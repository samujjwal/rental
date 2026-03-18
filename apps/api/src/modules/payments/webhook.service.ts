import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventsService } from '@/common/events/events.service';
import { BookingStatus, PayoutStatus, PaymentStatus, RefundStatus } from '@rental-portal/database';
import { fromMinorUnits } from '@rental-portal/shared-types';
import { LedgerService } from './services/ledger.service';
import { EscrowService } from './services/escrow.service';
import { WebhookDeadLetterQueue, DeadLetterEntry } from './utils/stripe-retry';
import { BookingStateMachineService } from '@/modules/bookings/services/booking-state-machine.service';

/** TTL for webhook idempotency keys: 48 hours covers Stripe's retry window */
const WEBHOOK_IDEMPOTENCY_TTL = 48 * 60 * 60;

@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  readonly deadLetter = new WebhookDeadLetterQueue();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private cacheService: CacheService,
    private eventsService: EventsService,
    private ledger: LedgerService,
    private escrowService: EscrowService,
    private bookingStateMachine: BookingStateMachineService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    const nodeEnv = this.configService.get<string>('nodeEnv') || process.env.NODE_ENV;

    if (!stripeKey || !webhookSecret) {
      if (nodeEnv === 'development') {
        this.logger.warn(
          'STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured — Webhook service disabled in development',
        );
        this.stripe = new Stripe('sk_test_dev_placeholder_key', {
          apiVersion: '2026-01-28.clover',
        });
        this.webhookSecret = 'wh_test_dev_placeholder_secret';
      } else {
        if (!stripeKey) {
          throw new Error(
            'STRIPE_SECRET_KEY is not configured. Set it in environment variables.',
          );
        }
        if (!webhookSecret) {
          throw new Error(
            'STRIPE_WEBHOOK_SECRET is not configured. Set it in environment variables.',
          );
        }
      }
    } else {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2026-01-28.clover',
      });
      this.webhookSecret = webhookSecret;
    }
  }

  onModuleInit() {
    // Wire Redis into the DLQ so entries survive restarts
    try {
      const redis = this.cacheService.getClient();
      this.deadLetter.setRedis(redis);
      this.logger.log('WebhookDeadLetterQueue backed by Redis');
    } catch (err) {
      this.logger.warn(`DLQ Redis init failed, using in-memory fallback: ${err.message}`);
    }
  }

  /**
   * Release an idempotency lock so Stripe retries can reprocess a failed event.
   * Called in catch blocks, after enqueuing to dead-letter, before re-throwing.
   */
  private async releaseEventLock(eventId: string): Promise<void> {
    try {
      await this.cacheService.del(`stripe:webhook:${eventId}`);
    } catch (err) {
      this.logger.warn(`Failed to release idempotency lock for event ${eventId}: ${err.message}`);
    }
  }

  /**
   * Check if a Stripe event has already been processed (idempotency guard).
   * Uses Redis SET NX (atomic set-if-not-exists) to claim the event.
   * Returns true if this is a duplicate (already processed).
   * Falls back to allowing processing if Redis is unavailable — Stripe's
   * own event structure and our DB-level idempotency checks provide safety.
   */
  private async isDuplicateEvent(eventId: string): Promise<boolean> {
    try {
      const key = `stripe:webhook:${eventId}`;
      // Atomically try to claim this event. Returns true if we claimed it (new event).
      const claimed = await this.cacheService.setNx(
        key,
        { processedAt: new Date().toISOString() },
        WEBHOOK_IDEMPOTENCY_TTL,
      );
      // If we couldn't claim it, it's a duplicate
      return !claimed;
    } catch (error) {
      // Redis is down — allow processing to continue.
      // DB-level constraints and handler-specific idempotency checks (e.g. refund dedup)
      // provide a secondary safety net.
      this.logger.warn(
        `Redis unavailable for idempotency check on event ${eventId}: ${error.message}. Allowing processing.`,
      );
      return false;
    }
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

    // Process event with dead-letter queue for irrecoverable processing failures
    try {
      await this.processEvent(event);
    } catch (processingError) {
      this.logger.error(
        `Failed to process webhook ${event.id} (${event.type}): ${processingError.message}`,
      );
      // Release the idempotency lock so Stripe retries can reprocess this event
      await this.releaseEventLock(event.id);
      await this.deadLetter.enqueue({
        eventId: event.id,
        eventType: event.type,
        payload: event.data.object,
        error: processingError.message,
        failedAt: new Date(),
        attempts: 1,
      });
      // Re-throw to signal 500 to Stripe so it retries
      throw processingError;
    }
  }

  /**
   * Process a verified Stripe event — dispatches to the correct handler.
   */
  private async processEvent(event: Stripe.Event): Promise<void> {
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

      case 'payment_intent.requires_action':
        await this.handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
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

      case 'refund.updated':
        await this.handleRefundUpdated(event.data.object as Stripe.Refund);
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

      // Route booking confirmation through the authoritative state machine so that
      // all preconditions, guards, optimistic-lock, state-history creation, cache
      // invalidation, and side-effects (reminder notification, deposit hold) are
      // applied uniformly regardless of whether the trigger is a UI action or a
      // Stripe webhook.  This eliminates B6 (bypassing state machine guards).
      //
      // Idempotency: if the booking is already CONFIRMED (duplicate webhook replay
      // after the idempotency guard window), we log and skip — the optimistic-lock
      // inside transition() would reject the updateMany anyway, but we short-circuit
      // here to avoid a noisy BadRequestException in the logs.
      const currentStatus = payment.booking.status;
      if (currentStatus === BookingStatus.PENDING_PAYMENT) {
        await this.bookingStateMachine.transition(
          payment.bookingId,
          'COMPLETE_PAYMENT',
          'SYSTEM',
          'SYSTEM',
          { paymentIntentId: id, source: 'stripe_webhook' },
        );
      } else if (currentStatus !== BookingStatus.CONFIRMED) {
        this.logger.warn(
          `Booking ${payment.bookingId} is in unexpected state ${currentStatus} ` +
          `when processing payment_intent.succeeded [${id}]. ` +
          `Ledger entries will still be reconciled.`,
        );
      }

      // Record ledger entries (idempotent)
      const existingLedger = await this.prisma.ledgerEntry.findFirst({
        where: {
          bookingId: payment.bookingId,
          transactionType: 'PAYMENT',
        },
        select: { id: true },
      });

      const total = Number(payment.booking.totalPrice || 0);
      const serviceFee = Number(payment.booking.serviceFee || 0);
      const depositAmount = Number(payment.booking.depositAmount || 0);
      const platformFee = Number(payment.booking.platformFee || 0);
      const taxAmount = Number(payment.booking.taxAmount || 0);
      // Subtract all non-owner components: serviceFee, platformFee, deposit, and tax
      const subtotal = Math.max(0, total - serviceFee - platformFee - depositAmount - taxAmount);
      const currencyCode = payment.booking.currency;

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

      // Create and fund escrow for the booking payment
      const escrow = await this.escrowService.createEscrow({
        bookingId: payment.bookingId,
        amount: subtotal,
        currency: currencyCode,
        releaseCondition: 'checkout_confirmed',
      });
      await this.escrowService.fundEscrow(escrow.id);
      this.logger.log(`Escrow ${escrow.id} created and funded for booking ${payment.bookingId}`);

      // Emit payment succeeded event
      this.eventsService.emitPaymentSucceeded({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: fromMinorUnits(amount, currency), // Convert from minor units (handles zero-decimal currencies)
        currency,
        status: PayoutStatus.COMPLETED,
        renterId: payment.booking.renterId,
        ownerId: payment.booking.ownerId,
      });

      this.logger.log(`Payment ${payment.id} marked as completed`);
    } catch (error) {
      this.logger.error(`Error handling payment success: ${error.message}`, error.stack);
      throw error; // Rethrow so Stripe retries on transient failures
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

      // Mark booking as payment failed with optimistic lock + state history
      await this.prisma.$transaction(async (tx: any) => {
        const updated = await tx.booking.updateMany({
          where: {
            id: payment.bookingId,
            status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_OWNER_APPROVAL] },
          },
          data: { status: BookingStatus.PAYMENT_FAILED },
        });

        if (updated.count > 0) {
          await tx.bookingStateHistory.create({
            data: {
              bookingId: payment.bookingId,
              fromStatus: payment.booking.status as BookingStatus,
              toStatus: BookingStatus.PAYMENT_FAILED,
              changedBy: 'SYSTEM',
              metadata: JSON.stringify({
                paymentIntentId: id,
                source: 'stripe_webhook',
                reason: last_payment_error?.message || 'Payment failed',
              }),
            },
          });
        }
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
      throw error; // Rethrow so Stripe retries on transient failures
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
   * Handle payment intent requires action (3DS/SCA authentication needed).
   * Updates payment status and notifies the renter to complete authentication.
   */
  private async handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent) {
    const { id } = paymentIntent;

    try {
      const payment = await this.prisma.payment.findFirst({
        where: { stripePaymentIntentId: id },
        include: { booking: true },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for requires_action PaymentIntent ${id}`);
        return;
      }

      // Update payment status to indicate authentication is required
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PROCESSING,
          metadata: JSON.stringify({
            ...(payment.metadata ? JSON.parse(payment.metadata as string) : {}),
            requiresAction: true,
            actionRequiredAt: new Date().toISOString(),
          }),
        },
      });

      // Emit action-required event (not payment-failed) so notification system can alert the renter
      this.eventsService.emitPaymentActionRequired({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: 0,
        currency: payment.booking.currency,
        status: PayoutStatus.FAILED,
        renterId: payment.booking.renterId,
        ownerId: payment.booking.ownerId,
        reason: 'Additional authentication required (3DS/SCA). Please complete payment.',
      });

      this.logger.log(`Payment ${payment.id} requires additional authentication (3DS/SCA)`);
    } catch (error) {
      this.logger.error(`Error handling requires_action: ${error.message}`, error.stack);
      throw error;
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
    const { id, amount_refunded, amount, refunds } = charge;

    if (!refunds?.data?.length) {
      this.logger.warn(`Charge ${id} marked as refunded but no refund data present`);
    }

    // Stripe sends charge.refunded for every individual refund action.
    // `refunds.data[0]` is the MOST RECENT refund (reverse-chronological order).
    // `amount_refunded` is the CUMULATIVE total — using it for ledger entries would
    // double-count on subsequent partial refunds (B5 fix).
    const latestStripeRefund = refunds?.data?.[0];
    const stripeRefundId = latestStripeRefund?.id;
    // Use the individual refund amount, falling back to cumulative only if unavailable.
    const thisRefundAmount = fromMinorUnits(
      latestStripeRefund?.amount ?? amount_refunded,
      charge.currency,
    );
    // A charge is fully refunded when total amount_refunded equals the original charge amount.
    const isFullRefund = amount > 0 && amount_refunded >= amount;

    try {
      const payment = await this.prisma.payment.findFirst({
        where: { stripeChargeId: id },
        include: { booking: true },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for Charge ${id}`);
        return;
      }

      // ── Idempotency: skip if this exact Stripe refund ID is already COMPLETED ──
      const existingByStripeId = stripeRefundId
        ? await this.prisma.refund.findFirst({
            where: { refundId: stripeRefundId },
          })
        : null;

      if (existingByStripeId?.status === RefundStatus.COMPLETED) {
        this.logger.warn(
          `Refund ${stripeRefundId} already completed for payment ${payment.id} — skipping duplicate`,
        );
        return;
      }

      // ── Upsert refund record ──
      // Prefer updating a PENDING/PROCESSING record created by the refund queue processor
      // (which already has the correct amount from triggerRefundProcess).  Otherwise create
      // a fresh COMPLETED record for this individual partial refund.
      const pendingRefund = existingByStripeId ?? await this.prisma.refund.findFirst({
        where: {
          bookingId: payment.bookingId,
          status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingRefund) {
        await this.prisma.refund.update({
          where: { id: pendingRefund.id },
          data: {
            refundId: stripeRefundId || pendingRefund.refundId,
            // Correct the stored amount to the actual Stripe refund amount (not the estimate).
            amount: thisRefundAmount,
            status: RefundStatus.COMPLETED,
          },
        });
      } else {
        await this.prisma.refund.create({
          data: {
            bookingId: payment.bookingId,
            amount: thisRefundAmount,
            currency: charge.currency,
            status: RefundStatus.COMPLETED,
            refundId: stripeRefundId || `refund_${Date.now()}`,
            reason: latestStripeRefund?.reason || 'requested_by_customer',
          },
        });
      }

      // ── Ledger: record THIS refund's amount (not cumulative) to avoid double-counting ──
      await this.ledger.recordRefund(
        payment.bookingId,
        payment.booking.renterId,
        thisRefundAmount,
        charge.currency,
      );

      // ── Booking status: only transition to REFUNDED on a full refund ──
      // Partial refunds leave the booking in CANCELLED until fully refunded.
      // State machine CANCELLED → REFUNDED is triggered here; all other statuses
      // are logged for manual review.
      if (isFullRefund && payment.booking.status === BookingStatus.CANCELLED) {
        await this.bookingStateMachine.transition(
          payment.bookingId,
          'REFUND',
          'SYSTEM',
          'SYSTEM',
          {
            chargeId: id,
            amountRefunded: fromMinorUnits(amount_refunded, charge.currency),
            source: 'stripe_webhook',
          },
        );
      } else if (isFullRefund && payment.booking.status !== BookingStatus.REFUNDED) {
        this.logger.warn(
          `Booking ${payment.bookingId} is fully refunded on Stripe but in state ` +
          `${payment.booking.status} — manual review required.`,
        );
      } else {
        this.logger.log(
          `Partial refund of ${thisRefundAmount} ${charge.currency} recorded for booking ` +
          `${payment.bookingId} (total refunded so far: ${fromMinorUnits(amount_refunded, charge.currency)})`,
        );
      }

      this.eventsService.emitPaymentRefunded({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: thisRefundAmount,
        currency: charge.currency,
        refundId: stripeRefundId ?? `refund_charge_${id}`,
        renterId: payment.booking.renterId,
        ownerId: payment.booking.ownerId,
      });

      this.logger.log(`Refund processed for payment ${payment.id} — amount: ${thisRefundAmount}, full: ${isFullRefund}`);
    } catch (error) {
      this.logger.error(`Error handling refund: ${error.message}`);
      throw error;
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
        // For Stripe disputes, the initiator is the cardholder (renter) disputing
        // the charge. On Connect platforms, the owner could also be the defendant.
        // We default initiator to renterId since they are the one who filed the chargeback.
        const isConnectDispute = !!dispute.payment_intent && typeof dispute.payment_intent === 'object'
          && !!(dispute.payment_intent as Stripe.PaymentIntent).on_behalf_of;
        const initiatorId = isConnectDispute ? (booking.ownerId || booking.renterId) : booking.renterId;
        const defendantId = isConnectDispute ? booking.renterId : (booking.ownerId || booking.renterId);

        await this.prisma.dispute.create({
          data: {
            bookingId: booking.id,
            initiatorId,
            defendantId,
            title: `Stripe Dispute ${id}`,
            type: 'PAYMENT_ISSUE',
            status: 'OPEN',
            priority: 'HIGH',
            description: `Stripe dispute (${reason || 'unknown reason'}). Amount: ${fromMinorUnits(amount, dispute.currency || 'USD').toFixed(2)} ${dispute.currency?.toUpperCase()}. Evidence deadline: ${evidence_details?.due_by ? new Date(evidence_details.due_by * 1000).toISOString() : 'N/A'}.`,
            amount: fromMinorUnits(amount, dispute.currency || 'USD'),
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
      throw error; // Rethrow so Stripe retries on transient failures
    }
  }

  /**
   * Handle successful payout — marks payout as PAID and transitions booking to SETTLED
   */
  private async handlePayoutPaid(payout: Stripe.Payout) {
    const { id, amount, destination } = payout;

    this.logger.log(`Payout successful: ${id}, amount: ${fromMinorUnits(amount, payout.currency)}`);

    // Update payout status in DB and transition the associated booking to SETTLED
    try {
      await this.prisma.payout.updateMany({
        where: {
          OR: [{ stripeId: id }, { transferId: id }],
        },
        data: {
          status: PayoutStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Find the payout record to extract bookingId from its metadata
      const payoutRecord = await this.prisma.payout.findFirst({
        where: {
          OR: [{ stripeId: id }, { transferId: id }],
        },
        select: { metadata: true },
      });

      if (payoutRecord?.metadata) {
        try {
          const meta = JSON.parse(payoutRecord.metadata);
          const bookingId = meta?.bookingId || meta?.bookingIds?.[0];

          if (bookingId) {
            const booking = await this.prisma.booking.findUnique({
              where: { id: bookingId },
              select: { status: true },
            });

            if (booking?.status === BookingStatus.COMPLETED) {
              await this.prisma.$transaction(async (tx: any) => {
                const updated = await tx.booking.updateMany({
                  where: { id: bookingId, status: BookingStatus.COMPLETED },
                  data: { status: BookingStatus.SETTLED },
                });

                if (updated.count > 0) {
                  await tx.bookingStateHistory.create({
                    data: {
                      bookingId,
                      fromStatus: BookingStatus.COMPLETED,
                      toStatus: BookingStatus.SETTLED,
                      changedBy: 'SYSTEM',
                      metadata: JSON.stringify({
                        payoutId: id,
                        transition: 'SETTLE',
                        source: 'stripe_webhook',
                      }),
                    },
                  });
                }
              });

              this.logger.log(`Booking ${bookingId} transitioned to SETTLED after payout ${id}`);
            }
          }
        } catch (parseErr) {
          this.logger.warn(`Could not parse payout metadata for ${id}: ${parseErr.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error updating payout ${id}: ${error.message}`);
      throw error; // Rethrow so Stripe retries on transient failures
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
        where: {
          OR: [{ stripeId: id }, { transferId: id }],
        },
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

    this.logger.log(`Transfer created: ${id}, amount: ${fromMinorUnits(amount, transfer.currency)}`);

    // Track transfer to connected account
    try {
      const destinationAccountId = typeof destination === 'string' ? destination : destination?.id;
      if (!destinationAccountId) {
        this.logger.warn(`Transfer ${id} has no destination account`);
        return;
      }

      // Find the owner with this connected account
      const owner = await this.prisma.user.findFirst({
        where: { stripeConnectId: destinationAccountId },
      });

      if (!owner) {
        this.logger.warn(`No user found for Stripe Connect account ${destinationAccountId}`);
        return;
      }

      // Record the transfer as a payout record
      await this.prisma.payout.upsert({
        where: { transferId: id },
        create: {
          ownerId: owner.id,
          amount: fromMinorUnits(amount, transfer.currency),
          currency: transfer.currency.toUpperCase(),
          status: 'COMPLETED',
          transferId: id,
          metadata: JSON.stringify({
            type: 'transfer',
            destination: destinationAccountId,
            description: transfer.description,
          }),
        },
        update: {
          status: 'COMPLETED',
        },
      });

      this.logger.log(`Transfer ${id} tracked for owner ${owner.id}`);
    } catch (error) {
      this.logger.error(`Error tracking transfer ${id}: ${error.message}`, error.stack);
    }
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
   * Handle refund.updated — fires for ACH bank refunds that transition asynchronously.
   * Maps Stripe refund status (pending→succeeded/failed) to our RefundStatus enum.
   */
  private async handleRefundUpdated(refund: Stripe.Refund) {
    const { id, status } = refund;
    this.logger.log(`Refund updated: ${id}, status: ${status}`);

    if (!status || status === 'pending') return;

    const statusMap: Record<string, string> = {
      succeeded: RefundStatus.COMPLETED,
      failed: RefundStatus.FAILED,
      canceled: RefundStatus.FAILED,
    };
    const mappedStatus = statusMap[status];
    if (!mappedStatus) return;

    try {
      await this.prisma.refund.updateMany({
        where: { refundId: id },
        data: { status: mappedStatus as any },
      });
      this.logger.log(`Refund ${id} status updated to ${mappedStatus}`);
    } catch (error) {
      this.logger.error(`Error updating refund ${id}: ${error.message}`);
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

    // Map Stripe subscription status to internal status and persist
    try {
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

      if (!customerId) {
        this.logger.warn(`Subscription ${subscription.id} has no customer`);
        return;
      }

      const user = await this.prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (!user) {
        this.logger.warn(`No user found for Stripe customer ${customerId}`);
        return;
      }

      // Update user's subscription status based on event type
      const statusMap: Record<string, string> = {
        active: 'ACTIVE',
        past_due: 'PAST_DUE',
        canceled: 'CANCELLED',
        unpaid: 'UNPAID',
        trialing: 'TRIALING',
        incomplete: 'INCOMPLETE',
        incomplete_expired: 'EXPIRED',
        paused: 'PAUSED',
      };

      const mappedStatus = statusMap[subscription.status] || subscription.status.toUpperCase();

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: mappedStatus,
          subscriptionId: subscription.id,
          subscriptionPlan: subscription.items?.data?.[0]?.price?.id || null,
        },
      });

      this.logger.log(
        `Updated subscription for user ${user.id}: ${mappedStatus} (${subscription.id})`,
      );
    } catch (error) {
      this.logger.error(`Error handling subscription event: ${error.message}`, error.stack);
    }
  }
}
