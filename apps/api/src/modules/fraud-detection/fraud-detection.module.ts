import { Module } from '@nestjs/common';
import { FraudDetectionService } from './services/fraud-detection.service';
import { FraudEventListenerService } from './services/fraud-event-listener.service';
import { FraudDetectionController } from './controllers/fraud-detection.controller';
import { EventsModule } from '@/common/events/events.module';
import { FxModule } from '@/common/fx/fx.module';

@Module({
  imports: [EventsModule, FxModule],
  controllers: [FraudDetectionController],
  providers: [FraudDetectionService, FraudEventListenerService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
