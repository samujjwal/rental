/**
 * Integration Module
 * 
 * Provides cross-module integration and communication services
 */

import { Module, Global } from '@nestjs/common';
import { ResilienceModule } from '@/modules/common/resilience/resilience.module';
import { CrossModuleIntegrationService } from './services/cross-module-integration.service';
import { CommunicationService } from './services/communication.service';

@Global()
@Module({
  imports: [ResilienceModule],
  providers: [CrossModuleIntegrationService, CommunicationService],
  exports: [CrossModuleIntegrationService, CommunicationService],
})
export class IntegrationModule {}

export { CrossModuleIntegrationService, CommunicationService };
