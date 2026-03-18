import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import type { PaymentCommandPayload, PaymentCommandType } from '@/common/payments/payment-command.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { BookingCalculationService } from './booking-calculation.service';
import { NotificationType } from '@rental-portal/database';
import { randomUUID } from 'crypto';

export type BookingTransition =
  | 'SUBMIT_REQUEST'
  | 'OWNER_APPROVE'
  | 'OWNER_REJECT'
  | 'COMPLETE_PAYMENT'
  | 'FAIL_PAYMENT'
  | 'RETRY_PAYMENT'
  | 'START_RENTAL'
  | 'CANCEL'
  | 'REQUEST_RETURN'
  | 'APPROVE_RETURN'
  | 'REJECT_RETURN'
  | 'COMPLETE'
  | 'SETTLE'
  | 'INITIATE_DISPUTE'
  | 'RESOLVE_DISPUTE_OWNER_FAVOR'
  | 'RESOLVE_DISPUTE_RENTER_FAVOR'
  | 'REFUND'
  | 'EXPIRE';

interface StateTransition {
  from: BookingStatus;
  to: BookingStatus;
  transition: BookingTransition;
  allowedRoles: ('RENTER' | 'OWNER' | 'ADMIN' | 'SYSTEM')[];
  preconditions?: (booking: any) => Promise<boolean>;
}

interface StateMachineResult {
  success: boolean;
  newState: BookingStatus;
  message: string;
  errors?: string[];
}

@Injectable()
export class BookingStateMachineService {
  private readonly transitions: StateTransition[];
  private readonly logger = new Logger(BookingStateMachineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly notificationsService: NotificationsService,
    private readonly calculationService: BookingCalculationService,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
    @InjectQueue('bookings') private readonly bookingsQueue: Queue,
  ) {
    this.transitions = this.defineTransitions();
  }

  private defineTransitions(): StateTransition[] {
    return [
      // DRAFT → PENDING_OWNER_APPROVAL (request-to-book creates this state)
      {
        from: BookingStatus.DRAFT,
        to: BookingStatus.PENDING_OWNER_APPROVAL,
        transition: 'SUBMIT_REQUEST',
        allowedRoles: ['RENTER'],
      },

      // PENDING_OWNER_APPROVAL → PENDING_PAYMENT (owner approves)
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.PENDING_PAYMENT,
        transition: 'OWNER_APPROVE',
        allowedRoles: ['OWNER'],
      },

      // PENDING_OWNER_APPROVAL → CANCELLED (owner rejects)
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.CANCELLED,
        transition: 'OWNER_REJECT',
        allowedRoles: ['OWNER'],
      },

