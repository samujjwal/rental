import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

@Injectable()
export class RateLimitService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    // Initialize Redis client for rate limiting
    const redisUrl = this.configService.get('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    }
  }

  /**
   * Check if request is within rate limit
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (!this.redis) {
      // If Redis is not available, allow all requests
      return { allowed: true, remaining: config.maxRequests, resetTime: 0 };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Use Redis sorted set to track requests
    const multi = this.redis.multi();

    // Remove old requests outside the window
    multi.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    multi.zcard(key);

    // Add current request
    multi.zadd(key, now, `${now}`);

    // Set expiration
    multi.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await multi.exec();
    const count = results[1][1] as number;

    const allowed = count < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count - 1);
    const resetTime = now + config.windowMs;

    return { allowed, remaining, resetTime };
  }

  /**
   * Get rate limit key for a user
   */
  getUserRateLimitKey(userId: string, endpoint?: string): string {
    return endpoint ? `ratelimit:user:${userId}:${endpoint}` : `ratelimit:user:${userId}`;
  }

  /**
   * Get rate limit key for an IP address
   */
  getIpRateLimitKey(ip: string, endpoint?: string): string {
    return endpoint ? `ratelimit:ip:${ip}:${endpoint}` : `ratelimit:ip:${ip}`;
  }

  /**
   * Block a user temporarily
   */
  async blockUser(userId: string, durationMs: number): Promise<void> {
    if (!this.redis) return;

    const key = `ratelimit:blocked:user:${userId}`;
    await this.redis.setex(key, Math.ceil(durationMs / 1000), '1');
  }

  /**
   * Block an IP temporarily
   */
  async blockIp(ip: string, durationMs: number): Promise<void> {
    if (!this.redis) return;

    const key = `ratelimit:blocked:ip:${ip}`;
    await this.redis.setex(key, Math.ceil(durationMs / 1000), '1');
  }

  /**
   * Check if user is blocked
   */
  async isUserBlocked(userId: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `ratelimit:blocked:user:${userId}`;
    const result = await this.redis.get(key);
    return result !== null;
  }

  /**
   * Check if IP is blocked
   */
  async isIpBlocked(ip: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `ratelimit:blocked:ip:${ip}`;
    const result = await this.redis.get(key);
    return result !== null;
  }

  /**
   * Get remaining requests for a key
   */
  async getRemainingRequests(key: string, maxRequests: number): Promise<number> {
    if (!this.redis) return maxRequests;

    const count = await this.redis.zcard(key);
    return Math.max(0, maxRequests - count);
  }

  /**
   * Clear rate limit for a key
   */
  async clearRateLimit(key: string): Promise<void> {
    if (!this.redis) return;

    await this.redis.del(key);
  }
}
