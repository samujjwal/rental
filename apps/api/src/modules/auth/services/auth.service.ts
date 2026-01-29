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
        password: dto.password, // Add password field
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        dateOfBirth: dto.dateOfBirth,
        role: UserRole.CUSTOMER,
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

    // Check status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is suspended or banned');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
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
}
