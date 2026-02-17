import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventsService } from './events.service';

/**
 * Module-wiring smoke tests for the cross-cutting EventsService.
 * Verifies that each emit* helper actually fires the correct event name
 * so that @OnEvent listeners in EventListeners will be triggered.
 */
describe('EventsService (smoke)', () => {
  let service: EventsService;
  let emitter: EventEmitter2;

  beforeEach(() => {
    emitter = new EventEmitter2();
    service = new EventsService(emitter);
  });

  // ── booking events ──
  it('emitBookingCreated fires "booking.created"', () => {
    const spy = jest.fn();
    emitter.on('booking.created', spy);

    service.emitBookingCreated({
      bookingId: 'b1',
      renterId: 'r1',
      ownerId: 'o1',
      listingId: 'l1',
      startDate: new Date(),
      endDate: new Date(),
      totalAmount: 100,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b1' }));
  });

  it('emitBookingConfirmed fires "booking.confirmed"', () => {
    const spy = jest.fn();
    emitter.on('booking.confirmed', spy);

    service.emitBookingConfirmed({
      bookingId: 'b2',
      previousStatus: 'PENDING' as any,
      newStatus: 'CONFIRMED' as any,
      renterId: 'r1',
      ownerId: 'o1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitBookingCancelled fires "booking.cancelled"', () => {
    const spy = jest.fn();
    emitter.on('booking.cancelled', spy);

    service.emitBookingCancelled({
      bookingId: 'b3',
      previousStatus: 'CONFIRMED' as any,
      newStatus: 'CANCELLED' as any,
      renterId: 'r1',
      ownerId: 'o1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitBookingCompleted fires "booking.completed"', () => {
    const spy = jest.fn();
    emitter.on('booking.completed', spy);

    service.emitBookingCompleted({
      bookingId: 'b4',
      previousStatus: 'IN_PROGRESS' as any,
      newStatus: 'COMPLETED' as any,
      renterId: 'r1',
      ownerId: 'o1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitBookingStatusChanged fires generic + specific events', () => {
    const genericSpy = jest.fn();
    const specificSpy = jest.fn();
    emitter.on('booking.status.changed', genericSpy);
    emitter.on('booking.status.confirmed', specificSpy);

    service.emitBookingStatusChanged({
      bookingId: 'b5',
      previousStatus: 'PENDING' as any,
      newStatus: 'CONFIRMED' as any,
      renterId: 'r1',
      ownerId: 'o1',
    });

    expect(genericSpy).toHaveBeenCalledTimes(1);
    expect(specificSpy).toHaveBeenCalledTimes(1);
  });

  // ── payment events ──
  it('emitPaymentProcessed fires generic + specific events', () => {
    const genericSpy = jest.fn();
    const specificSpy = jest.fn();
    emitter.on('payment.processed', genericSpy);
    emitter.on('payment.completed', specificSpy);

    service.emitPaymentProcessed({
      paymentId: 'p1',
      bookingId: 'b1',
      amount: 100,
      status: 'COMPLETED' as any,
      renterId: 'r1',
      ownerId: 'o1',
    });

    expect(genericSpy).toHaveBeenCalledTimes(1);
    expect(specificSpy).toHaveBeenCalledTimes(1);
  });

  it('emitPaymentSucceeded fires "payment.succeeded"', () => {
    const spy = jest.fn();
    emitter.on('payment.succeeded', spy);

    service.emitPaymentSucceeded({
      paymentId: 'p2',
      bookingId: 'b1',
      amount: 50,
      status: 'COMPLETED' as any,
      renterId: 'r1',
      ownerId: 'o1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitPaymentFailed fires "payment.failed"', () => {
    const spy = jest.fn();
    emitter.on('payment.failed', spy);

    service.emitPaymentFailed({
      paymentId: 'p3',
      bookingId: 'b1',
      amount: 50,
      status: 'FAILED' as any,
      renterId: 'r1',
      ownerId: 'o1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitPaymentRefunded fires "payment.refunded"', () => {
    const spy = jest.fn();
    emitter.on('payment.refunded', spy);

    service.emitPaymentRefunded({
      paymentId: 'p4',
      bookingId: 'b1',
      amount: 25,
      status: 'COMPLETED' as any,
      renterId: 'r1',
      ownerId: 'o1',
      refundId: 'ref1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ── listing events ──
  it('emitListingCreated fires "listing.created"', () => {
    const spy = jest.fn();
    emitter.on('listing.created', spy);

    service.emitListingCreated({
      listingId: 'l1',
      ownerId: 'o1',
      categoryId: 'c1',
      title: 'Drill',
      status: 'AVAILABLE' as any,
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitListingUpdated fires "listing.updated"', () => {
    const spy = jest.fn();
    emitter.on('listing.updated', spy);

    service.emitListingUpdated({
      listingId: 'l1',
      ownerId: 'o1',
      changes: { title: 'New Title' },
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitListingStatusChanged fires generic + specific events', () => {
    const genericSpy = jest.fn();
    const specificSpy = jest.fn();
    emitter.on('listing.status.changed', genericSpy);
    emitter.on('listing.status.available', specificSpy);

    service.emitListingStatusChanged({
      listingId: 'l1',
      ownerId: 'o1',
      previousStatus: 'DRAFT' as any,
      newStatus: 'AVAILABLE' as any,
    });

    expect(genericSpy).toHaveBeenCalledTimes(1);
    expect(specificSpy).toHaveBeenCalledTimes(1);
  });

  it('emitListingDeleted fires "listing.deleted"', () => {
    const spy = jest.fn();
    emitter.on('listing.deleted', spy);

    service.emitListingDeleted({ listingId: 'l1', ownerId: 'o1' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ── review events ──
  it('emitReviewCreated fires "review.created"', () => {
    const spy = jest.fn();
    emitter.on('review.created', spy);

    service.emitReviewCreated({
      reviewId: 'rev1',
      reviewerId: 'r1',
      revieweeId: 'o1',
      bookingId: 'b1',
      rating: 5,
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ── dispute events ──
  it('emitDisputeCreated fires "dispute.created"', () => {
    const spy = jest.fn();
    emitter.on('dispute.created', spy);

    service.emitDisputeCreated({
      disputeId: 'd1',
      bookingId: 'b1',
      reportedBy: 'r1',
      type: 'PROPERTY_DAMAGE',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitDisputeResolved fires "dispute.resolved"', () => {
    const spy = jest.fn();
    emitter.on('dispute.resolved', spy);

    service.emitDisputeResolved({
      disputeId: 'd1',
      bookingId: 'b1',
      resolution: 'Refunded',
      resolvedBy: 'admin1',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ── messaging events ──
  it('emitMessageSent fires "message.sent"', () => {
    const spy = jest.fn();
    emitter.on('message.sent', spy);

    service.emitMessageSent({
      messageId: 'm1',
      conversationId: 'conv1',
      senderId: 'u1',
      recipientIds: ['u2'],
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ── user events ──
  it('emitUserRegistered fires "user.registered"', () => {
    const spy = jest.fn();
    emitter.on('user.registered', spy);

    service.emitUserRegistered({
      userId: 'u1',
      email: 'test@test.com',
      role: 'USER',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emitUserVerified fires generic + specific events', () => {
    const genericSpy = jest.fn();
    const specificSpy = jest.fn();
    emitter.on('user.verified', genericSpy);
    emitter.on('user.verified.email', specificSpy);

    service.emitUserVerified({
      userId: 'u1',
      verificationType: 'EMAIL',
    });

    expect(genericSpy).toHaveBeenCalledTimes(1);
    expect(specificSpy).toHaveBeenCalledTimes(1);
  });
});
