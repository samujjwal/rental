import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class CacheService {
  private readonly redis: Redis;
  private readonly pubClient: Redis;
  private readonly subClient: Redis;
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL: number;
  private readonly subscribers = new Map<string, Set<(message: any) => void>>();
  private messageHandlerBound = false;

  // Circuit breaker state
  private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5; // Trip after 5 consecutive failures
  private readonly resetTimeout = 30_000; // Try again after 30 seconds
  private readonly halfOpenMaxAttempts = 2; // Allow 2 attempts in half-open
  private halfOpenAttempts = 0;

  constructor(private readonly configService: ConfigService) {
    const redisConfig: RedisOptions = {
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get('redis.password'),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.redis = new Redis(redisConfig);
    this.pubClient = new Redis(redisConfig);
    this.subClient = new Redis({
      ...redisConfig,
      // Subscriber connections can fail ready checks after entering pub/sub mode.
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
    this.defaultTTL = this.configService.get('redis.ttl', 3600);

    this.redis.on('error', (err) => this.logger.error('Redis error', err));
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
      this.resetCircuitBreaker();
    });
    this.pubClient.on('error', (err) => this.logger.error('Redis publish client error', err));
    this.subClient.on('error', (err) => this.logger.error('Redis subscribe client error', err));
  }

  /**
   * Circuit breaker: check if Redis operations should be allowed.
   * Returns true if the circuit is open (should skip Redis).
   */
  private isCircuitOpen(): boolean {
    if (this.circuitState === 'CLOSED') return false;

    if (this.circuitState === 'OPEN') {
      // Check if reset timeout has elapsed → transition to HALF_OPEN
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.circuitState = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        this.logger.log('Redis circuit breaker transitioning to HALF_OPEN');
        return false; // Allow attempt
      }
      return true; // Still open — skip Redis
    }

    // HALF_OPEN: allow a limited number of attempts
    if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
      return true; // Exceeded half-open attempts
    }
    return false;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === 'HALF_OPEN') {
      // Failure in half-open → back to open
      this.circuitState = 'OPEN';
      this.logger.error(`Redis circuit breaker OPEN after half-open failure (${this.failureCount} total failures)`);
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.circuitState = 'OPEN';
      this.logger.error(
        `Redis circuit breaker OPEN after ${this.failureCount} consecutive failures. ` +
        `All cache operations will return defaults for ${this.resetTimeout / 1000}s. ` +
        `This will cause increased database load.`,
      );
    }
  }

  private recordSuccess(): void {
    if (this.circuitState === 'HALF_OPEN') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.resetCircuitBreaker();
        this.logger.log('Redis circuit breaker CLOSED — Redis recovered');
      }
    } else {
      this.failureCount = 0;
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
  }

  /** Expose circuit state for health checks and testing */
  getCircuitState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.circuitState;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isCircuitOpen()) return null;
    try {
      const value = await this.redis.get(key);
      this.recordSuccess();
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.recordFailure();
      this.logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (this.isCircuitOpen()) return;
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      if (expiry > 0) {
        await this.redis.setex(key, expiry, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      this.logger.error(`Error setting key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (this.isCircuitOpen()) return;
    try {
      await this.redis.del(key);
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      this.logger.error(`Error deleting key ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Error deleting pattern ${pattern}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.isCircuitOpen()) return false;
    try {
      const result = await this.redis.exists(key);
      this.recordSuccess();
      return result === 1;
    } catch (error) {
      this.recordFailure();
      this.logger.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Atomically set a key only if it does not exist ("set if not exists").
   * Returns true if the key was set (i.e., it was not previously present),
   * or false if the key already existed (duplicate/concurrent call).
   */
  async setNx(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      // Use SET key value EX ttl NX — atomic set-if-not-exists with expiry
      const result = expiry > 0
        ? await this.redis.set(key, serialized, 'EX', expiry, 'NX')
        : await this.redis.set(key, serialized, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Error setNx key ${key}:`, error);
      return false;
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, by);
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Error setting expiry for key ${key}:`, error);
    }
  }

  // ─── Redis Set operations (for WebSocket presence, etc.) ───

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Error adding to set ${key}:`, error);
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Error removing from set ${key}:`, error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      this.logger.error(`Error getting set members for ${key}:`, error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      return (await this.redis.sismember(key, member)) === 1;
    } catch (error) {
      this.logger.error(`Error checking set membership for ${key}:`, error);
      return false;
    }
  }

  // ─── Redis Hash operations ───
  async hset(key: string, field: string, value: unknown): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.hset(key, field, serialized);
    } catch (error) {
      this.logger.error(`Error setting hash field ${field} in ${key}:`, error);
    }
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting hash field ${field} from ${key}:`, error);
      return null;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      const data = await this.redis.hgetall(key);
      const result: Record<string, T> = {};

      for (const [field, value] of Object.entries(data)) {
        result[field] = JSON.parse(value);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error getting all hash fields from ${key}:`, error);
      return {};
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    try {
      await this.redis.hdel(key, field);
    } catch (error) {
      this.logger.error(`Error deleting hash field ${field} from ${key}:`, error);
    }
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    try {
      await this.redis.zadd(key, score, member);
    } catch (error) {
      this.logger.error(`Error adding to sorted set ${key}:`, error);
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.redis.zrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Error getting range from sorted set ${key}:`, error);
      return [];
    }
  }

  async zrem(key: string, member: string): Promise<void> {
    try {
      await this.redis.zrem(key, member);
    } catch (error) {
      this.logger.error(`Error removing from sorted set ${key}:`, error);
    }
  }

  async delete(key: string): Promise<boolean> {
    if (this.isCircuitOpen()) return false;
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    try {
      const serialized = JSON.stringify(message);
      await this.pubClient.publish(channel, serialized);
    } catch (error) {
      this.logger.error(`Error publishing to channel ${channel}:`, error);
    }
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      if (!this.messageHandlerBound) {
        this.subClient.on('message', (ch, msg) => {
          const callbacks = this.subscribers.get(ch);
          if (!callbacks || callbacks.size === 0) {
            return;
          }

          let parsed: any;
          try {
            parsed = JSON.parse(msg);
          } catch (error) {
            this.logger.error(`Error parsing message from ${ch}:`, error);
            return;
          }

          callbacks.forEach((cb) => {
            try {
              cb(parsed);
            } catch (error) {
              this.logger.error(`Error handling message callback for ${ch}:`, error);
            }
          });
        });
        this.messageHandlerBound = true;
      }

      const existing = this.subscribers.get(channel);
      if (existing) {
        existing.add(callback);
        return;
      }

      this.subscribers.set(channel, new Set([callback]));
      await this.subClient.subscribe(channel);
    } catch (error) {
      this.logger.error(`Error subscribing to channel ${channel}:`, error);
    }
  }

  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }

  getClient(): Redis {
    return this.redis;
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.redis.quit(),
      this.pubClient.quit(),
      this.subClient.quit(),
    ]);
  }
}
