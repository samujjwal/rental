import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService, OAuthProfile } from './oauth.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { ConfigService } from '@nestjs/config';

describe('OAuthService', () => {
  let service: OAuthService;
  let prisma: jest.Mocked<PrismaService>;
  let tokenService: jest.Mocked<TokenService>;
  let configService: jest.Mocked<ConfigService>;

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@gmail.com',
    firstName: 'Test',
    lastName: 'User',
    googleId: 'google-123',
    status: 'ACTIVE',
    role: 'USER',
    passwordHash: 'hashed',
    mfaSecret: 'secret',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokens: jest.fn().mockResolvedValue(mockTokens),
            createSession: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('google-client-id'),
          },
        },
        {
          provide: MfaService,
          useValue: {
            generateSecret: jest.fn().mockResolvedValue({ secret: 'test-secret', qrCode: 'test-qr' }),
            verifyToken: jest.fn().mockResolvedValue(true),
            enableMfa: jest.fn().mockResolvedValue(undefined),
            disableMfa: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(OAuthService);
    prisma = module.get(PrismaService);
    tokenService = module.get(TokenService);
    configService = module.get(ConfigService);
  });

  describe('authenticateOAuth', () => {
    const googleProfile: OAuthProfile = {
      provider: 'google',
      providerId: 'google-123',
      email: 'Test@Gmail.com',
      firstName: 'Test',
      lastName: 'User',
    };

    it('returns existing user found by provider ID', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.authenticateOAuth(googleProfile);

      expect(result.isNewUser).toBe(false);
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBe(mockTokens.refreshToken);
      expect(result.user.passwordHash).toBeUndefined();
      expect(result.user.mfaSecret).toBeUndefined();
    });

    it('links OAuth to existing email user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null); // no provider match
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser); // email match
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.authenticateOAuth(googleProfile);

      expect(result.isNewUser).toBe(false);
      // Should link googleId
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { googleId: 'google-123' },
      });
    });

    it('creates new user when no match found', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const newUser = { ...mockUser, id: 'new-user' };
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(newUser);

      const result = await service.authenticateOAuth(googleProfile);

      expect(result.isNewUser).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@gmail.com', // lowercased
          emailVerified: true,
          role: 'USER',
          status: 'ACTIVE',
          googleId: 'google-123',
        }),
      });
    });

    it('throws when user account is suspended', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(service.authenticateOAuth(googleProfile)).rejects.toThrow(
        'Account is suspended',
      );
    });

    it('handles Apple provider', async () => {
      const appleProfile: OAuthProfile = {
        provider: 'apple',
        providerId: 'apple-456',
        email: 'user@icloud.com',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const newUser = { ...mockUser, id: 'apple-user', status: 'ACTIVE' };
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(newUser);

      await service.authenticateOAuth(appleProfile);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appleId: 'apple-456',
        }),
      });
    });

    it('creates session with IP and user agent', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.authenticateOAuth(googleProfile, '1.2.3.4', 'Mozilla/5.0');

      expect(tokenService.createSession).toHaveBeenCalledWith(
        mockUser.id,
        mockTokens.refreshToken,
        mockTokens.accessToken,
        { ipAddress: '1.2.3.4', userAgent: 'Mozilla/5.0' },
      );
    });
  });

  describe('verifyGoogleToken', () => {
    it('throws for invalid token', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(service.verifyGoogleToken('bad-token')).rejects.toThrow(
        'Invalid Google token',
      );

      global.fetch = originalFetch;
    });

    it('returns profile for valid token', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: 'google-sub-123',
            email: 'test@gmail.com',
            given_name: 'Test',
            family_name: 'User',
            picture: 'https://photo.url',
            aud: 'google-client-id',
          }),
      });

      const profile = await service.verifyGoogleToken('valid-token');
      expect(profile.provider).toBe('google');
      expect(profile.providerId).toBe('google-sub-123');
      expect(profile.email).toBe('test@gmail.com');

      global.fetch = originalFetch;
    });

    it('throws on audience mismatch', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: 'google-sub-123',
            email: 'test@gmail.com',
            aud: 'wrong-client-id',
          }),
      });

      await expect(service.verifyGoogleToken('valid-token')).rejects.toThrow(
        'audience mismatch',
      );

      global.fetch = originalFetch;
    });
  });

  describe('verifyAppleToken', () => {
    const kid = 'test-kid-1';
    const makeAppleJWT = (payload: any, headerOverrides?: any) => {
      const header = Buffer.from(JSON.stringify({ kid, alg: 'RS256', ...headerOverrides })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${header}.${body}.fake-signature`;
    };

    let originalFetch: typeof global.fetch;
    let cryptoVerifySpy: jest.SpyInstance;

    beforeEach(() => {
      originalFetch = global.fetch;
      // Mock Apple JWKS endpoint to return a key matching our kid
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ kid, kty: 'RSA', n: 'test-n', e: 'AQAB', alg: 'RS256', use: 'sig' }],
          }),
      });

      // Mock crypto.verify to skip real RSA verification in tests
      const crypto = require('crypto');
      cryptoVerifySpy = jest.spyOn(crypto, 'verify').mockReturnValue(true);
      jest.spyOn(crypto, 'createPublicKey').mockReturnValue({} as any);
    });

    afterEach(() => {
      global.fetch = originalFetch;
      cryptoVerifySpy?.mockRestore();
      jest.restoreAllMocks();
    });

    it('throws for malformed JWT', async () => {
      await expect(service.verifyAppleToken('not-a-jwt', 'code')).rejects.toThrow();
    });

    it('throws when signing key not found', async () => {
      const token = makeAppleJWT({ iss: 'https://evil.com', sub: '1', email: 'a@b.com' }, { kid: 'unknown-kid' });
      await expect(service.verifyAppleToken(token, 'code')).rejects.toThrow('Apple token signing key not found');
    });

    it('throws for wrong issuer', async () => {
      const token = makeAppleJWT({ iss: 'https://evil.com', sub: '1', email: 'a@b.com' });
      await expect(service.verifyAppleToken(token, 'code')).rejects.toThrow('Invalid Apple token issuer');
    });

    it('throws for expired token', async () => {
      const token = makeAppleJWT({
        iss: 'https://appleid.apple.com',
        aud: 'google-client-id',
        sub: '1',
        email: 'a@b.com',
        exp: Math.floor(Date.now() / 1000) - 3600,
      });
      await expect(service.verifyAppleToken(token, 'code')).rejects.toThrow('Apple token expired');
    });

    it('throws when signature verification fails', async () => {
      cryptoVerifySpy.mockReturnValue(false);
      const token = makeAppleJWT({
        iss: 'https://appleid.apple.com',
        sub: '1',
        email: 'a@b.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      await expect(service.verifyAppleToken(token, 'code')).rejects.toThrow('Apple token signature verification failed');
    });

    it('returns profile for valid Apple token', async () => {
      const token = makeAppleJWT({
        iss: 'https://appleid.apple.com',
        aud: 'google-client-id',
        sub: 'apple-sub-123',
        email: 'user@icloud.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const profile = await service.verifyAppleToken(token, 'auth-code');
      expect(profile.provider).toBe('apple');
      expect(profile.providerId).toBe('apple-sub-123');
      expect(profile.email).toBe('user@icloud.com');
    });
  });
});
