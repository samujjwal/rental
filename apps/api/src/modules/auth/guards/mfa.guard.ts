import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@rental-portal/database';

export const REQUIRE_MFA_KEY = 'requireMFA';

/**
 * Decorator to mark endpoints that require MFA verification.
 * Only applies to admin roles (ADMIN, SUPER_ADMIN, OPERATIONS_ADMIN, FINANCE_ADMIN, SUPPORT_ADMIN).
 */
export const RequireMFA = () => SetMetadata(REQUIRE_MFA_KEY, true);

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if the endpoint requires MFA
    const requireMfa = this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireMfa) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Only apply MFA requirement to admin roles
    const isAdmin = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.OPERATIONS_ADMIN,
      UserRole.FINANCE_ADMIN,
      UserRole.SUPPORT_ADMIN,
    ].includes(user.role);

    if (!isAdmin) {
      return true; // Non-admin users don't need MFA
    }

    // Check if user has MFA enabled
    if (!user.mfaEnabled) {
      throw new ForbiddenException(
        'MFA is required for this action. Please enable two-factor authentication in your security settings.',
      );
    }

    // Check if MFA was verified in this session
    if (!request.mfaVerified) {
      throw new ForbiddenException(
        'MFA verification required. Please provide your two-factor authentication code.',
      );
    }

    return true;
  }
}
