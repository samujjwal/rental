import { Module } from '@nestjs/common';
import { FraudDetectionService } from './services/fraud-detection.service';

@Module({
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
