# Universal Rental Portal — Execution Plan Part 2: Core Features Implementation

**Document:** Part 2 of 5 - Features 3-10 Detailed Implementation  
**Related:** EXECUTION_PLAN_V2.md (Part 1)  
**Last Updated:** January 23, 2026

---

## 📋 Table of Contents

- [Feature 3: Booking State Machine & Lifecycle](#feature-3-booking-state-machine--lifecycle)
- [Feature 4: Payment System Integration](#feature-4-payment-system-integration)
- [Feature 5: Search & Discovery Infrastructure](#feature-5-search--discovery-infrastructure)
- [Feature 6: Messaging & Real-time Communication](#feature-6-messaging--real-time-communication)
- [Feature 7: Fulfillment & Condition Reports](#feature-7-fulfillment--condition-reports)
- [Feature 8: Dispute Resolution System](#feature-8-dispute-resolution-system)
- [Feature 9: Mobile App Architecture](#feature-9-mobile-app-architecture)
- [Feature 10: Admin Portal Implementation](#feature-10-admin-portal-implementation)

---

## Feature 3: Booking State Machine & Lifecycle

### 3.1 State Machine Architecture

#### State Definitions & Transitions

```typescript
// apps/api/src/modules/bookings/domain/booking-state-machine.ts

export enum BookingStatus {
  DRAFT = "DRAFT",
  PENDING_OWNER_APPROVAL = "PENDING_OWNER_APPROVAL",
  PENDING_PAYMENT = "PENDING_PAYMENT",
  CONFIRMED = "CONFIRMED",
  IN_PROGRESS = "IN_PROGRESS",
  AWAITING_RETURN_INSPECTION = "AWAITING_RETURN_INSPECTION",
  COMPLETED = "COMPLETED",
  SETTLED = "SETTLED",
  CANCELLED = "CANCELLED",
  DISPUTED = "DISPUTED",
  REFUNDED = "REFUNDED",
}

interface StateDefinition {
  allowedTransitions: BookingStatus[];
  invariants: InvariantCheck[];
  onEnter?: (booking: Booking) => Promise<void>;
  onExit?: (booking: Booking) => Promise<void>;
  onFailedTransition?: (booking: Booking, error: Error) => Promise<void>;
}

interface InvariantCheck {
  name: string;
  check: (booking: Booking) => boolean | Promise<boolean>;
  errorMessage: string;
}

const STATE_DEFINITIONS: Record<BookingStatus, StateDefinition> = {
  [BookingStatus.DRAFT]: {
    allowedTransitions: [
      BookingStatus.PENDING_OWNER_APPROVAL,
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.CANCELLED,
    ],
    invariants: [
      {
        name: "quote_exists",
        check: (booking) => !!booking.quoteSnapshot,
        errorMessage: "Quote snapshot is required",
      },
    ],
    onEnter: async (booking) => {
      // Log draft creation
      await auditLog.create({
        action: "booking.draft.created",
        bookingId: booking.id,
        userId: booking.renterId,
      });
    },
  },

  [BookingStatus.PENDING_OWNER_APPROVAL]: {
    allowedTransitions: [
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.CANCELLED,
    ],
    invariants: [
      {
        name: "listing_requires_approval",
        check: async (booking) => {
          const listing = await getListing(booking.listingId);
          return listing.bookingMode === "request-to-book";
        },
        errorMessage: "Listing does not require approval",
      },
    ],
    onEnter: async (booking) => {
      // Set expiration timer (48 hours)
      await scheduleJob("expire-booking-request", {
        bookingId: booking.id,
        expiresAt: addHours(new Date(), 48),
      });

      // Notify owner
      await notificationService.send({
        userId: booking.ownerId,
        type: "booking_requested",
        data: { bookingId: booking.id },
      });
    },
  },

  [BookingStatus.PENDING_PAYMENT]: {
    allowedTransitions: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    invariants: [
      {
        name: "payment_intent_created",
        check: (booking) => !!booking.paymentIntentId,
        errorMessage: "Payment intent must be created",
      },
      {
        name: "owner_approved_if_required",
        check: async (booking) => {
          const listing = await getListing(booking.listingId);
          if (listing.bookingMode === "instant-book") return true;
          return booking.ownerApprovedAt !== null;
        },
        errorMessage: "Owner approval required",
      },
    ],
    onEnter: async (booking) => {
      // Set payment expiration (15 minutes)
      await scheduleJob("expire-payment-window", {
        bookingId: booking.id,
        expiresAt: addMinutes(new Date(), 15),
      });

      // Notify renter
      await notificationService.send({
        userId: booking.renterId,
        type: "payment_required",
        data: { bookingId: booking.id },
      });
    },
  },

  [BookingStatus.CONFIRMED]: {
    allowedTransitions: [
      BookingStatus.IN_PROGRESS,
      BookingStatus.CANCELLED,
      BookingStatus.DISPUTED,
    ],
    invariants: [
      {
        name: "payment_succeeded",
        check: async (booking) => {
          const payment = await getPaymentIntent(booking.paymentIntentId);
          return payment.status === "succeeded";
        },
        errorMessage: "Payment must be successful",
      },
      {
        name: "deposit_held_if_required",
        check: async (booking) => {
          const listing = await getListing(booking.listingId);
          if (!listing.requiresDeposit) return true;
          return !!booking.depositHoldId;
        },
        errorMessage: "Deposit hold required",
      },
      {
        name: "agreement_snapshot_exists",
        check: (booking) => !!booking.agreementSnapshot,
        errorMessage: "Agreement snapshot is required",
      },
    ],
    onEnter: async (booking) => {
      // Block availability
      await blockAvailability(booking.listingId, booking.dateRange);

      // Schedule reminder emails
      await scheduleJob("send-booking-reminder", {
        bookingId: booking.id,
        sendAt: subHours(booking.startDate, 24), // 24 hours before
      });

      // Notify both parties
      await Promise.all([
        notificationService.send({
          userId: booking.renterId,
          type: "booking_confirmed",
          data: { bookingId: booking.id },
        }),
        notificationService.send({
          userId: booking.ownerId,
          type: "booking_confirmed",
          data: { bookingId: booking.id },
        }),
      ]);

      // Emit domain event
      await eventBus.publish("booking.confirmed", {
        bookingId: booking.id,
        listingId: booking.listingId,
        renterId: booking.renterId,
        ownerId: booking.ownerId,
        dateRange: booking.dateRange,
      });
    },
  },

  [BookingStatus.IN_PROGRESS]: {
    allowedTransitions: [
      BookingStatus.AWAITING_RETURN_INSPECTION,
      BookingStatus.COMPLETED,
      BookingStatus.DISPUTED,
    ],
    invariants: [
      {
        name: "start_date_reached",
        check: (booking) => isPast(booking.startDate),
        errorMessage: "Start date has not been reached",
      },
      {
        name: "checkin_report_if_required",
        check: async (booking) => {
          const listing = await getListing(booking.listingId);
          const category = await getCategory(listing.category);

          if (!category.requiresCheckinReport) return true;

          const report = await getConditionReport(booking.id, "check_in");
          return report?.status === "submitted";
        },
        errorMessage: "Check-in condition report required",
      },
    ],
    onEnter: async (booking) => {
      // Track start
      await auditLog.create({
        action: "booking.started",
        bookingId: booking.id,
      });

      // Schedule late return detection
      await scheduleJob("detect-late-return", {
        bookingId: booking.id,
        checkAt: addHours(booking.endDate, 2), // 2 hours grace period
      });

      // Notify about check-out requirements
      await scheduleJob("send-checkout-reminder", {
        bookingId: booking.id,
        sendAt: subHours(booking.endDate, 4),
      });
    },
  },

  [BookingStatus.AWAITING_RETURN_INSPECTION]: {
    allowedTransitions: [BookingStatus.COMPLETED, BookingStatus.DISPUTED],
    invariants: [
      {
        name: "end_date_reached",
        check: (booking) => isPast(booking.endDate),
        errorMessage: "End date has not been reached",
      },
      {
        name: "checkout_report_submitted",
        check: async (booking) => {
          const report = await getConditionReport(booking.id, "check_out");
          return report?.status === "submitted";
        },
        errorMessage: "Check-out condition report required",
      },
    ],
    onEnter: async (booking) => {
      // Set inspection deadline
      const listing = await getListing(booking.listingId);
      const category = await getCategory(listing.category);

      await scheduleJob("auto-complete-inspection", {
        bookingId: booking.id,
        expiresAt: addHours(new Date(), category.inspectionWindowHours || 48),
      });

      // Notify owner to inspect
      await notificationService.send({
        userId: booking.ownerId,
        type: "inspection_required",
        data: { bookingId: booking.id },
      });
    },
  },

  [BookingStatus.COMPLETED]: {
    allowedTransitions: [BookingStatus.SETTLED, BookingStatus.DISPUTED],
    invariants: [
      {
        name: "no_open_disputes",
        check: async (booking) => {
          const disputes = await getOpenDisputes(booking.id);
          return disputes.length === 0;
        },
        errorMessage: "Cannot complete booking with open disputes",
      },
    ],
    onEnter: async (booking) => {
      // Trigger review requests
      await scheduleJob("send-review-request", {
        bookingId: booking.id,
        sendAt: addHours(new Date(), 24), // 24 hours after completion
      });

      // Notify both parties
      await Promise.all([
        notificationService.send({
          userId: booking.renterId,
          type: "booking_completed",
          data: { bookingId: booking.id },
        }),
        notificationService.send({
          userId: booking.ownerId,
          type: "booking_completed",
          data: { bookingId: booking.id },
        }),
      ]);
    },
  },

  [BookingStatus.SETTLED]: {
    allowedTransitions: [BookingStatus.DISPUTED],
    invariants: [
      {
        name: "payout_processed_or_scheduled",
        check: async (booking) => {
          return !!booking.payoutId || !!booking.payoutScheduledAt;
        },
        errorMessage: "Payout must be processed or scheduled",
      },
      {
        name: "deposit_released",
        check: async (booking) => {
          if (!booking.depositHoldId) return true;
          const deposit = await getDepositHold(booking.depositHoldId);
          return deposit.status === "released";
        },
        errorMessage: "Deposit must be released",
      },
    ],
    onEnter: async (booking) => {
      // Process payout to owner
      await processOwnerPayout(booking);

      // Release deposit
      if (booking.depositHoldId) {
        await releaseDepositHold(booking.depositHoldId);
      }

      // Archive booking data
      await scheduleJob("archive-booking", {
        bookingId: booking.id,
        archiveAt: addMonths(new Date(), 3), // Archive after 3 months
      });
    },
  },

  [BookingStatus.CANCELLED]: {
    allowedTransitions: [BookingStatus.REFUNDED],
    invariants: [],
    onEnter: async (booking) => {
      // Calculate and process refund
      const refund = await calculateCancellationRefund(booking);
      await processRefund(booking, refund);

      // Release availability
      await releaseAvailability(booking.listingId, booking.dateRange);

      // Release deposit if held
      if (booking.depositHoldId) {
        await releaseDepositHold(booking.depositHoldId);
      }

      // Notify parties
      await Promise.all([
        notificationService.send({
          userId: booking.renterId,
          type: "booking_cancelled",
          data: { bookingId: booking.id, refund },
        }),
        notificationService.send({
          userId: booking.ownerId,
          type: "booking_cancelled",
          data: { bookingId: booking.id },
        }),
      ]);
    },
  },

  [BookingStatus.DISPUTED]: {
    allowedTransitions: [
      BookingStatus.COMPLETED,
      BookingStatus.REFUNDED,
      BookingStatus.SETTLED,
    ],
    invariants: [
      {
        name: "dispute_exists",
        check: async (booking) => {
          const dispute = await getActiveDispute(booking.id);
          return !!dispute;
        },
        errorMessage: "Active dispute required",
      },
    ],
    onEnter: async (booking) => {
      // Pause any scheduled actions
      await cancelScheduledJobs(booking.id);

      // Notify admin team
      await notificationService.send({
        channel: "admin",
        type: "dispute_opened",
        data: { bookingId: booking.id },
      });
    },
  },

  [BookingStatus.REFUNDED]: {
    allowedTransitions: [],
    invariants: [
      {
        name: "refund_processed",
        check: async (booking) => {
          const refunds = await getRefunds(booking.id);
          return refunds.some((r) => r.status === "succeeded");
        },
        errorMessage: "Refund must be processed",
      },
    ],
    onEnter: async (booking) => {
      // Final notification
      await notificationService.send({
        userId: booking.renterId,
        type: "refund_processed",
        data: { bookingId: booking.id },
      });
    },
  },
};
```

### 3.2 State Machine Service Implementation

```typescript
// apps/api/src/modules/bookings/services/booking-state-machine.service.ts

@Injectable()
export class BookingStateMachineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly auditService: AuditService,
  ) {}

  async transition(
    bookingId: string,
    toState: BookingStatus,
    context: TransitionContext,
  ): Promise<Booking> {
    return await this.prisma.$transaction(
      async (tx) => {
        // Lock booking row
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            listing: true,
            renter: true,
            owner: true,
          },
        });

        if (!booking) {
          throw new NotFoundException(`Booking ${bookingId} not found`);
        }

        // Validate transition
        await this.validateTransition(booking, toState);

        // Execute exit handler for current state
        const currentStateDef = STATE_DEFINITIONS[booking.status];
        if (currentStateDef.onExit) {
          await currentStateDef.onExit(booking);
        }

        // Update booking status
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: toState,
            updatedAt: new Date(),
          },
        });

        // Record state transition in history
        await tx.bookingStateHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: toState,
            triggeredBy: context.triggeredBy,
            triggeredById: context.triggeredById,
            reason: context.reason,
            metadata: context.metadata,
            timestamp: new Date(),
          },
        });

        // Execute enter handler for new state
        const newStateDef = STATE_DEFINITIONS[toState];
        if (newStateDef.onEnter) {
          await newStateDef.onEnter(updatedBooking);
        }

        // Emit state change event
        await this.eventBus.publish("booking.state.changed", {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: toState,
          triggeredBy: context.triggeredBy,
          timestamp: new Date(),
        });

        // Audit log
        await this.auditService.log({
          action: "booking.state.transition",
          resource: "booking",
          resourceId: bookingId,
          userId: context.triggeredById,
          changes: {
            status: { from: booking.status, to: toState },
          },
          metadata: context.metadata,
        });

        return updatedBooking;
      },
      {
        isolationLevel: "Serializable", // Prevent concurrent transitions
        timeout: 10000, // 10 second timeout
      },
    );
  }

  private async validateTransition(
    booking: Booking,
    toState: BookingStatus,
  ): Promise<void> {
    const currentStateDef = STATE_DEFINITIONS[booking.status];

    // Check if transition is allowed
    if (!currentStateDef.allowedTransitions.includes(toState)) {
      throw new InvalidStateTransitionException(
        `Cannot transition from ${booking.status} to ${toState}`,
      );
    }

    // Check all invariants for the new state
    const newStateDef = STATE_DEFINITIONS[toState];
    const failedInvariants: InvariantCheck[] = [];

    for (const invariant of newStateDef.invariants) {
      const result = await invariant.check(booking);
      if (!result) {
        failedInvariants.push(invariant);
      }
    }

    if (failedInvariants.length > 0) {
      throw new InvariantViolationException(
        `State transition invariants failed`,
        failedInvariants.map((inv) => ({
          name: inv.name,
          message: inv.errorMessage,
        })),
      );
    }
  }

  async getAvailableTransitions(bookingId: string): Promise<BookingStatus[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    const stateDef = STATE_DEFINITIONS[booking.status];
    return stateDef.allowedTransitions;
  }

  async getStateHistory(bookingId: string): Promise<BookingStateHistory[]> {
    return await this.prisma.bookingStateHistory.findMany({
      where: { bookingId },
      orderBy: { timestamp: "asc" },
      include: {
        triggeredByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  // Automatic state transitions based on conditions
  async checkAndTransitionExpiredBookings(): Promise<void> {
    const now = new Date();

    // Auto-cancel pending approvals after 48 hours
    const expiredApprovals = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        createdAt: { lte: subHours(now, 48) },
      },
    });

    for (const booking of expiredApprovals) {
      await this.transition(booking.id, BookingStatus.CANCELLED, {
        triggeredBy: "system",
        reason: "Owner did not respond within 48 hours",
      });
    }

    // Auto-cancel pending payments after 15 minutes
    const expiredPayments = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        updatedAt: { lte: subMinutes(now, 15) },
      },
    });

    for (const booking of expiredPayments) {
      await this.transition(booking.id, BookingStatus.CANCELLED, {
        triggeredBy: "system",
        reason: "Payment window expired",
      });
    }
  }

  async autoCompleteAfterInspection(): Promise<void> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
      },
      include: {
        listing: { include: { category: true } },
      },
    });

    for (const booking of bookings) {
      const inspectionWindow =
        booking.listing.category.inspectionWindowHours || 48;
      const deadline = addHours(booking.inspectionStartedAt, inspectionWindow);

      if (isPast(deadline)) {
        // No disputes filed within inspection window
        await this.transition(booking.id, BookingStatus.COMPLETED, {
          triggeredBy: "system",
          reason: "Inspection window expired without disputes",
        });
      }
    }
  }
}
```

### 3.3 Booking Flow Implementations

#### Instant Book Flow

```typescript
// apps/api/src/modules/bookings/services/instant-book.service.ts

@Injectable()
export class InstantBookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly quoteService: QuoteService,
    private readonly paymentService: PaymentService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async createInstantBooking(dto: CreateBookingDto): Promise<Booking> {
    // Validate listing allows instant booking
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });

    if (listing.bookingMode !== "instant-book") {
      throw new BadRequestException("Listing does not support instant booking");
    }

    // Check availability (with lock)
    const isAvailable = await this.availabilityService.checkAndReserve(
      dto.listingId,
      dto.dateRange,
      dto.quantity,
    );

    if (!isAvailable) {
      throw new ConflictException("Dates are no longer available");
    }

    try {
      // Generate quote
      const quote = await this.quoteService.generateQuote({
        listingId: dto.listingId,
        dateRange: dto.dateRange,
        quantity: dto.quantity,
        renterId: dto.renterId,
      });

      // Create booking in PENDING_PAYMENT state
      const booking = await this.prisma.booking.create({
        data: {
          listingId: dto.listingId,
          renterId: dto.renterId,
          ownerId: listing.ownerId,
          status: BookingStatus.PENDING_PAYMENT,
          dateRange: dto.dateRange,
          quantity: dto.quantity,
          quoteSnapshot: quote,
          agreementSnapshot: await this.generateAgreementSnapshot(
            listing,
            quote,
          ),
          fulfillmentMethod: dto.fulfillmentMethod,
          guestCount: dto.guestCount,
          specialRequests: dto.specialRequests,
        },
      });

      // Create payment intent
      const paymentIntent = await this.paymentService.createPaymentIntent({
        bookingId: booking.id,
        amount: quote.total,
        currency: quote.currency,
        metadata: {
          bookingId: booking.id,
          listingId: listing.id,
          renterId: dto.renterId,
          ownerId: listing.ownerId,
        },
      });

      // Update booking with payment intent ID
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { paymentIntentId: paymentIntent.id },
      });

      // Create deposit hold if required
      if (listing.requiresDeposit) {
        const depositHold = await this.paymentService.createDepositHold({
          bookingId: booking.id,
          amount: listing.depositAmount,
          currency: quote.currency,
        });

        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { depositHoldId: depositHold.id },
        });
      }

      return booking;
    } catch (error) {
      // Release reservation on failure
      await this.availabilityService.releaseReservation(
        dto.listingId,
        dto.dateRange,
        dto.quantity,
      );
      throw error;
    }
  }

  async confirmPayment(
    bookingId: string,
    paymentIntentId: string,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException("Booking is not awaiting payment");
    }

    // Verify payment succeeded
    const payment = await this.paymentService.getPaymentIntent(paymentIntentId);
    if (payment.status !== "succeeded") {
      throw new BadRequestException("Payment has not succeeded");
    }

    // Transition to CONFIRMED
    return await this.stateMachine.transition(
      bookingId,
      BookingStatus.CONFIRMED,
      {
        triggeredBy: "system",
        reason: "Payment confirmed",
      },
    );
  }
}
```

#### Request-to-Book Flow

```typescript
// apps/api/src/modules/bookings/services/request-to-book.service.ts

@Injectable()
export class RequestToBookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly quoteService: QuoteService,
    private readonly notificationService: NotificationService,
  ) {}

  async createBookingRequest(dto: CreateBookingDto): Promise<Booking> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });

    if (listing.bookingMode !== "request-to-book") {
      throw new BadRequestException("Listing does not support request-to-book");
    }

    // Generate quote
    const quote = await this.quoteService.generateQuote({
      listingId: dto.listingId,
      dateRange: dto.dateRange,
      quantity: dto.quantity,
      renterId: dto.renterId,
    });

    // Create booking in PENDING_OWNER_APPROVAL state
    const booking = await this.prisma.booking.create({
      data: {
        listingId: dto.listingId,
        renterId: dto.renterId,
        ownerId: listing.ownerId,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        dateRange: dto.dateRange,
        quantity: dto.quantity,
        quoteSnapshot: quote,
        fulfillmentMethod: dto.fulfillmentMethod,
        guestCount: dto.guestCount,
        specialRequests: dto.specialRequests,
        expiresAt: addHours(new Date(), 48), // 48 hour expiration
      },
    });

    // Notify owner
    await this.notificationService.send({
      userId: listing.ownerId,
      type: "booking_request_received",
      data: {
        bookingId: booking.id,
        renterName: dto.renterName,
        dateRange: dto.dateRange,
      },
    });

    return booking;
  }

  async acceptBookingRequest(
    bookingId: string,
    ownerId: string,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (booking.ownerId !== ownerId) {
      throw new ForbiddenException("Not authorized");
    }

    if (booking.status !== BookingStatus.PENDING_OWNER_APPROVAL) {
      throw new BadRequestException("Booking is not awaiting approval");
    }

    // Check if expired
    if (isPast(booking.expiresAt)) {
      throw new BadRequestException("Booking request has expired");
    }

    // Mark as owner approved
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        ownerApprovedAt: new Date(),
        ownerApprovedBy: ownerId,
      },
    });

    // Transition to PENDING_PAYMENT
    const updatedBooking = await this.stateMachine.transition(
      bookingId,
      BookingStatus.PENDING_PAYMENT,
      {
        triggeredBy: "owner",
        triggeredById: ownerId,
        reason: "Owner accepted booking request",
      },
    );

    // Create payment intent
    const paymentIntent = await this.paymentService.createPaymentIntent({
      bookingId: booking.id,
      amount: booking.quoteSnapshot.total,
      currency: booking.quoteSnapshot.currency,
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { paymentIntentId: paymentIntent.id },
    });

    // Notify renter
    await this.notificationService.send({
      userId: booking.renterId,
      type: "booking_request_accepted",
      data: {
        bookingId: booking.id,
        paymentRequired: true,
      },
    });

    return updatedBooking;
  }

  async declineBookingRequest(
    bookingId: string,
    ownerId: string,
    reason: string,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (booking.ownerId !== ownerId) {
      throw new ForbiddenException("Not authorized");
    }

    if (booking.status !== BookingStatus.PENDING_OWNER_APPROVAL) {
      throw new BadRequestException("Booking is not awaiting approval");
    }

    // Transition to CANCELLED
    const updatedBooking = await this.stateMachine.transition(
      bookingId,
      BookingStatus.CANCELLED,
      {
        triggeredBy: "owner",
        triggeredById: ownerId,
        reason: `Owner declined: ${reason}`,
      },
    );

    // Notify renter
    await this.notificationService.send({
      userId: booking.renterId,
      type: "booking_request_declined",
      data: {
        bookingId: booking.id,
        reason,
      },
    });

    return updatedBooking;
  }
}
```

### 3.4 Cancellation & Refund Logic

```typescript
// apps/api/src/modules/bookings/services/cancellation.service.ts

@Injectable()
export class CancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly paymentService: PaymentService,
    private readonly ledgerService: LedgerService,
  ) {}

  async cancelBooking(
    bookingId: string,
    cancelledBy: "renter" | "owner" | "admin",
    userId: string,
    reason: string,
  ): Promise<CancellationResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          include: { cancellationPolicy: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    // Validate cancellation is allowed
    this.validateCancellation(booking, cancelledBy, userId);

    // Calculate refund
    const refundCalculation = await this.calculateRefund(
      booking,
      cancelledBy,
      new Date(),
    );

    // Execute cancellation
    return await this.prisma.$transaction(async (tx) => {
      // Transition booking to CANCELLED
      await this.stateMachine.transition(bookingId, BookingStatus.CANCELLED, {
        triggeredBy: cancelledBy,
        triggeredById: userId,
        reason,
        metadata: { refundCalculation },
      });

      // Process refund
      let refund = null;
      if (refundCalculation.refundAmount > 0) {
        refund = await this.paymentService.createRefund({
          paymentIntentId: booking.paymentIntentId,
          amount: refundCalculation.refundAmount,
          reason: "Booking cancelled",
          metadata: {
            bookingId: booking.id,
            cancelledBy,
            policyApplied: refundCalculation.policyName,
          },
        });

        // Record in ledger
        await this.ledgerService.recordRefund({
          bookingId: booking.id,
          refundId: refund.id,
          amount: refundCalculation.refundAmount,
          description: `Cancellation refund - ${refundCalculation.policyName}`,
        });
      }

      // Release deposit hold
      if (booking.depositHoldId) {
        await this.paymentService.releaseDepositHold(booking.depositHoldId);
      }

      // Record cancellation fee if applicable
      if (refundCalculation.cancellationFee > 0) {
        await this.ledgerService.recordCancellationFee({
          bookingId: booking.id,
          amount: refundCalculation.cancellationFee,
          description: "Cancellation penalty",
        });
      }

      return {
        booking,
        refund,
        refundCalculation,
      };
    });
  }

  private async calculateRefund(
    booking: Booking,
    cancelledBy: "renter" | "owner" | "admin",
    cancelledAt: Date,
  ): Promise<RefundCalculation> {
    const policy = booking.listing.cancellationPolicy;
    const totalPaid = booking.quoteSnapshot.total.amount;
    const hoursUntilStart = differenceInHours(booking.startDate, cancelledAt);

    let refundPercentage = 0;
    let policyName = "";

    // Owner cancellation - full refund always
    if (cancelledBy === "owner") {
      refundPercentage = 100;
      policyName = "Owner cancellation - full refund";
    }
    // Admin cancellation - full refund
    else if (cancelledBy === "admin") {
      refundPercentage = 100;
      policyName = "Admin cancellation - full refund";
    }
    // Renter cancellation - apply policy
    else {
      switch (policy.type) {
        case "flexible":
          if (hoursUntilStart >= 24) {
            refundPercentage = 100;
            policyName = "Flexible - Full refund (>24h)";
          } else if (hoursUntilStart >= 0) {
            refundPercentage = 50;
            policyName = "Flexible - 50% refund (<24h)";
          } else {
            refundPercentage = 0;
            policyName = "Flexible - No refund (after start)";
          }
          break;

        case "moderate":
          if (hoursUntilStart >= 5 * 24) {
            // 5 days
            refundPercentage = 100;
            policyName = "Moderate - Full refund (>5 days)";
          } else if (hoursUntilStart >= 24) {
            refundPercentage = 50;
            policyName = "Moderate - 50% refund (1-5 days)";
          } else {
            refundPercentage = 0;
            policyName = "Moderate - No refund (<24h)";
          }
          break;

        case "strict":
          if (hoursUntilStart >= 7 * 24) {
            // 7 days
            refundPercentage = 100;
            policyName = "Strict - Full refund (>7 days)";
          } else if (hoursUntilStart >= 48) {
            refundPercentage = 50;
            policyName = "Strict - 50% refund (2-7 days)";
          } else {
            refundPercentage = 0;
            policyName = "Strict - No refund (<48h)";
          }
          break;

        case "non-refundable":
          refundPercentage = 0;
          policyName = "Non-refundable";
          break;
      }
    }

    const refundAmount = Math.round(totalPaid * (refundPercentage / 100));
    const cancellationFee = totalPaid - refundAmount;

    // Subtract processing fee (e.g., 3% of refund)
    const processingFee = Math.round(refundAmount * 0.03);
    const netRefund = refundAmount - processingFee;

    return {
      originalAmount: totalPaid,
      refundPercentage,
      refundAmount: netRefund,
      cancellationFee,
      processingFee,
      policyName,
      hoursUntilStart,
      breakdown: [
        {
          type: "original_charge",
          description: "Original booking amount",
          amount: totalPaid,
        },
        {
          type: "refund",
          description: `Refund (${refundPercentage}%)`,
          amount: refundAmount,
        },
        {
          type: "processing_fee",
          description: "Processing fee (3%)",
          amount: -processingFee,
        },
        {
          type: "cancellation_fee",
          description: "Cancellation penalty",
          amount: -cancellationFee,
        },
      ],
    };
  }

  private validateCancellation(
    booking: Booking,
    cancelledBy: "renter" | "owner" | "admin",
    userId: string,
  ): void {
    // Check authorization
    if (cancelledBy === "renter" && booking.renterId !== userId) {
      throw new ForbiddenException("Not authorized to cancel this booking");
    }
    if (cancelledBy === "owner" && booking.ownerId !== userId) {
      throw new ForbiddenException("Not authorized to cancel this booking");
    }

    // Check if booking can be cancelled
    const cancellableStatuses = [
      BookingStatus.PENDING_OWNER_APPROVAL,
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];

    if (!cancellableStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Booking cannot be cancelled in ${booking.status} status`,
      );
    }

    // Owner cannot cancel after start date (except admin)
    if (cancelledBy === "owner" && isPast(booking.startDate)) {
      throw new BadRequestException(
        "Owner cannot cancel booking after start date",
      );
    }
  }
}
```

### 3.5 React Router v7 Booking Flow Integration

```typescript
// apps/web/app/routes/bookings.create.tsx

import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const listingId = url.searchParams.get('listingId');

  if (!listingId) {
    throw new Response('Listing ID required', { status: 400 });
  }

  const userId = await requireUserId(request);

  // Fetch listing details and generate quote
  const [listing, quote] = await Promise.all([
    apiClient.listings.getById(listingId),
    apiClient.quotes.generate({
      listingId,
      dateRange: {
        start: url.searchParams.get('startDate'),
        end: url.searchParams.get('endDate')
      }
    })
  ]);

  return json({ listing, quote, user: await getUserById(userId) });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  const bookingData = {
    listingId: formData.get('listingId') as string,
    renterId: userId,
    dateRange: {
      start: new Date(formData.get('startDate') as string),
      end: new Date(formData.get('endDate') as string)
    },
    guestCount: parseInt(formData.get('guestCount') as string),
    specialRequests: formData.get('specialRequests') as string,
    fulfillmentMethod: formData.get('fulfillmentMethod') as string
  };

  try {
    // Create booking
    const booking = await apiClient.bookings.create(bookingData);

    // Redirect to payment
    return redirect(`/bookings/${booking.id}/payment`);
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
}

export default function CreateBooking() {
  const { listing, quote, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Booking Form */}
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold mb-6">Confirm and pay</h1>

          <Form method="post" className="space-y-6">
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="startDate" value={quote.dateRange.start} />
            <input type="hidden" name="endDate" value={quote.dateRange.end} />

            {/* Trip details */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Your trip</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Dates</span>
                  <span>{formatDateRange(quote.dateRange)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Guests</span>
                  <input
                    type="number"
                    name="guestCount"
                    min="1"
                    max={listing.capacity}
                    defaultValue="1"
                    className="w-20 px-2 py-1 border rounded"
                  />
                </div>
              </div>
            </section>

            {/* Payment method */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Pay with</h2>
              <StripePaymentElement />
            </section>

            {/* Cancellation policy */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Cancellation policy</h2>
              <p className="text-gray-600">
                {listing.cancellationPolicy.description}
              </p>
            </section>

            {/* Special requests */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Special requests</h2>
              <textarea
                name="specialRequests"
                rows={4}
                className="w-full px-3 py-2 border rounded"
                placeholder="Any special requirements?"
              />
            </section>

            {/* Terms agreement */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the <a href="/terms" className="text-blue-600">Terms of Service</a>,
                <a href="/cancellation-policy" className="text-blue-600"> Cancellation Policy</a>,
                and <a href="/house-rules" className="text-blue-600">House Rules</a>.
              </label>
            </div>

            {actionData?.error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {actionData.error}
              </div>
            )}

            <button
              type="submit"
              disabled={!agreedToTerms || isSubmitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : `Confirm and pay ${formatCurrency(quote.total)}`}
            </button>
          </Form>
        </div>

        {/* Right: Price Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 border rounded-lg p-6">
            <div className="flex gap-4 mb-6">
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-24 h-24 object-cover rounded-lg"
              />
              <div>
                <h3 className="font-semibold">{listing.title}</h3>
                <p className="text-sm text-gray-600">{listing.category}</p>
                <div className="flex items-center mt-1">
                  <StarIcon className="w-4 h-4" />
                  <span className="text-sm ml-1">{listing.rating}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-4">Price details</h4>
              <div className="space-y-2">
                {quote.lineItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.description}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total (USD)</span>
                  <span>{formatCurrency(quote.total)}</span>
                </div>
              </div>

              {quote.deposit && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 p-3 rounded">
                  <p className="text-sm">
                    <strong>Security deposit:</strong> {formatCurrency(quote.deposit)}
                    will be held but not charged unless there are damages.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Feature 4: Payment System Integration

### 4.1 Stripe Connect Setup

```typescript
// apps/api/src/modules/payments/services/stripe.service.ts

import Stripe from "stripe";

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(config.get("STRIPE_SECRET_KEY"), {
      apiVersion: "2023-10-16",
      typescript: true,
    });
  }

  // Marketplace payment intent
  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<Stripe.PaymentIntent> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: params.bookingId },
      include: { listing: { include: { owner: true } } },
    });

    // Calculate platform fee (e.g., 10% of subtotal)
    const platformFee = Math.round(params.amount * 0.1);
    const ownerAmount = params.amount - platformFee;

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount, // in cents
      currency: params.currency.toLowerCase(),

      // Connect to owner's Stripe account
      application_fee_amount: platformFee,
      transfer_data: {
        destination: booking.listing.owner.stripeAccountId,
      },

      // Metadata for tracking
      metadata: {
        bookingId: params.bookingId,
        listingId: booking.listingId,
        renterId: booking.renterId,
        ownerId: booking.ownerId,
        platformFee: platformFee.toString(),
        ownerAmount: ownerAmount.toString(),
      },

      // Payment method types
      payment_method_types: ["card"],

      // Capture method
      capture_method: "automatic",

      // Description
      description: `Booking #${params.bookingId.slice(0, 8)}`,

      // Statement descriptor
      statement_descriptor: "RENTAL PLATFORM",
    });

    return paymentIntent;
  }

  // Deposit authorization hold
  async createDepositHold(
    params: CreateDepositHoldParams,
  ): Promise<Stripe.PaymentIntent> {
    const depositIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),

      // Use separate payment method or same as booking
      payment_method: params.paymentMethodId,

      // Manual capture for holds
      capture_method: "manual",

      // Confirm immediately if payment method provided
      confirm: !!params.paymentMethodId,

      metadata: {
        bookingId: params.bookingId,
        type: "deposit_hold",
      },

      description: `Security deposit - Booking #${params.bookingId.slice(0, 8)}`,
    });

    // Store hold information
    await this.prisma.depositHold.create({
      data: {
        id: depositIntent.id,
        bookingId: params.bookingId,
        amount: params.amount,
        currency: params.currency,
        status: "authorized",
        expiresAt: addDays(new Date(), 7), // Holds expire after 7 days
        stripePaymentIntentId: depositIntent.id,
      },
    });

    return depositIntent;
  }

  // Release deposit hold
  async releaseDepositHold(depositHoldId: string): Promise<void> {
    const hold = await this.prisma.depositHold.findUnique({
      where: { id: depositHoldId },
    });

    if (!hold) {
      throw new NotFoundException("Deposit hold not found");
    }

    if (hold.status !== "authorized") {
      throw new BadRequestException("Deposit hold is not authorized");
    }

    // Cancel the payment intent to release the hold
    await this.stripe.paymentIntents.cancel(hold.stripePaymentIntentId);

    // Update database
    await this.prisma.depositHold.update({
      where: { id: depositHoldId },
      data: {
        status: "released",
        releasedAt: new Date(),
      },
    });
  }

  // Capture deposit (for damages)
  async captureDeposit(
    depositHoldId: string,
    amount?: number,
  ): Promise<Stripe.PaymentIntent> {
    const hold = await this.prisma.depositHold.findUnique({
      where: { id: depositHoldId },
    });

    if (!hold) {
      throw new NotFoundException("Deposit hold not found");
    }

    if (hold.status !== "authorized") {
      throw new BadRequestException("Deposit hold is not authorized");
    }

    // Capture full amount or partial
    const captureAmount = amount || hold.amount;

    const captured = await this.stripe.paymentIntents.capture(
      hold.stripePaymentIntentId,
      {
        amount_to_capture: captureAmount,
      },
    );

    // Update database
    await this.prisma.depositHold.update({
      where: { id: depositHoldId },
      data: {
        status:
          amount && amount < hold.amount ? "partially_captured" : "captured",
        capturedAmount: captureAmount,
        capturedAt: new Date(),
      },
    });

    return captured;
  }

  // Create refund
  async createRefund(params: CreateRefundParams): Promise<Stripe.Refund> {
    const refund = await this.stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount,
      reason: this.mapRefundReason(params.reason),
      metadata: params.metadata,
    });

    // Record in database
    await this.prisma.refund.create({
      data: {
        id: refund.id,
        bookingId: params.metadata.bookingId,
        paymentIntentId: params.paymentIntentId,
        amount: params.amount,
        currency: refund.currency,
        reason: params.reason,
        status: refund.status,
        stripeRefundId: refund.id,
      },
    });

    return refund;
  }

  // Owner Connect account onboarding
  async createConnectAccount(userId: string): Promise<Stripe.Account> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Create Connect account
    const account = await this.stripe.accounts.create({
      type: "express", // or 'standard' for more control
      country: user.country || "US",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        userId: user.id,
      },
    });

    // Store Connect account ID
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeAccountId: account.id },
    });

    return account;
  }

  // Generate Connect onboarding link
  async createAccountLink(userId: string): Promise<Stripe.AccountLink> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeAccountId) {
      throw new BadRequestException("User does not have Connect account");
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: `${this.config.get("APP_URL")}/host/onboarding/refresh`,
      return_url: `${this.config.get("APP_URL")}/host/onboarding/complete`,
      type: "account_onboarding",
    });

    return accountLink;
  }

  // Create payout to owner
  async createPayout(params: CreatePayoutParams): Promise<Stripe.Transfer> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: params.bookingId },
      include: { owner: true },
    });

    if (!booking.owner.stripeAccountId) {
      throw new BadRequestException(
        "Owner has not completed Stripe onboarding",
      );
    }

    // Create transfer to Connect account
    const transfer = await this.stripe.transfers.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      destination: booking.owner.stripeAccountId,
      transfer_group: `booking_${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        type: "owner_payout",
      },
      description: `Payout for booking #${params.bookingId.slice(0, 8)}`,
    });

    // Record in database
    await this.prisma.payout.create({
      data: {
        id: transfer.id,
        bookingId: params.bookingId,
        ownerId: booking.ownerId,
        amount: params.amount,
        currency: params.currency,
        status: "completed",
        stripeTransferId: transfer.id,
        paidAt: new Date(),
      },
    });

    return transfer;
  }

  // Webhook handler
  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const webhookSecret = this.config.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.handlePaymentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "payment_intent.payment_failed":
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "charge.refunded":
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "account.updated":
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      console.error("Payment intent missing bookingId in metadata");
      return;
    }

    // Update booking status
    await this.bookingStateMachine.transition(
      bookingId,
      BookingStatus.CONFIRMED,
      {
        triggeredBy: "system",
        reason: "Payment succeeded",
        metadata: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      },
    );

    // Record in ledger
    await this.ledgerService.recordPayment({
      bookingId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      platformFee: parseInt(paymentIntent.metadata.platformFee || "0"),
      ownerAmount: parseInt(paymentIntent.metadata.ownerAmount || "0"),
    });
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) return;

    // Cancel booking
    await this.bookingStateMachine.transition(
      bookingId,
      BookingStatus.CANCELLED,
      {
        triggeredBy: "system",
        reason: "Payment failed",
        metadata: {
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message,
        },
      },
    );

    // Notify renter
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    await this.notificationService.send({
      userId: booking.renterId,
      type: "payment_failed",
      data: {
        bookingId,
        error: paymentIntent.last_payment_error?.message,
      },
    });
  }
}
```

### 4.2 Double-Entry Ledger Implementation

```typescript
// apps/api/src/modules/payments/services/ledger.service.ts

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  // Record booking payment
  async recordPayment(params: RecordPaymentParams): Promise<void> {
    const {
      bookingId,
      paymentIntentId,
      amount,
      currency,
      platformFee,
      ownerAmount,
    } = params;

    await this.prisma.$transaction([
      // Debit: Cash (asset) increases
      this.createEntry({
        bookingId,
        account: "assets.cash",
        side: "debit",
        amount,
        currency,
        description: "Payment received from renter",
        externalId: paymentIntentId,
        externalType: "payment_intent",
      }),

      // Credit: Liability to owner
      this.createEntry({
        bookingId,
        account: "liabilities.owners",
        side: "credit",
        amount: ownerAmount,
        currency,
        description: "Amount due to owner",
        externalId: paymentIntentId,
        externalType: "payment_intent",
      }),

      // Credit: Platform revenue
      this.createEntry({
        bookingId,
        account: "revenue.platform_fee",
        side: "credit",
        amount: platformFee,
        currency,
        description: "Platform service fee (10%)",
        externalId: paymentIntentId,
        externalType: "payment_intent",
      }),
    ]);
  }

  // Record refund
  async recordRefund(params: RecordRefundParams): Promise<void> {
    const { bookingId, refundId, amount, currency, description } = params;

    await this.prisma.$transaction([
      // Debit: Reduce revenue or liability
      this.createEntry({
        bookingId,
        account: "expenses.refunds",
        side: "debit",
        amount,
        currency,
        description: description || "Refund to renter",
        externalId: refundId,
        externalType: "refund",
      }),

      // Credit: Reduce cash
      this.createEntry({
        bookingId,
        account: "assets.cash",
        side: "credit",
        amount,
        currency,
        description: description || "Refund to renter",
        externalId: refundId,
        externalType: "refund",
      }),
    ]);
  }

  // Record owner payout
  async recordPayout(params: RecordPayoutParams): Promise<void> {
    const { bookingId, payoutId, amount, currency } = params;

    await this.prisma.$transaction([
      // Debit: Reduce liability to owner
      this.createEntry({
        bookingId,
        account: "liabilities.owners",
        side: "debit",
        amount,
        currency,
        description: "Payout to owner",
        externalId: payoutId,
        externalType: "payout",
      }),

      // Credit: Reduce cash
      this.createEntry({
        bookingId,
        account: "assets.cash",
        side: "credit",
        amount,
        currency,
        description: "Payout to owner",
        externalId: payoutId,
        externalType: "payout",
      }),
    ]);
  }

  // Record deposit hold
  async recordDepositHold(params: RecordDepositParams): Promise<void> {
    const { bookingId, depositHoldId, amount, currency } = params;

    await this.prisma.$transaction([
      // Debit: Deposits held (asset)
      this.createEntry({
        bookingId,
        account: "assets.deposits.held",
        side: "debit",
        amount,
        currency,
        description: "Security deposit held",
        externalId: depositHoldId,
        externalType: "deposit_hold",
      }),

      // Credit: Deposit liability
      this.createEntry({
        bookingId,
        account: "liabilities.deposits",
        side: "credit",
        amount,
        currency,
        description: "Security deposit liability",
        externalId: depositHoldId,
        externalType: "deposit_hold",
      }),
    ]);
  }

  // Record deposit release
  async recordDepositRelease(params: ReleaseDepositParams): Promise<void> {
    const { bookingId, depositHoldId, amount, currency } = params;

    await this.prisma.$transaction([
      // Debit: Reduce deposit liability
      this.createEntry({
        bookingId,
        account: "liabilities.deposits",
        side: "debit",
        amount,
        currency,
        description: "Security deposit released",
        externalId: depositHoldId,
        externalType: "deposit_release",
      }),

      // Credit: Reduce deposits held
      this.createEntry({
        bookingId,
        account: "assets.deposits.held",
        side: "credit",
        amount,
        currency,
        description: "Security deposit released",
        externalId: depositHoldId,
        externalType: "deposit_release",
      }),
    ]);
  }

  // Record deposit capture (for damages)
  async recordDepositCapture(params: CaptureDepositParams): Promise<void> {
    const { bookingId, depositHoldId, amount, currency, reason } = params;

    await this.prisma.$transaction([
      // Debit: Reduce deposit liability
      this.createEntry({
        bookingId,
        account: "liabilities.deposits",
        side: "debit",
        amount,
        currency,
        description: `Deposit captured: ${reason}`,
        externalId: depositHoldId,
        externalType: "deposit_capture",
      }),

      // Credit: Platform revenue (from captured deposit)
      this.createEntry({
        bookingId,
        account: "revenue.damages",
        side: "credit",
        amount,
        currency,
        description: `Deposit captured: ${reason}`,
        externalId: depositHoldId,
        externalType: "deposit_capture",
      }),
    ]);
  }

  // Create ledger entry
  private async createEntry(
    params: CreateLedgerEntryParams,
  ): Promise<LedgerEntry> {
    return await this.prisma.ledgerEntry.create({
      data: {
        id: crypto.randomUUID(),
        bookingId: params.bookingId,
        account: params.account,
        side: params.side,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        externalId: params.externalId,
        externalType: params.externalType,
        createdAt: new Date(),
      },
    });
  }

  // Get balance for an account
  async getAccountBalance(account: string, currency: string): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        account,
        currency,
      },
    });

    let balance = 0;
    entries.forEach((entry) => {
      if (entry.side === "debit") {
        balance += entry.amount;
      } else {
        balance -= entry.amount;
      }
    });

    return balance;
  }

  // Reconciliation report
  async generateReconciliationReport(
    startDate: Date,
    endDate: Date,
  ): Promise<ReconciliationReport> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get Stripe transactions for the same period
    const stripeTransactions = await this.stripe.balanceTransactions.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000),
      },
    });

    // Match transactions
    const matches = this.matchTransactions(entries, stripeTransactions.data);
    const discrepancies = matches.filter((m) => m.discrepancy !== 0);

    return {
      period: { start: startDate, end: endDate },
      ledgerTotal: this.sumEntries(entries),
      stripeTotal: this.sumStripeTransactions(stripeTransactions.data),
      matchCount: matches.filter((m) => m.matched).length,
      discrepancyCount: discrepancies.length,
      discrepancies,
      status: discrepancies.length === 0 ? "balanced" : "imbalanced",
    };
  }

  private matchTransactions(
    ledgerEntries: LedgerEntry[],
    stripeTransactions: Stripe.BalanceTransaction[],
  ): TransactionMatch[] {
    const matches: TransactionMatch[] = [];

    ledgerEntries.forEach((entry) => {
      const stripeMatch = stripeTransactions.find(
        (st) => st.id === entry.externalId,
      );

      if (stripeMatch) {
        const discrepancy = entry.amount - Math.abs(stripeMatch.amount);
        matches.push({
          ledgerEntry: entry,
          stripeTransaction: stripeMatch,
          matched: true,
          discrepancy,
        });
      } else {
        matches.push({
          ledgerEntry: entry,
          stripeTransaction: null,
          matched: false,
          discrepancy: entry.amount,
        });
      }
    });

    return matches;
  }
}
```

_This is Part 2 (Features 3-4). The document is getting quite long. Should I:_

1. Continue with Features 5-10 in this same file?
2. Create Part 3 with Features 5-10?
3. Create separate files for each remaining feature?

What would you prefer?
