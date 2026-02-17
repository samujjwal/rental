import { Module } from '@nestjs/common';
import { StripeService } from './services/stripe.service';
import { LedgerService } from './services/ledger.service';
import { PayoutsService } from './services/payouts.service';
import { StripeTaxService } from './services/stripe-tax.service';
import { PaymentEventsService } from './services/payment-events.service';
import { PaymentsController } from './controllers/payments.controller';
import { TaxController } from './controllers/tax.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { BookingsModule } from '../bookings/bookings.module';
import { EventsModule } from '@/common/events/events.module';

@Module({
  imports: [BookingsModule, EventsModule],
  controllers: [PaymentsController, TaxController, WebhookController],
  providers: [StripeService, LedgerService, PayoutsService, StripeTaxService, WebhookService, PaymentEventsService],
  exports: [StripeService, LedgerService, StripeTaxService],
})
export class PaymentsModule {}
