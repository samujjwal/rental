/**
 * Re-exports auth guards, decorators, and utilities from modules/auth/
 * so that common/ modules can import them without upward dependency violations.
 *
 * All other modules should import from '@/common/auth/' instead of '@/modules/auth/guards' or '@/modules/auth/decorators'.
 */
export { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
export { WsJwtAuthGuard } from '@/modules/auth/guards/ws-jwt-auth.guard';
export { RolesGuard, Permission, ROLES_KEY, PERMISSIONS_KEY } from '@/modules/auth/guards/roles.guard';
export { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
export { Roles } from '@/modules/auth/decorators/roles.decorator';
export { Permissions } from '@/modules/auth/decorators/permissions.decorator';
