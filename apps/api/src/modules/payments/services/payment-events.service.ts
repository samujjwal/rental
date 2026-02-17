import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { StripeService } from './stripe.service';
import { PayoutsService } from './payouts.service';
import { BookingStatus, PayoutStatus } from '@rental-portal/database';

interface SettlementEvent {
  bookingId: string;
  ownerId: string;
  ownerStripeConnectId: string | null;
  amount: number;
  currency: string;
  timestamp: string;
}

interface RefundEvent {
  bookingId: string;
  refundRecordId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason: string;
  timestamp: string;
}

interface DepositHoldEvent {
  bookingId: string;
  amount: number;
  currency: string;
  renterId: string;
  listingId: string;
  timestamp: string;
}

interface DepositReleaseEvent {
  bookingId: string;
  timestamp: string;
}

@Injectable()
export class PaymentEventsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly stripeService: StripeService,
    private readonly payoutsService: PayoutsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscribeToPaymentEvents();
  }

  private async subscribeToPaymentEvents(): Promise<void> {
    await this.cacheService.subscribe('booking:settlement', (event: SettlementEvent) =>
      this.handleSettlement(event),
    );

    await this.cacheService.subscribe('booking:refund', (event: RefundEvent) =>
      this.handleRefund(event),
    );

    await this.cacheService.subscribe('booking:deposit-hold', (event: DepositHoldEvent) =>
      this.handleDepositHold(event),
    );

    await this.cacheService.subscribe('booking:deposit-release', (event: DepositReleaseEvent) =>
      this.handleDepositRelease(event),
    );

    this.logger.log('Subscribed to payment event channels');
  }

  private async handleSettlement(event: SettlementEvent): Promise<void> {
    const { bookingId, ownerId, ownerStripeConnectId, amount, currency } = event;

    this.logger.log(`Processing settlement for booking ${bookingId}: ${amount} ${currency}`);

    try {
      if (!ownerStripeConnectId) {
        this.logger.warn(`Owner ${ownerId} has no Stripe Connect ID — skipping payout`);
        return;
      }

      if (amount <= 0) {
        this.logger.warn(`Settlement amount is ${amount} for booking ${bookingId} — skipping`);
        return;
      }

      // Create Stripe payout to owner
      const transferId = await this.stripeService.createPayout(
        ownerStripeConnectId,
        amount,
        currency,
      );

      // Create payout record
      await this.prisma.payout.create({
        data: {
          ownerId,
          amount,
          currency,
          transferId,
          status: PayoutStatus.PENDING,
        },
      });

      // Transition booking from COMPLETED → SETTLED
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.SETTLED },
      });

      this.logger.log(`Settlement completed for booking ${bookingId}, payout: ${transferId}`);
    } catch (error) {
      this.logger.error(`Settlement failed for booking ${bookingId}: ${error.message}`, error.stack);
    }
  }

  private async handleRefund(event: RefundEvent): Promise<void> {
    const { bookingId, refundRecordId, paymentIntentId, amount, reason } = event;

    this.logger.log(`Processing refund for booking ${bookingId}: ${amount}`);

    try {
      // Execute Stripe refund
      const stripeRefundId = await this.stripeService.createRefund(
        paymentIntentId,
        amount,
        reason,
      );

      // Update refund record with Stripe refund ID and mark as completed
      await this.prisma.refund.update({
        where: { id: refundRecordId },
        data: {
          refundId: stripeRefundId,
          status: 'COMPLETED',
        },
      });

      // Transition booking from CANCELLED → REFUNDED
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.REFUNDED },
      });

      this.logger.log(`Refund completed for booking ${bookingId}, stripe: ${stripeRefundId}`);
    } catch (error) {
      this.logger.error(`Refund failed for booking ${bookingId}: ${error.message}`, error.stack);

      // Mark refund as failed in DB
      await this.prisma.refund.update({
        where: { id: refundRecordId },
        data: { status: 'FAILED' },
      }).catch((e) => this.logger.error(`Failed to update refund status: ${e.message}`));
    }
  }

  private async handleDepositHold(event: DepositHoldEvent): Promise<void> {
    const { bookingId, amount, currency } = event;

    this.logger.log(`Processing deposit hold for booking ${bookingId}: ${amount} ${currency}`);

    try {
      await this.stripeService.holdDeposit(bookingId, amount, currency);
      this.logger.log(`Deposit hold created for booking ${bookingId}`);
    } catch (error) {
      this.logger.error(`Deposit hold failed for booking ${bookingId}: ${error.message}`, error.stack);
    }
  }

  private async handleDepositRelease(event: DepositReleaseEvent): Promise<void> {
    const { bookingId } = event;

    this.logger.log(`Processing deposit release for booking ${bookingId}`);

    try {
      const depositHold = await this.prisma.depositHold.findFirst({
        where: { bookingId, status: 'AUTHORIZED' },
      });

      if (!depositHold) {
        this.logger.warn(`No active deposit hold found for booking ${bookingId}`);
        return;
      }

      await this.stripeService.releaseDeposit(depositHold.id);
      this.logger.log(`Deposit released for booking ${bookingId}`);
    } catch (error) {
      this.logger.error(`Deposit release failed for booking ${bookingId}: ${error.message}`, error.stack);
    }
  }
}
