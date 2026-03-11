import { Logger } from '@nestjs/common';

const logger = new Logger('StripeRetry');

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 500) */
  initialDelayMs?: number;
  /** Maximum delay cap in ms (default: 10_000) */
  maxDelayMs?: number;
  /** Whether to add jitter (default: true) */
  jitter?: boolean;
  /** Only retry on these error types (default: retries all non-permanent errors) */
  retryableErrors?: string[];
}

/** Errors that should never be retried (permanent failures). */
const NON_RETRYABLE_PATTERNS = [
  'authentication',
  'invalid_api_key',
  'api_key_expired',
  'card_declined',
  'expired_card',
  'incorrect_cvc',
  'incorrect_number',
  'resource_missing',
  'idempotency_key_in_use',
];

/**
 * Determine if a Stripe error is retryable.
 * Rate limits (429), server errors (500+), and network failures are retryable.
 * Authentication, validation, and card errors are permanent.
 */
function isRetryable(error: any): boolean {
  // Stripe SDK decorates StripeError with .type and .statusCode
  const statusCode = error?.statusCode || error?.status || 0;
  const errType = error?.type || '';
  const errCode = error?.code || '';
  const message = (error?.message || '').toLowerCase();

  // Rate limit → always retryable
  if (statusCode === 429) return true;

  // Server errors → retryable
  if (statusCode >= 500) return true;

  // Network errors → retryable
  if (errType === 'StripeConnectionError' || errType === 'StripeAPIError') return true;

  // Check against permanent failure patterns
  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (errCode.includes(pattern) || errType.includes(pattern) || message.includes(pattern)) {
      return false;
    }
  }

  // 4xx errors (other than 429) → not retryable by default
  if (statusCode >= 400 && statusCode < 500) return false;

  // Unknown errors → retryable (safer to retry than drop)
  return true;
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 * Formula: min(maxDelay, initialDelay * 2^attempt + jitter)
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  jitter: boolean,
): number {
  const exponentialDelay = initialDelayMs * Math.pow(2, attempt);
  const jitterMs = jitter ? Math.random() * initialDelayMs : 0;
  return Math.min(maxDelayMs, exponentialDelay + jitterMs);
}

/**
 * Execute a Stripe API call with exponential backoff retry.
 *
 * @example
 * ```ts
 * const intent = await withRetry(
 *   () => stripe.paymentIntents.create({ ... }),
 *   { maxAttempts: 3 },
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    maxDelayMs = 10_000,
    jitter = true,
  } = options || {};

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryable(error)) {
        logger.warn(
          `Non-retryable Stripe error (attempt ${attempt + 1}/${maxAttempts}): ${error.message}`,
        );
        throw error;
      }

      if (attempt < maxAttempts - 1) {
        const delay = calculateDelay(attempt, initialDelayMs, maxDelayMs, jitter);
        logger.warn(
          `Retryable Stripe error (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms: ${error.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(
    `Stripe operation failed after ${maxAttempts} attempts: ${lastError?.message}`,
  );
  throw lastError;
}

/**
 * Dead-letter entry for failed webhook events.
 */
export interface DeadLetterEntry {
  eventId: string;
  eventType: string;
  payload: any;
  error: string;
  failedAt: Date;
  attempts: number;
}

const DLQ_REDIS_KEY = 'webhook:dead_letter_queue';

/**
 * Redis-backed dead-letter queue for failed webhook events.
 * Falls back to in-memory storage if no Redis client is provided.
 *
 * In production, construct with a Redis client (ioredis) to persist entries
 * across restarts and prevent data loss.
 */
export class WebhookDeadLetterQueue {
  private readonly logger = new Logger(WebhookDeadLetterQueue.name);
  private readonly fallbackEntries: DeadLetterEntry[] = [];
  private readonly maxSize: number;
  private redis: any | null;

  constructor(maxSize = 10_000, redis?: any) {
    this.maxSize = maxSize;
    this.redis = redis ?? null;
    if (!this.redis) {
      this.logger.warn('WebhookDeadLetterQueue: no Redis client provided, using in-memory fallback');
    }
  }

