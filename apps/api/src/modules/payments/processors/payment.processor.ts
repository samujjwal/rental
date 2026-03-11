/**
 * Payment Queue Processor
 *
 * Handles async payment operations:
 * - retry-payment: Retry failed payments with exponential backoff
 * - capture-escrow: Capture escrow funds after booking completion
 * - release-escrow: Release escrow funds back to renter (cancellation/refund)
 * - process-payout: Process scheduled payouts to hosts
 */
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { StripeService } from '../services/stripe.service';
import { PayoutStatus } from '@rental-portal/database';
import { extractTraceCtx, createTracedLogger, TraceCtxPayload } from '@/common/queue/queue-trace.util';

interface RetryPaymentJob extends TraceCtxPayload {
  paymentIntentId: string;
  bookingId: string;
  attempt: number;
  maxAttempts: number;
}

interface EscrowJob {
  bookingId: string;
  amount?: number;
  currency?: string;
  reason?: string;
}

interface ProcessPayoutJob {
  ownerId: string;
  bookingIds: string[];
  amount: number;
  currency: string;
}

interface SettlementJob {
  bookingId: string;
  ownerId: string;
  ownerStripeConnectId: string;
  amount: number;
  currency: string;
  timestamp: string;
}

interface RefundJob {
  bookingId: string;
  refundRecordId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason: string;
  timestamp: string;
}

interface DepositHoldJob {
  bookingId: string;
  amount: number;
  currency: string;
  renterId: string;
  listingId: string;
  timestamp: string;
}

interface DepositReleaseJob {
  bookingId: string;
  timestamp: string;
}

