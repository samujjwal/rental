/**
 * MarketplaceAiModule
 *
 * Owns AI-driven marketplace capabilities:
 *   - AI Concierge (natural-language search & recommendations)
 *   - Multi-Modal Search (image + text)
 *   - Demand Forecasting
 *   - Expansion Planner (new market opportunity scoring)
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../common/prisma/prisma.module';

// Services
import { AiConciergeService } from '../services/ai-concierge.service';
import { MultiModalSearchService } from '../services/multi-modal-search.service';
import { DemandForecastingService } from '../services/demand-forecasting.service';
import { ExpansionPlannerService } from '../services/expansion-planner.service';

// Controllers
import { AiConciergeController } from '../controllers/ai-concierge.controller';
import { MarketplaceSearchController } from '../controllers/marketplace-search.controller';
import { DemandForecastController } from '../controllers/demand-forecast.controller';
import { ExpansionController } from '../controllers/expansion.controller';

const SERVICES = [
  AiConciergeService,
  MultiModalSearchService,
  DemandForecastingService,
  ExpansionPlannerService,
];

const CONTROLLERS = [
  AiConciergeController,
  MarketplaceSearchController,
  DemandForecastController,
  ExpansionController,
];

@Module({
  imports: [PrismaModule],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class MarketplaceAiModule {}
