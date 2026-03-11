import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

export interface LockOptions {
  ttl?: number; // Time to live in seconds
  retryDelay?: number; // Retry delay in milliseconds
  maxRetries?: number; // Maximum number of retries
}

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly DEFAULT_TTL = 30; // 30 seconds
  private readonly DEFAULT_RETRY_DELAY = 100; // 100ms
  private readonly DEFAULT_MAX_RETRIES = 10;

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Acquire a distributed lock for a given key
   * @param key - Lock key (e.g., 'rating-update:user-123')
   * @param options - Lock options
   * @returns Lock release function or null if lock not acquired
   */
  async acquireLock(
    key: string,
    options: LockOptions = {},
  ): Promise<(() => Promise<void>) | null> {
    const {
      ttl = this.DEFAULT_TTL,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      maxRetries = this.DEFAULT_MAX_RETRIES,
    } = options;

    const lockKey = `lock:${key}`;
    const lockValue = this.generateLockValue();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try to acquire lock using SET NX EX (atomic operation)
        const acquired = await this.cacheService.setNx(lockKey, lockValue, ttl);

        if (acquired) {
          this.logger.debug(`Lock acquired for key: ${key} (attempt ${attempt + 1})`);
          
          // Return release function
          return async () => {
            try {
              await this.releaseLock(lockKey, lockValue);
              this.logger.debug(`Lock released for key: ${key}`);
            } catch (error) {
              this.logger.error(`Failed to release lock for key: ${key}`, error);
            }
          };
        }
      } catch (error) {
        this.logger.error(`Error acquiring lock for key: ${key} (attempt ${attempt + 1})`, error);
        
        if (attempt < maxRetries - 1) {
          await this.delay(retryDelay);
        }
      }
    }

    this.logger.warn(`Failed to acquire lock for key: ${key} after ${maxRetries} attempts`);
    return null;
  }

  /**
   * Execute a function with distributed locking
   * @param key - Lock key
   * @param fn - Function to execute while holding lock
   * @param options - Lock options
   * @returns Result of the function or null if lock not acquired
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T | null> {
    const release = await this.acquireLock(key, options);
    
    if (!release) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await release();
    }
  }

  /**
   * Release a distributed lock
   * @param lockKey - Lock key
   * @param lockValue - Lock value (to ensure we only release our own lock)
   */
  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    // Use Lua script for atomic check-and-delete
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    // This would need to be implemented in your cache service
    // For now, we'll use a simple approach
    const currentValue = await this.cacheService.get(lockKey);
    if (currentValue === lockValue) {
      await this.cacheService.delete(lockKey);
    }
  }

  /**
   * Generate a unique lock value
   */
  private generateLockValue(): string {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a lock exists
   * @param key - Lock key
   * @returns True if lock exists
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const exists = await this.cacheService.exists(lockKey);
    return exists;
  }

  /**
   * Force release a lock (admin use only)
   * @param key - Lock key
   */
  async forceReleaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    await this.cacheService.delete(lockKey);
    this.logger.warn(`Force released lock for key: ${key}`);
  }
}
