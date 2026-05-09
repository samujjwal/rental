import { UserRole } from '@rental-portal/database';

/**
 * Centralized Admin Role Matrix
 * 
 * This file centralizes all admin role definitions to avoid hardcoded role lists
 * throughout the codebase. All admin-related role checks should reference these
 * constants instead of hardcoding role names.
 * 
 * Role Hierarchy (from highest to lowest):
 * - SUPER_ADMIN: Full system access, can manage all other admins
 * - ADMIN: Standard admin access
 * - OPERATIONS_ADMIN: Operational tasks and system maintenance
 * - FINANCE_ADMIN: Financial operations, payouts, refunds
 * - SUPPORT_ADMIN: Customer support and dispute resolution
 */

/**
 * All admin roles (full admin access)
 */
export const ALL_ADMIN_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.OPERATIONS_ADMIN,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_ADMIN,
];

/**
 * Core admin roles (can manage system-wide settings)
 */
export const CORE_ADMIN_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];

/**
 * Operations admin roles (can perform operational tasks)
 */
export const OPERATIONS_ADMIN_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.OPERATIONS_ADMIN,
];

/**
 * Finance admin roles (can manage payments, payouts, refunds)
 */
export const FINANCE_ADMIN_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.FINANCE_ADMIN,
];

/**
 * Support admin roles (can manage disputes and customer support)
 */
export const SUPPORT_ADMIN_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.SUPPORT_ADMIN,
];

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  return ALL_ADMIN_ROLES.includes(role);
}

/**
 * Check if a role is a core admin (ADMIN or SUPER_ADMIN)
 */
export function isCoreAdmin(role: string | undefined): boolean {
  if (!role) return false;
  return CORE_ADMIN_ROLES.includes(role);
}

/**
 * Check if a role has operations admin privileges
 */
export function isOperationsAdmin(role: string | undefined): boolean {
  if (!role) return false;
  return OPERATIONS_ADMIN_ROLES.includes(role);
}

/**
 * Check if a role has finance admin privileges
 */
export function isFinanceAdmin(role: string | undefined): boolean {
  if (!role) return false;
  return FINANCE_ADMIN_ROLES.includes(role);
}

/**
 * Check if a role has support admin privileges
 */
export function isSupportAdmin(role: string | undefined): boolean {
  if (!role) return false;
  return SUPPORT_ADMIN_ROLES.includes(role);
}
