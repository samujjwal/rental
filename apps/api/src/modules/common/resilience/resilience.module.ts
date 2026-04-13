/**
 * Resilience Module
 * 
 * Provides retry logic, circuit breaker, and bulkhead patterns for system resilience
 */

import { Module, Global } from '@nestjs/common';
import { RetryService, CircuitBreaker, Bulkhead, ResilienceService } from './services/retry.service';

@Global()
@Module({
  providers: [RetryService, ResilienceService],
  exports: [RetryService, ResilienceService],
})
export class ResilienceModule {}

export { RetryService, CircuitBreaker, Bulkhead, ResilienceService };
