import { Module } from '@nestjs/common';
import { InsuranceService } from './services/insurance.service';
import { InsuranceVerificationService } from './services/insurance-verification.service';
import { InsurancePolicyService } from './services/insurance-policy.service';
import { InsuranceController } from './controllers/insurance.controller';

@Module({
  controllers: [InsuranceController],
  providers: [
    InsuranceService,
    InsuranceVerificationService,
    InsurancePolicyService,
  ],
  exports: [InsuranceService],
})
export class InsuranceModule {}
