import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService, RateLimitConfig } from './rate-limit.service';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private rateLimitService: RateLimitService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get rate limit config from decorator
    const config = this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, context.getHandler());

    if (!config) {
      // No rate limit configured, allow request
      return true;
    }

    const userId = request.user?.id;
    const ip = request.ip;

    // Check if user or IP is blocked
    if (userId && (await this.rateLimitService.isUserBlocked(userId))) {
      throw new HttpException(
        'Your account has been temporarily blocked due to excessive requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (await this.rateLimitService.isIpBlocked(ip)) {
      throw new HttpException(
        'Too many requests from this IP address',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate rate limit key
    const endpoint = `${request.method}:${request.route?.path || request.url}`;
    const key = userId
      ? this.rateLimitService.getUserRateLimitKey(userId, endpoint)
      : this.rateLimitService.getIpRateLimitKey(ip, endpoint);

    // Check rate limit
    const { allowed, remaining, resetTime } = await this.rateLimitService.checkRateLimit(
      key,
      config,
    );

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', config.maxRequests);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetTime);

    if (!allowed) {
      // If block duration is specified, block the user/IP
      if (config.blockDurationMs) {
        if (userId) {
          await this.rateLimitService.blockUser(userId, config.blockDurationMs);
        } else {
          await this.rateLimitService.blockIp(ip, config.blockDurationMs);
        }
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
