import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private readonly windowMs = 60000; // 1 minute
  private readonly maxRequests = 100;

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.getKey(req);
    const now = Date.now();

    let data = this.requests.get(key);
    if (!data || now > data.resetTime) {
      data = { count: 0, resetTime: now + this.windowMs };
      this.requests.set(key, data);
    }

    data.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - data.count).toString());
    res.setHeader('X-RateLimit-Reset', data.resetTime.toString());

    if (data.count > this.maxRequests) {
      res.setHeader('Retry-After', Math.ceil((data.resetTime - now) / 1000).toString());
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((data.resetTime - now) / 1000)
      });
    }

    next();
  }

  private getKey(req: Request): string {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }
}
