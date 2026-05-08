import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Security Headers Middleware
 * 
 * This middleware sets HTTP security headers to protect against common web vulnerabilities.
 * Note: Most security headers are already set by Helmet in main.ts. This middleware
 * adds additional headers or overrides for specific security requirements.
 * 
 * Security Headers Set:
 * - X-Frame-Options: DENY (prevents clickjacking)
 * - X-Content-Type-Options: nosniff (prevents MIME sniffing)
 * - X-XSS-Protection: 1; mode=block (legacy XSS protection)
 * - Referrer-Policy: strict-origin-when-cross-origin (controls referrer info)
 * - Permissions-Policy: restricts browser features
 * 
 * NOTE: Content-Security-Policy and Strict-Transport-Security are handled by Helmet
 * in main.ts to ensure proper configuration based on environment.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // X-Frame-Options - Prevents clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options - Prevents MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-XSS-Protection - Legacy XSS protection (modern browsers ignore this)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy - Controls how much referrer information is sent
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy - Restricts browser features (geolocation, camera, etc.)
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );

    // NOTE: Content-Security-Policy is handled by Helmet in main.ts
    // NOTE: Strict-Transport-Security is handled by Helmet in main.ts (HTTPS only)

    next();
  }
}
