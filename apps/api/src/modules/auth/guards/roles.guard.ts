import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@rental-portal/database';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

/**
 * Permission definitions for granular admin access control.
 */
export enum Permission {
  // Booking permissions
  MANAGE_BOOKINGS = 'manage_bookings',
  VIEW_BOOKINGS = 'view_bookings',

  // Listing permissions
  MANAGE_LISTINGS = 'manage_listings',
  MODERATE_LISTINGS = 'moderate_listings',

  // User permissions
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  SUSPEND_USERS = 'suspend_users',

  // Financial permissions
  VIEW_FINANCIALS = 'view_financials',
  MANAGE_PAYOUTS = 'manage_payouts',
  PROCESS_REFUNDS = 'process_refunds',

  // Dispute permissions
  MANAGE_DISPUTES = 'manage_disputes',
  RESOLVE_DISPUTES = 'resolve_disputes',

  // System permissions
  MANAGE_CATEGORIES = 'manage_categories',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_SYSTEM = 'manage_system',

  // KYC/Identity
  REVIEW_KYC = 'review_kyc',
}

/**
 * Role → permissions mapping.
 * SUPER_ADMIN has all permissions.
 * Sub-admin roles have scoped permissions.
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.OPERATIONS_ADMIN]: [
    Permission.MANAGE_BOOKINGS,
    Permission.VIEW_BOOKINGS,
    Permission.MANAGE_LISTINGS,
    Permission.MODERATE_LISTINGS,
    Permission.VIEW_USERS,
    Permission.MANAGE_CATEGORIES,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_DISPUTES,
    Permission.RESOLVE_DISPUTES,
    Permission.REVIEW_KYC,
  ],
  [UserRole.FINANCE_ADMIN]: [
    Permission.VIEW_BOOKINGS,
    Permission.VIEW_FINANCIALS,
    Permission.MANAGE_PAYOUTS,
    Permission.PROCESS_REFUNDS,
    Permission.VIEW_ANALYTICS,
  ],
  [UserRole.SUPPORT_ADMIN]: [
    Permission.VIEW_BOOKINGS,
    Permission.VIEW_USERS,
    Permission.MANAGE_DISPUTES,
    Permission.RESOLVE_DISPUTES,
    Permission.MANAGE_BOOKINGS,
    Permission.REVIEW_KYC,
  ],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check role-based access
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Check permission-based access
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Role check
    if (requiredRoles) {
      const hasRole = requiredRoles.includes(user.role);
      // SUPER_ADMIN and ADMIN pass any role check
      const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;

      if (!hasRole && !isAdmin) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    // Permission check
    if (requiredPermissions) {
      const userPermissions = ROLE_PERMISSIONS[user.role] || [];
      const hasAllPermissions = requiredPermissions.every((p) => userPermissions.includes(p));

      if (!hasAllPermissions) {
        throw new ForbiddenException('Insufficient permissions for this action');
      }
    }

    return true;
  }
}
