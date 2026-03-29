import { Test, TestingModule } from '@nestjs/testing';
import { DistributedLockService, LockOptions } from './distributed-lock.service';
import { CacheService } from '../cache/cache.service';

describe('DistributedLockService', () => {
  let service: DistributedLockService;
  let mockCache: { 
    setNx: jest.Mock; 
    exists: jest.Mock; 
    delete: jest.Mock;
    getClient: jest.Mock;
  };

  const mockCacheService = {
    setNx: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      eval: jest.fn(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedLockService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<DistributedLockService>(DistributedLockService);
    mockCache = mockCacheService as any;
    jest.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should acquire lock on first attempt', async () => {
      mockCache.setNx.mockResolvedValue(true);

      const release = await service.acquireLock('test-key');

      expect(release).toBeInstanceOf(Function);
      expect(mockCache.setNx).toHaveBeenCalledWith('lock:test-key', expect.any(String), 30);
    });

    it('should retry and acquire lock', async () => {
      mockCache.setNx
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const release = await service.acquireLock('retry-key', { retryDelay: 10, maxRetries: 5 });

      expect(release).toBeInstanceOf(Function);
      expect(mockCache.setNx).toHaveBeenCalledTimes(3);
    });

    it('should return null after max retries exceeded', async () => {
      mockCache.setNx.mockResolvedValue(false);

      const release = await service.acquireLock('busy-key', { retryDelay: 10, maxRetries: 3 });

      expect(release).toBeNull();
      expect(mockCache.setNx).toHaveBeenCalledTimes(3);
    });

    it('should use custom TTL', async () => {
      mockCache.setNx.mockResolvedValue(true);

      await service.acquireLock('ttl-key', { ttl: 60 });

      expect(mockCache.setNx).toHaveBeenCalledWith('lock:ttl-key', expect.any(String), 60);
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.setNx.mockRejectedValue(new Error('Cache unavailable'));

      const release = await service.acquireLock('error-key', { retryDelay: 10, maxRetries: 2 });

      expect(release).toBeNull();
    });
  });

  describe('release lock function', () => {
    it('should release lock when called', async () => {
      mockCache.setNx.mockResolvedValue(true);
      mockCache.getClient().eval.mockResolvedValue(1);

      const release = await service.acquireLock('release-key');
      expect(release).toBeInstanceOf(Function);

      await release!();

      expect(mockCache.getClient().eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'lock:release-key',
        expect.any(String),
      );
    });

    it('should handle release errors gracefully', async () => {
      mockCache.setNx.mockResolvedValue(true);
      mockCache.getClient().eval.mockRejectedValue(new Error('Release failed'));

      const release = await service.acquireLock('release-error-key');
      
      // Should not throw
      await expect(release!()).resolves.not.toThrow();
    });
  });

  describe('withLock', () => {
    it('should execute function with lock', async () => {
      mockCache.setNx.mockResolvedValue(true);
      mockCache.getClient().eval.mockResolvedValue(1);

      const fn = jest.fn().mockResolvedValue('result');
      const result = await service.withLock('with-lock-key', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return null if lock not acquired', async () => {
      mockCache.setNx.mockResolvedValue(false);

      const fn = jest.fn().mockResolvedValue('result');
      const result = await service.withLock('busy-key', fn, { maxRetries: 1 });

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should release lock after function execution', async () => {
      mockCache.setNx.mockResolvedValue(true);
      mockCache.getClient().eval.mockResolvedValue(1);

      const fn = jest.fn().mockResolvedValue('done');
      await service.withLock('release-after-key', fn);

      expect(mockCache.getClient().eval).toHaveBeenCalled();
    });

    it('should release lock even if function throws', async () => {
      mockCache.setNx.mockResolvedValue(true);
      mockCache.getClient().eval.mockResolvedValue(1);

      const fn = jest.fn().mockRejectedValue(new Error('Function failed'));

      await expect(service.withLock('error-key', fn)).rejects.toThrow('Function failed');
      
      // Lock should still be released
      expect(mockCache.getClient().eval).toHaveBeenCalled();
    });

    it('should pass function result through', async () => {
      mockCache.setNx.mockResolvedValue(true);
      mockCache.getClient().eval.mockResolvedValue(1);

      const complexResult = { data: [1, 2, 3], count: 3 };
      const fn = jest.fn().mockResolvedValue(complexResult);

      const result = await service.withLock('complex-key', fn);

      expect(result).toEqual(complexResult);
    });
  });

  describe('isLocked', () => {
    it('should return true when lock exists', async () => {
      mockCache.exists.mockResolvedValue(true);

      const locked = await service.isLocked('existing-lock');

      expect(locked).toBe(true);
      expect(mockCache.exists).toHaveBeenCalledWith('lock:existing-lock');
    });

    it('should return false when lock does not exist', async () => {
      mockCache.exists.mockResolvedValue(false);

      const locked = await service.isLocked('non-existing-lock');

      expect(locked).toBe(false);
    });
  });

  describe('forceReleaseLock', () => {
    it('should force delete the lock', async () => {
      mockCache.delete.mockResolvedValue(1);

      await service.forceReleaseLock('force-release-key');

      expect(mockCache.delete).toHaveBeenCalledWith('lock:force-release-key');
    });

    it('should handle delete errors', async () => {
      mockCache.delete.mockRejectedValue(new Error('Delete failed'));

      // Should not throw
      await expect(service.forceReleaseLock('error-key')).resolves.not.toThrow();
    });
  });

  describe('concurrency scenarios', () => {
    it('should prevent concurrent access with same key', async () => {
      let concurrentCount = 0;
      mockCache.setNx.mockImplementation(async () => {
        if (concurrentCount === 0) {
          concurrentCount++;
          return true;
        }
        return false;
      });

      const firstLock = await service.acquireLock('concurrent-key', { maxRetries: 1 });
      const secondLock = await service.acquireLock('concurrent-key', { maxRetries: 1 });

      expect(firstLock).toBeInstanceOf(Function);
      expect(secondLock).toBeNull();
    });

    it('should allow different keys to lock independently', async () => {
      mockCache.setNx.mockResolvedValue(true);

      const lock1 = await service.acquireLock('key-1');
      const lock2 = await service.acquireLock('key-2');

      expect(lock1).toBeInstanceOf(Function);
      expect(lock2).toBeInstanceOf(Function);
    });
  });
});
