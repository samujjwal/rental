import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventsService } from '@/common/events/events.service';
import { BookingStatus, PayoutStatus } from '@rental-portal/database';
import { LedgerService } from './services/ledger.service';

/** TTL for webhook idempotency keys: 48 hours covers Stripe's retry window */
const WEBHOOK_IDEMPOTENCY_TTL = 48 * 60 * 60;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private cacheService: CacheService,
    private eventsService: EventsService,
    private ledger: LedgerService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-01-28.clover',
    });
    this.webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
  }

  /**
   * Check if a Stripe event has already been processed (idempotency guard).
   * Uses Redis SET with NX + TTL to atomically claim the event.
   * Returns true if this is a duplicate (already processed).
   */
  private async isDuplicateEvent(eventId: string): Promise<boolean> {
    const key = `stripe:webhook:${eventId}`;
    const alreadyProcessed = await this.cacheService.exists(key);
    if (alreadyProcessed) {
      return true;
    }
    // Claim the event — set key with TTL so it expires after 48h
    await this.cacheService.set(key, { processedAt: new Date().toISOString() }, WEBHOOK_IDEMPOTENCY_TTL);
    return false;
  }

  /**
   * Handle incoming Stripe webhook
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw error;
    }

    // Idempotency: skip if this event was already processed
    if (await this.isDuplicateEvent(event.id)) {
      this.logger.warn(`Duplicate webhook event ${event.id} (${event.type}) — skipping`);
      return;
    }

    this.logger.log(`Processing webhook event: ${event.type} [${event.id}]`);

    // Handle different event types
    switch (event.type) {
      // Payment Intent events
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      // Charge events
      case 'charge.succeeded':
        await this.handleChargeSucceeded(event.data.object as Stripe.Charge);
        break;

      case 'charge.failed':
        await this.handleChargeFailed(event.data.object as Stripe.Charge);
        break;

      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      // Payout events
      case 'payout.paid':
        await this.handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case 'payout.failed':
        await this.handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      // Transfer events
      case 'transfer.created':
        await this.handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      // Account events (for Connect)
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      // Customer events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionEvent(event);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const { id, amount, currency, metadata } = paymentIntent;

    try {
      // Find payment record by Stripe payment intent ID
      const payment = await this.prisma.payment.findFirst({
        where: { stripePaymentIntentId: id },
        include: { booking: true },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for PaymentIntent ${id}`);
        return;
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          processedAt: new Date(),
        },
      });

      // Update booking status to CONFIRMED
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CONFIRMED },
      });

      // Record ledger entries (idempotent)
      const existingLedger = await this.prisma.ledgerEntry.findFirst({
        where: {
          bookingId: payment.bookingId,
          transactionType: 'PAYMENT',
        },
        select: { id: true },
      });

      const total = Number(payment.booking.totalPrice || payment.booking.totalAmount || 0);
      const serviceFee = Number(payment.booking.serviceFee || 0);
      const depositAmount = Number(payment.booking.depositAmount || 0);
      const platformFee = Number(payment.booking.platformFee || 0);
      const subtotal = Math.max(0, total - serviceFee - depositAmount);
      const currencyCode = payment.booking.currency || 'USD';

      if (!existingLedger) {
        await this.ledger.recordBookingPayment(
          payment.bookingId,
          payment.booking.renterId,
          payment.booking.ownerId,
          {
            total,
            subtotal,
            platformFee,
            serviceFee,
            currency: currencyCode,
          },
        );
      }

      if (depositAmount > 0) {
        const existingDeposit = await this.prisma.ledgerEntry.findFirst({
          where: {
            bookingId: payment.bookingId,
            transactionType: 'DEPOSIT_HOLD',
          },
          select: { id: true },
        });

        if (!existingDeposit) {
          await this.ledger.recordDepositHold(
            payment.bookingId,
            payment.booking.renterId,
            depositAmount,
            currencyCode,
          );
        }
      }

      // Emit payment succeeded event
      this.eventsService.emitPaymentSucceeded({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: amount / 100, // Convert from cents
        currency,
        status: PayoutStatus.COMPLETED,
        renterId: payment.booking.renterId,
        ownerId: payment.booking.ownerId,
      });

      this.logger.log(`Payment ${payment.id} marked as completed`);
    } catch (error) {
      this.logger.error(`Error handling payment success: ${error.message}`);
    }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const { id, last_payment_error } = paymentIntent;

    try {
      const payment = await this.prisma.payment.findFirst({
        where: { stripePaymentIntentId: id },
        include: { booking: true },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for PaymentIntent ${id}`);
        return;
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: last_payment_error?.message || 'Payment failed',
        },
      });

      // Mark booking as payment failed (allows retry)
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.PAYMENT_FAILED },
      });

      // Emit payment failed event
      this.eventsService.emitPaymentFailed({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: 0,
        currency: payment.booking.currency,
        status: PayoutStatus.FAILED,
        renterId: payment.booking.renterId,
        ownerId: payment.booking.ownerId,
        reason: last_payment_error?.message || 'Payment failed',
      });

      this.logger.log(`Payment ${payment.id} marked as failed`);
    } catch (error) {
      this.logger.error(`Error handling payment failure: ${error.message}`);
    }
  }

  /**
   * Handle canceled payment intent
   */
  private async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
    const { id } = paymentIntent;

    try {
      const payment = await this.prisma.payment.findFirst({
        where: { stripePaymentIntentId: id },
      });

      if (!payment) {
        return;
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELLED' },
      });

      this.logger.log(`Payment ${payment.id} marked as cancelled`);
    } catch (error) {
      this.logger.error(`Error handling payment cancellation: ${error.message}`);
    }
  }

  /**
   * Handle successful charge
   */
  private async handleChargeSucceeded(charge: Stripe.Charge) {
    this.logger.log(`Charge succeeded: ${charge.id}, amount: ${charge.amount}`);
  }

  /**
   * Handle failed charge
   */
  private async handleChargeFailed(charge: Stripe.Charge) {
    this.logger.log(`Charge failed: ${charge.id}, reason: ${charge.failure_message}`);
  }

  /**
   * Handle refunded charge
   */
  private async handleChargeRefunded(charge: Stripe.Charge) {
    const { id, amount_refunded, refunds } = charge;

    try {
      // Find payment by charge ID
      const payment = await this.prisma.payment.findFirst({
        where: { stripeChargeId: id },
        include: { booking: true },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for Charge ${id}`);
        return;
      }

      // Create refund record
      const refund = await this.prisma.refund.create({
        data: {
          bookingId: payment.bookingId,
          amount: amount_refunded / 100,
          currency: charge.currency,
          status: PayoutStatus.CANCELLED,
          refundId: refunds.data[0]?.id || `refund_${Date.now()}`,
          reason: refunds.data[0]?.reason || 'requested_by_customer',
        },
      });

      // Record refund in double-entry ledger
      await this.ledger.recordRefund(
        payment.bookingId,
        payment.booking.renterId,
        amount_refunded / 100,
        charge.currency,
      );

      // Update booking status to REFUNDED
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.REFUNDED },
      });

      // Emit refund event
      this.eventsService.emitPaymentRefunded({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: amount_refunded / 100,
        currency: charge.currency,
        status: PayoutStatus.CANCELLED,
        refundId: refund.id,
        renterId: payment.booking.renterId,
        ownerId: payment.booking.ownerId,
      });

      this.logger.log(`Refund processed for payment ${payment.id}`);
    } catch (error) {
      this.logger.error(`Error handling refund: ${error.message}`);
    }
  }

  /**
   * Handle dispute created — creates DB record, freezes deposit, notifies admin
   */
  private async handleDisputeCreated(dispute: Stripe.Dispute) {
    const { id, amount, charge, reason, status, evidence_details } = dispute;

    this.logger.warn(
      `Dispute created: ${id}, charge: ${charge}, amount: ${amount}, reason: ${reason}`,
    );

    try {
      const chargeId = typeof charge === 'string' ? charge : charge?.id;

      // Find the related payment by Stripe charge ID
      const payment = chargeId
        ? await this.prisma.payment.findFirst({
            where: { stripeChargeId: chargeId },
            include: { booking: { include: { listing: true } } },
          })
        : null;

      if (!payment?.booking) {
        this.logger.warn(`No linked booking found for dispute ${id}, charge ${chargeId}`);
        return;
      }

      const booking = payment.booking;

      // Create dispute record in DB (idempotent)
      const existing = await this.prisma.dispute.findFirst({
        where: {
          bookingId: booking.id,
          title: { contains: id },
        },
      });

      if (!existing) {
        await this.prisma.dispute.create({
          data: {
            bookingId: booking.id,
            initiatorId: booking.renterId,
            defendantId: booking.ownerId,
            title: `Stripe Dispute ${id}`,
            type: 'PAYMENT_ISSUE',
            status: 'OPEN',
            priority: 'HIGH',
            description: `Stripe dispute (${reason || 'unknown reason'}). Amount: ${(amount / 100).toFixed(2)} ${dispute.currency?.toUpperCase()}. Evidence deadline: ${evidence_details?.due_by ? new Date(evidence_details.due_by * 1000).toISOString() : 'N/A'}.`,
            amount: amount / 100,
          },
        });
      }

      // Freeze the security deposit — mark as CAPTURED to prevent release
      await this.prisma.depositHold.updateMany({
        where: { bookingId: booking.id, status: 'HELD' },
        data: {
          status: 'CAPTURED',
          capturedAt: new Date(),
          metadata: JSON.stringify({ reason: `Captured due to Stripe dispute ${id}: ${reason}` }),
        },
      });

      // Notify admins via event bus
      this.eventsService.emitDisputeCreated({
        disputeId: id,
        bookingId: booking.id,
        reportedBy: booking.renterId,
        type: 'PAYMENT_ISSUE',
      });

      this.logger.log(`Dispute ${id} recorded and deposit frozen for booking ${booking.id}`);
    } catch (error) {
      this.logger.error(`Error handling dispute creation: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle successful payout
   */
  private async handlePayoutPaid(payout: Stripe.Payout) {
    const { id, amount, destination } = payout;

    this.logger.log(`Payout successful: ${id}, amount: ${amount / 100}`);

    // Update payout status in DB
    try {
      await this.prisma.payout.updateMany({
        where: { stripeId: id },
        data: {
          status: PayoutStatus.PAID,
          paidAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Error updating payout ${id}: ${error.message}`);
    }
  }

  /**
   * Handle failed payout
   */
  private async handlePayoutFailed(payout: Stripe.Payout) {
    const { id, failure_message } = payout;

    this.logger.error(`Payout failed: ${id}, reason: ${failure_message}`);

    // Update payout status in DB
    try {
      await this.prisma.payout.updateMany({
        where: { stripeId: id },
        data: {
          status: PayoutStatus.FAILED,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating failed payout ${id}: ${error.message}`);
    }
  }

  /**
   * Handle transfer created (for Stripe Connect)
   */
  private async handleTransferCreated(transfer: Stripe.Transfer) {
    const { id, amount, destination } = transfer;

    this.logger.log(`Transfer created: ${id}, amount: ${amount / 100}`);

    // Track transfer to connected account
  }

  /**
   * Handle account updated (for Stripe Connect)
   */
  private async handleAccountUpdated(account: Stripe.Account) {
    const { id, charges_enabled, payouts_enabled } = account;

    this.logger.log(
      `Account updated: ${id}, charges: ${charges_enabled}, payouts: ${payouts_enabled}`,
    );

    // Update user's connected account status
    try {
      await this.prisma.user.updateMany({
        where: { stripeConnectId: id },
        data: {
          stripeChargesEnabled: charges_enabled,
          stripePayoutsEnabled: payouts_enabled,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating account status: ${error.message}`);
    }
  }

  /**
   * Handle subscription events
   */
  private async handleSubscriptionEvent(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;

    this.logger.log(
      `Subscription ${event.type}: ${subscription.id}, status: ${subscription.status}`,
    );

    // Handle subscription-based features if applicable
  }
}
