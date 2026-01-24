import { Module } from '@nestjs/common';
import { TaxCalculationService } from './services/tax-calculation.service';

@Module({
  providers: [TaxCalculationService],
  exports: [TaxCalculationService],
})
export class TaxModule {}
