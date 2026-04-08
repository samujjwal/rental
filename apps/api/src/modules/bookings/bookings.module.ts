import { Module } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { BookingCalculationService } from './services/booking-calculation.service';
import { BookingPricingService } from './services/booking-pricing.service';
import { BookingPricingBridgeService } from './services/booking-pricing-bridge.service';
import { BookingEligibilityService } from './services/booking-eligibility.service';
import { BookingValidationService } from './services/booking-validation.service';
import { InvoiceService } from './services/invoice.service';
import { BookingsController } from './controllers/bookings.controller';
import { BookingsDevController } from './controllers/bookings-dev.controller';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FraudDetectionModule } from '../fraud-detection/fraud-detection.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PolicyEngineModule } from '../policy-engine/policy-engine.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { BullModule } from '@nestjs/bull';
import { BOOKING_ELIGIBILITY_PORT } from './ports/booking-eligibility.port';
import { BOOKING_PRICING_PORT } from './ports/booking-pricing.port';

// Register the dev controller only when STRIPE_TEST_BYPASS is active
// AND we are not in production. This keeps bypass/reset endpoints completely
// off the production route table.
const devControllers =
  process.env['STRIPE_TEST_BYPASS'] === 'true' &&
  process.env['NODE_ENV'] !== 'production'
    ? [BookingsDevController]
    : [];

@Module({
  imports: [
    ListingsModule, 
    FraudDetectionModule, 
    NotificationsModule, 
    InsuranceModule, 
    ModerationModule, 
    PolicyEngineModule, 
    ComplianceModule,
    BullModule.registerQueue({ name: 'bookings' }),
    BullModule.registerQueue({ name: 'payments' }),
  ],
  controllers: [BookingsController, ...devControllers],
  providers: [
    BookingsService,
    BookingStateMachineService,
    BookingCalculationService,
    BookingPricingService,
    BookingPricingBridgeService,
    BookingValidationService,
    InvoiceService,
    BookingEligibilityService,
    {
      provide: BOOKING_ELIGIBILITY_PORT,
      useExisting: BookingEligibilityService,
    },
    {
      provide: BOOKING_PRICING_PORT,
      useExisting: BookingPricingBridgeService,
    },
  ],
  exports: [BookingsService, BookingStateMachineService, BookingPricingService],
})
export class BookingsModule {}
