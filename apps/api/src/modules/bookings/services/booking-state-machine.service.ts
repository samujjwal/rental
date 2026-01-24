import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';

export type BookingTransition =
  | 'SUBMIT_REQUEST'
  | 'OWNER_APPROVE'
  | 'OWNER_REJECT'
  | 'COMPLETE_PAYMENT'
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
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
            state: authorizedTransition.to,
            transitionedBy: actorId,
            metadata,
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
        break;

      case BookingStatus.IN_PROGRESS:
        // Create condition report if configured
        await this.createInitialConditionReport(bookingId);
        break;

      case BookingStatus.COMPLETED:
        // Trigger settlement process
        await this.triggerSettlementProcess(bookingId);
        break;

      case BookingStatus.CANCELLED:
        // Trigger refund process
        await this.triggerRefundProcess(bookingId);
        break;

      case BookingStatus.DISPUTED:
        // Notify admin and hold funds
        await this.notifyAdminDispute(bookingId);
        break;
    }
  }

  private async scheduleReminderNotification(bookingId: string, startDate: Date): Promise<void> {
    // Implementation: Add job to queue for reminder 24h before start
    // This would integrate with BullMQ
    console.log(`Scheduling reminder for booking ${bookingId} starting ${startDate}`);
  }

  private async createInitialConditionReport(bookingId: string): Promise<void> {
    // Implementation: Create initial condition report template
    console.log(`Creating initial condition report for booking ${bookingId}`);
  }

  private async triggerSettlementProcess(bookingId: string): Promise<void> {
    // Implementation: Trigger payment settlement job
    console.log(`Triggering settlement for booking ${bookingId}`);
  }

  private async triggerRefundProcess(bookingId: string): Promise<void> {
    // Implementation: Trigger refund calculation and processing
    console.log(`Triggering refund for booking ${bookingId}`);
  }

  private async notifyAdminDispute(bookingId: string): Promise<void> {
    // Implementation: Notify admin team about dispute
    console.log(`Notifying admin about dispute for booking ${bookingId}`);
  }

  async getStateHistory(bookingId: string) {
    return this.prisma.bookingStateHistory.findMany({
      where: { bookingId },
      include: {
        transitionedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { transitionedAt: 'asc' },
    });
  }

  isTerminalState(state: BookingStatus): boolean {
    return [BookingStatus.SETTLED, BookingStatus.REFUNDED, BookingStatus.CANCELLED].includes(state);
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
