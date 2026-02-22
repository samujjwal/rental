import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserRole, UserStatus } from '@rental-portal/database';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EmailService } from '@/common/email/email.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
}

export interface LoginDto {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash' | 'mfaSecret'>;
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
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.email.toLowerCase(), // Use email as username
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        dateOfBirth: dto.dateOfBirth,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.tokenService.generateTokens(user);

    // Create session
    await this.tokenService.createSession(user.id, refreshToken, accessToken, {
      ipAddress: '',
      userAgent: '',
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
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock (6.4)
    const userAny = user as any;
    if (userAny.lockedUntil && userAny.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (userAny.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account is temporarily locked. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
      );
    }

    // Check status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is suspended or banned');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment login attempts
      const newAttempts = ((user as any).loginAttempts || 0) + 1;
      const lockData: any = { loginAttempts: newAttempts };

      // Lock after 5 failed attempts for 15 minutes
      if (newAttempts >= 5) {
        lockData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        lockData.loginAttempts = 0;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: lockData,
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset login attempts on successful login
    if ((user as any).loginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null } as any,
      });
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new BadRequestException('MFA code required');
      }

      const isMfaValid = this.mfaService.verifyToken(user.mfaSecret!, dto.mfaCode);

      if (!isMfaValid) {
        throw new UnauthorizedException('Invalid MFA code');
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
    options: { email?: string; role?: UserRole },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv !== 'development') {
      throw new UnauthorizedException('Dev login is only available in development');
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
      throw new UnauthorizedException('No active user available for dev login');
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
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is suspended or banned');
    }

    // Generate new tokens
    const tokens = await this.tokenService.generateTokens(session.user);

    // Update session
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: this.sanitizeUser(session.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        userId,
        refreshToken,
      },
    });

    // Invalidate cached user
    await this.cacheService.del(`user:${userId}`);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    await this.cacheService.del(`user:${userId}`);
  }

  async validateSessionToken(userId: string, accessToken?: string | null): Promise<boolean> {
    if (!accessToken) {
      return false;
    }

    const session = await this.prisma.session.findFirst({
      where: {
        userId,
        token: accessToken,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return Boolean(session);
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
      // Cache for 15 minutes
      await this.cacheService.set(`user:${userId}`, user, 900);
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
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
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await this.passwordService.verify(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
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
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const { secret, qrCode } = await this.mfaService.generateSecret(user.email);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, qrCode };
  }

  async verifyAndEnableMfa(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }

    const isValid = this.mfaService.verifyToken(user.mfaSecret, code);

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
  }

  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await this.passwordService.verify(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash' | 'mfaSecret'> {
    const { passwordHash, mfaSecret, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Send verification email with token (6.3).
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.emailVerified) throw new BadRequestException('Email already verified');

    const token = require('crypto').randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerificationToken: token },
    });

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
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  /**
   * Send phone verification OTP (6.3).
   */
  async sendPhoneVerification(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const phone = user.phoneNumber || user.phone;
    if (!phone) throw new BadRequestException('No phone number on file');
    if (user.phoneVerified) throw new BadRequestException('Phone already verified');

    const otp = require('crypto').randomInt(100000, 999999).toString();
    await this.cacheService.set(`phone_verify:${userId}`, otp, 300); // 5 min

    // In production, integrate with Twilio/SNS. For now, log it.
    const logger = new (require('@nestjs/common').Logger)('PhoneVerification');
    logger.log(`Phone OTP for ${phone}: ${otp} (integrate SMS provider for production)`);

    return { message: 'Verification code sent to your phone' };
  }

  /**
   * Verify phone with OTP (6.3).
   */
  async verifyPhone(userId: string, code: string): Promise<{ message: string }> {
    const stored = await this.cacheService.get<string>(`phone_verify:${userId}`);
    if (!stored) throw new BadRequestException('Code expired. Request a new one.');
    if (stored !== code) throw new BadRequestException('Invalid verification code');

    await this.cacheService.del(`phone_verify:${userId}`);
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    });

    return { message: 'Phone verified successfully' };
  }
}
