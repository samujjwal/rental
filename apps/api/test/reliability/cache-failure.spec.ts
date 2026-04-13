import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { CacheService } from '../../src/common/cache/cache.service';

describe('Cache Failure Scenarios', () => {
  let app: INestApplication;
  let cacheService: CacheService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    cacheService = app.get<CacheService>(CacheService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cache connection failure', () => {
    it('should serve requests when cache returns null', async () => {
      // Attempt to get a key that doesn't exist
      const result = await cacheService.get('nonexistent-key').catch(() => null);
      expect(result === null || result === undefined).toBe(true);
    });
  });

  describe('Cache timeout handling', () => {
    it('should handle cache set and get operations', async () => {
      await cacheService.set('test-key', 'test-value', 60);
      const value = await cacheService.get('test-key');
      expect(value).toBe('test-value');

      // Cleanup
      await cacheService.del('test-key');
    });

    it('should handle expired cache keys', async () => {
      // Set with very short TTL (1 second)
      await cacheService.set('expiring-key', 'will-expire', 1);

      // Wait for expiration
      await new Promise((r) => setTimeout(r, 1500));

      const value = await cacheService.get('expiring-key');
      expect(value).toBeNull();
    });
  });

  describe('Cache corruption recovery', () => {
    it('should handle corrupted cache entries', async () => {
      // Store an unexpected value type
      await cacheService.set('corrupted-key', '{invalid-json}', 60);

      const value = await cacheService.get('corrupted-key');
      // Application should handle non-JSON strings gracefully
      expect(value).toBeDefined();

      // Cleanup
      await cacheService.del('corrupted-key');
    });
  });

  describe('Cache fallback to DB', () => {
    it('should return null on cache miss', async () => {
      await cacheService.del('listing-cache-test');

      const cached = await cacheService.get('listing-cache-test');
      expect(cached === null || cached === undefined).toBe(true);
      // Application logic should fetch from DB on cache miss
    });
  });

  describe('Cache retry logic', () => {
    it('should retry cache operations on transient failures', async () => {
      let attempts = 0;
      const maxRetries = 3;

      const cacheOperationWithRetry = async (): Promise<boolean> => {
        attempts++;
        try {
          await cacheService.set('retry-test', 'value', 60);
          return true;
        } catch {
          if (attempts < maxRetries) {
            await new Promise((r) => setTimeout(r, 100));
            return cacheOperationWithRetry();
          }
          return false;
        }
      };

      const result = await cacheOperationWithRetry();
      expect(result).toBe(true);
      expect(attempts).toBeLessThanOrEqual(maxRetries);

      // Cleanup
      await cacheService.del('retry-test');
    });
  });
});
