import { Module } from '@nestjs/common';
import { StripeService } from './services/stripe.service';
import { LedgerService } from './services/ledger.service';
import { PayoutsService } from './services/payouts.service';
import { StripeTaxService } from './services/stripe-tax.service';
import { PaymentsController } from './controllers/payments.controller';
import { TaxController } from './controllers/tax.controller';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule],
  controllers: [PaymentsController, TaxController],
  providers: [StripeService, LedgerService, PayoutsService, StripeTaxService],
  exports: [StripeService, LedgerService, StripeTaxService],
})
export class PaymentsModule {}
