import { Module } from '@nestjs/common';
import { StripeService } from './services/stripe.service';
import { LedgerService } from './services/ledger.service';
import { PayoutsService } from './services/payouts.service';
import { PaymentsController } from './controllers/payments.controller';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule],
  controllers: [PaymentsController],
  providers: [StripeService, LedgerService, PayoutsService],
  exports: [StripeService, LedgerService],
})
export class PaymentsModule {}
