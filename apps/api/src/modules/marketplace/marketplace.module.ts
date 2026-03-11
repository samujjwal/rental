import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

// V5 Enterprise Services
import { LiquidityEngineService } from './services/liquidity-engine.service';
import { AiConciergeService } from './services/ai-concierge.service';
import { DemandForecastingService } from './services/demand-forecasting.service';
import { ExpansionPlannerService } from './services/expansion-planner.service';
import { MultiModalSearchService } from './services/multi-modal-search.service';
import { PricingIntelligenceService } from './services/pricing-intelligence.service';
import { FraudIntelligenceService } from './services/fraud-intelligence.service';
import { InventoryGraphService } from './services/inventory-graph.service';
import { AvailabilityGraphService } from './services/availability-graph.service';
import { PaymentOrchestrationService } from './services/payment-orchestration.service';
import { TaxPolicyEngineService } from './services/tax-policy-engine.service';
import { CountryPolicyPackService } from './services/country-policy-pack.service';
import { ReputationService } from './services/reputation.service';
import { DisputeResolutionService } from './services/dispute-resolution.service';
import { ObservabilityService } from './services/observability.service';
import { GeoDistributionService } from './services/geo-distribution.service';
import { ComplianceAutomationService } from './services/compliance-automation.service';
import { CheckoutOrchestratorService } from './services/checkout-orchestrator.service';
import { PolicyPackLoaderService } from './services/policy-pack-loader.service';

// V5 Enterprise Controllers
import { LiquidityController } from './controllers/liquidity.controller';
import { AiConciergeController } from './controllers/ai-concierge.controller';
import { DemandForecastController } from './controllers/demand-forecast.controller';
import { ExpansionController } from './controllers/expansion.controller';
import { MarketplaceSearchController } from './controllers/marketplace-search.controller';
import { PricingIntelligenceController } from './controllers/pricing-intelligence.controller';
import { FraudIntelligenceController } from './controllers/fraud-intelligence.controller';
import { InventoryGraphController } from './controllers/inventory-graph.controller';
import { AvailabilityController } from './controllers/availability.controller';
import { PaymentOrchestrationController } from './controllers/payment-orchestration.controller';
import { TaxPolicyController } from './controllers/tax-policy.controller';
import { CountryPolicyController } from './controllers/country-policy.controller';
import { ReputationController } from './controllers/reputation.controller';
import { DisputeResolutionController } from './controllers/dispute-resolution.controller';
import { ObservabilityController } from './controllers/observability.controller';
import { GeoDistributionController } from './controllers/geo-distribution.controller';
import { ComplianceAutomationController } from './controllers/compliance-automation.controller';
import { CheckoutController } from './controllers/checkout.controller';

// Gateways
import { AvailabilityGateway } from './gateways/availability.gateway';

const V5_SERVICES = [
  PolicyPackLoaderService,
  LiquidityEngineService,
  AiConciergeService,
  DemandForecastingService,
  ExpansionPlannerService,
  MultiModalSearchService,
  PricingIntelligenceService,
  FraudIntelligenceService,
  InventoryGraphService,
  AvailabilityGraphService,
  PaymentOrchestrationService,
  TaxPolicyEngineService,
  CountryPolicyPackService,
  ReputationService,
  DisputeResolutionService,
  ObservabilityService,
  GeoDistributionService,
  ComplianceAutomationService,
  CheckoutOrchestratorService,
];

const V5_CONTROLLERS = [
  LiquidityController,
  AiConciergeController,
  DemandForecastController,
  ExpansionController,
  MarketplaceSearchController,
  PricingIntelligenceController,
  FraudIntelligenceController,
  InventoryGraphController,
  AvailabilityController,
  PaymentOrchestrationController,
  TaxPolicyController,
  CountryPolicyController,
  ReputationController,
  DisputeResolutionController,
  ObservabilityController,
  GeoDistributionController,
  ComplianceAutomationController,
  CheckoutController,
];

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [...V5_CONTROLLERS],
  providers: [...V5_SERVICES, AvailabilityGateway],
  exports: [...V5_SERVICES],
})
export class MarketplaceModule {}
