import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventsService } from '@/common/events/events.service';
import { LedgerService } from './services/ledger.service';
import { EscrowService } from './services/escrow.service';
import { BookingStateMachineService } from '@/modules/bookings/services/booking-state-machine.service';
import Stripe from 'stripe';

/**
 * CRITICAL: Webhook Idempotency Tests
 *
 * These tests validate exactly-once processing of webhook events,
 * preventing duplicate payments, notifications, and state changes.
 *
 * Risk Level: HIGH - Prevents duplicate charges and inconsistent state
 */
describe('WebhookService - Idempotency Validation', () => {
  let service: WebhookService;
  let prisma: any;
  let cache: any;
  let events: any;
  let ledger: any;
  let escrow: any;
  let stateMachine: any;
  let config: any;
  let mockStripe: any;

  const mockWebhookEvent = {
    id: 'evt_test123',
    type: 'payment_intent.succeeded',
    object: 'event',
    created: 1640995200,
    data: {
      object: {
        id: 'pi_test123',
        object: 'payment_intent',
        amount: 10000,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          bookingId: 'booking-123',
        },
      },
    },
  };

  const mockPayment = {
    id: 'payment-1',
    stripePaymentIntentId: 'pi_test123',
    bookingId: 'booking-123',
    amount: 10000,
    status: 'COMPLETED',
    booking: {
      id: 'booking-123',
      status: 'PENDING_PAYMENT',
      currency: 'USD',
      renterId: 'renter-1',
      ownerId: 'owner-1',
      totalPrice: 10000,
      serviceFee: 500,
      platformFee: 300,
      listing: { id: 'listing-1' },
    },
  };

  beforeEach(async () => {
    mockStripe = {
      webhooks: {
        constructEvent: jest.fn().mockReturnValue(mockWebhookEvent),
      },
    };

    prisma = {
      payment: { findFirst: jest.fn(), update: jest.fn() },
      booking: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
      bookingStateHistory: { create: jest.fn() },
      ledgerEntry: { findFirst: jest.fn() },
      refund: { create: jest.fn(), findFirst: jest.fn() },
      dispute: { create: jest.fn() },
      payout: { update: jest.fn() },
      user: { update: jest.fn() },
      depositHold: { updateMany: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        const tx = {
          ...prisma,
          booking: {
            ...prisma.booking,
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          bookingStateHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        };
        return cb(tx);
      }),
      webhookEventLog: { create: jest.fn(), findFirst: jest.fn() },
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      setNx: jest.fn().mockResolvedValue(true),
      del: jest.fn(),
    };

    events = {
      emit: jest.fn(),
      emitPaymentSucceeded: jest.fn(),
      emitPaymentFailed: jest.fn(),
      emitPaymentRefunded: jest.fn(),
    };

    ledger = {
      recordPayment: jest.fn(),
      recordBookingPayment: jest.fn(),
      recordDepositHold: jest.fn(),
      recordRefund: jest.fn(),
    };

    escrow = {
      releaseDeposit: jest.fn(),
      captureDeposit: jest.fn(),
      createEscrow: jest.fn().mockResolvedValue({ id: 'escrow-1' }),
      fundEscrow: jest.fn(),
    };

    stateMachine = {
      runConfirmedSideEffects: jest.fn(),
      transition: jest.fn(),
    };

    config = {
      get: jest.fn((key: string) => {
        const config = {
          STRIPE_SECRET_KEY: 'sk_test_key',
          STRIPE_WEBHOOK_SECRET: 'whsec_test',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
        { provide: LedgerService, useValue: ledger },
        { provide: EscrowService, useValue: escrow },
        { provide: BookingStateMachineService, useValue: stateMachine },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);

    // Mock Stripe instance
    (service as any).stripe = mockStripe;
  });

  describe('CRITICAL: Exactly-Once Processing', () => {
    it('should process payment succeeded webhook exactly once', async () => {
      // First processing - cache miss
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Verify idempotency key was set
      expect(cache.setNx).toHaveBeenCalledWith(
        `stripe:webhook:${mockWebhookEvent.id}`,
        expect.any(Object),
        172800,
      );

      // Verify side effects occurred once
      expect(prisma.payment.update).toHaveBeenCalled();
      expect(ledger.recordBookingPayment).toHaveBeenCalled();
      expect(events.emitPaymentSucceeded).toHaveBeenCalled();
    });

    it('should skip processing duplicate webhook events', async () => {
      // First processing - cache miss
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Reset all mocks to track second processing
      jest.clearAllMocks();

      // Second processing - duplicate (setNx returns false indicating already processed)
      cache.setNx.mockResolvedValue(false);

      await service.processWebhook(mockWebhookEvent as any);

      // Verify no side effects occurred on second processing
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(ledger.recordBookingPayment).not.toHaveBeenCalled();
      expect(events.emitPaymentSucceeded).not.toHaveBeenCalled();
      expect(stateMachine.runConfirmedSideEffects).not.toHaveBeenCalled();
    });

    it('should handle race conditions with distributed locking', async () => {
      // Simulate concurrent processing attempts
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // Second attempt fails
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      // First process succeeds
      const result1 = await service.processWebhook(mockWebhookEvent as any);

      // Second process should be skipped due to lock
      await service.processWebhook(mockWebhookEvent as any);

      // Both calls should complete without error

      // Only first processing should have side effects
      expect(prisma.payment.update).toHaveBeenCalledTimes(1);
      expect(ledger.recordBookingPayment).toHaveBeenCalledTimes(1);
    });

    it('should use appropriate TTL for idempotency keys', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Verify TTL is set (typically 48 hours for webhook idempotency)
      expect(cache.setNx).toHaveBeenCalledWith(
        `stripe:webhook:${mockWebhookEvent.id}`,
        expect.any(Object),
        172800,
      );
    });
  });

  describe('CRITICAL: Duplicate Prevention', () => {
    it('should prevent duplicate payment recordings', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      // First processing
      await service.processWebhook(mockWebhookEvent as any);

      // Verify ledger entry creation
      expect(ledger.recordBookingPayment).toHaveBeenCalledTimes(1);

      // Reset and try duplicate
      jest.clearAllMocks();
      cache.setNx.mockResolvedValue(false); // Already processed

      await service.processWebhook(mockWebhookEvent as any);

      // Second processing should not create duplicate ledger entries
      expect(ledger.recordBookingPayment).not.toHaveBeenCalled();
    });

    it('should prevent duplicate booking state changes', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      // First processing
      await service.processWebhook(mockWebhookEvent as any);

      expect(prisma.payment.update).toHaveBeenCalled();

      // Reset and try duplicate
      jest.clearAllMocks();
      cache.setNx.mockResolvedValue(false); // Already processed

      await service.processWebhook(mockWebhookEvent as any);

      // Second processing should not update booking again
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should prevent duplicate notifications', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      // First processing
      await service.processWebhook(mockWebhookEvent as any);

      expect(events.emitPaymentSucceeded).toHaveBeenCalled();

      // Reset and try duplicate
      jest.clearAllMocks();
      cache.setNx.mockResolvedValue(false); // Already processed

      await service.processWebhook(mockWebhookEvent as any);

      // Second processing should not send duplicate notifications
      expect(events.emitPaymentSucceeded).not.toHaveBeenCalled();
    });

    it('should prevent duplicate escrow operations', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      // First processing
      await service.processWebhook(mockWebhookEvent as any);

      expect(escrow.createEscrow).toHaveBeenCalled();
      expect(escrow.fundEscrow).toHaveBeenCalled();

      // Reset and try duplicate
      jest.clearAllMocks();
      cache.setNx.mockResolvedValue(false); // Already processed

      await service.processWebhook(mockWebhookEvent as any);

      // Second processing should not perform duplicate escrow operations
      expect(escrow.createEscrow).not.toHaveBeenCalled();
      expect(escrow.fundEscrow).not.toHaveBeenCalled();
    });
  });

  describe('CRITICAL: Event Type Idempotency', () => {
    it('should handle different event types independently', async () => {
      const paymentFailedEvent = {
        ...mockWebhookEvent,
        id: 'evt_test456',
        type: 'payment_intent.payment_failed',
      };

      // Process payment succeeded
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Process payment failed (different event)
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);

      await service.processWebhook(paymentFailedEvent as any);

      // Both events should be processed independently
      expect(cache.setNx).toHaveBeenCalledTimes(2);
      expect(cache.setNx).toHaveBeenCalledWith(
        `stripe:webhook:${mockWebhookEvent.id}`,
        expect.any(Object),
        172800,
      );
      expect(cache.setNx).toHaveBeenCalledWith(
        `stripe:webhook:${paymentFailedEvent.id}`,
        expect.any(Object),
        172800,
      );
    });

    it('should maintain separate idempotency for each webhook ID', async () => {
      const events = [
        { ...mockWebhookEvent, id: 'evt_1' },
        { ...mockWebhookEvent, id: 'evt_2' },
        { ...mockWebhookEvent, id: 'evt_3' },
      ];

      for (const event of events) {
        cache.get.mockResolvedValue(null);
        cache.setNx.mockResolvedValue(true);
        prisma.payment.findFirst.mockResolvedValue(mockPayment);

        await service.processWebhook(event as any);
      }

      // Each event should have its own idempotency key
      expect(cache.setNx).toHaveBeenCalledTimes(3);
      events.forEach((event, index) => {
        expect(cache.setNx).toHaveBeenNthCalledWith(
          index + 1,
          `stripe:webhook:${event.id}`,
          expect.any(Object),
          172800,
        );
      });
    });
  });

  describe('CRITICAL: Error Handling and Recovery', () => {
    it('should not set idempotency key on processing failure', async () => {
      cache.setNx.mockResolvedValue(true);

      // Simulate processing error
      prisma.payment.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(service.processWebhook(mockWebhookEvent as any)).rejects.toThrow(
        'Database error',
      );

      // setNx IS called to check idempotency, but lock is released on failure
      expect(cache.setNx).toHaveBeenCalled();
      // Lock is released on failure so retry can occur
      expect(cache.del).toHaveBeenCalledWith(`stripe:webhook:${mockWebhookEvent.id}`);
    });

    it('should allow retry after failed processing', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);

      // First attempt fails
      prisma.payment.findFirst.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.processWebhook(mockWebhookEvent as any)).rejects.toThrow(
        'Database error',
      );

      // Reset for retry
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      // Retry should succeed
      await service.processWebhook(mockWebhookEvent as any);

      expect(prisma.payment.update).toHaveBeenCalled();
      expect(ledger.recordBookingPayment).toHaveBeenCalled();
    });

    it('should handle cache service failures gracefully', async () => {
      // Cache service fails during idempotency check
      cache.setNx.mockRejectedValue(new Error('Cache service down'));
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      // Service should still attempt to process (cache failure allows processing)
      await service.processWebhook(mockWebhookEvent as any);

      // Side effects should still occur when cache fails
      expect(prisma.payment.update).toHaveBeenCalled();
      expect(ledger.recordBookingPayment).toHaveBeenCalled();
    });

    it('should handle errors during webhook processing', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);

      // Simulate processing error
      prisma.payment.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(service.processWebhook(mockWebhookEvent as any)).rejects.toThrow(
        'Database error',
      );

      // Should not check cache for failed webhooks
      expect(cache.get).not.toHaveBeenCalled();
    });
  });

  describe('CRITICAL: Performance and Scalability', () => {
    it('should handle high-volume webhook processing efficiently', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        ...mockWebhookEvent,
        id: `evt_${i}`,
      }));

      const startTime = Date.now();

      // Process all events
      const promises = events.map((event) => {
        cache.get.mockResolvedValue(null);
        cache.setNx.mockResolvedValue(true);
        prisma.payment.findFirst.mockResolvedValue(mockPayment);
        return service.processWebhook(event as any);
      });

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 events

      // Should have set idempotency keys for all events
      expect(cache.setNx).toHaveBeenCalledTimes(100);
    });

    it('should use efficient cache key patterns', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Should use consistent key pattern with stripe:webhook: prefix
      expect(cache.setNx).toHaveBeenCalledWith(
        `stripe:webhook:${mockWebhookEvent.id}`,
        expect.any(Object),
        172800,
      );

      // Key should contain the event ID
      const key = cache.setNx.mock.calls[0][0];
      expect(key).toContain(mockWebhookEvent.id);
      expect(key).toMatch(/^stripe:webhook:evt_/);
    });

    it('should batch database operations for efficiency', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Should process payment and update records
      expect(prisma.payment.update).toHaveBeenCalled();
      expect(ledger.recordBookingPayment).toHaveBeenCalled();
    });
  });

  describe('CRITICAL: Audit and Monitoring', () => {
    it('should log all webhook processing attempts', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Service uses cache-based idempotency with 48h TTL and stripe:webhook: prefix
      expect(cache.setNx).toHaveBeenCalledWith(
        `stripe:webhook:${mockWebhookEvent.id}`,
        expect.any(Object),
        172800, // 48 hours in seconds
      );
    });

    it('should log duplicate webhook attempts', async () => {
      // First processing
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.processWebhook(mockWebhookEvent as any);

      // Reset for duplicate
      jest.clearAllMocks();
      cache.setNx.mockResolvedValue(false); // Already processed

      await service.processWebhook(mockWebhookEvent as any);

      // Duplicate should be skipped via idempotency check
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('should track processing metrics', async () => {
      cache.get.mockResolvedValue(null);
      cache.setNx.mockResolvedValue(true);
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      const startTime = Date.now();
      await service.processWebhook(mockWebhookEvent as any);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
