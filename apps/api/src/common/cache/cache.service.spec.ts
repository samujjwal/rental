import { CacheService } from './cache.service';

// Mock ioredis
const mockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
  incrby: jest.fn(),
  expire: jest.fn(),
  hset: jest.fn(),
  hget: jest.fn(),
  hgetall: jest.fn(),
  hdel: jest.fn(),
  zadd: jest.fn(),
  zrange: jest.fn(),
  zrem: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis());
});

describe('CacheService', () => {
  let service: CacheService;
  let redis: ReturnType<typeof mockRedis>;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        const map: Record<string, any> = {
          'redis.host': 'localhost',
          'redis.port': 6379,
          'redis.password': undefined,
          'redis.ttl': 3600,
        };
        return map[key] ?? defaultVal;
      }),
    };

    service = new CacheService(configService as any);

    // Access the private redis instance via getClient()
    redis = service.getClient() as any;
  });

  /* ---- get / set / del ---- */

  it('get returns parsed JSON on hit', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ name: 'Ram' }));
    const result = await service.get<{ name: string }>('user:1');
    expect(result).toEqual({ name: 'Ram' });
    expect(redis.get).toHaveBeenCalledWith('user:1');
  });

  it('get returns null on miss', async () => {
    redis.get.mockResolvedValue(null);
    expect(await service.get('missing')).toBeNull();
  });

  it('get returns null on error', async () => {
    redis.get.mockRejectedValue(new Error('conn'));
    expect(await service.get('fail')).toBeNull();
  });

  it('set uses SETEX with default TTL', async () => {
    await service.set('k', { a: 1 });
    expect(redis.setex).toHaveBeenCalledWith('k', 3600, JSON.stringify({ a: 1 }));
  });

  it('set uses custom TTL when provided', async () => {
    await service.set('k', 'v', 60);
    expect(redis.setex).toHaveBeenCalledWith('k', 60, JSON.stringify('v'));
  });

  it('set swallows errors', async () => {
    redis.setex.mockRejectedValue(new Error('fail'));
    await expect(service.set('k', 'v')).resolves.toBeUndefined();
  });

  it('del removes key', async () => {
    await service.del('k');
    expect(redis.del).toHaveBeenCalledWith('k');
  });

  it('del swallows errors', async () => {
    redis.del.mockRejectedValue(new Error('fail'));
    await expect(service.del('k')).resolves.toBeUndefined();
  });

  /* ---- delPattern ---- */

  it('delPattern deletes matching keys', async () => {
    redis.keys.mockResolvedValue(['user:1', 'user:2']);
    await service.delPattern('user:*');
    expect(redis.del).toHaveBeenCalledWith('user:1', 'user:2');
  });

  it('delPattern no-ops when no keys match', async () => {
    redis.keys.mockResolvedValue([]);
    await service.delPattern('empty:*');
    expect(redis.del).not.toHaveBeenCalled();
  });

  /* ---- exists ---- */

  it('exists returns true when key exists', async () => {
    redis.exists.mockResolvedValue(1);
    expect(await service.exists('k')).toBe(true);
  });

  it('exists returns false when key missing', async () => {
    redis.exists.mockResolvedValue(0);
    expect(await service.exists('miss')).toBe(false);
  });

  it('exists returns false on error', async () => {
    redis.exists.mockRejectedValue(new Error('fail'));
    expect(await service.exists('fail')).toBe(false);
  });

  /* ---- increment ---- */

  it('increment returns new value', async () => {
    redis.incrby.mockResolvedValue(5);
    expect(await service.increment('counter', 2)).toBe(5);
    expect(redis.incrby).toHaveBeenCalledWith('counter', 2);
  });

  it('increment defaults to by=1', async () => {
    redis.incrby.mockResolvedValue(1);
    await service.increment('c');
    expect(redis.incrby).toHaveBeenCalledWith('c', 1);
  });

  it('increment returns 0 on error', async () => {
    redis.incrby.mockRejectedValue(new Error('fail'));
    expect(await service.increment('fail')).toBe(0);
  });

  /* ---- expire ---- */

  it('expire sets TTL', async () => {
    await service.expire('k', 120);
    expect(redis.expire).toHaveBeenCalledWith('k', 120);
  });

  /* ---- hash operations ---- */

  it('hset stores JSON-serialized value', async () => {
    await service.hset('hash', 'field', { x: 1 });
    expect(redis.hset).toHaveBeenCalledWith('hash', 'field', JSON.stringify({ x: 1 }));
  });

  it('hget returns parsed value', async () => {
    redis.hget.mockResolvedValue(JSON.stringify(42));
    expect(await service.hget('hash', 'field')).toBe(42);
  });

  it('hget returns null for missing field', async () => {
    redis.hget.mockResolvedValue(null);
    expect(await service.hget('hash', 'nope')).toBeNull();
  });

  it('hgetall returns parsed record', async () => {
    redis.hgetall.mockResolvedValue({ a: JSON.stringify(1), b: JSON.stringify(2) });
    expect(await service.hgetall('hash')).toEqual({ a: 1, b: 2 });
  });

  it('hgetall returns empty on error', async () => {
    redis.hgetall.mockRejectedValue(new Error('fail'));
    expect(await service.hgetall('hash')).toEqual({});
  });

  it('hdel removes hash field', async () => {
    await service.hdel('hash', 'field');
    expect(redis.hdel).toHaveBeenCalledWith('hash', 'field');
  });

  /* ---- sorted set operations ---- */

  it('zadd adds member with score', async () => {
    await service.zadd('leaderboard', 100, 'player1');
    expect(redis.zadd).toHaveBeenCalledWith('leaderboard', 100, 'player1');
  });

  it('zrange returns members', async () => {
    redis.zrange.mockResolvedValue(['a', 'b']);
    expect(await service.zrange('zset', 0, -1)).toEqual(['a', 'b']);
  });

  it('zrange returns empty array on error', async () => {
    redis.zrange.mockRejectedValue(new Error('fail'));
    expect(await service.zrange('zset', 0, 10)).toEqual([]);
  });

  it('zrem removes member', async () => {
    await service.zrem('zset', 'member');
    expect(redis.zrem).toHaveBeenCalledWith('zset', 'member');
  });

  /* ---- pub / sub ---- */

  it('publish serializes and publishes', async () => {
    const pub = service.getPubClient() as any;
    pub.publish = jest.fn();
    await service.publish('ch', { event: 'test' });
    expect(pub.publish).toHaveBeenCalledWith('ch', JSON.stringify({ event: 'test' }));
  });

  /* ---- onModuleDestroy ---- */

  it('onModuleDestroy quits all clients', async () => {
    await service.onModuleDestroy();
    expect(redis.quit).toHaveBeenCalled();
  });

  /* ---- Circuit Breaker ---- */

  describe('circuit breaker', () => {
    it('should start in CLOSED state', () => {
      expect(service.getCircuitState()).toBe('CLOSED');
    });

    it('should transition to OPEN after 5 consecutive failures', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection lost'));

      // Trigger 5 failures (failureThreshold = 5)
      for (let i = 0; i < 5; i++) {
        await service.get(`key-${i}`);
      }

      expect(service.getCircuitState()).toBe('OPEN');
    });

    it('should return null for get when circuit is OPEN', async () => {
      // Force circuit open by triggering 5 failures
      redis.get.mockRejectedValue(new Error('Redis down'));
      for (let i = 0; i < 5; i++) {
        await service.get(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('OPEN');

      // Now configure redis to succeed — but circuit is open, so it shouldn't be called
      redis.get.mockResolvedValue(JSON.stringify({ data: 'cached' }));
      jest.clearAllMocks(); // Clear call counts

      const result = await service.get('test-key');
      expect(result).toBeNull();
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('should return false for exists when circuit is OPEN', async () => {
      redis.exists.mockRejectedValue(new Error('Redis down'));
      for (let i = 0; i < 5; i++) {
        await service.exists(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('OPEN');

      redis.exists.mockResolvedValue(1);
      jest.clearAllMocks();

      const result = await service.exists('test-key');
      expect(result).toBe(false);
      expect(redis.exists).not.toHaveBeenCalled();
    });

    it('should transition from OPEN to HALF_OPEN after reset timeout', async () => {
      redis.get.mockRejectedValue(new Error('Redis down'));
      for (let i = 0; i < 5; i++) {
        await service.get(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('OPEN');

      // Advance time past the reset timeout (30 seconds)
      const realDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(realDateNow() + 31_000);

      redis.get.mockResolvedValue(JSON.stringify({ data: 'recovered' }));
      const result = await service.get('test-key');

      expect(service.getCircuitState()).not.toBe('OPEN');
      expect(result).toEqual({ data: 'recovered' });

      // Restore Date.now
      Date.now = realDateNow;
    });

    it('should transition from HALF_OPEN back to OPEN on failure', async () => {
      // Force OPEN
      redis.get.mockRejectedValue(new Error('Redis down'));
      for (let i = 0; i < 5; i++) {
        await service.get(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('OPEN');

      // Advance time to trigger HALF_OPEN
      const realDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(realDateNow() + 31_000);

      // Fail again in HALF_OPEN → should go back to OPEN
      redis.get.mockRejectedValue(new Error('Still broken'));
      await service.get('test-key');

      expect(service.getCircuitState()).toBe('OPEN');

      Date.now = realDateNow;
    });

    it('should transition from HALF_OPEN to CLOSED after enough successes', async () => {
      // Force OPEN
      redis.get.mockRejectedValue(new Error('Redis down'));
      for (let i = 0; i < 5; i++) {
        await service.get(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('OPEN');

      // Advance time to trigger HALF_OPEN
      const realDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(realDateNow() + 31_000);

      // Succeed enough times in HALF_OPEN (halfOpenMaxAttempts = 2)
      redis.get.mockResolvedValue(JSON.stringify('ok'));
      await service.get('key-1');
      await service.get('key-2');

      expect(service.getCircuitState()).toBe('CLOSED');

      Date.now = realDateNow;
    });

    it('should reset failure count on successful operation in CLOSED state', async () => {
      // Trigger some failures (but less than threshold)
      redis.get.mockRejectedValue(new Error('transient'));
      for (let i = 0; i < 3; i++) {
        await service.get(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('CLOSED'); // Still closed (< 5)

      // Succeed — should reset failure count
      redis.get.mockResolvedValue(JSON.stringify('data'));
      await service.get('key-ok');

      // Now 5 more failures should be needed (not 2)
      redis.get.mockRejectedValue(new Error('fail again'));
      for (let i = 0; i < 4; i++) {
        await service.get(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('CLOSED'); // Still not open (4 < 5)
    });

    it('should not call Redis set when circuit is OPEN', async () => {
      // Force circuit open
      redis.setex.mockRejectedValue(new Error('Redis down'));
      redis.get.mockRejectedValue(new Error('Redis down'));
      for (let i = 0; i < 5; i++) {
        await service.get(`key-${i}`);
      }
      expect(service.getCircuitState()).toBe('OPEN');

      jest.clearAllMocks();
      await service.set('key', 'value');
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });
});
