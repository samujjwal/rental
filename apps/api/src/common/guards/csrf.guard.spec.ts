import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: jest.Mocked<Reflector>;
  let configService: jest.Mocked<ConfigService>;

  function createContext(overrides: {
    method?: string;
    origin?: string;
    referer?: string;
    authorization?: string;
    xRequestedWith?: string;
  }): ExecutionContext {
    const headers: Record<string, string | undefined> = {
      origin: overrides.origin,
      referer: overrides.referer,
      authorization: overrides.authorization,
      'x-requested-with': overrides.xRequestedWith,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: overrides.method || 'POST',
          headers,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any as ExecutionContext;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3401,https://app.gharbatai.com'),
    } as any;

    // Default to non-production
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGINS = '';

    guard = new CsrfGuard(reflector, configService);
  });

  describe('safe methods', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('should allow %s requests', (method) => {
      const ctx = createContext({ method });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('SkipCsrf decorator', () => {
    it('should skip guard when @SkipCsrf() is applied', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const ctx = createContext({ method: 'POST' });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('Bearer token bypass', () => {
    it('should allow POST with Bearer token (CSRF-immune)', () => {
      const ctx = createContext({
        method: 'POST',
        authorization: 'Bearer eyJhbGciOi...',
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('Origin checking', () => {
    it('should allow requests from allowed origin', () => {
      const ctx = createContext({
        method: 'POST',
        origin: 'http://localhost:3401',
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should reject requests from disallowed origin', () => {
      const ctx = createContext({
        method: 'POST',
        origin: 'https://evil.com',
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('development mode (no origin)', () => {
    it('should allow requests without Origin in non-production', () => {
      process.env.NODE_ENV = 'development';
      guard = new CsrfGuard(reflector, configService);
      const ctx = createContext({ method: 'POST' });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      guard = new CsrfGuard(reflector, configService);
    });

    it('should reject POST without Origin, Bearer, or X-Requested-With', () => {
      const ctx = createContext({ method: 'POST' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow POST with X-Requested-With: XMLHttpRequest', () => {
      const ctx = createContext({
        method: 'POST',
        xRequestedWith: 'XMLHttpRequest',
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should reject POST with bad Referer', () => {
      const ctx = createContext({
        method: 'POST',
        referer: 'https://evil.com/page',
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow POST with matching Referer', () => {
      const ctx = createContext({
        method: 'POST',
        referer: 'http://localhost:3401/some-page',
      });
      // This should pass since referer matches an allowed origin
      // But without Origin or Bearer, production still requires X-Requested-With
      // unless referer check succeeds first (guard logic passes through)
      // Actually looking at the code: referer mismatch throws, but matching referer falls through
      // Then production requires xRequestedWith. So we need it here too:
      const ctxWithXhr = createContext({
        method: 'POST',
        referer: 'http://localhost:3401/some-page',
        xRequestedWith: 'XMLHttpRequest',
      });
      expect(guard.canActivate(ctxWithXhr)).toBe(true);
    });
  });

  describe('wildcard CORS_ORIGINS', () => {
    it('should allow any origin when CORS_ORIGINS is *', () => {
      process.env.CORS_ORIGINS = '*';
      guard = new CsrfGuard(reflector, configService);
      const ctx = createContext({
        method: 'POST',
        origin: 'https://anywhere.example.com',
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
