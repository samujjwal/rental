import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  i18nBadRequest,
  i18nUnauthorized,
  i18nConflict,
} from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { User, UserRole, UserStatus } from '@rental-portal/database';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EmailService } from '@/common/email/email.service';
import { FieldEncryptionService } from '@/common/encryption/field-encryption.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { SmsService } from './sms.service';

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  phone?: string;
  dateOfBirth?: Date;
  role?: string;
}

export interface LoginDto {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash' | 'mfaSecret' | 'mfaBackupCodes' | 'governmentIdNumber' | 'passwordResetToken' | 'passwordResetExpires' | 'emailVerificationToken'>;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mfaService: MfaService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly smsService: SmsService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('emails') private readonly emailsQueue: Queue,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw i18nConflict('auth.emailTaken');
    }

    // Validate password strength
    const strengthCheck = this.passwordService.validateStrength(dto.password);
    if (!strengthCheck.isValid) {
      throw new BadRequestException(
        `Password too weak: ${strengthCheck.errors.join(', ')}`,
      );
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Map user-selected role to UserRole enum (default USER)
    const roleMap: Record<string, UserRole> = {
      owner: UserRole.HOST,
      host: UserRole.HOST,
      renter: UserRole.CUSTOMER,
    };
    const resolvedRole = (dto.role && roleMap[dto.role.toLowerCase()]) || UserRole.USER;

    // Create user, tokens, and session atomically
    const txResult = await this.prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          username: dto.email.toLowerCase(), // Use email as username
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          phone: dto.phone ?? dto.phoneNumber ?? null,
          dateOfBirth: dto.dateOfBirth,
          role: resolvedRole,
          status: process.env.NODE_ENV === 'development' ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
        },
      });

      // Generate tokens (limited-access until verified)
      const tokens = await this.tokenService.generateTokens(newUser);

      // Create session
      await this.tokenService.createSession(newUser.id, tokens.refreshToken, tokens.accessToken, {
        ipAddress: '',
        userAgent: '',
      }, tx);

      return { user: newUser, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }) as unknown as { user: User; accessToken: string; refreshToken: string };
    const { user, accessToken, refreshToken } = txResult;

    // Send verification email (non-blocking, outside transaction)
    this.emailsQueue.add('send-verification', { userId: user.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    }).catch((e) =>
      this.logger.error('Failed to queue verification email', e),
    );

    // Emit registration event for fraud detection and analytics
    this.eventEmitter.emit('user.registered', {
      userId: user.id,
      email: user.email,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw i18nUnauthorized('auth.invalidCredentials');
    }

    // Check account lock (6.4)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account is temporarily locked. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
      );
    }

    // Check status
    if (user.status !== UserStatus.ACTIVE) {
      throw i18nUnauthorized('auth.accountLocked');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      // Atomic increment of login attempts to prevent race conditions
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: { increment: 1 } },
        select: { loginAttempts: true },
      });

      // Lock after 5 failed attempts for 15 minutes
      if (updated.loginAttempts >= 5) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
            loginAttempts: 0,
          },
        });
      }

      throw i18nUnauthorized('auth.invalidCredentials');
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw i18nBadRequest('auth.mfaRequired');
      }

      // Try TOTP code first
      const isMfaValid = await this.mfaService.verifyToken(
        this.fieldEncryption.decrypt(user.mfaSecret!),
        dto.mfaCode,
      );

      if (!isMfaValid) {
        // Try backup code fallback
        const backupCodeUsed = await this.tryBackupCode(user.id, dto.mfaCode);
        if (!backupCodeUsed) {
          throw i18nUnauthorized('auth.mfaInvalid');
        }
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.tokenService.generateTokens(user);

    // Create session
    await this.tokenService.createSession(user.id, refreshToken, accessToken, {
      ipAddress,
      userAgent,
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async devLogin(
    options: { email?: string; role?: UserRole; secret?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv !== 'development') {
      throw i18nUnauthorized('auth.devLoginOnly');
    }

    // Additional guard: require DEV_LOGIN_SECRET when configured
    const devSecret = this.configService.get<string>('DEV_LOGIN_SECRET');
    if (devSecret && options.secret !== devSecret) {
      throw i18nUnauthorized('auth.devLoginOnly');
    }

    const normalizedEmail = options.email?.trim().toLowerCase();
    const requestedRole = options.role;
    const preferredRole = Object.values(UserRole).includes(requestedRole as UserRole)
      ? requestedRole
      : undefined;

    let user = normalizedEmail
      ? await this.prisma.user.findFirst({
          where: {
            email: normalizedEmail,
            status: UserStatus.ACTIVE,
            ...(preferredRole ? { role: preferredRole } : {}),
          },
        })
      : null;

    if (!user && preferredRole) {
      user = await this.prisma.user.findFirst({
        where: { role: preferredRole, status: UserStatus.ACTIVE },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { status: UserStatus.ACTIVE },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!user) {
      throw i18nUnauthorized('auth.noDevUser');
    }

    const { accessToken, refreshToken } = await this.tokenService.generateTokens(user);
    await this.tokenService.createSession(user.id, refreshToken, accessToken, {
      ipAddress,
      userAgent,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    // Use a transaction with optimistic locking to prevent race conditions
    // where multiple concurrent refresh requests could reuse the same token
    return this.prisma.$transaction(async (tx: any) => {
      const session = await tx.session.findUnique({
        where: { refreshToken },
        include: { user: true },
      });

      if (!session) {
        throw i18nUnauthorized('auth.invalidRefreshToken');
      }

      if (session.expiresAt < new Date()) {
        await tx.session.delete({ where: { id: session.id } });
        throw i18nUnauthorized('auth.refreshTokenExpired');
      }

      if (session.user.status !== UserStatus.ACTIVE) {
        throw i18nUnauthorized('auth.accountSuspended');
      }

      // Generate new tokens
      const tokens = await this.tokenService.generateTokens(session.user);

      // Atomically update session — ensures no other request can use the old refresh token
      const sessionExpiryDays = this.configService.get<number>('auth.sessionExpiryDays', 7);
      await tx.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + sessionExpiryDays * 24 * 60 * 60 * 1000),
        },
      });

      return {
        user: this.sanitizeUser(session.user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }) as unknown as AuthResponse;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    // Find the session to invalidate its cache before deleting
    const session = await this.prisma.session.findFirst({
      where: { userId, refreshToken },
      select: { token: true },
    });

    await this.prisma.session.deleteMany({
      where: {
        userId,
        refreshToken,
      },
    });

    // Invalidate cached user and session
    await this.cacheService.del(`user:${userId}`);
    if (session?.token) {
      await this.cacheService.del(`session:${userId}:${session.token.slice(-16)}`);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    await this.cacheService.del(`user:${userId}`);
    // Pattern-based cache invalidation for all sessions of this user
    await this.cacheService.delPattern(`session:${userId}:*`);
  }

  async validateSessionToken(userId: string, accessToken?: string | null): Promise<boolean> {
    if (!accessToken) {
      return false;
    }

    // Check Redis cache first (5-minute TTL) to avoid DB query on every request
    const cacheKey = `session:${userId}:${accessToken.slice(-16)}`;
    const cached = await this.cacheService.get<boolean>(cacheKey);
    if (cached === true) {
      return true;
    }

    const session = await this.prisma.session.findFirst({
      where: {
        userId,
        token: accessToken,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    const isValid = Boolean(session);
    if (isValid) {
      // Cache valid sessions for 5 minutes
      await this.cacheService.set(cacheKey, true, 300);
    }

    return isValid;
  }

  private stripSensitiveForCache(user: User): Partial<User> {
    const { passwordHash, mfaSecret, passwordResetToken, passwordResetExpires, emailVerificationToken, governmentIdNumber, ...safe } = user as Record<string, unknown>;
    return safe as Partial<User>;
  }

  async validateUser(userId: string): Promise<User | null> {
    // Try cache first
    const cached = await this.cacheService.get<User>(`user:${userId}`);
    if (cached) return cached;

    // Fetch from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user && user.status === UserStatus.ACTIVE) {
      // Cache sanitized user for 15 minutes (strip sensitive fields)
      await this.cacheService.set(`user:${userId}`, this.stripSensitiveForCache(user), 900);
      return user;
    }

    return null;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    const resetToken = await this.tokenService.generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: resetExpires,
      },
    });

    // Send the raw token to the user; only the hash is stored
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw i18nBadRequest('auth.invalidToken');
    }

    // Validate new password strength (parity with register & changePassword)
    const strengthCheck = this.passwordService.validateStrength(newPassword);
    if (!strengthCheck.isValid) {
      throw new BadRequestException(
        `Password too weak: ${strengthCheck.errors.join(', ')}`,
      );
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Logout all sessions
    await this.logoutAll(user.id);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nUnauthorized('auth.userNotFound');
    }

    const isPasswordValid = await this.passwordService.verify(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw i18nUnauthorized('auth.passwordIncorrect');
    }

    // Validate new password strength
    const strengthCheck = this.passwordService.validateStrength(newPassword);
    if (!strengthCheck.isValid) {
      throw new BadRequestException(
        `Password too weak: ${strengthCheck.errors.join(', ')}`,
      );
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Logout all other sessions
    await this.logoutAll(userId);
  }

  async enableMfa(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nBadRequest('auth.userNotFound');
    }

    if (user.mfaEnabled) {
      throw i18nBadRequest('auth.mfaAlreadyEnabled');
    }

    const { secret, qrCode } = await this.mfaService.generateSecret(user.email);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: this.fieldEncryption.encrypt(secret) },
    });

    return { secret, qrCode };
  }

  async verifyAndEnableMfa(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw i18nBadRequest('auth.mfaSetupNotInitiated');
    }

    const isValid = await this.mfaService.verifyToken(this.fieldEncryption.decrypt(user.mfaSecret), code);

    if (!isValid) {
      throw i18nBadRequest('auth.invalidVerificationCode');
    }

    // Generate backup codes and store hashed versions
    const backupCodes = this.mfaService.generateBackupCodes(10);
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => this.passwordService.hash(c)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: hashedCodes,
      },
    });

    // Return plaintext codes once — user must save them
    return { backupCodes };
  }

  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nBadRequest('auth.userNotFound');
    }

    const isPasswordValid = await this.passwordService.verify(password, user.passwordHash);

    if (!isPasswordValid) {
      throw i18nUnauthorized('auth.invalidPassword');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });
  }

  sanitizeUser(user: User): Omit<User, 'passwordHash' | 'mfaSecret' | 'mfaBackupCodes' | 'governmentIdNumber' | 'passwordResetToken' | 'passwordResetExpires' | 'emailVerificationToken'> {
    const {
      passwordHash,
      mfaSecret,
      mfaBackupCodes,
      governmentIdNumber,
      passwordResetToken,
      passwordResetExpires,
      emailVerificationToken,
      ...sanitized
    } = user;
    return sanitized;
  }

  /**
   * Try to use a backup code for MFA. If valid, the code is consumed (removed).
   * Returns true if a backup code matched and was consumed.
   */
  private async tryBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true },
    });

    if (!user?.mfaBackupCodes?.length) {
      return false;
    }

    for (let i = 0; i < user.mfaBackupCodes.length; i++) {
      const isMatch = await this.passwordService.verify(code.toUpperCase(), user.mfaBackupCodes[i]);
      if (isMatch) {
        // Remove the used backup code
        const remaining = [...user.mfaBackupCodes];
        remaining.splice(i, 1);
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: remaining },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Send verification email with token (6.3).
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw i18nBadRequest('auth.userNotFound');
    if (user.emailVerified) throw i18nBadRequest('auth.emailAlreadyVerified');

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerificationToken: tokenHash },
    });
    // Store expiry in cache — 24 hours
    await this.cacheService.set(`email-verify:${tokenHash}`, { userId, createdAt: Date.now() }, 24 * 60 * 60);

    const baseUrl = this.configService.get<string>('WEB_URL') || 'http://localhost:3401';
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`;

    await this.emailService.sendEmail(
      user.email,
      'Verify Your Email',
      `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Verify Your Email</h2>
          <p>Click the button below to verify your email address:</p>
          <a href="${verifyUrl}" style="display:inline-block; padding:12px 24px; background:#4A90D9; color:#fff; text-decoration:none; border-radius:8px;">
            Verify Email
          </a>
          <p style="margin-top:20px; color:#666;">If you didn't create an account, ignore this email.</p>
        </div>
      `,
    );
  }

  /**
   * Verify email using token (6.3).
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    // Check cache for expiry — token valid for 24h
    const cached = await this.cacheService.get(`email-verify:${tokenHash}`);
    if (!cached) {
      throw i18nBadRequest('auth.invalidToken');
    }

    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: tokenHash },
    });

    if (!user) {
      throw i18nBadRequest('auth.invalidToken');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        status: UserStatus.ACTIVE,
      },
    });

    // Clean up cache
    await this.cacheService.del(`email-verify:${tokenHash}`);

    return { message: 'Email verified successfully' };
  }

  /**
   * Send phone verification OTP (6.3).
   */
  async sendPhoneVerification(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw i18nBadRequest('auth.userNotFound');

    const phone = user.phone;
    if (!phone) throw i18nBadRequest('auth.noPhoneOnFile');
    if (user.phoneVerified) throw i18nBadRequest('auth.phoneAlreadyVerified');

    const otp = require('crypto').randomInt(100000, 999999).toString();
    await this.cacheService.set(`phone_verify:${userId}`, otp, 300); // 5 min

    // Send OTP via SMS (falls back to logging when Twilio is not configured)
    await this.smsService.sendOtp(phone, otp);

    return { message: 'Verification code sent to your phone' };
  }

  /**
   * Verify phone with OTP (6.3).
   */
  async verifyPhone(userId: string, code: string): Promise<{ message: string }> {
    const stored = await this.cacheService.get<string>(`phone_verify:${userId}`);
    if (!stored) throw i18nBadRequest('auth.codeExpired');

    // Timing-safe comparison to prevent timing attacks
    const storedBuf = Buffer.from(String(stored), 'utf8');
    const codeBuf = Buffer.from(String(code), 'utf8');
    if (storedBuf.length !== codeBuf.length || !crypto.timingSafeEqual(storedBuf, codeBuf)) {
      throw i18nBadRequest('auth.invalidVerificationCode');
    }

    await this.cacheService.del(`phone_verify:${userId}`);
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    });

    return { message: 'Phone verified successfully' };
  }
}
