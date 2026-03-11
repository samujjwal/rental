/**
 * CsrfGuard
 *
 * Origin-based CSRF protection for state-mutating endpoints (POST/PUT/PATCH/DELETE).
 *
 * Approach:
 *  - GET / HEAD / OPTIONS are always safe — guard is a no-op.
 *  - For mutating methods, the request's `Origin` or `Referer` header must match
 *    one of the allowed origins from `CORS_ORIGINS` (comma-separated env var).
 *  - In development (`NODE_ENV !== 'production'`), requests without an Origin header
 *    are allowed (e.g. curl / Postman / unit tests).
 *  - In production, requests without an Origin AND without a matching Referer are
 *    rejected unless they carry a valid Bearer token (API-key / mobile clients), in
 *    which case the guard passes them through because JWT Bearer is CSRF-immune.
 *
 * This is applied globally via `setGlobalPrefix` / `useGlobalGuards` in main.ts
 * and can be skipped per-route with @SkipCsrf().
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export const SKIP_CSRF_KEY = 'skipCsrf';
/** Decorate a route or controller to bypass the CSRF check (e.g. webhooks). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

/** HTTP methods that are considered safe / idempotent. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;
  private readonly isProduction: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    const originsRaw =
      process.env.CORS_ORIGINS ||
      this.config.get<string>('CORS_ORIGINS') ||
      this.config.get<string>('frontendUrl') ||
      'http://localhost:3401';

    this.allowedOrigins = new Set(
      originsRaw
        .split(',')
        .map((o) => o.trim().toLowerCase())
        .filter(Boolean),
    );

    this.isProduction = process.env.NODE_ENV === 'production';
  }

  canActivate(context: ExecutionContext): boolean {
    // Allow metadata-decorated routes/controllers to skip this check
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<Request>();

    // Safe HTTP methods are always allowed
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

    // JWT Bearer token auth is inherently CSRF-immune because browsers cannot
    // automatically attach Authorization headers in cross-site requests.
    // Allow requests that carry a Bearer token to pass through.
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) return true;

    // Check Origin header (sent by browsers for cross-origin requests)
    const origin = (req.headers['origin'] as string | undefined)?.toLowerCase();

    if (origin) {
      if (this.isAllowedOrigin(origin)) return true;

      throw new ForbiddenException(
        'CSRF: Request origin is not in the allowed origins list.',
      );
    }

    // No Origin header present (same-origin navigation, curl, server-to-server)
    const referer = (req.headers['referer'] as string | undefined)?.toLowerCase();
    if (referer && !this.isAllowedReferer(referer)) {
      throw new ForbiddenException(
        'CSRF: Referer does not match allowed origins.',
      );
    }

    // In development, allow requests without Origin (Postman/curl/tests)
    if (!this.isProduction) return true;

    // Production: require X-Requested-With for anonymous form submissions
    // that have no Origin and no Bearer token.
    const xRequestedWith = req.headers['x-requested-with'] as string | undefined;
    if (xRequestedWith?.toLowerCase() === 'xmlhttprequest') return true;

    throw new ForbiddenException(
      'CSRF: Mutating requests must include an Authorization header, ' +
      'a same-site Origin, or X-Requested-With: XMLHttpRequest.',
    );
  }

  private isAllowedOrigin(origin: string): boolean {
    if (this.allowedOrigins.has(origin)) return true;
    // Wildcard — if CORS_ORIGINS is '*', allow all
    if (this.allowedOrigins.has('*')) return true;
    return false;
  }

  private isAllowedReferer(referer: string): boolean {
    for (const allowed of this.allowedOrigins) {
      if (referer.startsWith(allowed)) return true;
    }
    return false;
  }
}
