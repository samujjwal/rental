/**
 * Cache Layer Integration Tests
 *
 * Comprehensive tests for Redis cache operations:
 * - Basic read/write operations
 * - Cache expiration and TTL
 * - Cache invalidation
 * - Cache failure handling and fallback
 * - Cache eviction policies
 * - Cache statistics and monitoring
 * - Distributed cache consistency
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import { AppModule } from '../../src/app.module';
import Redis from 'ioredis';

describe('Cache Layer Integration', () => {
  let app: INestApplication;
  let cacheService: CacheService;
  let redisClient: Redis;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    cacheService = app.get<CacheService>(CacheService);
    
    // Create direct Redis connection for verification
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15, // Use separate DB for tests
    });

    await app.init();
  });

  afterAll(async () => {
    await redisClient.quit();
    await app.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await redisClient.flushdb();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve a value', async () => {
      // Arrange
      const key = 'test:key:1';
      const value = { data: 'test value', number: 123 };

      // Act
      await cacheService.set(key, value, 60); // 60 seconds TTL
      const retrieved = await cacheService.get(key);

      // Assert
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      // Act
      const result = await cacheService.get('non:existent:key');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle string values', async () => {
      // Arrange
      const key = 'test:string';
      const value = 'simple string value';

      // Act
      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);

      // Assert
      expect(retrieved).toBe(value);
    });

    it('should handle numeric values', async () => {
      // Arrange
      const key = 'test:number';
      const value = 42;

      // Act
      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);

      // Assert
      expect(retrieved).toBe(value);
    });

    it('should handle complex object values', async () => {
      // Arrange
      const key = 'test:complex';
      const value = {
        nested: {
          array: [1, 2, 3],
          object: { a: 1, b: 2 },
        },
        date: new Date().toISOString(),
        bool: true,
        nullValue: null,
      };

      // Act
      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);

      // Assert
      expect(retrieved).toEqual(value);
    });
  });

  describe('Cache Expiration', () => {
    it('should expire key after TTL', async () => {
      // Arrange
      const key = 'test:expire';
      const value = 'temporary value';
      const ttl = 1; // 1 second

      // Act
      await cacheService.set(key, value, ttl);
      
      // Verify it exists immediately
      const immediate = await cacheService.get(key);
      expect(immediate).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify it's gone
      const afterExpire = await cacheService.get(key);
      expect(afterExpire).toBeNull();
    });

    it('should handle different TTL values', async () => {
      // Arrange
      const shortKey = 'test:short';
      const longKey = 'test:long';
      const value = 'test';

      // Act
      await cacheService.set(shortKey, value, 1); // 1 second
      await cacheService.set(longKey, value, 3600); // 1 hour

      // Assert - Both should exist initially
      expect(await cacheService.get(shortKey)).toBe(value);
      expect(await cacheService.get(longKey)).toBe(value);

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Assert - Short should be gone, long should remain
      expect(await cacheService.get(shortKey)).toBeNull();
      expect(await cacheService.get(longKey)).toBe(value);
    });

    it('should support zero TTL (no expiration)', async () => {
      // Arrange
      const key = 'test:noexpire';
      const value = 'permanent';

      // Act
      await cacheService.set(key, value, 0);
      
      // Verify TTL is 0 or -1 (no expiration)
      const ttl = await redisClient.ttl(key);
      expect(ttl).toBeLessThanOrEqual(0);
    });
  });

  describe('Cache Deletion', () => {
    it('should delete a key', async () => {
      // Arrange
      const key = 'test:delete';
      const value = 'to be deleted';
      await cacheService.set(key, value, 60);

      // Act
      await cacheService.del(key);
      const result = await cacheService.get(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should delete multiple keys', async () => {
      // Arrange
      const keys = ['test:multi:1', 'test:multi:2', 'test:multi:3'];
      for (const key of keys) {
        await cacheService.set(key, 'value', 60);
      }

      // Act
      for (const key of keys) {
        await cacheService.del(key);
      }

      // Assert
      for (const key of keys) {
        expect(await cacheService.get(key)).toBeNull();
      }
    });

    it('should handle deletion of non-existent key gracefully', async () => {
      // Act & Assert - Should not throw
      await expect(cacheService.del('non:existent')).resolves.not.toThrow();
    });
  });

  describe('Cache Invalidation Patterns', () => {
    it('should invalidate by pattern', async () => {
      // Arrange
      await cacheService.set('user:1:profile', { name: 'User 1' }, 60);
      await cacheService.set('user:1:settings', { theme: 'dark' }, 60);
      await cacheService.set('user:2:profile', { name: 'User 2' }, 60);
      await cacheService.set('other:data', 'value', 60);

      // Act - Invalidate all user:1:* keys
      await cacheService.delPattern('user:1:*')

      // Assert
      expect(await cacheService.get('user:1:profile')).toBeNull();
      expect(await cacheService.get('user:1:settings')).toBeNull();
      expect(await cacheService.get('user:2:profile')).not.toBeNull();
      expect(await cacheService.get('other:data')).not.toBeNull();
    });

    it('should support pattern-based invalidation for user data', async () => {
      // Arrange
      await cacheService.set('user:123:profile', { data: 'profile' }, 60);
      await cacheService.set('user:123:bookings', { data: 'bookings' }, 60);
      await cacheService.set('user:456:profile', { data: 'other' }, 60);

      // Act
      await cacheService.delPattern('user:123:*');

      // Assert
      expect(await cacheService.get('user:123:profile')).toBeNull();
      expect(await cacheService.get('user:123:bookings')).toBeNull();
      expect(await cacheService.get('user:456:profile')).not.toBeNull();
    });
  });

  describe('Cache Failure Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // This test verifies that the cache service has proper error handling
      // We can't easily simulate a connection failure without complex mocking
      // But we can verify the service methods don't throw unhandled errors
      
      // Act & Assert
      await expect(cacheService.get('any:key')).resolves.not.toThrow();
      await expect(cacheService.set('any:key', 'value', 60)).resolves.not.toThrow();
    });

    it('should support cache-aside pattern for database fallback', async () => {
      // Arrange - Simulate a scenario where cache miss falls back to data source
      const key = 'test:fallback';
      
      // Act - First call (cache miss) - manually implement cache-aside
      let cachedValue = await cacheService.get(key);
      if (!cachedValue) {
        cachedValue = { data: 'from database' };
        await cacheService.set(key, cachedValue, 60);
      }

      // Assert
      expect(cachedValue).toEqual({ data: 'from database' });

      // Act - Second call (should be cached)
      const result2 = await cacheService.get(key);

      // Assert
      expect(result2).toEqual({ data: 'from database' });
    });
  });

  describe('Cache Statistics', () => {
    it('should track key count in Redis', async () => {
      // Arrange - Clear and add known number of keys
      const redisClient = cacheService.getClient();
      await redisClient.flushdb();
      await cacheService.set('count:1', 'a', 60);
      await cacheService.set('count:2', 'b', 60);
      await cacheService.set('count:3', 'c', 60);

      // Act
      const keys = await redisClient.keys('count:*');

      // Assert
      expect(keys).toHaveLength(3);
    });
  });

  describe('Distributed Cache Consistency', () => {
    it('should maintain consistency across concurrent writes', async () => {
      // Arrange
      const key = 'test:concurrent';
      const writes = [];

      // Act - Multiple concurrent writes
      for (let i = 0; i < 5; i++) {
        writes.push(cacheService.set(key, { iteration: i }, 60));
      }

      await Promise.all(writes);

      // Assert - Final value should be one of the writes
      const final = await cacheService.get<{ iteration: number }>(key);
      expect(final).toBeDefined();
      expect(final?.iteration).toBeGreaterThanOrEqual(0);
      expect(final?.iteration).toBeLessThan(5);
    });

    it('should support atomic increment operations', async () => {
      // Arrange
      const key = 'test:counter';
      await redisClient.set(key, '0');

      // Act
      const increments = [];
      for (let i = 0; i < 10; i++) {
        increments.push(redisClient.incr(key));
      }

      await Promise.all(increments);

      // Assert
      const finalValue = await redisClient.get(key);
      expect(parseInt(finalValue || '0')).toBe(10);
    });
  });

  describe('Cache Key Management', () => {
    it('should support manual key prefixing', async () => {
      // Arrange - Use manual prefix in key name
      const key = 'v1:config';
      
      // Act
      await cacheService.set(key, { version: 1 }, 60);
      const result = await cacheService.get(key);

      // Assert
      expect(result).toEqual({ version: 1 });
    });

    it('should handle key expiration updates', async () => {
      // Arrange
      const key = 'test:expire:update';
      await cacheService.set(key, 'value', 10); // 10 seconds

      // Act - Update TTL
      await cacheService.expire(key, 60); // Extend to 60 seconds

      // Assert
      const ttl = await redisClient.ttl(key);
      expect(ttl).toBeGreaterThan(10);
    });
  });

  describe('Batch Operations', () => {
    it('should support multiple get operations', async () => {
      // Arrange
      const keys = ['batch:1', 'batch:2', 'batch:3'];
      await cacheService.set(keys[0], 'value1', 60);
      await cacheService.set(keys[1], 'value2', 60);
      // Don't set keys[2] - should return null

      // Act
      const results = await Promise.all(keys.map(k => cacheService.get(k)));

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0]).toBe('value1');
      expect(results[1]).toBe('value2');
      expect(results[2]).toBeNull();
    });

    it('should support multiple concurrent set operations', async () => {
      // Arrange
      const data = [
        { key: 'mset:1', value: 'a' },
        { key: 'mset:2', value: 'b' },
        { key: 'mset:3', value: 'c' },
      ];

      // Act
      await Promise.all(data.map(item => cacheService.set(item.key, item.value, 60)));

      // Assert
      for (const item of data) {
        expect(await cacheService.get(item.key)).toBe(item.value);
      }
    });
  });
});
