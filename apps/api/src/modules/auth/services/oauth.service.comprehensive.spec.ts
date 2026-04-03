import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService, OAuthProfile } from './oauth.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@rental-portal/database';
import * as crypto from 'crypto';

// Mock crypto for Apple token verification
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createPublicKey: jest.fn(),
  verify: jest.fn(),
}));

describe('OAuthService - Comprehensive Coverage', () => {
  let service: OAuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let tokenService: jest.Mocked<TokenService>;
  let mfaService: jest.Mocked<MfaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    emailVerified: true,
    firstName: 'Test',
    lastName: 'User',
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    mfaEnabled: false,
    googleId: null,
    appleId: null,
    passwordHash: 'hash',
    mfaSecret: null,
    mfaBackupCodes: [],
    profilePhotoUrl: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockTokenService = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      createSession: jest.fn().mockResolvedValue(undefined),
    };

    const mockMfaService = {
      verifyToken: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: MfaService, useValue: mockMfaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    tokenService = module.get(TokenService) as jest.Mocked<TokenService>;
    mfaService = module.get(MfaService) as jest.Mocked<MfaService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateOAuth - Security & Logic', () => {
    const googleProfile: OAuthProfile = {
      provider: 'google',
      providerId: 'google-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profilePhotoUrl: 'https://example.com/photo.jpg',
    };

    it('should create new user when no matching account exists', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: 'new-user-id',
        googleId: 'google-123',
      });

      const result = await service.authenticateOAuth(googleProfile, '127.0.0.1', 'test-agent');

      expect(result.isNewUser).toBe(true);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('mfaSecret');
      expect(result.user).not.toHaveProperty('mfaBackupCodes');
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          googleId: 'google-123',
          emailVerified: true,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        }),
      });
    });

    it('should link OAuth to existing user with same email', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue({ ...mockUser, googleId: 'google-123' });

      const result = await service.authenticateOAuth(googleProfile);

      expect(result.isNewUser).toBe(false);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { googleId: 'google-123' },
      });
    });

    it('should NOT link OAuth if user has MFA enabled', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        mfaEnabled: true,
      });

      await expect(service.authenticateOAuth(googleProfile)).rejects.toThrow();
    });

    it('should reject authentication for suspended accounts', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(service.authenticateOAuth(googleProfile)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should find user by provider ID first, not email', async () => {
      const existingOAuthUser = { ...mockUser, googleId: 'google-123' };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(existingOAuthUser);

      const result = await service.authenticateOAuth(googleProfile);

      expect(result.isNewUser).toBe(false);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase before lookup', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: 'new-id',
        email: 'TEST@EXAMPLE.COM',
      });

      await service.authenticateOAuth({
        ...googleProfile,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should create session with correct metadata', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({ ...mockUser, googleId: 'google-123' });

      await service.authenticateOAuth(googleProfile, '192.168.1.1', 'Mozilla/5.0');

      expect(tokenService.createSession).toHaveBeenCalledWith(
        'user-1',
        'refresh-token',
        'access-token',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      );
    });

    it('should update last login timestamp and IP', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({ ...mockUser, googleId: 'google-123' });
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.authenticateOAuth(googleProfile, '10.0.0.1', 'agent');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          lastLoginAt: expect.any(Date),
          lastLoginIp: '10.0.0.1',
        },
      });
    });

    it('should handle Apple provider correctly', async () => {
      const appleProfile: OAuthProfile = {
        provider: 'apple',
        providerId: 'apple-abc-123',
        email: 'apple@example.com',
      };

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: 'apple-user',
        appleId: 'apple-abc-123',
      });

      await service.authenticateOAuth(appleProfile);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appleId: 'apple-abc-123',
        }),
      });
    });

    it('should strip all sensitive fields from returned user', async () => {
      const userWithSensitiveData = {
        ...mockUser,
        passwordHash: 'secret-hash',
        mfaSecret: 'secret-key',
        mfaBackupCodes: ['code1', 'code2'],
        googleId: 'google-123',
      };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(userWithSensitiveData);

      const result = await service.authenticateOAuth(googleProfile);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('mfaSecret');
      expect(result.user).not.toHaveProperty('mfaBackupCodes');
      expect(result.user).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('verifyGoogleToken - Token Validation', () => {
    const mockIdToken = 'valid-google-token';

    beforeEach(() => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'google-client-id';
        return null;
      });
    });

    it('should validate token and extract profile', async () => {
      const mockPayload = {
        sub: 'google-user-123',
        email: 'google@example.com',
        given_name: 'Google',
        family_name: 'User',
        picture: 'https://google.com/photo.jpg',
        aud: 'google-client-id',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPayload),
      } as any);

      const result = await service.verifyGoogleToken(mockIdToken);

      expect(result).toEqual({
        provider: 'google',
        providerId: 'google-user-123',
        email: 'google@example.com',
        firstName: 'Google',
        lastName: 'User',
        profilePhotoUrl: 'https://google.com/photo.jpg',
      });
    });

    it('should reject when GOOGLE_CLIENT_ID is not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue(null);

      await expect(service.verifyGoogleToken(mockIdToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject invalid token from Google API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      await expect(service.verifyGoogleToken(mockIdToken)).rejects.toThrow();
    });

    it('should reject token with mismatched audience', async () => {
      const mockPayload = {
        sub: 'google-user-123',
        email: 'google@example.com',
        aud: 'different-client-id',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPayload),
      } as any);

      await expect(service.verifyGoogleToken(mockIdToken)).rejects.toThrow();
    });

    it('should URL-encode the token to prevent injection', async () => {
      const maliciousToken = 'token\nwith\nnewlines<>&"';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sub: '123',
          email: 'test@test.com',
          aud: 'google-client-id',
        }),
      } as any);

      await service.verifyGoogleToken(maliciousToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(maliciousToken)),
      );
    });
  });

  describe('verifyAppleToken - JWT Signature Validation', () => {
    const mockAuthCode = 'auth-code';

    beforeEach(() => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'APPLE_CLIENT_ID') return 'com.example.app';
        return null;
      });
    });

    it('should reject malformed JWT (not 3 parts)', async () => {
      await expect(
        service.verifyAppleToken('invalid.token', mockAuthCode),
      ).rejects.toThrow();
    });

    it('should verify signature and extract profile', async () => {
      const header = { kid: 'key-123', alg: 'RS256' };
      const payload = {
        sub: 'apple-user-123',
        email: 'apple@example.com',
        iss: 'https://appleid.apple.com',
        aud: 'com.example.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockJwks = {
        keys: [{
          kid: 'key-123',
          kty: 'RSA',
          n: 'mock-n',
          e: 'AQAB',
        }],
      };

      (crypto.createPublicKey as jest.Mock).mockReturnValue({});
      (crypto.verify as jest.Mock).mockReturnValue(true);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockJwks),
      } as any);

      const token = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

      const result = await service.verifyAppleToken(token, mockAuthCode);

      expect(result.provider).toBe('apple');
      expect(result.providerId).toBe('apple-user-123');
    });

    it('should reject invalid signature', async () => {
      const header = { kid: 'key-123', alg: 'RS256' };
      const payload = {
        sub: 'user',
        email: 'test@test.com',
        iss: 'https://appleid.apple.com',
        aud: 'com.example.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockJwks = {
        keys: [{ kid: 'key-123', kty: 'RSA', n: 'mock-n', e: 'AQAB' }],
      };

      (crypto.createPublicKey as jest.Mock).mockReturnValue({});
      (crypto.verify as jest.Mock).mockReturnValue(false);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockJwks),
      } as any);

      const token = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

      await expect(service.verifyAppleToken(token, mockAuthCode)).rejects.toThrow();
    });

    it('should reject expired token', async () => {
      const header = { kid: 'key-123', alg: 'RS256' };
      const payload = {
        sub: 'user',
        email: 'test@test.com',
        iss: 'https://appleid.apple.com',
        aud: 'com.example.app',
        exp: Math.floor(Date.now() / 1000) - 3600,
      };

      const mockJwks = {
        keys: [{ kid: 'key-123', kty: 'RSA', n: 'mock-n', e: 'AQAB' }],
      };

      (crypto.createPublicKey as jest.Mock).mockReturnValue({});
      (crypto.verify as jest.Mock).mockReturnValue(true);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockJwks),
      } as any);

      const token = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

      await expect(service.verifyAppleToken(token, mockAuthCode)).rejects.toThrow();
    });

    it('should reject wrong audience', async () => {
      const header = { kid: 'key-123', alg: 'RS256' };
      const payload = {
        sub: 'user',
        email: 'test@test.com',
        iss: 'https://appleid.apple.com',
        aud: 'com.different.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockJwks = {
        keys: [{ kid: 'key-123', kty: 'RSA', n: 'mock-n', e: 'AQAB' }],
      };

      (crypto.createPublicKey as jest.Mock).mockReturnValue({});
      (crypto.verify as jest.Mock).mockReturnValue(true);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockJwks),
      } as any);

      const token = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

      await expect(service.verifyAppleToken(token, mockAuthCode)).rejects.toThrow();
    });
  });

  describe('Edge Cases & Security', () => {
    it('should handle email with special characters', async () => {
      const profile: OAuthProfile = {
        provider: 'google',
        providerId: 'google-special',
        email: 'user+tag@example.com',
        firstName: 'User',
        lastName: 'Test',
      };

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: 'special-id',
        email: 'user+tag@example.com',
        googleId: 'google-special',
      });

      const result = await service.authenticateOAuth(profile);

      expect(result.user.email).toBe('user+tag@example.com');
    });

    it('should handle missing user agent gracefully', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({ ...mockUser, googleId: 'google-123' });

      await service.authenticateOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
      }, '127.0.0.1', undefined);

      expect(tokenService.createSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        {
          ipAddress: '127.0.0.1',
          userAgent: undefined,
        },
      );
    });
  });
});
