import { Module } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { BookingCalculationService } from './services/booking-calculation.service';
import { BookingsController } from './controllers/bookings.controller';
import { ListingsModule } from '../listings/listings.module';
import { FraudDetectionModule } from '../fraud-detection/fraud-detection.module';

@Module({
  imports: [ListingsModule, FraudDetectionModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateMachineService, BookingCalculationService],
  exports: [BookingsService, BookingStateMachineService],
})
export class BookingsModule {}
