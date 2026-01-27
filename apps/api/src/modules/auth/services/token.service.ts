import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@rental-portal/database';
import { PrismaService } from '@/common/prisma/prisma.service';
import { randomBytes } from 'crypto';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.accessTokenExpiry'),
    });

    const refreshToken = this.generateRefreshToken();

    return { accessToken, refreshToken };
  }

  async createSession(
    userId: string,
    refreshToken: string,
    accessToken: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.session.create({
      data: {
        userId,
        token: accessToken,
        refreshToken,
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  }

  async generatePasswordResetToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  async generateEmailVerificationToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  verifyAccessToken(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token);
  }
}
