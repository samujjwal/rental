import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Metadata key to skip email verification check.
 * Use @SkipEmailVerification() on routes that should be accessible
 * to unverified users (e.g. resend verification, verify email).
 */
export const SKIP_EMAIL_VERIFICATION_KEY = 'skipEmailVerification';
export const SkipEmailVerification = () =>
  SetMetadata(SKIP_EMAIL_VERIFICATION_KEY, true);

/**
 * Metadata key to require email verification.
 * Use @RequireEmailVerification() on routes that need verified email
 * (e.g. create listing, create booking, initiate payment).
 */
export const REQUIRE_EMAIL_VERIFICATION_KEY = 'requireEmailVerification';
export const RequireEmailVerification = () =>
  SetMetadata(REQUIRE_EMAIL_VERIFICATION_KEY, true);

/**
 * Guard that enforces email verification on protected endpoints.
 *
 * Usage:
 *   @RequireEmailVerification()
 *   @Post()
 *   createListing() { ... }
 *
 * The guard reads `req.user.emailVerified` (set by JwtAuthGuard/Passport)
 * and rejects with 403 if the user has not verified their email.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if this route explicitly requires email verification
    const requireVerification = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireVerification) {
      return true; // Guard only activates on routes with @RequireEmailVerification()
    }

    // Check if the route has @SkipEmailVerification()
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // No user on request — let other guards handle authentication
      return true;
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email verification required. Please verify your email address before performing this action.',
      );
    }

    return true;
  }
}
