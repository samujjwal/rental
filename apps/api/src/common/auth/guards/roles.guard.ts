import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@rental-portal/database';

import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import {
  Permission,
  PERMISSIONS_KEY,
  ROLE_PERMISSIONS,
  ROLES_KEY,
} from '@/common/auth/authz.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw i18nForbidden('auth.notAuthenticated');
    }

    if (requiredRoles) {
      const hasRole = requiredRoles.includes(user.role);
      const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;

      if (!hasRole && !isAdmin) {
        throw i18nForbidden('auth.insufficientPermissions');
      }
    }

    if (requiredPermissions) {
      const userPermissions = ROLE_PERMISSIONS[user.role] || [];
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
        throw i18nForbidden('auth.insufficientPermissions');
      }
    }

    return true;
  }
}