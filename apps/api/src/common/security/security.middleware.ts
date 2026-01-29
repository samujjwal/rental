import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/common/logger/logger.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Content Security Policy
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    res.setHeader('Content-Security-Policy', cspDirectives);

    // Log suspicious activity
    this.detectSuspiciousActivity(req);

    next();
  }

  private detectSuspiciousActivity(req: Request) {
    const suspiciousPatterns = [
      /(\.\.|\/\/)/g, // Path traversal
      /<script>/gi, // XSS attempts
      /union.*select/gi, // SQL injection
      /javascript:/gi, // JavaScript injection
    ];

    const url = req.url;
    const body = JSON.stringify(req.body);

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body)) {
        this.logger.logSecurityEvent('Suspicious Request Detected', {
          ip: req.ip,
          url: req.url,
          method: req.method,
          userAgent: req.get('user-agent'),
          userId: (req as any).user?.id,
        });
        break;
      }
    }
  }
}
