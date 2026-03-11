import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  EmailVerifiedGuard,
  REQUIRE_EMAIL_VERIFICATION_KEY,
  SKIP_EMAIL_VERIFICATION_KEY,
} from './email-verified.guard';

describe('EmailVerifiedGuard', () => {
  let guard: EmailVerifiedGuard;
  let reflector: Reflector;

  const createContext = (user?: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new EmailVerifiedGuard(reflector);
  });

  it('should allow access when @RequireEmailVerification is not set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext({ emailVerified: false }))).toBe(true);
  });

  it('should allow access when email is verified', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRE_EMAIL_VERIFICATION_KEY) return true;
        return undefined;
      });
    expect(guard.canActivate(createContext({ emailVerified: true }))).toBe(true);
  });

  it('should deny access when email is not verified', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRE_EMAIL_VERIFICATION_KEY) return true;
        return undefined;
      });
    expect(() =>
      guard.canActivate(createContext({ emailVerified: false })),
    ).toThrow(ForbiddenException);
  });

  it('should allow access when @SkipEmailVerification is set', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRE_EMAIL_VERIFICATION_KEY) return true;
        if (key === SKIP_EMAIL_VERIFICATION_KEY) return true;
        return undefined;
      });
    expect(guard.canActivate(createContext({ emailVerified: false }))).toBe(true);
  });

  it('should allow access when no user is on request', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRE_EMAIL_VERIFICATION_KEY) return true;
        return undefined;
      });
    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('should include helpful message in error', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRE_EMAIL_VERIFICATION_KEY) return true;
        return undefined;
      });
    try {
      guard.canActivate(createContext({ emailVerified: false }));
      fail('Expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toContain('Email verification required');
    }
  });
});
