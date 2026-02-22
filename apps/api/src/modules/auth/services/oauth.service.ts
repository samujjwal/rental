import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { TokenService } from './token.service';
import { UserRole, UserStatus } from '@rental-portal/database';

export interface OAuthProfile {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string;
}

export interface OAuthResult {
  user: any;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authenticate a user via OAuth (Google or Apple).
   * Creates a new user if one doesn't exist.
   */
  async authenticateOAuth(
    profile: OAuthProfile,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OAuthResult> {
    const { provider, providerId, email, firstName, lastName, profilePhotoUrl } = profile;
    const normalizedEmail = email.toLowerCase();

    // Look up by provider ID first
    const providerField = provider === 'google' ? 'googleId' : 'appleId';
    let user = await this.prisma.user.findFirst({
      where: { [providerField]: providerId },
    });

    let isNewUser = false;

    if (!user) {
      // Check if user exists by email
      user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (user) {
        // Link OAuth provider to existing account
        await this.prisma.user.update({
          where: { id: user.id },
          data: { [providerField]: providerId },
        });
      } else {
        // Create new user
        isNewUser = true;
        user = await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            username: normalizedEmail,
            firstName: firstName || '',
            lastName: lastName || '',
            profilePhotoUrl,
            [providerField]: providerId,
            emailVerified: true, // OAuth emails are pre-verified
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
          },
        });
      }
    }

    // Check if account is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Account is suspended');
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.tokenService.generateTokens(user);
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

    const { passwordHash, mfaSecret, ...sanitized } = user;

    return {
      user: sanitized,
      accessToken,
      refreshToken,
      isNewUser,
    };
  }

  /**
   * Verify a Google ID token and extract profile info.
   */
  async verifyGoogleToken(idToken: string): Promise<OAuthProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!response.ok) {
      throw new Error('Invalid Google token');
    }

    const payload = await response.json();

    // Verify audience
    if (clientId && payload.aud !== clientId) {
      throw new Error('Google token audience mismatch');
    }

    return {
      provider: 'google',
      providerId: payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      profilePhotoUrl: payload.picture,
    };
  }

  /**
   * Verify an Apple identity token.
   */
  async verifyAppleToken(identityToken: string, authorizationCode: string): Promise<OAuthProfile> {
    // Decode the JWT to extract claims (Apple tokens are JWTs)
    const parts = identityToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid Apple token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

    // Verify issuer
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new Error('Invalid Apple token issuer');
    }

    // Verify not expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Apple token expired');
    }

    return {
      provider: 'apple',
      providerId: payload.sub,
      email: payload.email,
      firstName: undefined, // Apple only provides name on first login
      lastName: undefined,
    };
  }
}
