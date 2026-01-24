import { SetMetadata } from '@nestjs/common';
import { RateLimitConfig } from './rate-limit.service';

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Decorator to set rate limit for a route
 * @param config Rate limit configuration
 * @example
 * @RateLimit({ maxRequests: 10, windowMs: 60000 }) // 10 requests per minute
 */
export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);
