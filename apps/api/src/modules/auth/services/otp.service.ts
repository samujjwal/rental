import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EmailService } from '@/common/email/email.service';
import { TokenService } from './token.service';
import { UserStatus, UserRole } from '@rental-portal/database';
import * as crypto from 'crypto';

const OTP_TTL = 300; // 5 minutes
const OTP_RATE_LIMIT_KEY_PREFIX = 'otp_rate:';
const OTP_RATE_LIMIT_MAX = 3; // 3 requests per hour
const OTP_RATE_LIMIT_TTL = 3600; // 1 hour
const OTP_KEY_PREFIX = 'otp:';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generate a 6-digit OTP and send to user's email.
   */
  async requestOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit check
    const rateKey = `${OTP_RATE_LIMIT_KEY_PREFIX}${normalizedEmail}`;
    const rateCnt = await this.cacheService.get<number>(rateKey);
    if (rateCnt !== null && rateCnt >= OTP_RATE_LIMIT_MAX) {
      throw new HttpException(
        'Too many OTP requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Store in Redis with TTL
    const otpKey = `${OTP_KEY_PREFIX}${normalizedEmail}`;
    await this.cacheService.set(otpKey, { code: otp, attempts: 0 }, OTP_TTL);

    // Increment rate counter
    const newCount = (rateCnt || 0) + 1;
    await this.cacheService.set(rateKey, newCount, OTP_RATE_LIMIT_TTL);

    // Send email
    await this.emailService.sendEmail(
      normalizedEmail,
      'Your Login Code',
      `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Your Login Code</h2>
          <p>Use the following code to sign in:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px; background: #f4f4f4; text-align: center; border-radius: 8px;">
            ${otp}
          </div>
          <p>This code expires in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    );

    this.logger.log(`OTP sent to ${normalizedEmail}`);

    return { message: 'OTP sent to your email' };
  }

  /**
   * Verify OTP and return auth tokens.
   */
  async verifyOtp(
    email: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    const otpKey = `${OTP_KEY_PREFIX}${normalizedEmail}`;

    // Retrieve stored OTP
    const stored = await this.cacheService.get<{ code: string; attempts: number }>(otpKey);

    if (!stored) {
      throw new BadRequestException('OTP expired or not found. Please request a new one.');
    }

    // Check attempts
    if (stored.attempts >= 3) {
      await this.cacheService.del(otpKey);
      throw new UnauthorizedException('Too many incorrect attempts. Please request a new OTP.');
    }

    // Verify code
    if (stored.code !== code) {
      // Increment attempts
      await this.cacheService.set(
        otpKey,
        { ...stored, attempts: stored.attempts + 1 },
        OTP_TTL,
      );
      throw new UnauthorizedException('Invalid OTP code');
    }

    // OTP is valid — delete it
    await this.cacheService.del(otpKey);

    // Find or create user
    let isNewUser = false;
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedEmail,
          firstName: '',
          lastName: '',
          emailVerified: true,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is suspended');
    }

    // Mark email verified
    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    // Generate tokens
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

    const { passwordHash, mfaSecret, ...sanitized } = user;

    return {
      user: sanitized,
      accessToken,
      refreshToken,
      isNewUser,
    };
  }
}
