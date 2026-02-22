import { SetMetadata } from '@nestjs/common';
import { Permission, PERMISSIONS_KEY } from '../guards/roles.guard';

/**
 * Decorator that sets required permissions for a route handler.
 * Works with RolesGuard to check granular permissions based on
 * the user's role and its associated permission set.
 *
 * @example
 * @Permissions(Permission.VIEW_FINANCIALS, Permission.MANAGE_PAYOUTS)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
