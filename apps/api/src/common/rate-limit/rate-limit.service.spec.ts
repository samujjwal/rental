import { RateLimitService } from './rate-limit.service';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    multi: jest.fn().mockReturnValue({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 3], // zcard — 3 existing requests
        [null, 1], // zadd
        [null, 1], // expire
      ]),
    }),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    zcard: jest.fn().mockResolvedValue(5),
  }));
});

describe('RateLimitService', () => {
  let service: RateLimitService;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    service = new RateLimitService(configService);
  });

  describe('getUserRateLimitKey', () => {
    it('should generate user key with endpoint', () => {
      const key = service.getUserRateLimitKey('user-1', 'GET:/api/test');
      expect(key).toBe('ratelimit:user:user-1:GET:/api/test');
    });

    it('should generate user key without endpoint', () => {
      const key = service.getUserRateLimitKey('user-1');
      expect(key).toBe('ratelimit:user:user-1');
    });
  });

  describe('getIpRateLimitKey', () => {
    it('should generate IP key with endpoint', () => {
      const key = service.getIpRateLimitKey('192.168.1.1', 'POST:/api/auth/login');
      expect(key).toBe('ratelimit:ip:192.168.1.1:POST:/api/auth/login');
    });

    it('should generate IP key without endpoint', () => {
      const key = service.getIpRateLimitKey('192.168.1.1');
      expect(key).toBe('ratelimit:ip:192.168.1.1');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', async () => {
      const result = await service.checkRateLimit('test-key', {
        maxRequests: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(6); // 10 - 3 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should deny requests when limit exceeded', async () => {
      // Override the redis mock to return count >= maxRequests
      const mockRedis = (service as any).redis;
      mockRedis.multi.mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 10], // at limit
          [null, 1],
          [null, 1],
        ]),
      });

      const result = await service.checkRateLimit('test-key', {
        maxRequests: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('blockUser', () => {
    it('should block user in Redis', async () => {
      await service.blockUser('user-1', 300000);

      const mockRedis = (service as any).redis;
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'ratelimit:blocked:user:user-1',
        300,
        '1'
      );
    });
  });

  describe('blockIp', () => {
    it('should block IP in Redis', async () => {
      await service.blockIp('1.2.3.4', 600000);

      const mockRedis = (service as any).redis;
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'ratelimit:blocked:ip:1.2.3.4',
        600,
        '1'
      );
    });
  });

  describe('isUserBlocked', () => {
    it('should return false when user is not blocked', async () => {
      const result = await service.isUserBlocked('user-1');
      expect(result).toBe(false);
    });

    it('should return true when user is blocked', async () => {
      const mockRedis = (service as any).redis;
      mockRedis.get.mockResolvedValue('1');

      const result = await service.isUserBlocked('blocked-user');
      expect(result).toBe(true);
    });
  });

  describe('isIpBlocked', () => {
    it('should return false when IP is not blocked', async () => {
      const result = await service.isIpBlocked('10.0.0.1');
      expect(result).toBe(false);
    });

    it('should return true when IP is blocked', async () => {
      const mockRedis = (service as any).redis;
      mockRedis.get.mockResolvedValue('1');

      const result = await service.isIpBlocked('bad-ip');
      expect(result).toBe(true);
    });
  });

  describe('clearRateLimit', () => {
    it('should delete the key from Redis', async () => {
      await service.clearRateLimit('test-key');

      const mockRedis = (service as any).redis;
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('getRemainingRequests', () => {
    it('should return remaining requests', async () => {
      const result = await service.getRemainingRequests('test-key', 10);
      expect(result).toBe(5); // 10 - 5
    });
  });

  describe('without Redis', () => {
    it('should gracefully handle all operations', async () => {
      const noRedisConfig = { get: jest.fn().mockReturnValue(null) };
      const noRedisService = new RateLimitService(noRedisConfig as any);

      const result = await noRedisService.checkRateLimit('key', { maxRequests: 10, windowMs: 60000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);

      expect(await noRedisService.isUserBlocked('u1')).toBe(false);
      expect(await noRedisService.isIpBlocked('ip')).toBe(false);
      expect(await noRedisService.getRemainingRequests('key', 10)).toBe(10);

      // These should not throw
      await noRedisService.blockUser('u1', 1000);
      await noRedisService.blockIp('ip', 1000);
      await noRedisService.clearRateLimit('key');
    });
  });
});
