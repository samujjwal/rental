import { Module } from '@nestjs/common';
import { DynamicPricingService } from './services/dynamic-pricing.service';

@Module({
  providers: [DynamicPricingService],
  exports: [DynamicPricingService],
})
export class PricingModule {}
