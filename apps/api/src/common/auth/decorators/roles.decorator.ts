import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@rental-portal/database';
import { ROLES_KEY } from '@/common/auth/authz.constants';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);