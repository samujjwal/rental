import { SetMetadata } from '@nestjs/common';
import { Permission, PERMISSIONS_KEY } from '@/common/auth/authz.constants';

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);