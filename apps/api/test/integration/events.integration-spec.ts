import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventsService } from '../../src/common/events/events.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

describe('Events Integration', () => {
  let eventsService: EventsService;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [EventsService],
    }).compile();

    eventsService = moduleFixture.get<EventsService>(EventsService);
    eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
  });

  describe('Booking events', () => {
    it('should emit booking.created event with correct payload', (done) => {
      const payload = {
        bookingId: 'booking-1',
        renterId: 'renter-1',
        ownerId: 'owner-1',
        listingId: 'listing-1',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        totalPrice: 5000,
      };

      eventEmitter.on('booking.created', (received) => {
        expect(received).toEqual(payload);
        done();
      });

      eventsService.emitBookingCreated(payload);
    });

    it('should emit booking.status.changed and status-specific events', (done) => {
      const events: string[] = [];
      const payload = {
        bookingId: 'booking-2',
        previousStatus: 'PENDING' as any,
        newStatus: 'CONFIRMED' as any,
        renterId: 'renter-1',
        ownerId: 'owner-1',
      };

      eventEmitter.on('booking.status.changed', () => events.push('changed'));
      eventEmitter.on('booking.status.confirmed', () => {
        events.push('confirmed');
        expect(events).toContain('changed');
        expect(events).toContain('confirmed');
        done();
      });

      eventsService.emitBookingStatusChanged(payload);
    });
  });

  describe('Payment events', () => {
    it('should emit payment.processed event', (done) => {
      const payload = {
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        amount: 5000,
        currency: 'NPR',
        status: 'COMPLETED' as any,
        renterId: 'renter-1',
        ownerId: 'owner-1',
      };

      eventEmitter.on('payment.processed', (received) => {
        expect(received.paymentId).toBe('payment-1');
        expect(received.amount).toBe(5000);
        done();
      });

      eventsService.emitPaymentProcessed(payload);
    });

    it('should emit payment.failed event', (done) => {
      const payload = {
        paymentId: 'payment-2',
        bookingId: 'booking-2',
        amount: 3000,
        status: 'FAILED' as any,
        renterId: 'renter-1',
        ownerId: 'owner-1',
        reason: 'Insufficient funds',
      };

      eventEmitter.on('payment.failed', (received) => {
        expect(received.reason).toBe('Insufficient funds');
        done();
      });

      eventsService.emitPaymentFailed(payload);
    });

    it('should emit payment.refunded event', (done) => {
      const payload = {
        paymentId: 'payment-3',
        bookingId: 'booking-3',
        amount: 2000,
        currency: 'NPR',
        reason: 'Cancellation',
      };

      eventEmitter.on('payment.refunded', (received) => {
        expect(received.amount).toBe(2000);
        done();
      });

      eventsService.emitPaymentRefunded(payload);
    });
  });

  describe('Listing events', () => {
    it('should emit listing.created event', (done) => {
      const payload = {
        listingId: 'listing-1',
        ownerId: 'owner-1',
        categoryId: '1',
        title: 'Test Listing',
        status: 'DRAFT' as any,
      };

      eventEmitter.on('listing.created', (received) => {
        expect(received.title).toBe('Test Listing');
        done();
      });

      eventsService.emitListingCreated(payload);
    });

    it('should emit listing.status.changed and status-specific events', (done) => {
      const events: string[] = [];
      const payload = {
        listingId: 'listing-2',
        ownerId: 'owner-1',
        previousStatus: 'DRAFT' as any,
        newStatus: 'PUBLISHED' as any,
      };

      eventEmitter.on('listing.status.changed', () => events.push('changed'));
      eventEmitter.on('listing.status.published', () => {
        events.push('published');
        expect(events).toContain('changed');
        done();
      });

      eventsService.emitListingStatusChanged(payload);
    });
  });

  describe('Escrow events', () => {
    it('should emit escrow.funded event', (done) => {
      const payload = {
        escrowId: 'escrow-1',
        bookingId: 'booking-1',
        amount: 5000,
        currency: 'NPR',
      };

      eventEmitter.on('escrow.funded', (received) => {
        expect(received.escrowId).toBe('escrow-1');
        done();
      });

      eventsService.emitEscrowFunded(payload);
    });

    it('should emit escrow.released event', (done) => {
      const payload = {
        escrowId: 'escrow-2',
        bookingId: 'booking-2',
        amount: 3000,
        currency: 'NPR',
        releasedTo: 'host',
      };

      eventEmitter.on('escrow.released', (received) => {
        expect(received.releasedTo).toBe('host');
        done();
      });

      eventsService.emitEscrowReleased(payload);
    });

    it('should emit escrow.frozen event', (done) => {
      const payload = {
        escrowId: 'escrow-3',
        bookingId: 'booking-3',
        amount: 4000,
        currency: 'NPR',
        disputeId: 'dispute-1',
      };

      eventEmitter.on('escrow.frozen', (received) => {
        expect(received.disputeId).toBe('dispute-1');
        done();
      });

      eventsService.emitEscrowFrozen(payload);
    });
  });

  describe('Event ordering', () => {
    it('should deliver events in emission order', async () => {
      const received: string[] = [];

      eventEmitter.on('test.order.1', () => received.push('first'));
      eventEmitter.on('test.order.2', () => received.push('second'));
      eventEmitter.on('test.order.3', () => received.push('third'));

      eventEmitter.emit('test.order.1', {});
      eventEmitter.emit('test.order.2', {});
      eventEmitter.emit('test.order.3', {});

      // EventEmitter2 is synchronous for non-async listeners
      expect(received).toEqual(['first', 'second', 'third']);
    });
  });

  describe('Event failure handling', () => {
    it('should not crash when a listener throws', () => {
      eventEmitter.on('test.error', () => {
        throw new Error('Listener error');
      });

      // Should not throw — EventEmitter2 catches listener errors
      expect(() => {
        eventEmitter.emit('test.error', {});
      }).not.toThrow();
    });
  });
});
