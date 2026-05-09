import { Module } from '@nestjs/common';
import { DynamicPricingService } from './services/dynamic-pricing.service';
import { CanonicalPricingService } from './services/canonical-pricing.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PolicyEngineModule } from '../policy-engine/policy-engine.module';

@Module({
  imports: [PolicyEngineModule],
  providers: [
    DynamicPricingService,
    CanonicalPricingService,
    PrismaService,
    ConfigService,
  ],
  exports: [DynamicPricingService, CanonicalPricingService],
})
export class PricingModule {}
