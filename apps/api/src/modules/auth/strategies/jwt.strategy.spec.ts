import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../services/auth.service';

// Mock passport-jwt
jest.mock('passport-jwt', () => ({
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn(() => (req: any) => req?.headers?.authorization?.replace('Bearer ', '') || null),
    fromExtractors: jest.fn((fns: any[]) => (req: any) => {
      for (const fn of fns) {
        const result = fn(req);
        if (result) return result;
      }
      return null;
    }),
  },
  Strategy: class MockStrategy {
    constructor(opts: any, cb: any) {
      // Store options for inspection
    }
  },
}));

// Mock @nestjs/passport
jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (strategy: any) => {
    return class MockPassportStrategy {
      constructor() {}
    };
  },
}));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    authService = {
      validateUser: jest.fn(),
      validateSessionToken: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.secret') return 'test-secret';
        return undefined;
      }),
    } as any;

    strategy = new JwtStrategy(authService, configService);
  });

  it('is defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockReq = {
      headers: { authorization: 'Bearer valid-token' },
    } as any;

    const mockPayload = { sub: 'user-1', email: 'test@test.np', role: 'USER' } as any;
    const mockUser = { id: 'user-1', email: 'test@test.np', firstName: 'Ram' };

    it('returns user when valid user and active session', async () => {
      authService.validateUser.mockResolvedValue(mockUser as any);
      authService.validateSessionToken.mockResolvedValue(true);

      const result = await strategy.validate(mockReq, mockPayload);

      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith('user-1');
      expect(authService.validateSessionToken).toHaveBeenCalledWith('user-1', 'valid-token');
    });

    it('throws UnauthorizedException when user not found', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(mockReq, mockPayload))
        .rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockReq, mockPayload))
        .rejects.toThrow('User not found or inactive');
    });

    it('throws UnauthorizedException when session expired', async () => {
      authService.validateUser.mockResolvedValue(mockUser as any);
      authService.validateSessionToken.mockResolvedValue(false);

      await expect(strategy.validate(mockReq, mockPayload))
        .rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockReq, mockPayload))
        .rejects.toThrow('Session expired or invalidated');
    });
  });
});
