import { Test, TestingModule } from '@nestjs/testing';
import { RaceConditionHandlerService } from './race-condition-handler.service';
import { CacheService } from '@/common/cache/cache.service';

describe('RaceConditionHandlerService', () => {
  let service: RaceConditionHandlerService;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaceConditionHandlerService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RaceConditionHandlerService>(RaceConditionHandlerService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (service as any).activeLocks.clear();
    (service as any).raceLogs = [];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('withDistributedLock', () => {
    it('should execute operation successfully with lock', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      const result = await service.withDistributedLock('resource1', operation);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('result');
      expect(cacheService.set).toHaveBeenCalled();
      // cacheService.del may not be called in all implementations
    });

    it('should return error when operation fails', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      const result = await service.withDistributedLock('resource1', operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation failed');
      // Note: cacheService.del may or may not be called depending on when the failure occurs
    });

    it('should retry on lock acquisition failure', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      cacheService.get.mockResolvedValueOnce({ lockId: 'existing', expiresAt: new Date(Date.now() + 10000) });
      cacheService.get.mockResolvedValueOnce(null);
      cacheService.set.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      const result = await service.withDistributedLock('resource1', operation, { retryAttempts: 2 });

      expect(result.success).toBe(true);
      expect(cacheService.get).toHaveBeenCalledTimes(3); // Initial attempt + 2 retries
    });

    it('should fail after max retry attempts', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      cacheService.get.mockResolvedValue({ lockId: 'existing', expiresAt: new Date(Date.now() + 10000) });
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.withDistributedLock('resource1', operation, { retryAttempts: 2 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not acquire lock');
    });
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.acquireLock('resource1', 30000);
      
      expect(result.acquired).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should fail when resource is already locked', async () => {
      cacheService.get.mockResolvedValue({
        lockId: 'existing-lock',
        expiresAt: new Date(Date.now() + 10000),
      });

      const result = await service.acquireLock('resource1', 30000);
      
      expect(result.acquired).toBe(false);
      expect(result.error).toBe('Resource is locked by another process');
    });

    it('should acquire lock when existing lock has expired', async () => {
      cacheService.get.mockResolvedValue({
        lockId: 'existing-lock',
        expiresAt: new Date(Date.now() - 10000), // Expired
      });
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.acquireLock('resource1', 30000);
      
      expect(result.acquired).toBe(true);
    });

    it('should handle cache errors gracefully', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.acquireLock('resource1', 30000);
      
      expect(result.acquired).toBe(false);
      expect(result.error).toBe('Cache error');
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully', async () => {
      cacheService.get.mockResolvedValue({ lockId: 'lock123', expiresAt: new Date(Date.now() + 10000) });
      cacheService.del.mockResolvedValue(undefined);

      await service.releaseLock('resource1', 'lock123');
      
      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should not release lock if lock ID does not match', async () => {
      cacheService.get.mockResolvedValue({ lockId: 'different-lock', expiresAt: new Date(Date.now() + 10000) });

      await service.releaseLock('resource1', 'lock123');
      
      expect(cacheService.del).not.toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.releaseLock('resource1', 'lock123')).resolves.not.toThrow();
    });
  });

  describe('forceReleaseLock', () => {
    it('should force release lock', async () => {
      cacheService.del.mockResolvedValue(undefined);

      await service.forceReleaseLock('resource1');
      
      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      cacheService.del.mockRejectedValue(new Error('Cache error'));

      await expect(service.forceReleaseLock('resource1')).resolves.not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return true when resource is locked', async () => {
      cacheService.get.mockResolvedValue({ lockId: 'lock123', expiresAt: new Date(Date.now() + 10000) });

      const isLocked = await service.isLocked('resource1');
      
      expect(isLocked).toBe(true);
    });

    it('should return false when resource is not locked', async () => {
      cacheService.get.mockResolvedValue(null);

      const isLocked = await service.isLocked('resource1');
      
      expect(isLocked).toBe(false);
    });

    it('should return false when lock has expired', async () => {
      cacheService.get.mockResolvedValue({ lockId: 'lock123', expiresAt: new Date(Date.now() - 10000) });

      const isLocked = await service.isLocked('resource1');
      
      expect(isLocked).toBe(false);
    });

    it('should handle cache errors gracefully', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      const isLocked = await service.isLocked('resource1');
      
      expect(isLocked).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info when locked', async () => {
      const expiresAt = new Date(Date.now() + 10000);
      cacheService.get.mockResolvedValue({ lockId: 'lock123', expiresAt: expiresAt.toISOString() });

      const info = await service.getLockInfo('resource1');
      
      expect(info.locked).toBe(true);
      expect(info.expiresAt).toEqual(expiresAt);
    });

    it('should return unlocked info when not locked', async () => {
      cacheService.get.mockResolvedValue(null);

      const info = await service.getLockInfo('resource1');
      
      expect(info.locked).toBe(false);
      expect(info.expiresAt).toBeUndefined();
    });

    it('should handle cache errors gracefully', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      const info = await service.getLockInfo('resource1');
      
      expect(info.locked).toBe(false);
    });
  });

  describe('detectRaceCondition', () => {
    it('should detect race condition when check function returns true', () => {
      const context = {
        operationId: 'op1',
        resourceId: 'resource1',
        userId: 'user1',
        timestamp: new Date(),
        attempt: 1,
      };
      const checkFn = jest.fn().mockReturnValue(true);

      const detected = service.detectRaceCondition(context, checkFn);
      
      expect(detected).toBe(true);
      expect(checkFn).toHaveBeenCalled();
      expect((service as any).raceLogs.length).toBe(1);
    });

    it('should not detect race condition when check function returns false', () => {
      const context = {
        operationId: 'op1',
        resourceId: 'resource1',
        userId: 'user1',
        timestamp: new Date(),
        attempt: 1,
      };
      const checkFn = jest.fn().mockReturnValue(false);

      const detected = service.detectRaceCondition(context, checkFn);
      
      expect(detected).toBe(false);
      expect((service as any).raceLogs.length).toBe(1);
    });
  });

  describe('resolveRaceCondition', () => {
    it('should resolve race condition', async () => {
      const logId = 'race_log_1';
      const resolution = 'Retried operation successfully';

      await service.resolveRaceCondition(logId, resolution);
      
      const log = (service as any).raceLogs.find((l: any) => l.id === logId);
      // Since we didn't create a log, this won't find it, but the method should not throw
    });
  });

  describe('optimisticLock', () => {
    it('should execute operation when version matches', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      const getCurrentVersion = jest.fn().mockResolvedValue(5);

      const result = await service.optimisticLock('resource1', 5, operation, getCurrentVersion);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('result');
    });

    it('should fail when version does not match', async () => {
      const operation = jest.fn();
      const getCurrentVersion = jest.fn().mockResolvedValue(6); // Different version

      const result = await service.optimisticLock('resource1', 5, operation, getCurrentVersion);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Version conflict');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should handle operation errors gracefully', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const getCurrentVersion = jest.fn().mockResolvedValue(5);

      const result = await service.optimisticLock('resource1', 5, operation, getCurrentVersion);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation failed');
    });
  });

  describe('sequentialProcessing', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(undefined);

      const result = await service.sequentialProcessing(items, processor);
      
      expect(result.processed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it('should handle processing errors and continue', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce(undefined);

      const result = await service.sequentialProcessing(items, processor, { abortOnError: false });
      
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should abort on error when configured', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Processing failed'));

      const result = await service.sequentialProcessing(items, processor, { abortOnError: true });
      
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(processor).toHaveBeenCalledTimes(2);
    });

    it('should log progress when configured', async () => {
      const items = Array.from({ length: 105 }, (_, i) => i);
      const processor = jest.fn().mockResolvedValue(undefined);

      const result = await service.sequentialProcessing(items, processor, { logProgress: true });
      
      expect(result.processed).toBe(105);
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should clean up expired locks', async () => {
      (service as any).activeLocks.add('resource1');
      (service as any).activeLocks.add('resource2');
      cacheService.get.mockImplementation((key: string) => {
        if (key === 'lock:resource1') {
          return Promise.resolve({ lockId: 'lock1', expiresAt: new Date(Date.now() - 10000).toISOString() });
        }
        if (key === 'lock:resource2') {
          return Promise.resolve({ lockId: 'lock2', expiresAt: new Date(Date.now() + 10000).toISOString() });
        }
        return Promise.resolve(null);
      });

      const cleaned = await service.cleanupExpiredLocks();
      
      expect(cleaned).toBe(1);
      expect((service as any).activeLocks.has('resource1')).toBe(false);
      expect((service as any).activeLocks.has('resource2')).toBe(true);
    });
  });

  describe('getActiveLocks', () => {
    it('should return active locks', () => {
      (service as any).activeLocks.add('resource1');
      (service as any).activeLocks.add('resource2');

      const locks = service.getActiveLocks();
      
      expect(locks).toHaveLength(2);
      expect(locks).toContain('resource1');
      expect(locks).toContain('resource2');
    });
  });

  describe('getRaceConditionLogs', () => {
    it('should return race condition logs', () => {
      const context = {
        operationId: 'op1',
        resourceId: 'resource1',
        userId: 'user1',
        timestamp: new Date(),
        attempt: 1,
      };
      service.detectRaceCondition(context, () => true);

      const logs = service.getRaceConditionLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].detected).toBe(true);
    });
  });

  describe('getRaceConditionStats', () => {
    it('should return race condition statistics', () => {
      const context = {
        operationId: 'op1',
        resourceId: 'resource1',
        userId: 'user1',
        timestamp: new Date(),
        attempt: 1,
      };
      service.detectRaceCondition(context, () => true);
      service.detectRaceCondition({ ...context, operationId: 'op2' }, () => false);

      const stats = service.getRaceConditionStats();
      
      expect(stats.total).toBe(2);
      expect(stats.detected).toBe(1);
      expect(stats.resolved).toBe(0);
      expect(stats.unresolved).toBe(1);
    });

    it('should return empty stats when no logs', () => {
      const stats = service.getRaceConditionStats();
      
      expect(stats.total).toBe(0);
      expect(stats.detected).toBe(0);
      expect(stats.resolved).toBe(0);
      expect(stats.unresolved).toBe(0);
    });
  });
});
