/**
 * PolicyEngineModule — Global module providing the configuration-driven policy engine.
 *
 * This module is the sole entry point for policy evaluation across the application.
 * Domain services inject PolicyEngineService and ContextResolverService.
 *
 * All country-specific, region-specific, and time-variant business rules are
 * stored in the database and evaluated at runtime — zero hardcoded logic.
 */
import { Module, Global } from '@nestjs/common';
import {
  PolicyEngineService,
  RuleEvaluatorService,
  PolicyRegistryService,
  PolicyAuditService,
  ContextResolverService,
} from './services';

@Global()
@Module({
  providers: [
    RuleEvaluatorService,
    PolicyRegistryService,
    PolicyAuditService,
    PolicyEngineService,
    ContextResolverService,
  ],
  exports: [
    PolicyEngineService,
    ContextResolverService,
    RuleEvaluatorService,
  ],
})
export class PolicyEngineModule {}
