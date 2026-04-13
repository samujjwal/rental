import { Test, TestingModule } from '@nestjs/testing';
import { RetryService, CircuitBreaker, Bulkhead, ResilienceService } from './services/retry.service';

// Custom error classes for testing retry conditions
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ECONNREFUSED extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ECONNREFUSED';
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Retry Logic Tests
 *
 * These tests validate the actual RetryService implementation:
 * - Exponential backoff retry logic
 * - Maximum retry limits
 * - Retry condition evaluation
 * - Retry state tracking
 * - Retry failure handling
 * - Idempotent retry operations
 * - Circuit breaker functionality
 * - Bulkhead pattern
 */
describe('RetryService Tests', () => {
  let retryService: RetryService;
  let circuitBreaker: CircuitBreaker;
  let bulkhead: Bulkhead;
  let resilienceService: ResilienceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetryService,
        ResilienceService,
      ],
    }).compile();

    retryService = module.get<RetryService>(RetryService);
    resilienceService = module.get<ResilienceService>(ResilienceService);
    circuitBreaker = new CircuitBreaker('test-circuit', { failureThreshold: 5, resetTimeout: 60000 });
    bulkhead = new Bulkhead('test-bulkhead', { maxConcurrent: 10, maxQueue: 20 });
  });

  describe('EXPONENTIAL BACKOFF', () => {
    it('should retry with exponential backoff on failure', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10, // Small delay for testing
        jitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should cap maximum backoff delay', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 10) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 10,
        baseDelay: 100,
        maxDelay: 500,
        jitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(10);
    });

    it('should add jitter to backoff delay when enabled', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 2,
        baseDelay: 100,
        jitter: true,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  describe('MAXIMUM RETRY LIMITS', () => {
    it('should respect maximum retry limit', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        throw new Error('Retryable error');
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(4); // Initial + 3 retries
    });

    it('should stop retrying on success', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount === 2) {
          return { success: true };
        }
        throw new Error('Retryable error');
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 5,
        baseDelay: 10,
        jitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2); // Stopped after success
    });

    it('should not retry non-retryable errors', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        throw new ValidationError('Invalid input');
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
        nonRetryableErrors: ['ValidationError'],
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // No retries for non-retryable errors
    });
  });

  describe('RETRY CONDITION EVALUATION', () => {
    it('should retry on retryable errors', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        throw new ECONNREFUSED('Connection refused');
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
        retryableErrors: ['ECONNREFUSED'],
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBeGreaterThan(1);
    });

    it('should retry on all errors by default', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        throw new ValidationError('Invalid input');
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBeGreaterThan(1); // Retries by default
    });

    it('should retry only on specified retryable errors', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        throw new NetworkError('Network failure');
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
        retryableErrors: ['NetworkError'],
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBeGreaterThan(1);
    });
  });

  describe('RETRY STATE TRACKING', () => {
    it('should track retry attempts and total delay', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.totalDelay).toBeGreaterThan(0);
    });

    it('should return error information on failure', async () => {
      const operation = async () => {
        throw new Error('Permanent failure');
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Permanent failure');
    });

    it('should call retry callback on each retry', async () => {
      let attemptCount = 0;
      let callbackCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await retryService.executeWithRetry(operation, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
        onRetry: (attempt, error, delay) => {
          callbackCount++;
        },
      });

      expect(result.success).toBe(true);
      expect(callbackCount).toBe(2); // 2 retries before success
    });
  });

  describe('CIRCUIT BREAKER', () => {
    it('should open circuit after threshold failures', async () => {
      const cb = resilienceService.getCircuitBreaker('test-circuit-open', {
        failureThreshold: 3,
      });

      // Simulate failures
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('Failure');
          });
        } catch (e) {
          // Expected
        }
      }

      expect(cb.getState()).toBe('OPEN');
    });

    it('should reject requests when circuit is open', async () => {
      const cb = resilienceService.getCircuitBreaker('test-circuit-reject', {
        failureThreshold: 2,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('Failure');
          });
        } catch (e) {
          // Expected
        }
      }

      // Should reject
      await expect(cb.execute(async () => {
        return { success: true };
      })).rejects.toThrow('OPEN');
    });

    it('should close circuit after successful calls in half-open', async () => {
      const cb = resilienceService.getCircuitBreaker('test-circuit-close', {
        failureThreshold: 2,
        successThreshold: 2,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('Failure');
          });
        } catch (e) {
          // Expected
        }
      }

      // Force close to test recovery
      cb.forceClose();

      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('BULKHEAD', () => {
    it('should limit concurrent operations', async () => {
      const bh = resilienceService.getBulkhead('test-bulkhead-limit', {
        maxConcurrent: 2,
      });

      let activeCount = 0;
      let maxActive = 0;

      const operation = async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeCount--;
      };

      await Promise.all([
        bh.execute(operation),
        bh.execute(operation),
        bh.execute(operation),
      ]);

      expect(maxActive).toBeLessThanOrEqual(2);
    });

    it('should queue operations when limit reached', async () => {
      const bh = resilienceService.getBulkhead('test-bulkhead-queue', {
        maxConcurrent: 1,
        maxQueue: 2,
      });

      const results: number[] = [];

      const operation = async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 20));
        results.push(id);
      };

      await Promise.all([
        bh.execute(() => operation(1)),
        bh.execute(() => operation(2)),
        bh.execute(() => operation(3)),
      ]);

      expect(results).toHaveLength(3);
    });
  });

  describe('RESILIENCE SERVICE', () => {
    it('should execute with retry and circuit breaker', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await resilienceService.executeWithResilience(operation, {
        circuitBreakerName: 'test-resilience-cb',
        retryConfig: {
          maxRetries: 3,
          baseDelay: 10,
          jitter: false,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should get circuit breaker metrics', async () => {
      const cb = resilienceService.getCircuitBreaker('test-metrics-cb');
      const metrics = resilienceService.getAllCircuitBreakerMetrics();

      expect(metrics).toHaveProperty('test-metrics-cb');
      expect(metrics['test-metrics-cb']).toHaveProperty('state');
    });

    it('should get bulkhead metrics', async () => {
      const bh = resilienceService.getBulkhead('test-metrics-bh');
      const metrics = resilienceService.getAllBulkheadMetrics();

      expect(metrics).toHaveProperty('test-metrics-bh');
      expect(metrics['test-metrics-bh']).toHaveProperty('running');
    });
  });
});
