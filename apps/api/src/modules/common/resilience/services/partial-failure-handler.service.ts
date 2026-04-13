/**
 * Partial Failure Handler Service
 * 
 * Handles partial failures with graceful degradation, fallback mechanisms, and recovery
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  OperationResult,
  BatchOperationResult,
  FallbackStrategy,
  DegradationLevel,
  PartialFailureConfig,
  FailureContext,
  RecoveryStrategy,
  PartialFailureMetrics,
} from '../interfaces/partial-failure.interface';

@Injectable()
export class PartialFailureHandler {
  private readonly logger = new Logger(PartialFailureHandler.name);
  private currentDegradationLevel = 0;
  private metrics: PartialFailureMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    fallbackUsages: 0,
    degradedOperations: 0,
    currentDegradationLevel: 0,
    recoveriesAttempted: 0,
    recoveriesSuccessful: 0,
  };
  private recoveryStrategies: RecoveryStrategy[] = [];
  private fallbackStrategies: Map<string, FallbackStrategy<any>> = new Map();
  private degradationLevels: DegradationLevel[] = [];

  constructor(private readonly config: PartialFailureConfig) {
    this.degradationLevels = config.degradationLevels || [
      {
        level: 0,
        name: 'normal',
        features: ['all'],
        disabledFeatures: [],
      },
      {
        level: 1,
        name: 'degraded',
        features: ['essential'],
        disabledFeatures: ['non-essential', 'analytics', 'notifications'],
      },
      {
        level: 2,
        name: 'minimal',
        features: ['critical'],
        disabledFeatures: ['non-essential', 'analytics', 'notifications', 'search', 'filters'],
      },
    ];

    if (config.fallbackStrategies) {
      Object.entries(config.fallbackStrategies).forEach(([name, strategy]) => {
        this.fallbackStrategies.set(name, strategy);
      });
    }
  }

  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackName?: string,
    defaultValue?: T,
  ): Promise<OperationResult<T>> {
    this.metrics.totalOperations++;

    try {
      const data = await operation();
      this.metrics.successfulOperations++;

      return {
        success: true,
        data,
        fallbackUsed: false,
      };
    } catch (error) {
      this.metrics.failedOperations++;

      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Operation failed: ${err.message}`);

      // Try fallback if available
      if (fallbackName && this.fallbackStrategies.has(fallbackName)) {
        try {
          const strategy = this.fallbackStrategies.get(fallbackName)!;
          const fallbackData = await strategy.execute();
          this.metrics.fallbackUsages++;

          return {
            success: true,
            data: fallbackData,
            fallbackUsed: true,
          };
        } catch (fallbackError) {
          this.logger.error(`Fallback also failed: ${fallbackError}`);
        }
      }

      // Return default value if provided
      if (defaultValue !== undefined) {
        return {
          success: true,
          data: defaultValue,
          fallbackUsed: true,
        };
      }

      return {
        success: false,
        error: err,
        fallbackUsed: false,
      };
    }
  }

  async executeBatch<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
    options: {
      continueOnError?: boolean;
      maxConcurrency?: number;
      onPartialFailure?: (failed: Array<{ item: T; error: Error }>) => void;
    } = {},
  ): Promise<BatchOperationResult<T>> {
    this.metrics.totalOperations++;

    const results = await Promise.allSettled(
      items.map(async (item) => {
        try {
          await operation(item);
          return { success: true, item };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          return { success: false, item, error: err };
        }
      }),
    );

    const successful: T[] = [];
    const failed: Array<{ item: T; error: Error }> = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successful.push(result.value.item);
        } else {
          failed.push({ item: result.value.item, error: result.value.error! });
        }
      } else {
        failed.push({ item: items[results.indexOf(result)], error: new Error(result.reason) });
      }
    });

    const partial = failed.length > 0 && successful.length > 0;

    if (partial) {
      this.metrics.degradedOperations++;
      options.onPartialFailure?.(failed);
    }

    if (failed.length === 0) {
      this.metrics.successfulOperations++;
    }

    return {
      successful,
      failed,
      partial,
      totalCount: items.length,
      successCount: successful.length,
      failureCount: failed.length,
    };
  }

  async executeWithDegradation<T>(
    operation: () => Promise<T>,
    featureName: string,
    degradedOperation?: () => Promise<Partial<T>>,
  ): Promise<OperationResult<T>> {
    this.metrics.totalOperations++;

    // Check if current degradation level allows this feature
    const currentLevel = this.degradationLevels[this.currentDegradationLevel];
    if (currentLevel.disabledFeatures.includes(featureName)) {
      this.logger.warn(`Feature '${featureName}' disabled due to degradation level ${this.currentDegradationLevel}`);

      if (degradedOperation) {
        try {
          const partialData = await degradedOperation();
          this.metrics.degradedOperations++;

          return {
            success: true,
            partialData,
            fallbackUsed: true,
          } as OperationResult<T>;
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      }

      return {
        success: false,
        error: new Error(`Feature '${featureName}' is currently disabled`),
      };
    }

    try {
      const data = await operation();
      this.metrics.successfulOperations++;
      return { success: true, data };
    } catch (error) {
      this.metrics.failedOperations++;

      if (degradedOperation) {
        try {
          const partialData = await degradedOperation();
          this.metrics.degradedOperations++;
          this.increaseDegradationLevel();

          return {
            success: true,
            partialData,
            fallbackUsed: true,
          } as OperationResult<T>;
        } catch (degradedError) {
          this.logger.error(`Degraded operation also failed: ${degradedError}`);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  async attemptRecovery(failure: FailureContext): Promise<boolean> {
    this.metrics.recoveriesAttempted++;

    for (const strategy of this.recoveryStrategies) {
      if (strategy.condition(failure)) {
        try {
          const success = await this.executeRecoveryWithRetry(strategy, failure);
          if (success) {
            this.metrics.recoveriesSuccessful++;
            this.decreaseDegradationLevel();
            return true;
          }
        } catch (error) {
          this.logger.error(`Recovery strategy '${strategy.name}' failed: ${error}`);
        }
      }
    }

    return false;
  }

  private async executeRecoveryWithRetry(
    strategy: RecoveryStrategy,
    failure: FailureContext,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < strategy.maxAttempts; attempt++) {
      try {
        const success = await strategy.action(failure);
        if (success) {
          this.logger.log(`Recovery successful with strategy '${strategy.name}' on attempt ${attempt + 1}`);
          return true;
        }
      } catch (error) {
        this.logger.warn(`Recovery attempt ${attempt + 1} failed: ${error}`);
      }

      if (attempt < strategy.maxAttempts - 1) {
        await this.sleep(strategy.backoffDelay * Math.pow(2, attempt));
      }
    }

    return false;
  }

  increaseDegradationLevel(): void {
    if (this.currentDegradationLevel < this.degradationLevels.length - 1) {
      this.currentDegradationLevel++;
      this.metrics.currentDegradationLevel = this.currentDegradationLevel;
      this.logger.warn(`Degradation level increased to ${this.currentDegradationLevel}`);
    }
  }

  decreaseDegradationLevel(): void {
    if (this.currentDegradationLevel > 0) {
      this.currentDegradationLevel--;
      this.metrics.currentDegradationLevel = this.currentDegradationLevel;
      this.logger.log(`Degradation level decreased to ${this.currentDegradationLevel}`);
    }
  }

  getCurrentDegradationLevel(): DegradationLevel {
    return this.degradationLevels[this.currentDegradationLevel];
  }

  getMetrics(): PartialFailureMetrics {
    return { ...this.metrics };
  }

  isFeatureEnabled(featureName: string): boolean {
    const level = this.degradationLevels[this.currentDegradationLevel];
    return level.features.includes('all') ||
           level.features.includes(featureName) ||
           !level.disabledFeatures.includes(featureName);
  }

  registerFallbackStrategy<T>(name: string, strategy: FallbackStrategy<T>): void {
    this.fallbackStrategies.set(name, strategy);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