  /**
   * Provide a Redis client after construction (e.g., from DI).
   */
  setRedis(redis: any): void {
    this.redis = redis;
    // Migrate any in-memory entries to Redis
    if (this.fallbackEntries.length > 0) {
      const pending = [...this.fallbackEntries];
      this.fallbackEntries.length = 0;
      for (const entry of pending) {
        this.enqueue(entry);
      }
    }
  }

  /**
   * Add a failed webhook event to the dead-letter queue.
   */
  async enqueue(entry: DeadLetterEntry): Promise<void> {
    if (this.redis) {
      try {
        const size = await this.redis.llen(DLQ_REDIS_KEY);
        if (size >= this.maxSize) {
          const evictedRaw = await this.redis.lpop(DLQ_REDIS_KEY);
          if (evictedRaw) {
            const evicted = JSON.parse(evictedRaw);
            this.logger.warn(`DLQ full, evicting oldest entry: ${evicted?.eventId}`);
          }
        }
        await this.redis.rpush(DLQ_REDIS_KEY, JSON.stringify(entry));
      } catch (err) {
        this.logger.error(`Redis DLQ enqueue failed, using fallback: ${err.message}`);
        this.fallbackEntries.push(entry);
      }
    } else {
      if (this.fallbackEntries.length >= this.maxSize) {
        const evicted = this.fallbackEntries.shift();
        this.logger.warn(`DLQ full, evicting oldest entry: ${evicted?.eventId}`);
      }
      this.fallbackEntries.push(entry);
    }
    this.logger.error(
      `Webhook event ${entry.eventId} (${entry.eventType}) moved to dead-letter queue after ${entry.attempts} attempts: ${entry.error}`,
    );
  }

  /**
   * Get all entries in the dead-letter queue.
   */
  async getAll(): Promise<DeadLetterEntry[]> {
    if (this.redis) {
      try {
        const raw = await this.redis.lrange(DLQ_REDIS_KEY, 0, -1);
        return raw.map((r: string) => JSON.parse(r));
      } catch (error) {
        this.logger.debug(`Redis DLQ getAll failed, using fallback: ${error instanceof Error ? error.message : error}`);
        return [...this.fallbackEntries];
      }
    }
    return [...this.fallbackEntries];
  }

  /**
   * Get pending entries count.
   */
  async size(): Promise<number> {
    if (this.redis) {
      try {
        return await this.redis.llen(DLQ_REDIS_KEY);
      } catch (error) {
        this.logger.debug(`Redis DLQ size failed, using fallback: ${error instanceof Error ? error.message : error}`);
        return this.fallbackEntries.length;
      }
    }
    return this.fallbackEntries.length;
  }

  /**
   * Remove an entry by event ID (after manual re-processing).
   */
  async remove(eventId: string): Promise<boolean> {
    if (this.redis) {
      try {
        const raw = await this.redis.lrange(DLQ_REDIS_KEY, 0, -1);
        for (const r of raw) {
          const entry = JSON.parse(r);
          if (entry.eventId === eventId) {
            await this.redis.lrem(DLQ_REDIS_KEY, 1, r);
            return true;
          }
        }
        return false;
      } catch (error) {
        this.logger.debug(`Redis DLQ remove failed, falling through to in-memory: ${error instanceof Error ? error.message : error}`);
      }
    }
    const index = this.fallbackEntries.findIndex((e) => e.eventId === eventId);
    if (index >= 0) {
      this.fallbackEntries.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Drain all entries for reprocessing, clearing the queue.
   */
  async drain(): Promise<DeadLetterEntry[]> {
    if (this.redis) {
      try {
        const raw = await this.redis.lrange(DLQ_REDIS_KEY, 0, -1);
        await this.redis.del(DLQ_REDIS_KEY);
        return raw.map((r: string) => JSON.parse(r));
      } catch (error) {
        this.logger.debug(`Redis DLQ drain failed, using fallback: ${error instanceof Error ? error.message : error}`);
      }
    }
    const drained = [...this.fallbackEntries];
    this.fallbackEntries.length = 0;
    return drained;
  }
}
