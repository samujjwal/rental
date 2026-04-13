/**
 * Retry Service
 * 
 * Implements retry logic with exponential backoff, circuit breaker, and bulkhead patterns
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  RetryConfig,
  RetryResult,
  RetryState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerMetrics,
  BulkheadConfig,
  BulkheadMetrics,
  BulkheadSlot,
  RetryCondition,
} from '../interfaces/retry.interface';

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
  ): Promise<RetryResult<T>> {
    const mergedConfig = { ...this.defaultRetryConfig, ...config };
    const state: RetryState = {
      attempt: 0,
      nextDelay: mergedConfig.baseDelay,
      totalDelay: 0,
    };

    while (state.attempt <= mergedConfig.maxRetries) {
      try {
        const data = await operation();

        return {
          success: true,
          data,
          attempts: state.attempt + 1,
          totalDelay: state.totalDelay,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        state.lastError = err;

        if (state.attempt === mergedConfig.maxRetries) {
          mergedConfig.onExhausted?.(err);
          return {
            success: false,
            error: err,
            attempts: state.attempt + 1,
            totalDelay: state.totalDelay,
          };
        }

        if (mergedConfig.nonRetryableErrors?.includes(err.name)) {
          return {
            success: false,
            error: err,
            attempts: state.attempt + 1,
            totalDelay: state.totalDelay,
          };
        }

        if (
          mergedConfig.retryableErrors?.length &&
          !mergedConfig.retryableErrors.includes(err.name)
        ) {
          return {
            success: false,
            error: err,
            attempts: state.attempt + 1,
            totalDelay: state.totalDelay,
          };
        }

        const delay = this.calculateDelay(state.attempt, mergedConfig);
        state.totalDelay += delay;
        state.nextDelay = Math.min(delay * mergedConfig.backoffMultiplier, mergedConfig.maxDelay);

        mergedConfig.onRetry?.(state.attempt + 1, err, delay);
        this.logger.warn(`Retry attempt ${state.attempt + 1} after ${delay}ms: ${err.message}`);

        await this.sleep(delay);
        state.attempt++;
      }
    }

    return {
      success: false,
      error: state.lastError,
      attempts: state.attempt + 1,
      totalDelay: state.totalDelay,
    };
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    if (config.jitter) {
      return Math.floor(cappedDelay * (0.5 + Math.random() * 0.5));
    }

    return cappedDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

@Injectable()
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitBreakerState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private consecutiveSuccesses = 0;
  private consecutiveFailures = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private totalCalls = 0;
  private rejectedCalls = 0;
  private halfOpenCalls = 0;
  private resetTimer?: NodeJS.Timeout;

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenMaxCalls: 3,
    successThreshold: 2,
    monitoringPeriod: 60000,
  };

  constructor(
    private readonly name: string,
    private readonly config: Partial<CircuitBreakerConfig> = {},
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === 'OPEN') {
      this.rejectedCalls++;
      throw new Error(`Circuit breaker '${this.name}' is OPEN`);
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCalls >= (this.config.halfOpenMaxCalls || 3)) {
        this.rejectedCalls++;
        throw new Error(`Circuit breaker '${this.name}' is HALF_OPEN and max calls reached`);
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    if (this.state === 'HALF_OPEN') {
      if (this.consecutiveSuccesses >= (this.config.successThreshold || 2)) {
        this.closeCircuit();
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      this.openCircuit();
      return;
    }

    if (this.state === 'CLOSED' && this.consecutiveFailures >= (this.config.failureThreshold || 5)) {
      this.openCircuit();
    }
  }

  private openCircuit(): void {
    this.state = 'OPEN';
    this.logger.warn(`Circuit breaker '${this.name}' opened`);

    this.resetTimer = setTimeout(() => {
      this.halfOpenCircuit();
    }, this.config.resetTimeout);
  }

  private halfOpenCircuit(): void {
    this.state = 'HALF_OPEN';
    this.halfOpenCalls = 0;
    this.consecutiveSuccesses = 0;
    this.logger.log(`Circuit breaker '${this.name}' half-opened`);
  }

  private closeCircuit(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.halfOpenCalls = 0;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    this.logger.log(`Circuit breaker '${this.name}' closed`);
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      totalCalls: this.totalCalls,
      rejectedCalls: this.rejectedCalls,
    };
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  forceOpen(): void {
    this.openCircuit();
  }

  forceClose(): void {
    this.closeCircuit();
  }
}

@Injectable()
export class Bulkhead {
  private readonly logger = new Logger(Bulkhead.name);
  private running = 0;
  private completed = 0;
  private rejected = 0;
  private queue: Array<{
    resolve: (slot: BulkheadSlot) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  private readonly defaultConfig: BulkheadConfig = {
    maxConcurrent: 10,
    maxQueue: 100,
    queueTimeout: 5000,
  };

  constructor(
    private readonly name: string,
    private readonly config: Partial<BulkheadConfig> = {},
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  async acquire(): Promise<BulkheadSlot> {
    const { maxConcurrent, maxQueue, queueTimeout } = this.config;

    // If under limit, execute immediately
    if (this.running < (maxConcurrent || 10)) {
      this.running++;
      return this.createSlot();
    }

    // If queue is full, reject
    if (this.queue.length >= (maxQueue || 100)) {
      this.rejected++;
      throw new Error(`Bulkhead '${this.name}' queue is full`);
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.queue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        this.rejected++;
        reject(new Error(`Bulkhead '${this.name}' queue timeout`));
      }, queueTimeout);

      this.queue.push({
        resolve: (slot) => {
          clearTimeout(timer);
          resolve(slot);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        timer,
      });
    });
  }

  private createSlot(): BulkheadSlot {
    return {
      release: () => {
        this.running--;
        this.completed++;
        this.processQueue();
      },
    };
  }

  private processQueue(): void {
    const { maxConcurrent } = this.config;

    while (this.queue.length > 0 && this.running < (maxConcurrent || 10)) {
      const next = this.queue.shift();
      if (next) {
        this.running++;
        next.resolve(this.createSlot());
      }
    }
  }

  getMetrics(): BulkheadMetrics {
    return {
      availableSlots: Math.max(0, (this.config.maxConcurrent || 10) - this.running),
      queueSize: this.queue.length,
      running: this.running,
      completed: this.completed,
      rejected: this.rejected,
      queued: this.queue.length,
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const slot = await this.acquire();

    try {
      return await operation();
    } finally {
      slot.release();
    }
  }
}

@Injectable()
export class ResilienceService {
  private readonly logger = new Logger(ResilienceService.name);
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private bulkheads = new Map<string, Bulkhead>();

  constructor(private readonly retryService: RetryService) {}

  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker(name, config));
    }
    return this.circuitBreakers.get(name)!;
  }

  getBulkhead(name: string, config?: Partial<BulkheadConfig>): Bulkhead {
    if (!this.bulkheads.has(name)) {
      this.bulkheads.set(name, new Bulkhead(name, config));
    }
    return this.bulkheads.get(name)!;
  }

  async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: {
      circuitBreakerName?: string;
      circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
      bulkheadName?: string;
      bulkheadConfig?: Partial<BulkheadConfig>;
      retryConfig?: Partial<RetryConfig>;
    } = {},
  ): Promise<RetryResult<T>> {
    let wrappedOperation = operation;

    // Apply circuit breaker if specified
    if (options.circuitBreakerName) {
      const cb = this.getCircuitBreaker(options.circuitBreakerName, options.circuitBreakerConfig);
      wrappedOperation = () => cb.execute(operation);
    }

    // Apply bulkhead if specified
    if (options.bulkheadName) {
      const bh = this.getBulkhead(options.bulkheadName, options.bulkheadConfig);
      const currentOp = wrappedOperation;
      wrappedOperation = () => bh.execute(currentOp);
    }

    // Apply retry logic
    return this.retryService.executeWithRetry(wrappedOperation, options.retryConfig);
  }

  getAllCircuitBreakerMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    this.circuitBreakers.forEach((cb, name) => {
      metrics[name] = cb.getMetrics();
    });
    return metrics;
  }

  getAllBulkheadMetrics(): Record<string, BulkheadMetrics> {
    const metrics: Record<string, BulkheadMetrics> = {};
    this.bulkheads.forEach((bh, name) => {
      metrics[name] = bh.getMetrics();
    });
    return metrics;
  }
}
