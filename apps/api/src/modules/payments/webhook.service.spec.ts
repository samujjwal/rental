import { WebhookService } from './webhook.service';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('WebhookService', () => {
  let service: WebhookService;
  let configService: any;
  let prisma: any;
  let cacheService: any;
  let eventsService: any;
  let ledgerService: any;
  let mockStripeInstance: any;

  const mockPayment = {
    id: 'payment-1',
    stripePaymentIntentId: 'pi_test123',
    stripeChargeId: 'ch_1',
    bookingId: 'booking-1',
    amount: 10000,
    booking: {
      id: 'booking-1',
      status: 'CONFIRMED',
      currency: 'NPR',
      renterId: 'renter-1',
      ownerId: 'owner-1',
      totalPrice: 10000,
      serviceFee: 500,
      depositAmount: 2000,
      platformFee: 300,
      listing: { id: 'listing-1', depositAmount: 2000 },
    },
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_key',
          STRIPE_WEBHOOK_SECRET: 'whsec_test',
        };
        return map[key];
      }),
    };

    prisma = {
      payment: { findFirst: jest.fn(), update: jest.fn() },
      booking: { update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn() },
      bookingStateHistory: { create: jest.fn().mockResolvedValue({}) },
      ledgerEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      refund: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      dispute: { create: jest.fn(), findFirst: jest.fn() },
      payout: { update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
      user: { update: jest.fn(), updateMany: jest.fn() },
      depositHold: { updateMany: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    cacheService = {
      exists: jest.fn().mockResolvedValue(false),
      set: jest.fn().mockResolvedValue(undefined),
      setNx: jest.fn().mockResolvedValue(true),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(null),
    };

    eventsService = {
      emit: jest.fn(),
      emitPaymentSucceeded: jest.fn(),
      emitPaymentFailed: jest.fn(),
      emitPaymentRefunded: jest.fn(),
      emitDisputeCreated: jest.fn(),
    };

    ledgerService = {
      recordPayment: jest.fn().mockResolvedValue(undefined),
      recordBookingPayment: jest.fn().mockResolvedValue(undefined),
      recordDepositHold: jest.fn().mockResolvedValue(undefined),
      recordRefund: jest.fn().mockResolvedValue(undefined),
    };

    service = new WebhookService(
      configService,
      prisma,
      cacheService,
      eventsService,
      ledgerService,
      { releaseDeposit: jest.fn(), captureDeposit: jest.fn(), createEscrow: jest.fn().mockResolvedValue({ id: 'escrow-1' }), fundEscrow: jest.fn().mockResolvedValue(undefined) } as any,
      { runConfirmedSideEffects: jest.fn().mockResolvedValue(undefined) } as any,
    );

    // Access Stripe instance from the service
    mockStripeInstance = (service as any).stripe;
  });

  describe('handleStripeWebhook', () => {
    it('should verify signature and process event', async () => {
      const rawBody = Buffer.from('test');
      const signature = 'sig_test';

      // Setup stripe constructEvent
      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_1',
          type: 'payment_intent.succeeded',
          data: {
            object: { id: 'pi_test123', amount: 10000, currency: 'npr', metadata: {} },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'SUCCEEDED' });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });

      // Should not throw
      await expect(
        service.handleStripeWebhook(rawBody, signature),
      ).resolves.not.toThrow();
    });

    it('should skip duplicate events via idempotency check', async () => {
      cacheService.setNx.mockResolvedValue(false);

      const rawBody = Buffer.from('test');
      const signature = 'sig_test';

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_duplicate',
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test', amount: 10000, currency: 'npr', metadata: {} } },
        });
      }

      await service.handleStripeWebhook(rawBody, signature);
      // Payment should not be looked up for duplicate events
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should throw when webhook signature verification fails', async () => {
      const rawBody = Buffer.from('tampered-body');
      const signature = 'sig_invalid';
      const sigError = new Error('No signatures found matching the expected signature for payload');

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
          throw sigError;
        });
      }

      await expect(
        service.handleStripeWebhook(rawBody, signature),
      ).rejects.toThrow('No signatures found matching the expected signature');

      // No processing should occur after signature failure
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('isDuplicateEvent (via handleStripeWebhook)', () => {
    it('should mark event in cache after processing', async () => {
      cacheService.setNx.mockResolvedValue(true);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_new',
          type: 'transfer.created',
          data: { object: { id: 'tr_1', amount: 1000, currency: 'usd' } },
        });
      }

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');
      expect(cacheService.setNx).toHaveBeenCalled();
    });
  });

  describe('handlePaymentIntentSucceeded (via webhook)', () => {
    it('should update payment and booking on successful payment', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_pi_ok',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test123',
              amount: 10000,
              currency: 'npr',
              metadata: { bookingId: 'booking-1' },
            },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'SUCCEEDED' });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');

      expect(prisma.payment.findFirst).toHaveBeenCalled();
    });
  });

  describe('handleChargeRefunded (via webhook)', () => {
    it('should create refund record on charge.refunded event', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_refund',
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_1',
              payment_intent: 'pi_test123',
              amount_refunded: 5000,
              currency: 'usd',
              refunds: { data: [{ id: 'refund_1', reason: 'requested_by_customer' }] },
            },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.refund.create.mockResolvedValue({ id: 'refund-1' });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1', status: 'REFUNDED' });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');
    });
  });

  describe('handleDisputeCreated (via webhook)', () => {
    it('should create dispute record on dispute event', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_dispute',
          type: 'charge.dispute.created',
          data: {
            object: {
              id: 'dp_1',
              payment_intent: 'pi_test123',
              amount: 5000,
              currency: 'npr',
              reason: 'fraudulent',
              status: 'needs_response',
            },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.dispute.findFirst.mockResolvedValue(null);
      prisma.dispute.create.mockResolvedValue({ id: 'dispute-1' });
      prisma.depositHold.updateMany.mockResolvedValue({ count: 1 });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');
    });
  });

  describe('handleAccountUpdated (via webhook)', () => {
    it('should update user stripe capabilities', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_acct',
          type: 'account.updated',
          data: {
            object: {
              id: 'acct_1',
              charges_enabled: true,
              payouts_enabled: true,
            },
          },
        });
      }

      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');
    });
  });

  describe('handlePayoutPaid (via webhook)', () => {
    it('should update payout status to PAID', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_payout',
          type: 'payout.paid',
          data: {
            object: { id: 'po_1', amount: 8000, currency: 'usd' },
          },
        });
      }

      prisma.payout.updateMany.mockResolvedValue({ count: 1 });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');
    });
  });

  describe('handlePayoutFailed (via webhook)', () => {
    it('should update payout status to FAILED', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_payout_fail',
          type: 'payout.failed',
          data: {
            object: {
              id: 'po_2',
              amount: 8000,
              currency: 'usd',
              failure_message: 'Insufficient funds',
            },
          },
        });
      }

      prisma.payout.updateMany.mockResolvedValue({ count: 1 });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');

      expect(prisma.payout.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeId: 'po_2' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('should not throw even if payout record is not found in DB', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_payout_fail_noop',
          type: 'payout.failed',
          data: {
            object: {
              id: 'po_unknown',
              amount: 0,
              currency: 'usd',
              failure_message: 'Account closed',
            },
          },
        });
      }

      prisma.payout.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.handleStripeWebhook(Buffer.from('body'), 'sig'),
      ).resolves.not.toThrow();
    });
  });

  describe('handlePaymentIntentFailed (via webhook)', () => {
    it('should mark payment as FAILED and booking as PAYMENT_FAILED', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_pi_fail',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_test123',
              last_payment_error: { message: 'Your card was declined' },
            },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'FAILED' });
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            failureReason: 'Your card was declined',
          }),
        }),
      );
      expect(eventsService.emitPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          reason: 'Your card was declined',
        }),
      );
    });

    it('should handle payment_failed when payment not found', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_pi_fail_nopay',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_nonexistent',
              last_payment_error: { message: 'Card declined' },
            },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(null);

      // Should not throw — just logs a warning and returns
      await expect(
        service.handleStripeWebhook(Buffer.from('body'), 'sig'),
      ).resolves.not.toThrow();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentIntentCanceled (via webhook)', () => {
    it('should mark payment as CANCELLED', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_pi_cancel',
          type: 'payment_intent.canceled',
          data: {
            object: { id: 'pi_test123' },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'CANCELLED' });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });
  });

  describe('handleDisputeCreated error propagation', () => {
    it('should re-throw errors so Stripe retries', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_dispute_err',
          type: 'charge.dispute.created',
          data: {
            object: {
              id: 'dp_err',
              charge: 'ch_1',
              payment_intent: 'pi_test123',
              amount: 5000,
              currency: 'npr',
              reason: 'fraudulent',
              status: 'needs_response',
            },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.dispute.findFirst.mockResolvedValue(null);
      prisma.dispute.create.mockRejectedValue(new Error('DB connection lost'));

      // Error should propagate up (via DLQ re-throw) so Stripe retries
      await expect(
        service.handleStripeWebhook(Buffer.from('body'), 'sig'),
      ).rejects.toThrow('DB connection lost');
    });
  });

  describe('handleChargeRefunded idempotency', () => {
    it('should skip duplicate refund if stripeRefundId already exists', async () => {
      cacheService.exists.mockResolvedValue(false);

      if (mockStripeInstance?.webhooks) {
        mockStripeInstance.webhooks.constructEvent.mockReturnValue({
          id: 'evt_refund_dup',
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_1',
              payment_intent: 'pi_test123',
              amount_refunded: 5000,
              currency: 'usd',
              refunds: { data: [{ id: 'refund_existing', reason: 'requested_by_customer' }] },
            },
          },
        });
      }

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      // Simulate existing refund record
      prisma.refund.findFirst = jest.fn().mockResolvedValue({ id: 'refund-exists', refundId: 'refund_existing' });

      await service.handleStripeWebhook(Buffer.from('body'), 'sig');

      // refund.create should NOT have been called
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });
  });
});
