import { Module } from '@nestjs/common';
import { FraudDetectionService } from './services/fraud-detection.service';
import { FraudEventListenerService } from './services/fraud-event-listener.service';
import { FraudDetectionController } from './controllers/fraud-detection.controller';
import { EventsModule } from '@/common/events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [FraudDetectionController],
  providers: [FraudDetectionService, FraudEventListenerService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
