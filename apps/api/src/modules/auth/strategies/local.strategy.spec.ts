import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../services/auth.service';

jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (strategy: any) => {
    return class MockPassportStrategy {
      constructor() {}
    };
  },
}));

jest.mock('passport-local', () => ({
  Strategy: class MockStrategy {},
}));

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    authService = {
      login: jest.fn(),
    } as any;

    strategy = new LocalStrategy(authService);
  });

  it('is defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('returns user on successful login', async () => {
      const mockUser = { id: 'u1', email: 'test@test.np', firstName: 'Ram' };
      authService.login.mockResolvedValue({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
      } as any);

      const result = await strategy.validate('test@test.np', 'password123');

      expect(result).toEqual(mockUser);
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@test.np',
        password: 'password123',
      });
    });

    it('throws UnauthorizedException when login returns null', async () => {
      authService.login.mockResolvedValue(null as any);

      await expect(strategy.validate('bad@test.np', 'wrong'))
        .rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate('bad@test.np', 'wrong'))
        .rejects.toThrow('Invalid credentials');
    });

    it('passes email and password to authService.login', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'u1' },
        accessToken: 'at',
        refreshToken: 'rt',
      } as any);

      await strategy.validate('user@example.com', 'mypassword');

      expect(authService.login).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'mypassword',
      });
    });
  });
});
