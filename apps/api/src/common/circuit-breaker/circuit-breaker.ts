import { Logger } from '@nestjs/common';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',    // Normal operation
  OPEN = 'OPEN',        // Circuit is tripped, calls fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before tripping
  resetTimeout: number;        // Time in ms before attempting reset
  halfOpenMaxAttempts: number; // Max attempts in half-open state
  monitoringEnabled?: boolean; // Enable metrics/logging
}

/**
 * Circuit breaker result
 */
export interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  state: CircuitState;
}

/**
 * CircuitBreaker - Protects external service calls from cascading failures
 * 
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker('stripe', {
 *   failureThreshold: 5,
 *   resetTimeout: 60000,
 *   halfOpenMaxAttempts: 3
 * });
 * 
 * const result = await breaker.execute(async () => {
 *   return await stripe.charges.create(chargeData);
 * });
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly logger = new Logger(CircuitBreaker.name);

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenMaxAttempts: 3,
      monitoringEnabled: true,
      ...options,
    };
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
        this.logCircuitState();
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute with result object (no exception thrown)
   */
  async executeSafe<T>(operation: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    try {
      const data = await this.execute(operation);
      return { success: true, data, state: this.state };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        state: this.state,
      };
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.options.monitoringEnabled) {
      this.logger.warn(
        `Circuit breaker '${this.name}' operation failed. ` +
        `Failure count: ${this.failureCount}/${this.options.failureThreshold}`,
      );
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.transitionToOpen();
    }
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.options.resetTimeout;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.error(
        `Circuit breaker '${this.name}' tripped to OPEN state. ` +
        `Will attempt reset after ${this.options.resetTimeout}ms`,
      );
    }
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    if (this.state !== CircuitState.CLOSED) {
      this.state = CircuitState.CLOSED;
      this.logger.log(`Circuit breaker '${this.name}' reset to CLOSED state`);
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    if (this.state !== CircuitState.HALF_OPEN) {
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenAttempts = 0;
      this.logger.log(`Circuit breaker '${this.name}' entered HALF_OPEN state`);
    }
  }

  /**
   * Log current circuit state
   */
  private logCircuitState(): void {
    if (this.options.monitoringEnabled) {
      this.logger.warn(
        `Circuit breaker '${this.name}' is ${this.state}. ` +
        `Failures: ${this.failureCount}, ` +
        `Time since last failure: ${Date.now() - this.lastFailureTime}ms`,
      );
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
    this.logger.log(`Circuit breaker '${this.name}' manually reset to CLOSED state`);
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
export class CircuitBreakerRegistry {
  private static readonly breakers = new Map<string, CircuitBreaker>();
  private static readonly logger = new Logger(CircuitBreakerRegistry.name);

  /**
   * Get or create a circuit breaker
   */
  static get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenMaxAttempts: 3,
        monitoringEnabled: true,
      };
      const breaker = new CircuitBreaker(name, options || defaultOptions);
      this.breakers.set(name, breaker);
      this.logger.log(`Created circuit breaker '${name}'`);
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
    this.logger.log('All circuit breakers reset');
  }

  /**
   * Get status of all circuit breakers
   */
  static getStatus(): Record<string, { state: CircuitState; failureCount: number }> {
    const status: Record<string, { state: CircuitState; failureCount: number }> = {};
    this.breakers.forEach((breaker, name) => {
      status[name] = {
        state: breaker.getState(),
        failureCount: breaker.getFailureCount(),
      };
    });
    return status;
  }
}

/**
 * Decorator for circuit breaker protection
 * Usage:
 * ```typescript
 * @CircuitBreaker('stripe', { failureThreshold: 5, resetTimeout: 60000 })
 * async createCharge(chargeData: CreateChargeDto) {
 *   return await stripe.charges.create(chargeData);
 * }
 * ```
 */
export function CircuitBreakerDecorator(
  name: string,
  options?: CircuitBreakerOptions,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const breakerName = `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const breaker = CircuitBreakerRegistry.get(breakerName, options);
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
