import { Module } from '@nestjs/common';
import { InsuranceService } from './services/insurance.service';
import { InsuranceVerificationService } from './services/insurance-verification.service';
import { InsurancePolicyService } from './services/insurance-policy.service';
import { InsuranceClaimsService } from './services/insurance-claims.service';
import { InsuranceController } from './controllers/insurance.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [InsuranceController],
  providers: [InsuranceService, InsuranceVerificationService, InsurancePolicyService, InsuranceClaimsService],
  exports: [InsuranceService, InsuranceClaimsService],
})
export class InsuranceModule {}
