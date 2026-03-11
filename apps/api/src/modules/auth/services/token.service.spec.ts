import { TokenService } from './token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '@rental-portal/database';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: any;

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
    role: UserRole.USER,
  };

  beforeEach(() => {
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
      verify: jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'RENTER',
      }),
    } as any;

    prisma = {
      session: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const configService = {
      get: jest.fn().mockReturnValue('1h'),
    } as unknown as ConfigService;

    service = new TokenService(jwtService, prisma, configService);
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const result = await service.generateTokens(mockUser as User);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBe(128); // 64 bytes → 128 hex chars
    });

    it('should sign with correct payload', async () => {
      await service.generateTokens(mockUser as User);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          email: 'test@example.com',
          role: UserRole.USER,
        }),
        expect.objectContaining({
          expiresIn: '1h',
        }),
      );
    });
  });

  describe('createSession', () => {
    it('should create a session in the database', async () => {
      await service.createSession('user-123', 'refresh-tok', 'access-tok', {
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          token: 'access-tok',
          refreshToken: 'refresh-tok',
          ipAddress: '1.2.3.4',
          userAgent: 'test-agent',
        }),
      });
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should return a hex string', async () => {
      const token = await service.generatePasswordResetToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes → 64 hex chars
    });
  });

  describe('generateEmailVerificationToken', () => {
    it('should return a hex string', async () => {
      const token = await service.generateEmailVerificationToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and return the payload', () => {
      const payload = service.verifyAccessToken('some-token');
      expect(payload.sub).toBe('user-123');
      expect(jwtService.verify).toHaveBeenCalledWith('some-token');
    });
  });
});
