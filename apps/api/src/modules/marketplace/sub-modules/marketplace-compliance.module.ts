/**
 * MarketplaceComplianceModule
 *
 * Owns trust, safety and regulatory capabilities:
 *   - Compliance Automation (KYC/KYB workflow orchestration)
 *   - Fraud Intelligence
 *   - Reputation (review scores, trust signals)
 *   - Dispute Resolution
 */
import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { MarketplaceOperationsModule } from './marketplace-operations.module';

// Services
import { ComplianceAutomationService } from '../services/compliance-automation.service';
import { FraudIntelligenceService } from '../services/fraud-intelligence.service';
import { ReputationService } from '../services/reputation.service';
import { DisputeResolutionService } from '../services/dispute-resolution.service';

// Controllers
import { ComplianceAutomationController } from '../controllers/compliance-automation.controller';
import { FraudIntelligenceController } from '../controllers/fraud-intelligence.controller';
import { ReputationController } from '../controllers/reputation.controller';
import { DisputeResolutionController } from '../controllers/dispute-resolution.controller';

const SERVICES = [
  ComplianceAutomationService,
  FraudIntelligenceService,
  ReputationService,
  DisputeResolutionService,
];

const CONTROLLERS = [
  ComplianceAutomationController,
  FraudIntelligenceController,
  ReputationController,
  DisputeResolutionController,
];

@Module({
  imports: [PrismaModule, forwardRef(() => MarketplaceOperationsModule)],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES],
  exports: [...SERVICES, forwardRef(() => MarketplaceOperationsModule)],
})
export class MarketplaceComplianceModule {}
