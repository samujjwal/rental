/**
 * MarketplaceAiModule public API barrel
 *
 * Only symbols exported here are considered part of the MarketplaceAiModule's
 * public surface. Consumers outside this module MUST import via this barrel,
 * not by importing service/controller files directly.
 *
 * This enforces the logical sub-module boundary at the physical file level
 * without requiring a full directory move (that would break all imports).
 */

export { AiConciergeService } from '../services/ai-concierge.service';
export { MultiModalSearchService } from '../services/multi-modal-search.service';
export { DemandForecastingService } from '../services/demand-forecasting.service';
export { ExpansionPlannerService } from '../services/expansion-planner.service';
