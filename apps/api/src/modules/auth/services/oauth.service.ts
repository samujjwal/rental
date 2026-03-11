import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { i18nUnauthorized, i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { UserRole, UserStatus } from '@rental-portal/database';
import * as crypto from 'crypto';

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
    private readonly mfaService: MfaService,
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
      throw i18nUnauthorized('auth.accountSuspended');
    }

    // MFA enforcement: OAuth login must not bypass MFA for existing users with MFA enabled.
    // New users created via OAuth cannot have MFA enabled yet, so skip for isNewUser.
    if (!isNewUser && user.mfaEnabled) {
      // OAuth does not supply an MFA code in the same request.
      // Signal the client to re-present with an MFA code via password login flow.
      throw i18nBadRequest('auth.mfaRequired');
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

    // Explicitly strip all sensitive fields — mfaBackupCodes must not be returned to clients
    const { passwordHash, mfaSecret, mfaBackupCodes, ...sanitized } = user;

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

    if (!clientId) {
      throw i18nUnauthorized('auth.googleNotConfigured');
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!response.ok) {
      throw i18nUnauthorized('auth.invalidGoogleToken');
    }

    const payload = await response.json();

    // Verify audience
    if (payload.aud !== clientId) {
      throw i18nUnauthorized('auth.googleAudienceMismatch');
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
      throw i18nUnauthorized('auth.appleInvalidFormat');
    }

    // Fetch Apple's public keys and verify the JWT signature
    try {
      const jwksResponse = await fetch('https://appleid.apple.com/auth/keys');
      if (!jwksResponse.ok) {
        throw i18nUnauthorized('auth.appleKeysFetchFailed');
      }
      const jwks = await jwksResponse.json();

      // Decode header to get the key ID
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));
      const key = jwks.keys?.find((k: any) => k.kid === header.kid);
      if (!key) {
        throw i18nUnauthorized('auth.appleKeyNotFound');
      }

      // Verify signature using the public key
      const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
      const signatureValid = crypto.verify(
        header.alg === 'RS256' ? 'RSA-SHA256' : 'RSA-SHA256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        publicKey,
        Buffer.from(parts[2], 'base64url'),
      );
      if (!signatureValid) {
        throw i18nUnauthorized('auth.appleSignatureFailed');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn('Apple token signature verification failed', error);
      throw i18nUnauthorized('auth.appleVerificationFailed');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

    // Verify issuer
    if (payload.iss !== 'https://appleid.apple.com') {
      throw i18nUnauthorized('auth.appleInvalidIssuer');
    }

    // Verify audience (client ID) — prevents cross-app token reuse
    const appleClientId = this.config.get<string>('APPLE_CLIENT_ID');
    if (!appleClientId) {
      throw i18nUnauthorized('auth.appleNotConfigured');
    }
    if (payload.aud !== appleClientId) {
      throw i18nUnauthorized('auth.appleAudienceMismatch');
    }

    // Verify not expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw i18nUnauthorized('auth.appleTokenExpired');
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
