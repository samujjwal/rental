/**
 * Race Condition Handler Service
 * 
 * Provides enhanced handling of race conditions with distributed locking
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';

export interface LockOptions {
  lockTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  expiresAt?: Date;
  error?: string;
}

export interface RaceConditionContext {
  operationId: string;
  resourceId: string;
  userId?: string;
  timestamp: Date;
  attempt: number;
}

export interface RaceConditionLog {
  id: string;
  context: RaceConditionContext;
  detected: boolean;
  resolved: boolean;
  resolution?: string;
}

@Injectable()
export class RaceConditionHandlerService {
  private readonly logger = new Logger(RaceConditionHandlerService.name);
  private raceLogs: RaceConditionLog[] = [];
  private readonly maxLogSize = 1000;
  private activeLocks = new Set<string>();

  constructor(private readonly cacheService: CacheService) {}

  async withDistributedLock<T>(
    resourceId: string,
    operation: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const { lockTimeout = 30000, retryAttempts = 3, retryDelay = 100 } = options;

    let lockResult: LockResult | null = null;
    let attempts = 0;

    // Try to acquire lock with retries
    while (attempts < retryAttempts) {
      lockResult = await this.acquireLock(resourceId, lockTimeout);

      if (lockResult.acquired) {
        break;
      }

      attempts++;
      if (attempts < retryAttempts) {
        await this.sleep(retryDelay * Math.pow(2, attempts)); // Exponential backoff
      }
    }

    if (!lockResult?.acquired) {
      this.logger.warn(`Failed to acquire lock for resource: ${resourceId}`);
      return {
        success: false,
        error: `Could not acquire lock for resource: ${resourceId}`,
      };
    }

    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      this.logger.error(`Operation failed under lock: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      };
    } finally {
      await this.releaseLock(resourceId, lockResult.lockId!);
    }
  }

  async acquireLock(
    resourceId: string,
    timeout: number = 30000,
  ): Promise<LockResult> {
    const lockId = this.generateLockId();
    const lockKey = `lock:${resourceId}`;
    const expiresAt = new Date(Date.now() + timeout);

    try {
      // Try to set lock atomically - use get first to check if exists
      const existing = await this.cacheService.get<any>(lockKey);

      if (existing) {
        // Check if lock has expired
        const existingExpiresAt = new Date(existing.expiresAt);
        if (existingExpiresAt > new Date()) {
          return {
            acquired: false,
            error: 'Resource is locked by another process',
          };
        }
        // Lock expired, can acquire
      }

      // Set the lock
      await this.cacheService.set(lockKey, {
        lockId,
        expiresAt: expiresAt.toISOString(),
        acquiredAt: new Date().toISOString(),
      }, timeout / 1000);

      this.activeLocks.add(resourceId);
      return {
        acquired: true,
        lockId,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Error acquiring lock: ${error}`);
      return {
        acquired: false,
        error: error instanceof Error ? error.message : 'Lock acquisition failed',
      };
    }
  }

  async releaseLock(resourceId: string, lockId: string): Promise<void> {
    const lockKey = `lock:${resourceId}`;

    try {
      const lock = await this.cacheService.get<any>(lockKey);

      // Only release if we own the lock
      if (lock && lock.lockId === lockId) {
        await this.cacheService.del(lockKey);
        this.activeLocks.delete(resourceId);
        this.logger.debug(`Released lock for resource: ${resourceId}`);
      }
    } catch (error) {
      this.logger.error(`Error releasing lock: ${error}`);
    }
  }

  async forceReleaseLock(resourceId: string): Promise<void> {
    const lockKey = `lock:${resourceId}`;

    try {
      await this.cacheService.del(lockKey);
      this.activeLocks.delete(resourceId);
      this.logger.warn(`Force released lock for resource: ${resourceId}`);
    } catch (error) {
      this.logger.error(`Error force releasing lock: ${error}`);
    }
  }

  async isLocked(resourceId: string): Promise<boolean> {
    const lockKey = `lock:${resourceId}`;

    try {
      const lock = await this.cacheService.get<any>(lockKey);
      if (!lock) return false;

      const expiresAt = new Date(lock.expiresAt);
      return expiresAt > new Date();
    } catch {
      return false;
    }
  }

  async getLockInfo(resourceId: string): Promise<{ locked: boolean; expiresAt?: Date }> {
    const lockKey = `lock:${resourceId}`;

    try {
      const lock = await this.cacheService.get<any>(lockKey);
      if (!lock) return { locked: false };

      const expiresAt = new Date(lock.expiresAt);
      return {
        locked: expiresAt > new Date(),
        expiresAt,
      };
    } catch {
      return { locked: false };
    }
  }

  detectRaceCondition(
    context: RaceConditionContext,
    checkFn: () => boolean,
  ): boolean {
    const detected = checkFn();

    this.logRaceCondition({
      id: this.generateRaceLogId(),
      context,
      detected,
      resolved: false,
    });

    if (detected) {
      this.logger.warn(
        `Race condition detected: operation=${context.operationId}, resource=${context.resourceId}`,
      );
    }

    return detected;
  }

  async resolveRaceCondition(
    logId: string,
    resolution: string,
  ): Promise<void> {
    const log = this.raceLogs.find((l) => l.id === logId);
    if (log) {
      log.resolved = true;
      log.resolution = resolution;
      this.logger.log(`Race condition resolved: ${resolution}`);
    }
  }

  async optimisticLock<T>(
    resourceId: string,
    version: number,
    operation: () => Promise<T>,
    getCurrentVersion: () => Promise<number>,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const currentVersion = await getCurrentVersion();

      if (currentVersion !== version) {
        // Version mismatch - race condition detected
        this.logRaceCondition({
          id: this.generateRaceLogId(),
          context: {
            operationId: 'optimistic-lock',
            resourceId,
            timestamp: new Date(),
            attempt: 1,
          },
          detected: true,
          resolved: false,
        });

        return {
          success: false,
          error: `Version conflict: expected ${version}, got ${currentVersion}`,
        };
      }

      const data = await operation();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      };
    }
  }

  async sequentialProcessing<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    options: { abortOnError?: boolean; logProgress?: boolean } = {},
  ): Promise<{
    processed: number;
    failed: number;
    errors: Array<{ item: T; error: string }>;
  }> {
    const { abortOnError = false, logProgress = true } = options;

    let processed = 0;
    let failed = 0;
    const errors: Array<{ item: T; error: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        await processor(item);
        processed++;

        if (logProgress && (i + 1) % 100 === 0) {
          this.logger.log(`Processed ${i + 1}/${items.length} items`);
        }
      } catch (error) {
        failed++;
        errors.push({
          item,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (abortOnError) {
          break;
        }
      }
    }

    return { processed, failed, errors };
  }

  async cleanupExpiredLocks(): Promise<number> {
    let cleaned = 0;

    for (const resourceId of this.activeLocks) {
      const info = await this.getLockInfo(resourceId);
      if (!info.locked) {
        this.activeLocks.delete(resourceId);
        cleaned++;
      }
    }

    return cleaned;
  }

  getActiveLocks(): string[] {
    return Array.from(this.activeLocks);
  }

  getRaceConditionLogs(): RaceConditionLog[] {
    return [...this.raceLogs];
  }

  getRaceConditionStats(): {
    total: number;
    detected: number;
    resolved: number;
    unresolved: number;
  } {
    return {
      total: this.raceLogs.length,
      detected: this.raceLogs.filter((l) => l.detected).length,
      resolved: this.raceLogs.filter((l) => l.resolved).length,
      unresolved: this.raceLogs.filter((l) => l.detected && !l.resolved).length,
    };
  }

  private logRaceCondition(log: RaceConditionLog): void {
    this.raceLogs.push(log);

    if (this.raceLogs.length > this.maxLogSize) {
      this.raceLogs = this.raceLogs.slice(-this.maxLogSize);
    }
  }

  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRaceLogId(): string {
    return `race_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
