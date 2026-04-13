/**
 * Retry Logic Interfaces
 * 
 * Defines types and interfaces for retry mechanisms, circuit breaker, and bulkhead patterns
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  onExhausted?: (error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

export interface RetryState {
  attempt: number;
  lastError?: Error;
  nextDelay: number;
  totalDelay: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxCalls: number;
  successThreshold: number;
  monitoringPeriod: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalCalls: number;
  rejectedCalls: number;
}

export interface BulkheadConfig {
  maxConcurrent: number;
  maxQueue: number;
  queueTimeout: number;
}

export interface BulkheadMetrics {
  availableSlots: number;
  queueSize: number;
  running: number;
  completed: number;
  rejected: number;
  queued: number;
}

export interface BulkheadSlot {
  release: () => void;
}

export interface ResilienceConfig {
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  bulkhead?: BulkheadConfig;
  timeout?: number;
}

export interface ResilienceContext {
  operationId: string;
  startTime: Date;
  retryAttempt: number;
  circuitBreakerState: CircuitBreakerState;
}

export type RetryCondition = (error: Error) => boolean;

export interface RetryStrategy {
  shouldRetry: RetryCondition;
  calculateDelay: (attempt: number, baseDelay: number) => number;
}
