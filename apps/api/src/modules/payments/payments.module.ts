import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { StripeService } from './services/stripe.service';
import { LedgerService } from './services/ledger.service';
import { PayoutsService } from './services/payouts.service';
import { PaymentDataService } from './services/payment-data.service';
import { StripeTaxService } from './services/stripe-tax.service';
import { PaymentEventsService } from './services/payment-events.service';
import { PaymentProviderFactory } from './services/payment-provider-factory.service';
import { EscrowService } from './services/escrow.service';
import { PaymentCommandLogService } from './services/payment-command-log.service';
import { PaymentCommandReconciliationService } from './services/payment-command-reconciliation.service';
import { PaymentProcessor } from './processors/payment.processor';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { PaymentsController } from './controllers/payments.controller';
import { TaxController } from './controllers/tax.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { BookingsModule } from '../bookings/bookings.module';
import { EventsModule } from '@/common/events/events.module';

@Module({
  imports: [
    BookingsModule,
    EventsModule,
    BullModule.registerQueue({ name: 'payments' }),
  ],
  controllers: [PaymentsController, TaxController, WebhookController],
  providers: [
    StripeService,
    LedgerService,
    PayoutsService,
    PaymentDataService,
    StripeTaxService,
    WebhookService,
    PaymentEventsService,
    PaymentProviderFactory,
    EscrowService,
    PaymentCommandLogService,
    PaymentCommandReconciliationService,
    PaymentProcessor,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: StripeService,
    },
  ],
  exports: [
    StripeService,
    LedgerService,
    StripeTaxService,
    PaymentDataService,
    PaymentProviderFactory,
    EscrowService,
    PaymentCommandLogService,
    PAYMENT_PROVIDER,
  ],
})
export class PaymentsModule {}
