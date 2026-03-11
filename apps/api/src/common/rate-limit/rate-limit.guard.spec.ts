import { RateLimitGuard } from './rate-limit.guard';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let rateLimitService: any;
  let reflector: any;

  const createMockContext = (user?: any, ip = '127.0.0.1', method = 'GET', path = '/api/test') => {
    const request = {
      user,
      ip,
      method,
      route: { path },
      url: path,
    };
    const headers: Record<string, any> = {};
    const response = {
      setHeader: jest.fn((key: string, val: any) => { headers[key] = val; }),
    };
    return {
      context: {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as any,
      request,
      response,
      headers,
    };
  };

  beforeEach(() => {
    rateLimitService = {
      isUserBlocked: jest.fn().mockResolvedValue(false),
      isIpBlocked: jest.fn().mockResolvedValue(false),
      getUserRateLimitKey: jest.fn().mockReturnValue('ratelimit:user:u1:GET:/api/test'),
      getIpRateLimitKey: jest.fn().mockReturnValue('ratelimit:ip:127.0.0.1:GET:/api/test'),
      checkRateLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000,
      }),
      blockUser: jest.fn().mockResolvedValue(undefined),
      blockIp: jest.fn().mockResolvedValue(undefined),
    };

    reflector = {
      get: jest.fn(),
    };

    guard = new RateLimitGuard(rateLimitService, reflector);
  });

  it('should allow access when no rate limit config is set', async () => {
    reflector.get.mockReturnValue(undefined);
    const { context } = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when within rate limit', async () => {
    reflector.get.mockReturnValue({ maxRequests: 10, windowMs: 60000 });
    const { context } = createMockContext({ id: 'u1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should set rate limit headers on response', async () => {
    reflector.get.mockReturnValue({ maxRequests: 10, windowMs: 60000 });
    const { context, response } = createMockContext({ id: 'u1' });

    await guard.canActivate(context);

    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('should throw 429 when rate limit exceeded', async () => {
    reflector.get.mockReturnValue({ maxRequests: 10, windowMs: 60000 });
    rateLimitService.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    });
    const { context } = createMockContext({ id: 'u1' });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(context);
    } catch (e: any) {
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('should block user when rate limit exceeded with blockDuration', async () => {
    reflector.get.mockReturnValue({ maxRequests: 5, windowMs: 60000, blockDurationMs: 300000 });
    rateLimitService.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    });
    const { context } = createMockContext({ id: 'u1' });

    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(rateLimitService.blockUser).toHaveBeenCalledWith('u1', 300000);
  });

  it('should block IP when rate limit exceeded for anonymous users', async () => {
    reflector.get.mockReturnValue({ maxRequests: 5, windowMs: 60000, blockDurationMs: 300000 });
    rateLimitService.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    });
    const { context } = createMockContext(undefined, '1.2.3.4');

    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(rateLimitService.blockIp).toHaveBeenCalledWith('1.2.3.4', 300000);
  });

  it('should reject blocked users immediately', async () => {
    reflector.get.mockReturnValue({ maxRequests: 10, windowMs: 60000 });
    rateLimitService.isUserBlocked.mockResolvedValue(true);
    const { context } = createMockContext({ id: 'u1' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Your account has been temporarily blocked'
    );
  });

  it('should reject blocked IPs immediately', async () => {
    reflector.get.mockReturnValue({ maxRequests: 10, windowMs: 60000 });
    rateLimitService.isIpBlocked.mockResolvedValue(true);
    const { context } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Too many requests from this IP address'
    );
  });

  it('should use user key for authenticated requests', async () => {
    reflector.get.mockReturnValue({ maxRequests: 10, windowMs: 60000 });
    const { context } = createMockContext({ id: 'u1' });

    await guard.canActivate(context);

    expect(rateLimitService.getUserRateLimitKey).toHaveBeenCalledWith('u1', 'GET:/api/test');
  });

  it('should use IP key for anonymous requests', async () => {
    reflector.get.mockReturnValue({ maxRequests: 10, windowMs: 60000 });
    const { context } = createMockContext(undefined, '10.0.0.1');

    await guard.canActivate(context);

    expect(rateLimitService.getIpRateLimitKey).toHaveBeenCalledWith('10.0.0.1', 'GET:/api/test');
  });
});
