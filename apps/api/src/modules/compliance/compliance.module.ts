import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { PolicyEngineModule } from '../policy-engine/policy-engine.module';
import { EventsModule } from '@/common/events/events.module';

@Module({
  imports: [PolicyEngineModule, EventsModule],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
