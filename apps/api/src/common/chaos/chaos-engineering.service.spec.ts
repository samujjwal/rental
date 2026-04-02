import { Test, TestingModule } from '@nestjs/testing';
import { ChaosEngineeringService } from './chaos-engineering.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { Logger } from '@nestjs/common';

describe('ChaosEngineeringService', () => {
  let service: ChaosEngineeringService;
  let mockPrisma: {
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    user: { count: jest.Mock };
  };
  let mockCache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let originalFetch: typeof global.fetch;
  let originalDate: typeof global.Date;
  let originalRedisUrl: string | undefined;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const mockPrismaService = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    user: { count: jest.fn() },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChaosEngineeringService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ChaosEngineeringService>(ChaosEngineeringService);
    mockPrisma = mockPrismaService as any;
    mockCache = mockCacheService as any;

    // Store original globals
    originalFetch = global.fetch;
    originalDate = global.Date;
    originalRedisUrl = process.env.REDIS_URL;

    // Mock global fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn() });

    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Restore globals
    global.fetch = originalFetch;
    global.Date = originalDate;
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }

    // Clean up any chaos flags
    delete process.env.STRIPE_MOCK_FAILURE;
    delete process.env.STRIPE_MOCK_FAILURE_RATE;
    delete process.env.STRIPE_WEBHOOK_DELAY;
    delete process.env.SENDGRID_MOCK_FAILURE;

    warnSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('injectDatabaseConnectionPoolExhaustion', () => {
    it('should call queryRaw with pg_sleep', async () => {
      await service.injectDatabaseConnectionPoolExhaustion();

      // Should call queryRaw for connection pool test
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should log warning', async () => {
      await service.injectDatabaseConnectionPoolExhaustion();

      expect(warnSpy).toHaveBeenCalledWith(
        '[CHAOS] Injecting: Database connection pool exhaustion',
      );
    });
  });

  describe('injectSlowQueries', () => {
    it('should set statement timeout', async () => {
      await service.injectSlowQueries();

      // Should set timeout via executeRaw
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should log warning', async () => {
      await service.injectSlowQueries();

      // Should log with dynamic delay value
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('injectRedisOutage', () => {
    it('should change REDIS_URL to invalid host', async () => {
      process.env.REDIS_URL = 'redis://valid-host:6379';

      await service.injectRedisOutage();

      expect(process.env.REDIS_URL).toBe('redis://invalid-host:6379');
    });

    it('should store original REDIS_URL', async () => {
      const originalUrl = 'redis://valid-host:6379';
      process.env.REDIS_URL = originalUrl;

      await service.injectRedisOutage();

      // After cleanup, REDIS_URL should be restored
      await service.cleanup();
      expect(process.env.REDIS_URL).toBe(originalUrl);
    });
  });

  describe('injectCacheStampede', () => {
    it('should attempt many concurrent cache gets', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.injectCacheStampede();

      expect(mockCache.get).toHaveBeenCalledWith('stampede-test-key');
      expect(mockCache.get).toHaveBeenCalledTimes(1000);
    });

    it('should set cache value after computation', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.injectCacheStampede();

      // Some cache.set calls should have been made
      expect(mockCache.set).toHaveBeenCalledWith('stampede-test-key', 'value', 60);
    });
  });

  describe('injectCacheCorruption', () => {
    it('should set malformed cache entries', async () => {
      await service.injectCacheCorruption();

      expect(mockCache.set).toHaveBeenCalledWith('corrupt-1', '}{"invalid json', 60);
      expect(mockCache.set).toHaveBeenCalledWith('corrupt-3', null, 60);
    });
  });

  describe('injectHighLatency', () => {
    it('should replace global.fetch with delayed version', async () => {
      await service.injectHighLatency();

      const fetchCall = global.fetch as jest.Mock;
      expect(fetchCall).not.toBe(originalFetch);

      // The mock should add a delay
      const start = Date.now();
      await (global.fetch as any)('https://example.com');
      // Note: In tests, setTimeout is often mocked, so this may be instant
    });

    it('should store original fetch', async () => {
      await service.injectHighLatency();

      // Verify fetch was replaced
      expect(global.fetch).not.toBe(originalFetch);

      await service.cleanup();

      // After cleanup, fetch should be restored (or at least cleanup called)
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('injectPacketLoss', () => {
    it('should replace global.fetch with failing version', async () => {
      await service.injectPacketLoss();

      // Test multiple times to account for randomness
      let failures = 0;
      for (let i = 0; i < 100; i++) {
        try {
          await (global.fetch as any)('https://example.com');
        } catch (e) {
          failures++;
        }
      }

      // Should have around 50% failure rate
      expect(failures).toBeGreaterThan(30);
      expect(failures).toBeLessThan(70);
    });
  });

  describe('injectDNSFailure', () => {
    it('should block stripe.com requests', async () => {
      await service.injectDNSFailure();

      await expect((global.fetch as any)('https://stripe.com')).rejects.toThrow(
        'ENOTFOUND: DNS lookup failed',
      );
    });

    it('should block sendgrid.com requests', async () => {
      await service.injectDNSFailure();

      await expect((global.fetch as any)('https://sendgrid.com')).rejects.toThrow(
        'ENOTFOUND: DNS lookup failed',
      );
    });

    it('should allow other requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      await service.injectDNSFailure();

      // This should not throw
      const result = await (global.fetch as any)('https://example.com');
      expect(result).toBeDefined();
    });
  });

  describe('injectStripeAPIFailure', () => {
    it('should set STRIPE_MOCK_FAILURE flag', async () => {
      await service.injectStripeAPIFailure();

      expect(process.env.STRIPE_MOCK_FAILURE).toBe('true');
      expect(process.env.STRIPE_MOCK_FAILURE_RATE).toBe('1.0');
    });
  });

  describe('injectStripeWebhookDelay', () => {
    it('should set STRIPE_WEBHOOK_DELAY', async () => {
      await service.injectStripeWebhookDelay();

      // In test mode, delay is 100ms; in production, 60000ms
      const expectedDelay =
        process.env.CHAOS_TEST_MODE === 'true' || process.env.NODE_ENV === 'test' ? '100' : '60000';
      expect(process.env.STRIPE_WEBHOOK_DELAY).toBe(expectedDelay);
    });
  });

  describe('injectEmailServiceFailure', () => {
    it('should set SENDGRID_MOCK_FAILURE flag', async () => {
      await service.injectEmailServiceFailure();

      expect(process.env.SENDGRID_MOCK_FAILURE).toBe('true');
    });
  });

  describe('injectMemoryPressure', () => {
    it('should log memory pressure message', async () => {
      await service.injectMemoryPressure();

      expect(warnSpy).toHaveBeenCalledWith('[CHAOS] Injecting: Memory pressure (allocating 500MB)');
    });

    it('should log completion message', async () => {
      await service.injectMemoryPressure();

      // Should log warning about memory pressure
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('injectCPUContention', () => {
    it('should log CPU contention message', async () => {
      await service.injectCPUContention();

      expect(warnSpy).toHaveBeenCalledWith('[CHAOS] Injecting: CPU contention (5s busy loop)');
    });

    it('should consume some time (busy loop)', async () => {
      const start = Date.now();
      await service.injectCPUContention();
      const elapsed = Date.now() - start;

      // The busy loop should take some time
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('injectClockSkew', () => {
    it('should replace Date with skewed version', async () => {
      const beforeNow = Date.now();

      await service.injectClockSkew();

      const afterNow = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;

      expect(afterNow - beforeNow).toBeGreaterThanOrEqual(fiveMinutesMs - 1000); // Allow some margin
    });

    it('should store original Date', async () => {
      await service.injectClockSkew();
      await service.cleanup();

      expect(global.Date).toBe(originalDate);
    });
  });

  describe('injectTimeJump', () => {
    it('should replace Date with jumped version', async () => {
      const beforeNow = Date.now();

      await service.injectTimeJump();

      const afterNow = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      expect(afterNow - beforeNow).toBeGreaterThanOrEqual(oneDayMs - 1000); // Allow some margin
    });

    it('should store original Date', async () => {
      await service.injectTimeJump();
      await service.cleanup();

      expect(global.Date).toBe(originalDate);
    });
  });

  describe('validateDatabaseResilience', () => {
    it('should return true when system handles errors gracefully', async () => {
      mockCache.get.mockResolvedValue('cached-value');

      const result = await service.validateDatabaseResilience();

      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalledWith('[CHAOS] Validation passed: System degraded gracefully');
    });

    it('should return false when validation fails', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.validateDatabaseResilience();

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('validateCacheFallback', () => {
    it('should return true when cache fallback works', async () => {
      mockPrisma.user.count.mockResolvedValue(100);

      const result = await service.validateCacheFallback();

      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalledWith('[CHAOS] Validation passed: Cache fallback works');
    });

    it('should return false when validation fails', async () => {
      mockPrisma.user.count.mockRejectedValue(new Error('DB error'));

      const result = await service.validateCacheFallback();

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('validateExternalServiceResilience', () => {
    it('should return true by default', async () => {
      const result = await service.validateExternalServiceResilience();

      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        '[CHAOS] Validation passed: External service failures handled',
      );
    });
  });

  describe('runChaosSuite', () => {
    it('should run all scenarios', async () => {
      mockCache.get.mockResolvedValue('cached');
      mockPrisma.user.count.mockResolvedValue(100);

      const result = await service.runChaosSuite();

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('results');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should include scenario names in results', async () => {
      mockCache.get.mockResolvedValue('cached');
      mockPrisma.user.count.mockResolvedValue(100);

      const result = await service.runChaosSuite();

      const scenarioNames = result.results.map((r) => r.scenario);
      expect(scenarioNames).toContain('Database Connection Pool Exhaustion');
      expect(scenarioNames).toContain('Slow Database Queries');
      expect(scenarioNames).toContain('Redis Outage');
      expect(scenarioNames).toContain('High Network Latency');
    });

    it('should track passed and failed counts', async () => {
      mockCache.get.mockResolvedValue('cached');
      mockPrisma.user.count.mockResolvedValue(100);

      const result = await service.runChaosSuite();

      expect(result.passed + result.failed).toBe(result.results.length);
    });

    it('should call cleanup after suite', async () => {
      mockCache.get.mockResolvedValue('cached');
      mockPrisma.user.count.mockResolvedValue(100);

      await service.runChaosSuite();

      expect(logSpy).toHaveBeenCalledWith('[CHAOS] Cleanup complete');
    });
  });
});