      // PENDING_OWNER_APPROVAL → CANCELLED (renter cancels before approval)
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.CANCELLED,
        transition: 'CANCEL',
        allowedRoles: ['RENTER'],
      },

      // PENDING_OWNER_APPROVAL → CANCELLED (auto-expire if owner doesn't respond)
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.CANCELLED,
        transition: 'EXPIRE',
        allowedRoles: ['SYSTEM'],
      },

      // PENDING_PAYMENT → CONFIRMED (payment completed)
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CONFIRMED,
        transition: 'COMPLETE_PAYMENT',
        allowedRoles: ['RENTER', 'SYSTEM'],
      },

      // PENDING_PAYMENT → PAYMENT_FAILED (payment attempt failed)
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.PAYMENT_FAILED,
        transition: 'FAIL_PAYMENT',
        allowedRoles: ['SYSTEM'],
      },

      // PAYMENT_FAILED → PENDING_PAYMENT (retry payment)
      {
        from: BookingStatus.PAYMENT_FAILED,
        to: BookingStatus.PENDING_PAYMENT,
        transition: 'RETRY_PAYMENT',
        allowedRoles: ['RENTER'],
      },

      // PAYMENT_FAILED → CANCELLED (grace period expired or user cancels)
      {
        from: BookingStatus.PAYMENT_FAILED,
        to: BookingStatus.CANCELLED,
        transition: 'EXPIRE',
        allowedRoles: ['SYSTEM', 'RENTER'],
      },

      // PENDING_PAYMENT → CANCELLED (payment timeout)
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CANCELLED,
        transition: 'EXPIRE',
        allowedRoles: ['SYSTEM'],
      },

      // PENDING_PAYMENT → CANCELLED (renter cancels before paying)
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CANCELLED,
        transition: 'CANCEL',
        allowedRoles: ['RENTER'],
      },

      // CONFIRMED → IN_PROGRESS (rental starts)
      {
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.IN_PROGRESS,
        transition: 'START_RENTAL',
        allowedRoles: ['OWNER', 'SYSTEM'],
      },

      // CONFIRMED → CANCELLED (cancelled before start)
      {
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.CANCELLED,
        transition: 'CANCEL',
        allowedRoles: ['RENTER', 'OWNER'],
      },

      // IN_PROGRESS → AWAITING_RETURN_INSPECTION (return requested)
      {
        from: BookingStatus.IN_PROGRESS,
        to: BookingStatus.AWAITING_RETURN_INSPECTION,
        transition: 'REQUEST_RETURN',
        allowedRoles: ['RENTER', 'SYSTEM'],
      },

      // IN_PROGRESS → DISPUTED (dispute raised during rental)
      {
        from: BookingStatus.IN_PROGRESS,
        to: BookingStatus.DISPUTED,
        transition: 'INITIATE_DISPUTE',
        allowedRoles: ['RENTER', 'OWNER'],
      },

      // AWAITING_RETURN_INSPECTION → COMPLETED (return approved)
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        to: BookingStatus.COMPLETED,
        transition: 'APPROVE_RETURN',
        allowedRoles: ['OWNER'],
      },

      // AWAITING_RETURN_INSPECTION → DISPUTED (issues found)
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        to: BookingStatus.DISPUTED,
        transition: 'REJECT_RETURN',
        allowedRoles: ['OWNER'],
      },

      // AWAITING_RETURN_INSPECTION → COMPLETED (auto-approve after timeout)
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        to: BookingStatus.COMPLETED,
        transition: 'EXPIRE',
        allowedRoles: ['SYSTEM'],
      },

      // COMPLETED → SETTLED (payment released)
      {
        from: BookingStatus.COMPLETED,
        to: BookingStatus.SETTLED,
        transition: 'SETTLE',
        allowedRoles: ['SYSTEM'],
      },

      // COMPLETED → DISPUTED (post-completion dispute, e.g. damage discovered late)
      {
        from: BookingStatus.COMPLETED,
        to: BookingStatus.DISPUTED,
        transition: 'INITIATE_DISPUTE',
        allowedRoles: ['RENTER', 'OWNER'],
      },

      // CANCELLED → REFUNDED (refund processed)
      {
        from: BookingStatus.CANCELLED,
        to: BookingStatus.REFUNDED,
        transition: 'REFUND',
        allowedRoles: ['SYSTEM'],
      },

      // DISPUTED → COMPLETED (dispute resolved in owner favor)
      {
        from: BookingStatus.DISPUTED,
        to: BookingStatus.COMPLETED,
        transition: 'RESOLVE_DISPUTE_OWNER_FAVOR',
        allowedRoles: ['ADMIN', 'SYSTEM'],
      },

      // DISPUTED → REFUNDED (dispute resolved in renter favor)
      {
        from: BookingStatus.DISPUTED,
        to: BookingStatus.REFUNDED,
        transition: 'RESOLVE_DISPUTE_RENTER_FAVOR',
        allowedRoles: ['ADMIN', 'SYSTEM'],
      },
    ];
  }

  async transition(
    bookingId: string,
    transition: BookingTransition,
    actorId: string,
    actorRole: 'RENTER' | 'OWNER' | 'ADMIN' | 'SYSTEM',
    metadata?: Record<string, any>,
  ): Promise<StateMachineResult> {
    // Fetch booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        renter: true,
        listing: { include: { owner: true } },
      },
    });

    if (!booking) {
      throw i18nBadRequest('booking.notFound');
    }

    // Find valid transition
    const validTransitions = this.transitions.filter(
      (t) => t.from === booking.status && t.transition === transition,
    );

    if (validTransitions.length === 0) {
      throw new BadRequestException(
        `Invalid transition: ${transition} from state ${booking.status}`,
      );
    }

    // Check role authorization
    const authorizedTransition = validTransitions.find((t) => t.allowedRoles.includes(actorRole));

    if (!authorizedTransition) {
      throw new ForbiddenException(`Role ${actorRole} not authorized for transition ${transition}`);
    }

    // Verify actor identity for non-SYSTEM/ADMIN roles
    if (actorRole === 'RENTER' && booking.renterId !== actorId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    if (actorRole === 'OWNER' && booking.listing.ownerId !== actorId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    // Check preconditions if any
    if (authorizedTransition.preconditions) {
      const preconditionsMet = await authorizedTransition.preconditions(booking);
      if (!preconditionsMet) {
        throw i18nBadRequest('booking.preconditionFailed');
      }
    }

    // Execute state transition atomically using optimistic locking:
    // The WHERE clause ensures the status hasn't changed since we read it.
    const [updatedBooking] = await this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: booking.status },
        data: {
          status: authorizedTransition.to,
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          'Booking state changed concurrently. Please retry the operation.',
        );
      }

      // Create state history entry within the same transaction
      await tx.bookingStateHistory.create({
        data: {
          bookingId,
          fromStatus: booking.status,
          toStatus: authorizedTransition.to,
          changedBy: actorId,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });

      const result = await tx.booking.findUnique({ where: { id: bookingId } });
      return [result];
    });

    // Invalidate cache
    await this.cacheService.del(`booking:${bookingId}`);

    // Emit events based on new state
    await this.emitStateChangeEvent(bookingId, authorizedTransition.to, booking, metadata);

    return {
      success: true,
      newState: authorizedTransition.to,
      message: `Booking transitioned to ${authorizedTransition.to}`,
    };
  }

  async canTransition(
    bookingId: string,
    transition: BookingTransition,
    actorRole: 'RENTER' | 'OWNER' | 'ADMIN' | 'SYSTEM',
  ): Promise<{ allowed: boolean; reason?: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { allowed: false, reason: 'Booking not found' };
    }

    const validTransitions = this.transitions.filter(
      (t) => t.from === booking.status && t.transition === transition,
    );

    if (validTransitions.length === 0) {
      return {
        allowed: false,
        reason: `No valid transition ${transition} from state ${booking.status}`,
      };
    }

    const authorizedTransition = validTransitions.find((t) => t.allowedRoles.includes(actorRole));

    if (!authorizedTransition) {
      return {
        allowed: false,
        reason: `Role ${actorRole} not authorized for transition ${transition}`,
      };
    }

    return { allowed: true };
  }

  getAvailableTransitions(
    currentState: BookingStatus,
    actorRole: 'RENTER' | 'OWNER' | 'ADMIN' | 'SYSTEM',
  ): BookingTransition[] {
    return this.transitions
      .filter((t) => t.from === currentState && t.allowedRoles.includes(actorRole))
      .map((t) => t.transition);
  }

  private async emitStateChangeEvent(
    bookingId: string,
    newState: BookingStatus,
    booking: any,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Publish state change event to Redis for notification service
    await this.cacheService.publish('booking:state-change', {
      bookingId,
      newState,
      renterId: booking.renterId,
      ownerId: booking.listing.ownerId,
      listingId: booking.listingId,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Handle automatic actions based on new state
    switch (newState) {
      case BookingStatus.CONFIRMED:
        // Schedule reminder before rental start
        await this.scheduleReminderNotification(bookingId, booking.startDate);
        // Trigger deposit hold if the listing has a security deposit
        await this.triggerDepositHold(bookingId);
        break;

      case BookingStatus.IN_PROGRESS:
        // Create condition report if configured
        await this.createInitialConditionReport(bookingId);
        break;

      case BookingStatus.COMPLETED:
        // Trigger settlement process
        await this.triggerSettlementProcess(bookingId);
        // Release deposit hold if no damage claims
        await this.releaseDepositIfClean(bookingId);
        break;

      case BookingStatus.CANCELLED:
        // Trigger refund process
        await this.triggerRefundProcess(bookingId);
        break;

      case BookingStatus.PAYMENT_FAILED:
        // Immediately notify renter so they can retry — then schedule grace-period expiration
        this.logger.log(`Payment failed for booking ${bookingId}, grace period started`);
        await this.notificationsService.sendNotification({
          userId: booking.renterId,
          type: NotificationType.BOOKING_CANCELLED,
          title: 'Payment failed',
          message: `Your payment for booking ${bookingId} failed. Please retry before the booking is cancelled.`,
          data: { bookingId, action: 'retry_payment' },
          channels: ['IN_APP', 'EMAIL'],
        }).catch((err) =>
          this.logger.error(`Failed to send payment-failed notification for booking ${bookingId}`, err),
        );
        await this.bookingsQueue.add(
          'expire-payment-failed',
          { bookingId },
          {
            delay: 24 * 60 * 60 * 1000, // 24 hours
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
          },
        );
        break;

      case BookingStatus.AWAITING_RETURN_INSPECTION:
        // Notify owner that the renter has requested a return inspection
        await this.notifyOwnerReturnRequested(bookingId, booking);
        break;

      case BookingStatus.DISPUTED:
        // Notify admin and hold funds
        await this.notifyAdminDispute(bookingId);
        break;
    }
  }

  private async scheduleReminderNotification(bookingId: string, startDate: Date): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) return;

    const reminderTime = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    const scheduledFor = reminderTime > new Date() ? reminderTime : undefined;

    await this.notificationsService.sendNotification({
      userId: booking.renterId,
      type: NotificationType.BOOKING_REMINDER,
      title: 'Upcoming booking reminder',
      message: `Your booking for ${booking.listing.title} starts on ${startDate.toDateString()}.`,
      data: { bookingId },
      channels: ['IN_APP'],
      scheduledFor,
    });
  }

  private async createInitialConditionReport(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, renterId: true, listingId: true },
    });

    if (!booking) return;

    const existing = await this.prisma.conditionReport.findFirst({
      where: {
        bookingId: booking.id,
        reportType: 'CHECK_IN',
      },
    });

    if (existing) return;

    await this.prisma.conditionReport.create({
      data: {
        bookingId: booking.id,
        propertyId: booking.listingId,
        createdBy: booking.renterId,
        checkIn: true,
        checkOut: false,
        photos: [],
        notes: '',
        damages: '[]',
        status: 'PENDING',
        reportType: 'CHECK_IN',
        checklistData: '[]',
      },
    });
  }

  private async triggerSettlementProcess(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { include: { owner: true } } },
    });

    if (!booking) return;

    this.logger.log(`Triggering settlement for booking ${bookingId}`);

    const payout = await this.prisma.payout.create({
      data: {
        ownerId: booking.listing.ownerId,
        amount: Number(booking.ownerEarnings),
        currency: booking.currency,
        status: 'PENDING',
        metadata: JSON.stringify({
          bookingId: booking.id,
          bookingIds: [booking.id],
          source: 'booking_state_machine',
        }),
      },
    });

    const command = await this.createPaymentCommand({
      userId: booking.listing.ownerId,
      entityType: 'PAYOUT',
      entityId: payout.id,
      amount: Number(booking.ownerEarnings),
      currency: booking.currency,
      metadata: {
        bookingId: booking.id,
        bookingIds: [booking.id],
        source: 'booking_state_machine',
      },
    });

    await this.paymentsQueue.add('process-payout', {
      payoutId: payout.id,
      ownerId: booking.listing.ownerId,
      ownerStripeConnectId: booking.listing.owner.stripeConnectId,
      bookingIds: [booking.id],
      amount: Number(booking.ownerEarnings),
      currency: booking.currency,
      commandId: command.id,
      timestamp: new Date().toISOString(),
    }, {
      jobId: `payout:${payout.id}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: false,
    });

    await this.updatePaymentCommand(command.id, {
      status: 'ENQUEUED',
      jobName: 'process-payout',
      jobId: `payout:${payout.id}`,
    });

    // NOTE: Do NOT transition to SETTLED here. The booking will remain in
    // COMPLETED until the payout.paid webhook confirms the payout succeeded.
    // The WebhookService.handlePayoutPaid() handler is responsible for
    // calling transition(bookingId, 'SETTLE', ...) on confirmation.

    await this.notificationsService.sendNotification({
      userId: booking.listing.ownerId,
      type: NotificationType.PAYOUT_PROCESSED,
      title: 'Earnings available',
      message: `Your earnings for booking ${booking.id} are now available.`,
      data: { bookingId: booking.id },
      channels: ['IN_APP'],
    });
  }

  private async triggerRefundProcess(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) return;

    const existingRefund = await this.prisma.refund.findFirst({
      where: { bookingId },
    });
    if (existingRefund) {
      return;
    }

    const refund = await this.calculationService.calculateRefund(bookingId, new Date());

    const refundRecord = await this.prisma.refund.create({
      data: {
        bookingId,
        amount: refund.refundAmount,
        currency: booking.currency,
        status: 'PENDING',
        refundId: randomUUID(),
        reason: refund.reason,
        description: 'Refund initiated after booking cancellation',
        metadata: JSON.stringify(refund),
      },
    });

    this.logger.log(`Triggering refund for booking ${bookingId}, amount: ${refund.refundAmount}`);

    // Enqueue refund job via Bull (persistent, retryable) instead of Redis pub/sub
    if (booking.paymentIntentId && refund.refundAmount > 0) {
      await this.paymentsQueue.add('process-refund', {
        bookingId,
        refundRecordId: refundRecord.id,
        paymentIntentId: booking.paymentIntentId,
        amount: refund.refundAmount,
        currency: booking.currency,
        reason: refund.reason,
        timestamp: new Date().toISOString(),
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: false,
      });
    }

    await this.notificationsService.sendNotification({
      userId: booking.renterId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Refund initiated',
      message: `Your refund for booking ${booking.id} has been initiated.`,
      data: { bookingId: booking.id },
      channels: ['IN_APP'],
    });

    // NOTE: Do NOT transition to REFUNDED here. The booking will remain in
    // CANCELLED until the Stripe refund.succeeded webhook confirms the refund.
    // The WebhookService handler is responsible for calling
    // transition(bookingId, 'REFUND', ...) on confirmation.
  }

  private async notifyAdminDispute(bookingId: string): Promise<void> {
    const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'];
    const admins = await this.prisma.user.findMany({
      where: { role: { in: adminRoles as any[] } },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.sendNotification({
          userId: admin.id,
          type: NotificationType.DISPUTE_OPENED,
          title: 'Dispute opened',
          message: `A dispute was opened for booking ${bookingId}.`,
          data: { bookingId },
          channels: ['IN_APP'],
        }),
      ),
    );
  }

  private async notifyOwnerReturnRequested(bookingId: string, booking: any): Promise<void> {
    const ownerId = booking.listing?.ownerId ?? booking.listing?.owner?.id;
    if (!ownerId) return;
    await this.notificationsService.sendNotification({
      userId: ownerId,
      type: NotificationType.BOOKING_REMINDER,
      title: 'Return inspection requested',
      message: `The renter has requested a return inspection for booking ${bookingId}. Please review and approve or dispute within 48 hours.`,
      data: { bookingId, action: 'approve_return' },
      channels: ['IN_APP', 'EMAIL'],
    }).catch((err) =>
      this.logger.error(`Failed to send return-requested notification for booking ${bookingId}`, err),
    );
  }

  /**
   * Triggers a deposit hold via the payments service when a booking is confirmed.
   * Publishes an event that the PaymentsModule listens for.
   */
  private async triggerDepositHold(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        depositAmount: true,
        currency: true,
        renterId: true,
        listingId: true,
      },
    });

    if (!booking || !booking.depositAmount || Number(booking.depositAmount) <= 0) {
      return; // No deposit required
    }

    this.logger.log(
      `Triggering deposit hold for booking ${bookingId}: ${booking.depositAmount} ${booking.currency}`,
    );

    // Enqueue deposit hold job via Bull (persistent, retryable) instead of Redis pub/sub
    await this.paymentsQueue.add('hold-deposit', {
      bookingId: booking.id,
      amount: Number(booking.depositAmount),
      currency: booking.currency,
      renterId: booking.renterId,
      listingId: booking.listingId,
      timestamp: new Date().toISOString(),
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: false,
    });
  }

  /**
   * Releases the deposit hold when a booking completes without damage claims.
   */
  private async releaseDepositIfClean(bookingId: string): Promise<void> {
    // Check if there are any pending damage claims or disputes
    const hasDamage = await this.prisma.conditionReport.findFirst({
      where: {
        bookingId,
        reportType: 'CHECK_OUT',
        damages: { not: '[]' },
      },
    });

    if (hasDamage) {
      this.logger.log(`Deposit held for booking ${bookingId} — damage reported`);
      return;
    }

    // Check for open disputes
    const hasDispute = await this.prisma.dispute.findFirst({
      where: { bookingId, status: { notIn: ['RESOLVED', 'WITHDRAWN'] } },
    });

    if (hasDispute) {
      this.logger.log(`Deposit held for booking ${bookingId} — active dispute`);
      return;
    }

    this.logger.log(`Releasing deposit for booking ${bookingId} — no issues found`);

    const depositHolds = await this.prisma.depositHold.findMany({
      where: {
        bookingId,
        status: { in: ['HELD', 'AUTHORIZED'] },
      },
      select: { id: true, amount: true, currency: true },
    });

    if (depositHolds.length === 0) {
      this.logger.log(`No releasable deposit hold found for booking ${bookingId}`);
      return;
    }

    const command = await this.createPaymentCommand({
      entityType: 'DEPOSIT_RELEASE',
      entityId: bookingId,
      amount: Number(depositHolds[0].amount),
      currency: depositHolds[0].currency,
      metadata: {
        bookingId,
        depositHoldIds: depositHolds.map((hold) => hold.id),
        source: 'booking_state_machine',
      },
    });

    // Enqueue deposit release job via Bull (persistent, retryable) instead of Redis pub/sub
    await this.paymentsQueue.add('release-deposit', {
      bookingId,
      commandId: command.id,
      timestamp: new Date().toISOString(),
    }, {
      jobId: `deposit-release:${bookingId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: false,
    });

    await this.updatePaymentCommand(command.id, {
      status: 'ENQUEUED',
      jobName: 'release-deposit',
      jobId: `deposit-release:${bookingId}`,
    });
  }

  private async createPaymentCommand(input: {
    userId?: string;
    entityType: PaymentCommandType;
    entityId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }) {
    const payload: PaymentCommandPayload = {
      commandType: input.entityType,
      status: 'PENDING',
      amount: input.amount,
      currency: input.currency,
      queueName: 'payments',
      requestedAt: new Date().toISOString(),
      metadata: input.metadata,
    };

    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: `${input.entityType}_COMMAND_REQUESTED`,
        entityType: input.entityType,
        entityId: input.entityId,
        newValues: JSON.stringify(payload),
      },
    });
  }

  private async updatePaymentCommand(commandId: string, patch: Partial<PaymentCommandPayload>) {
    const existing = await this.prisma.auditLog.findUnique({
      where: { id: commandId },
      select: { newValues: true },
    });

    let current: Partial<PaymentCommandPayload> = {};
    if (existing?.newValues) {
      try {
        current = JSON.parse(existing.newValues) as Partial<PaymentCommandPayload>;
      } catch {
        current = {};
      }
    }

    const mergedMetadata =
      patch.metadata && current.metadata
        ? { ...current.metadata, ...patch.metadata }
        : patch.metadata ?? current.metadata;

    await this.prisma.auditLog.update({
      where: { id: commandId },
      data: {
        newValues: JSON.stringify({
          ...current,
          ...patch,
          metadata: mergedMetadata,
        }),
      },
    });
  }

  async getStateHistory(bookingId: string) {
    return this.prisma.bookingStateHistory.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }

  isTerminalState(state: BookingStatus): boolean {
    return (
      [BookingStatus.SETTLED, BookingStatus.REFUNDED, BookingStatus.CANCELLED] as BookingStatus[]
    ).includes(state);
  }

  /**
   * Public entry-point for running CONFIRMED side-effects without a full state transition.
   * Used by the Stripe webhook handler which applies the DB update directly
   * and must also fire the same side effects the state machine normally would.
   */
  async runConfirmedSideEffects(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { include: { owner: true } } },
    });
    if (!booking) return;
    try {
      await this.scheduleReminderNotification(bookingId, booking.startDate);
    } catch (err) {
      this.logger.error(`scheduleReminderNotification failed for booking ${bookingId}`, err);
    }
    try {
      await this.triggerDepositHold(bookingId);
    } catch (err) {
      this.logger.error(`triggerDepositHold failed for booking ${bookingId}`, err);
    }
  }

  async autoTransitionExpiredBookings(): Promise<number> {
    const now = new Date();
    let count = 0;

    // Auto-cancel pending payment after 24 hours
    const pendingPayments = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: { lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });

    // Auto-approve return inspection after 48 hours
    const pendingInspections = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
        endDate: { lte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
    });

    // Auto-cancel pending owner approval after 72 hours
    const pendingApprovals = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        createdAt: { lte: new Date(now.getTime() - 72 * 60 * 60 * 1000) },
      },
    });

    // Auto-cancel payment_failed after 48 hours
    const failedPayments = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PAYMENT_FAILED,
        updatedAt: { lte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
    });

    // Process all batches concurrently with error isolation
    const batches = [
      ...pendingPayments.map((b) => ({ id: b.id, reason: 'Payment timeout' })),
      ...pendingInspections.map((b) => ({ id: b.id, reason: 'Auto-approved after 48 hours' })),
      ...pendingApprovals.map((b) => ({ id: b.id, reason: 'Owner did not respond within 72 hours' })),
      ...failedPayments.map((b) => ({ id: b.id, reason: 'Payment retry window expired' })),
    ];

    const results = await Promise.allSettled(
      batches.map(({ id, reason }) =>
        this.transition(id, 'EXPIRE', 'system', 'SYSTEM', { reason }),
      ),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') count++;
      else this.logger.warn(`Failed to expire booking: ${result.reason}`);
    }

    return count;
  }
}
