import { Module } from '@nestjs/common';
import { OrganizationScopeService } from './organization-scope.service';

@Module({
  providers: [OrganizationScopeService],
  exports: [OrganizationScopeService],
})
export class AuthorizationModule {}
