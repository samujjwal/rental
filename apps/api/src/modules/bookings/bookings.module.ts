import { Module } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { BookingCalculationService } from './services/booking-calculation.service';
import { InvoiceService } from './services/invoice.service';
import { BookingsController } from './controllers/bookings.controller';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FraudDetectionModule } from '../fraud-detection/fraud-detection.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ListingsModule, FraudDetectionModule, NotificationsModule, InsuranceModule, ModerationModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateMachineService, BookingCalculationService, InvoiceService],
  exports: [BookingsService, BookingStateMachineService],
})
export class BookingsModule {}
