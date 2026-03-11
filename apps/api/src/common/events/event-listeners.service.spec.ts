import { EventListeners } from './event-listeners.service';

describe('EventListeners', () => {
  let listeners: EventListeners;
  let notificationsQueue: { add: jest.Mock };
  let searchQueue: { add: jest.Mock };
  let bookingsQueue: { add: jest.Mock };

  beforeEach(() => {
    notificationsQueue = { add: jest.fn().mockResolvedValue(undefined) };
    searchQueue = { add: jest.fn().mockResolvedValue(undefined) };
    bookingsQueue = { add: jest.fn().mockResolvedValue(undefined) };
    listeners = new EventListeners(
      notificationsQueue as any,
      searchQueue as any,
      bookingsQueue as any,
    );
  });

  /* ---- Booking events ---- */

  it('handleBookingCreated sends notification + schedules expiration', async () => {
    await listeners.handleBookingCreated({
      bookingId: 'b1',
      listingId: 'l1',
      renterId: 'r1',
      ownerId: 'o1',
      startDate: new Date(),
      endDate: new Date(),
      totalPrice: 100,
    } as any);

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'o1',
        type: 'BOOKING_REQUEST',
        data: expect.objectContaining({ notificationType: 'booking_request', bookingId: 'b1' }),
      }),
    );
    expect(bookingsQueue.add).toHaveBeenCalledWith(
      'check-expiration',
      expect.objectContaining({ bookingId: 'b1' }),
      expect.objectContaining({ delay: 30 * 60 * 1000 }),
    );
  });

  it('handleBookingConfirmed notifies renter + schedules reminder', async () => {
    await listeners.handleBookingConfirmed({
      bookingId: 'b1',
      previousStatus: 'PENDING',
      newStatus: 'CONFIRMED',
      renterId: 'r1',
      ownerId: 'o1',
    } as any);

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'r1',
        type: 'BOOKING_CONFIRMED',
        priority: 'HIGH',
        data: expect.objectContaining({ notificationType: 'booking_confirmed', bookingId: 'b1' }),
      }),
    );
    expect(bookingsQueue.add).toHaveBeenCalledWith(
      'send-reminder',
      expect.objectContaining({ bookingId: 'b1', type: 'UPCOMING' }),
      expect.objectContaining({ delay: 24 * 60 * 60 * 1000 }),
    );
  });

  it('handleBookingCancelled notifies both renter and owner', async () => {
    await listeners.handleBookingCancelled({
      bookingId: 'b1',
      previousStatus: 'CONFIRMED',
      newStatus: 'CANCELLED',
      renterId: 'r1',
      ownerId: 'o1',
      reason: 'changed plans',
    } as any);

    expect(notificationsQueue.add).toHaveBeenCalledTimes(2);
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'r1',
        type: 'BOOKING_CANCELLED',
        data: expect.objectContaining({ notificationType: 'booking_cancelled', bookingId: 'b1' }),
      }),
    );
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'o1',
        type: 'BOOKING_CANCELLED',
        data: expect.objectContaining({ notificationType: 'booking_cancelled' }),
      }),
    );
  });

  it('handleBookingCompleted prompts both parties for reviews', async () => {
    await listeners.handleBookingCompleted({
      bookingId: 'b1',
      previousStatus: 'IN_PROGRESS',
      newStatus: 'COMPLETED',
      renterId: 'r1',
      ownerId: 'o1',
    } as any);

    expect(notificationsQueue.add).toHaveBeenCalledTimes(2);
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'r1',
        type: 'REVIEW_RECEIVED',
        data: expect.objectContaining({ notificationType: 'review_request', bookingId: 'b1' }),
      }),
    );
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'o1',
        type: 'REVIEW_RECEIVED',
        data: expect.objectContaining({ notificationType: 'review_request' }),
      }),
    );
  });

  /* ---- Payment events ---- */

  it('handlePaymentSucceeded sends batch notifications', async () => {
    await listeners.handlePaymentSucceeded({
      paymentId: 'p1',
      bookingId: 'b1',
      renterId: 'r1',
      ownerId: 'o1',
      amount: 5000,
      status: 'COMPLETED' as any,
    });

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send-batch',
      expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({ userId: 'r1' }),
          expect.objectContaining({ userId: 'o1' }),
        ]),
      }),
    );
  });

  it('handlePaymentFailed notifies renter with HIGH priority', async () => {
    await listeners.handlePaymentFailed({
      paymentId: 'p1',
      bookingId: 'b1',
      renterId: 'r1',
      ownerId: 'o1',
      amount: 5000,
      status: 'FAILED' as any,
    });

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'r1',
        type: 'PAYMENT_RECEIVED',   // regression guard: must NOT be BOOKING_CANCELLED
        priority: 'HIGH',
        data: expect.objectContaining({ notificationType: 'payment_failed', bookingId: 'b1' }),
      }),
    );
  });

  it('handlePaymentRefunded notifies renter about refund amount', async () => {
    await listeners.handlePaymentRefunded({
      paymentId: 'p1',
      bookingId: 'b1',
      renterId: 'r1',
      ownerId: 'o1',
      amount: 2500,
    });

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'r1',
        type: 'PAYMENT_REFUNDED',    // regression guard: must NOT be PAYMENT_RECEIVED or PAYOUT_PROCESSED
        message: expect.stringContaining('2500'),
        data: expect.objectContaining({
          notificationType: 'refund_processed',
          bookingId: 'b1',
          paymentId: 'p1',
        }),
      }),
    );
  });

  it('handlePaymentRefunded skips notification when renterId is absent', async () => {
    await listeners.handlePaymentRefunded({
      transactionId: 'tx-99',
      amount: 1000,
      // renterId intentionally absent (PaymentOrchestrationService path)
    });

    expect(notificationsQueue.add).not.toHaveBeenCalled();
  });

  /* ---- Listing events ---- */

  it('handleListingCreated indexes in search + notifies owner', async () => {
    await listeners.handleListingCreated({ listingId: 'l1', ownerId: 'o1', title: 'Camera' } as any);

    expect(searchQueue.add).toHaveBeenCalledWith(
      'index-listing',
      expect.objectContaining({ listingId: 'l1', operation: 'index' }),
    );
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ userId: 'o1' }),
    );
  });

  it('handleListingUpdated reindexes in search', async () => {
    await listeners.handleListingUpdated({ listingId: 'l1', ownerId: 'o1', title: 'Camera v2' } as any);

    expect(searchQueue.add).toHaveBeenCalledWith(
      'index-listing',
      expect.objectContaining({ listingId: 'l1', operation: 'update' }),
    );
  });

  it('handleListingDeleted removes from search index', async () => {
    await listeners.handleListingDeleted({ listingId: 'l1', ownerId: 'o1' });

    expect(searchQueue.add).toHaveBeenCalledWith(
      'index-listing',
      expect.objectContaining({ listingId: 'l1', operation: 'delete' }),
    );
  });

  it('handleListingActivated notifies owner listing is live', async () => {
    await listeners.handleListingActivated({ listingId: 'l1', ownerId: 'o1' });

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ userId: 'o1', type: 'LISTING_APPROVED' }),
    );
  });

  /* ---- Review events ---- */

  it('handleReviewCreated notifies reviewee + reindexes listing if provided', async () => {
    await listeners.handleReviewCreated({
      reviewId: 'rev1',
      reviewerId: 'r1',
      revieweeId: 'o1',
      bookingId: 'b1',
      listingId: 'l1',
      rating: 5,
    });

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ userId: 'o1', type: 'REVIEW_RECEIVED' }),
    );
    expect(searchQueue.add).toHaveBeenCalledWith(
      'index-listing',
      expect.objectContaining({ listingId: 'l1', operation: 'update' }),
    );
  });

  it('handleReviewCreated skips search index when no listingId', async () => {
    await listeners.handleReviewCreated({
      reviewId: 'rev1',
      reviewerId: 'r1',
      revieweeId: 'o1',
      bookingId: 'b1',
      listingId: undefined as any,
      rating: 4,
    });

    expect(searchQueue.add).not.toHaveBeenCalled();
  });

  /* ---- Dispute events ---- */

  it('handleDisputeCreated notifies admin team with HIGH priority', async () => {
    await listeners.handleDisputeCreated({
      disputeId: 'd1',
      bookingId: 'b1',
      reportedBy: 'u1',
      type: 'PROPERTY_DAMAGE',
    });

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'u1',               // regression guard: must NOT be 'admin'
        type: 'DISPUTE_OPENED',
        priority: 'HIGH',
        data: expect.objectContaining({
          notificationType: 'dispute_opened',
          disputeId: 'd1',
        }),
      }),
    );
  });

  /* ---- Message events ---- */

  it('handleMessageSent sends push to each recipient', async () => {
    await listeners.handleMessageSent({
      messageId: 'm1',
      conversationId: 'c1',
      senderId: 's1',
      recipientIds: ['r1', 'r2'],
    });

    expect(notificationsQueue.add).toHaveBeenCalledTimes(2);
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ userId: 'r1', type: 'MESSAGE_RECEIVED', channels: ['PUSH'] }),
    );
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ userId: 'r2' }),
    );
  });

  /* ---- User events ---- */

  it('handleUserRegistered sends welcome email', async () => {
    await listeners.handleUserRegistered({ userId: 'u1', email: 'a@b.np', role: 'USER' } as any);

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ userId: 'u1', channels: ['EMAIL'] }),
    );
  });

  it('handleEmailVerified sends in-app notification', async () => {
    await listeners.handleEmailVerified({ userId: 'u1' });

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        userId: 'u1',
        type: 'VERIFICATION_COMPLETE',
        channels: ['IN_APP'],
      }),
    );
  });
});
