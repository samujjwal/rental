import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../src/common/cache/cache.service';
import { CacheModule } from '../../src/common/cache/cache.module';
import { ConfigModule } from '@nestjs/config';

describe('Cache Integration', () => {
  let cacheService: CacheService;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        CacheModule,
      ],
    }).compile();

    cacheService = moduleFixture.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  describe('Basic cache operations', () => {
    it('should set and get a string value', async () => {
      await cacheService.set('test:string', 'hello', 60);
      const result = await cacheService.get('test:string');
      expect(result).toBe('hello');
    });

    it('should set and get a JSON object', async () => {
      const data = { id: 'listing-1', title: 'Test', price: 1000 };
      await cacheService.set('test:json', JSON.stringify(data), 60);
      const result = await cacheService.get('test:json');
      expect(JSON.parse(result as string)).toEqual(data);
    });

    it('should delete a key', async () => {
      await cacheService.set('test:delete', 'value', 60);
      await cacheService.del('test:delete');
      const result = await cacheService.get('test:delete');
      expect(result).toBeNull();
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('test:nonexistent:' + Date.now());
      expect(result).toBeNull();
    });
  });

  describe('Cache TTL', () => {
    it('should expire keys after TTL', async () => {
      await cacheService.set('test:ttl', 'expiring', 1); // 1 second TTL
      const before = await cacheService.get('test:ttl');
      expect(before).toBe('expiring');

      // Wait for expiration
      await new Promise((r) => setTimeout(r, 1500));
      const after = await cacheService.get('test:ttl');
      expect(after).toBeNull();
    });
  });

  describe('Cache invalidation patterns', () => {
    it('should invalidate specific cache entries', async () => {
      await cacheService.set('listing:1', 'data1', 300);
      await cacheService.set('listing:2', 'data2', 300);

      // Delete one listing cache
      await cacheService.del('listing:1');
      expect(await cacheService.get('listing:1')).toBeNull();
      expect(await cacheService.get('listing:2')).toBe('data2');

      // Cleanup
      await cacheService.del('listing:2');
    });
  });

  describe('Cache fallback behavior', () => {
    it('should handle cache miss gracefully and allow fallback', async () => {
      const key = 'test:fallback:' + Date.now();
      const cached = await cacheService.get(key);

      if (cached === null) {
        // Simulate DB fallback
        const dbResult = 'from-database';
        await cacheService.set(key, dbResult, 300);
        const afterSet = await cacheService.get(key);
        expect(afterSet).toBe('from-database');
      }

      // Cleanup
      await cacheService.del(key);
    });
  });

  describe('Pub/Sub', () => {
    it('should publish messages to channels', async () => {
      // publish should not throw
      await expect(
        cacheService.publish('test:channel', { event: 'test', data: 'hello' }),
      ).resolves.not.toThrow();
    });
  });
});
