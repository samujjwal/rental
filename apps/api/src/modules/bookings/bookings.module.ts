import { Module } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { BookingCalculationService } from './services/booking-calculation.service';
import { BookingPricingService } from './services/booking-pricing.service';
import { InvoiceService } from './services/invoice.service';
import { BookingsController } from './controllers/bookings.controller';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FraudDetectionModule } from '../fraud-detection/fraud-detection.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PolicyEngineModule } from '../policy-engine/policy-engine.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [ListingsModule, FraudDetectionModule, NotificationsModule, InsuranceModule, ModerationModule, PolicyEngineModule, ComplianceModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateMachineService, BookingCalculationService, BookingPricingService, InvoiceService],
  exports: [BookingsService, BookingStateMachineService, BookingPricingService],
})
export class BookingsModule {}
