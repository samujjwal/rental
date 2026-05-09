import { Module } from '@nestjs/common';
import { EmailModule } from '@/common/email/email.module';
import { AuthorizationModule } from '@/common/authorization/authorization.module';
import { OrganizationsService } from './services/organizations.service';
import { OrganizationsController } from './controllers/organizations.controller';

@Module({
  imports: [EmailModule, AuthorizationModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
