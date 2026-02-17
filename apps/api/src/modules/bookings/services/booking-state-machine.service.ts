import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
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
  | 'RESOLVE_DISPUTE'
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
  ) {
    this.transitions = this.defineTransitions();
  }

  private defineTransitions(): StateTransition[] {
    return [
      // DRAFT → PENDING_OWNER_APPROVAL (instant booking creates this state)
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

      // CONFIRMED → IN_PROGRESS (rental starts)
      {
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.IN_PROGRESS,
        transition: 'START_RENTAL',
        allowedRoles: ['OWNER', 'RENTER', 'SYSTEM'],
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
        transition: 'RESOLVE_DISPUTE',
        allowedRoles: ['ADMIN', 'SYSTEM'],
      },

      // DISPUTED → REFUNDED (dispute resolved in renter favor)
      {
        from: BookingStatus.DISPUTED,
        to: BookingStatus.REFUNDED,
        transition: 'RESOLVE_DISPUTE',
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
      throw new BadRequestException('Booking not found');
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
      throw new ForbiddenException('Not the renter of this booking');
    }

    if (actorRole === 'OWNER' && booking.listing.ownerId !== actorId) {
      throw new ForbiddenException('Not the owner of this listing');
    }

    // Check preconditions if any
    if (authorizedTransition.preconditions) {
      const preconditionsMet = await authorizedTransition.preconditions(booking);
      if (!preconditionsMet) {
        throw new BadRequestException('Preconditions not met for this transition');
      }
    }

    // Execute state transition
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: authorizedTransition.to,
        stateHistory: {
          create: {
            fromStatus: booking.status,
            toStatus: authorizedTransition.to,
            changedBy: actorId,
            metadata: metadata ? JSON.stringify(metadata) : undefined,
          },
        },
      },
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
        // Schedule grace-period expiration (e.g. 24h to retry)
        this.logger.log(`Payment failed for booking ${bookingId}, grace period started`);
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

    // Publish settlement event for PaymentsModule to execute Stripe payout
    await this.cacheService.publish('booking:settlement', {
      bookingId: booking.id,
      ownerId: booking.listing.ownerId,
      ownerStripeConnectId: booking.listing.owner.stripeConnectId,
      amount: Number(booking.ownerEarnings),
      currency: booking.currency,
      timestamp: new Date().toISOString(),
    });

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

    // Publish refund event for PaymentsModule to execute Stripe refund
    if (booking.paymentIntentId && refund.refundAmount > 0) {
      await this.cacheService.publish('booking:refund', {
        bookingId,
        refundRecordId: refundRecord.id,
        paymentIntentId: booking.paymentIntentId,
        amount: refund.refundAmount,
        currency: booking.currency,
        reason: refund.reason,
        timestamp: new Date().toISOString(),
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
  }

  private async notifyAdminDispute(bookingId: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
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

    // Publish event for PaymentsModule to listen and execute Stripe hold
    await this.cacheService.publish('booking:deposit-hold', {
      bookingId: booking.id,
      amount: Number(booking.depositAmount),
      currency: booking.currency,
      renterId: booking.renterId,
      listingId: booking.listingId,
      timestamp: new Date().toISOString(),
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

    // Publish event for PaymentsModule to execute Stripe release
    await this.cacheService.publish('booking:deposit-release', {
      bookingId,
      timestamp: new Date().toISOString(),
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

    for (const booking of pendingPayments) {
      await this.transition(booking.id, 'EXPIRE', 'system', 'SYSTEM', {
        reason: 'Payment timeout',
      });
      count++;
    }

    // Auto-approve return inspection after 48 hours
    const pendingInspections = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
        endDate: { lte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
    });

    for (const booking of pendingInspections) {
      await this.transition(booking.id, 'EXPIRE', 'system', 'SYSTEM', {
        reason: 'Auto-approved after 48 hours',
      });
      count++;
    }

    return count;
  }
}
