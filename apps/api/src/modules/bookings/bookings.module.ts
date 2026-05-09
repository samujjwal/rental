import { Module, forwardRef } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { BookingCalculationService } from './services/booking-calculation.service';
import { BookingPricingService } from './services/booking-pricing.service';
import { BookingPricingBridgeService } from './services/booking-pricing-bridge.service';
import { BookingEligibilityService } from './services/booking-eligibility.service';
import { BookingValidationService } from './services/booking-validation.service';
import { InvoiceService } from './services/invoice.service';
import { BookingOutboxService } from './services/booking-outbox.service';
import { QuoteSnapshotService } from './services/quote-snapshot.service';
import { BookingsController } from './controllers/bookings.controller';
import { BookingsDevController } from './controllers/bookings-dev.controller';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FraudDetectionModule } from '../fraud-detection/fraud-detection.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PolicyEngineModule } from '../policy-engine/policy-engine.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { AuthorizationModule } from '@/common/authorization/authorization.module';
import { BullModule } from '@nestjs/bull';
import { BOOKING_ELIGIBILITY_PORT } from './ports/booking-eligibility.port';
import { BOOKING_PRICING_PORT } from './ports/booking-pricing.port';

// Register the dev controller only when STRIPE_TEST_BYPASS is active
// AND NODE_ENV is 'test' or 'e2e'. This aligns with the stricter guardrail
// in StripeService and prevents bypass in development/staging environments.
const nodeEnv = process.env['NODE_ENV'] || process.env['nodeEnv'];
const devControllers =
  process.env['STRIPE_TEST_BYPASS'] === 'true' &&
  (nodeEnv === 'test' || nodeEnv === 'e2e')
    ? [BookingsDevController]
    : [];

@Module({
  imports: [
    forwardRef(() => ListingsModule),
    FraudDetectionModule,
    NotificationsModule,
    InsuranceModule,
    ModerationModule,
    PolicyEngineModule,
    ComplianceModule,
    AuthorizationModule,
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
    BookingOutboxService,
    QuoteSnapshotService,
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
