import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/common/logger/logger.service';

/**
 * Security Middleware
 * 
 * This middleware provides security monitoring and logging for suspicious activity.
 * Security headers are handled by Helmet in main.ts to ensure proper configuration
 * based on environment and to avoid conflicts.
 * 
 * Security Features:
 * - Suspicious activity detection (path traversal, XSS, SQL injection, JavaScript injection)
 * - Security event logging
 * - Request metadata capture for forensic analysis
 * 
 * NOTE: Security headers (CSP, HSTS, X-Frame-Options, etc.) are set by Helmet in main.ts
 * to ensure proper environment-based configuration and avoid duplication.
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Remove sensitive headers that could expose server information
    res.removeHeader('X-Powered-By');

    // Log suspicious activity for security monitoring
    this.detectSuspiciousActivity(req);

    next();
  }

  /**
   * Detects and logs suspicious activity patterns in requests
   * Patterns detected:
   * - Path traversal attempts (.., //)
   * - XSS attempts (<script>, javascript:)
   * - SQL injection attempts (union select, exec, etc.)
   * - JavaScript injection (javascript: protocol)
   */
  private detectSuspiciousActivity(req: Request) {
    const suspiciousPatterns = [
      /(\.\.|\/\/)/, // Path traversal
      /<script>/i, // XSS attempts
      /union.*select/i, // SQL injection
      /javascript:/i, // JavaScript injection
      /<iframe/i, // iframe injection
      /onerror=/i, // onerror event handler injection
      /onload=/i, // onload event handler injection
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
          pattern: pattern.source,
        });
        break;
      }
    }
  }
}
