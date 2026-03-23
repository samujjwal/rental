import { Module } from '@nestjs/common';
import { MarketplaceAiModule } from './sub-modules/marketplace-ai.module';
import { MarketplacePricingModule } from './sub-modules/marketplace-pricing.module';
import { MarketplaceComplianceModule } from './sub-modules/marketplace-compliance.module';
import { MarketplaceOperationsModule } from './sub-modules/marketplace-operations.module';

/**
 * MarketplaceModule
 *
 * Facade that composes the four domain-bounded marketplace sub-modules.
 * Each sub-module owns a cohesive slice of the marketplace domain:
 *
 *   MarketplaceAiModule         — AI Concierge, Search, Demand Forecasting, Expansion
 *   MarketplacePricingModule    — Pricing Intelligence, Liquidity, Tax, Policy, Geo
 *   MarketplaceComplianceModule — Compliance, Fraud, Reputation, Dispute Resolution
 *   MarketplaceOperationsModule — Checkout, Payments, Availability, Inventory, Bulk Ops
 */
@Module({
  imports: [
    MarketplaceAiModule,
    MarketplacePricingModule,
    MarketplaceComplianceModule,
    MarketplaceOperationsModule,
  ],
  exports: [
    MarketplaceAiModule,
    MarketplacePricingModule,
    MarketplaceComplianceModule,
    MarketplaceOperationsModule,
  ],
})
export class MarketplaceModule {}