@Processor('payments')
export class PaymentProcessor {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly stripeService: StripeService,
  ) {}

  @Process('retry-payment')
  async handleRetryPayment(job: Job<RetryPaymentJob>): Promise<{ success: boolean; attempt: number }> {
    const { paymentIntentId, bookingId, attempt, maxAttempts } = job.data;
    const { traceId, requestId } = extractTraceCtx(job);
    const logger = createTracedLogger(PaymentProcessor.name, traceId, requestId);
    logger.log(`Retrying payment ${paymentIntentId}, attempt ${attempt}/${maxAttempts}`);

    try {
      // Check if payment is still in a retryable state
      const payment = await this.prisma.payment.findFirst({
        where: { paymentIntentId, status: 'FAILED' },
        include: { booking: true },
      });

      if (!payment) {
        logger.log(`Payment ${paymentIntentId} no longer in FAILED state, skipping retry`);
        return { success: false, attempt };
      }

      // Update payment status to processing
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PROCESSING', metadata: JSON.stringify({ retryAttempt: attempt }) },
      });

      // The actual Stripe retry is handled by the webhook flow
      // Here we mark it ready for retry and the payment provider picks it up
      logger.log(`Payment ${paymentIntentId} marked for retry, attempt ${attempt}`);

      // If max attempts reached, mark as permanently failed
      if (attempt >= maxAttempts) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failureReason: `Max retry attempts (${maxAttempts}) reached`,
          },
        });

        // Transition booking to payment failed
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'PAYMENT_FAILED' },
        });

        this.events.emitPaymentFailed({
          paymentId: payment.id,
          bookingId,
          amount: Number(payment.amount),
          currency: payment.currency,
          status: PayoutStatus.FAILED,
          renterId: payment.booking.renterId,
          ownerId: payment.booking.ownerId || '',
          reason: 'Max retry attempts reached',
        });

        return { success: false, attempt };
      }

      return { success: true, attempt };
    } catch (error) {
      logger.error(`Payment retry failed for ${paymentIntentId}:`, error);

      // Schedule next retry with exponential backoff if under max attempts
      if (attempt < maxAttempts) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30 * 60 * 1000); // Max 30 min
        await job.queue.add(
          'retry-payment',
          { ...job.data, attempt: attempt + 1 },
          { delay: backoffMs },
        );
      }

      return { success: false, attempt };
    }
  }

  @Process('capture-escrow')
  async handleCaptureEscrow(job: Job<EscrowJob>): Promise<{ captured: boolean }> {
    const { bookingId, amount } = job.data;
    this.logger.log(`Capturing escrow for booking ${bookingId}`);

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { depositHolds: { where: { status: 'HELD' } } },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found for escrow capture`);
        return { captured: false };
      }

      // Mark deposit holds as captured
      for (const hold of booking.depositHolds) {
        await this.prisma.depositHold.update({
          where: { id: hold.id },
          data: {
            status: 'CAPTURED',
            capturedAt: new Date(),
            deductedAmount: amount ? amount : hold.amount,
          },
        });
      }

      this.events.emitEscrowFunded({
        escrowId: booking.depositHolds[0]?.id || bookingId,
        bookingId,
        amount: amount || Number(booking.depositHolds[0]?.amount || 0),
        currency: booking.currency,
      });

      return { captured: true };
    } catch (error) {
      this.logger.error(`Escrow capture failed for booking ${bookingId}:`, error);
      return { captured: false };
    }
  }

  @Process('release-escrow')
  async handleReleaseEscrow(job: Job<EscrowJob>): Promise<{ released: boolean }> {
    const { bookingId, reason } = job.data;
    this.logger.log(`Releasing escrow for booking ${bookingId}, reason: ${reason}`);

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { depositHolds: { where: { status: { in: ['HELD', 'AUTHORIZED'] } } } },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found for escrow release`);
        return { released: false };
      }

      for (const hold of booking.depositHolds) {
        await this.prisma.depositHold.update({
          where: { id: hold.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }

      this.events.emitEscrowReleased({
        escrowId: booking.depositHolds[0]?.id || bookingId,
        bookingId,
        amount: Number(booking.depositHolds[0]?.amount || 0),
        currency: booking.currency,
        releasedTo: booking.renterId,
      });

      return { released: true };
    } catch (error) {
      this.logger.error(`Escrow release failed for booking ${bookingId}:`, error);
      return { released: false };
    }
  }

  @Process('process-payout')
  async handleProcessPayout(job: Job<ProcessPayoutJob>): Promise<{ processed: boolean }> {
    const { ownerId, bookingIds, amount, currency } = job.data;
    this.logger.log(`Processing payout $${amount} ${currency} for owner ${ownerId}`);

    try {
      // Create payout record
      const payout = await this.prisma.payout.create({
        data: {
          ownerId,
          amount,
          currency,
          status: 'PROCESSING',
          metadata: JSON.stringify({ bookingIds }),
        },
      });

      this.events.emitPayoutReleased({
        payoutId: payout.id,
        ownerId,
        amount,
        currency,
        bookingIds,
      });

      return { processed: true };
    } catch (error) {
      this.logger.error(`Payout processing failed for owner ${ownerId}:`, error);
      return { processed: false };
    }
  }

  // ── Financial event handlers (migrated from Redis pub/sub) ──

  @Process('process-settlement')
  async handleSettlement(job: Job<SettlementJob>): Promise<{ settled: boolean }> {
    const { bookingId, ownerId, ownerStripeConnectId, amount, currency } = job.data;
    this.logger.log(`Processing settlement for booking ${bookingId}, amount ${amount} ${currency}`);

    try {
      if (!ownerStripeConnectId) {
        this.logger.warn(`Owner ${ownerId} has no Stripe Connect ID, skipping payout`);
        return { settled: false };
      }

      const payoutId = await this.stripeService.createPayout({
        accountId: ownerStripeConnectId,
        amount,
        currency,
      });

      await this.prisma.payout.create({
        data: {
          ownerId,
          amount,
          currency,
          status: 'COMPLETED',
          transferId: payoutId,
          metadata: JSON.stringify({ bookingId }),
        },
      });

      this.events.emitPayoutReleased({
        payoutId,
        ownerId,
        amount,
        currency,
        bookingIds: [bookingId],
      });

      this.logger.log(`Settlement completed for booking ${bookingId}, payout ${payoutId}`);
      return { settled: true };
    } catch (error) {
      this.logger.error(`Settlement failed for booking ${bookingId}:`, error);
      throw error; // Let Bull retry
    }
  }

  @Process('process-refund')
  async handleRefund(job: Job<RefundJob>): Promise<{ refunded: boolean }> {
    const { bookingId, refundRecordId, paymentIntentId, amount, currency, reason } = job.data;
    this.logger.log(`Processing refund for booking ${bookingId}, amount ${amount} ${currency}`);

    try {
      const stripeRefundId = await this.stripeService.createRefund({
        paymentIntentId,
        amount,
        currency,
        reason,
      });

      // Update the refund record with the Stripe refund ID
      await this.prisma.refund.update({
        where: { id: refundRecordId },
        data: {
          refundId: stripeRefundId,
          status: 'COMPLETED',
        },
      });

      this.logger.log(`Refund completed for booking ${bookingId}, stripe refund ${stripeRefundId}`);
      return { refunded: true };
    } catch (error) {
      this.logger.error(`Refund failed for booking ${bookingId}:`, error);
      throw error; // Let Bull retry
    }
  }

  @Process('hold-deposit')
  async handleDepositHold(job: Job<DepositHoldJob>): Promise<{ held: boolean }> {
    const { bookingId, amount, currency, renterId } = job.data;
    this.logger.log(`Holding deposit for booking ${bookingId}, amount ${amount} ${currency}`);

    try {
      // Prevent double deposit hold — check for existing active hold on this booking
      const existingHold = await this.prisma.depositHold.findFirst({
        where: {
          bookingId,
          status: { in: ['HELD', 'AUTHORIZED', 'PENDING'] },
        },
      });
      if (existingHold) {
        this.logger.log(`Deposit already held for booking ${bookingId}, skipping`);
        return { held: true };
      }

      const holdId = await this.stripeService.holdDeposit({
        bookingId,
        amount,
        currency,
      });

      await this.prisma.depositHold.create({
        data: {
          bookingId,
          amount,
          currency,
          status: 'HELD',
          stripeId: holdId,
          metadata: JSON.stringify({ renterId }),
        },
      });

      this.events.emitEscrowFunded({
        escrowId: holdId,
        bookingId,
        amount,
        currency,
      });

      this.logger.log(`Deposit held for booking ${bookingId}, hold ${holdId}`);
      return { held: true };
    } catch (error) {
      this.logger.error(`Deposit hold failed for booking ${bookingId}:`, error);
      throw error; // Let Bull retry
    }
  }

  @Process('release-deposit')
  async handleDepositRelease(job: Job<DepositReleaseJob>): Promise<{ released: boolean }> {
    const { bookingId } = job.data;
    this.logger.log(`Releasing deposit for booking ${bookingId}`);

    try {
      const holds = await this.prisma.depositHold.findMany({
        where: { bookingId, status: 'HELD' },
      });

      if (holds.length === 0) {
        this.logger.warn(`No active deposit holds found for booking ${bookingId}`);
        return { released: false };
      }

      for (const hold of holds) {
        if (hold.stripeId) {
          await this.stripeService.releaseDeposit(hold.stripeId);
        }

        await this.prisma.depositHold.update({
          where: { id: hold.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }

      const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });

      this.events.emitEscrowReleased({
        escrowId: holds[0].id,
        bookingId,
        amount: Number(holds[0].amount),
        currency: booking?.currency || 'NPR',
        releasedTo: booking?.renterId || '',
      });

      this.logger.log(`Deposit released for booking ${bookingId}`);
      return { released: true };
    } catch (error) {
      this.logger.error(`Deposit release failed for booking ${bookingId}:`, error);
      throw error; // Let Bull retry
    }
  }
}
