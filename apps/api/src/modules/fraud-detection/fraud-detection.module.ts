import { Module } from '@nestjs/common';
import { FraudDetectionService } from './services/fraud-detection.service';
import { FraudDetectionController } from './controllers/fraud-detection.controller';

@Module({
  controllers: [FraudDetectionController],
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
