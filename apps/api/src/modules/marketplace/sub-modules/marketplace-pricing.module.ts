/**
 * MarketplacePricingModule
 *
 * Owns all pricing, tax, and liquidity capabilities:
 *   - Pricing Intelligence (real-time price optimisation)
 *   - Liquidity Engine (supply/demand balancing)
 *   - Tax Policy Engine
 *   - Country Policy Pack + Loader (regional rules)
 *   - Geo Distribution
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../common/prisma/prisma.module';

// Services
import { PricingIntelligenceService } from '../services/pricing-intelligence.service';
import { LiquidityEngineService } from '../services/liquidity-engine.service';
import { TaxPolicyEngineService } from '../services/tax-policy-engine.service';
import { CountryPolicyPackService } from '../services/country-policy-pack.service';
import { PolicyPackLoaderService } from '../services/policy-pack-loader.service';
import { GeoDistributionService } from '../services/geo-distribution.service';

// Controllers
import { PricingIntelligenceController } from '../controllers/pricing-intelligence.controller';
import { LiquidityController } from '../controllers/liquidity.controller';
import { TaxPolicyController } from '../controllers/tax-policy.controller';
import { CountryPolicyController } from '../controllers/country-policy.controller';
import { GeoDistributionController } from '../controllers/geo-distribution.controller';

const SERVICES = [
  PricingIntelligenceService,
  LiquidityEngineService,
  TaxPolicyEngineService,
  CountryPolicyPackService,
  PolicyPackLoaderService,
  GeoDistributionService,
];

const CONTROLLERS = [
  PricingIntelligenceController,
  LiquidityController,
  TaxPolicyController,
  CountryPolicyController,
  GeoDistributionController,
];

@Module({
  imports: [PrismaModule],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class MarketplacePricingModule {}
