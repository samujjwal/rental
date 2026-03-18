import { UserRole } from '@rental-portal/database';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

export enum Permission {
  MANAGE_BOOKINGS = 'manage_bookings',
  VIEW_BOOKINGS = 'view_bookings',
  MANAGE_LISTINGS = 'manage_listings',
  MODERATE_LISTINGS = 'moderate_listings',
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  SUSPEND_USERS = 'suspend_users',
  VIEW_FINANCIALS = 'view_financials',
  MANAGE_PAYOUTS = 'manage_payouts',
  PROCESS_REFUNDS = 'process_refunds',
  MANAGE_DISPUTES = 'manage_disputes',
  RESOLVE_DISPUTES = 'resolve_disputes',
  MANAGE_CATEGORIES = 'manage_categories',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_SYSTEM = 'manage_system',
  REVIEW_KYC = 'review_kyc',
}

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.MANAGE_BOOKINGS,
    Permission.VIEW_BOOKINGS,
    Permission.MANAGE_LISTINGS,
    Permission.MODERATE_LISTINGS,
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.SUSPEND_USERS,
    Permission.VIEW_FINANCIALS,
    Permission.MANAGE_DISPUTES,
    Permission.RESOLVE_DISPUTES,
    Permission.MANAGE_CATEGORIES,
    Permission.VIEW_ANALYTICS,
    Permission.REVIEW_KYC,
  ],
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