import { PaymentEventsService } from './payment-events.service';

describe('PaymentEventsService', () => {
  let service: PaymentEventsService;
  let prisma: any;
  let cacheService: any;
  let stripeService: any;
  let payoutsService: any;

  beforeEach(() => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payout: {
        create: jest.fn(),
      },
      refund: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      depositHold: {
        findFirst: jest.fn(),
      },
    };

    cacheService = {
      subscribe: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };

    stripeService = {
      createPayout: jest.fn().mockResolvedValue({ id: 'po_test' }),
      createRefund: jest.fn().mockResolvedValue({ id: 're_test', status: 'succeeded' }),
      holdDeposit: jest.fn().mockResolvedValue({ id: 'pi_hold' }),
      releaseDeposit: jest.fn().mockResolvedValue(undefined),
      captureDeposit: jest.fn().mockResolvedValue(undefined),
    };

    payoutsService = {
      createPayout: jest.fn(),
    };

    service = new PaymentEventsService(prisma, cacheService, stripeService, payoutsService);
  });

  describe('onModuleInit', () => {
    it('should subscribe to payment event channels', async () => {
      await service.onModuleInit();
      expect(cacheService.subscribe).toHaveBeenCalled();
    });
  });

  describe('handleSettlement', () => {
    const settlementEvent = {
      bookingId: 'booking-1',
      ownerId: 'owner-1',
      ownerStripeConnectId: 'acct_test',
      amount: 8000,
      currency: 'usd',
    };

    it('should skip settlement when owner has no Stripe connect ID', async () => {
      await (service as any).handleSettlement({
        ...settlementEvent,
        ownerStripeConnectId: null,
      });
      expect(stripeService.createPayout).not.toHaveBeenCalled();
    });

    it('should skip settlement when amount is zero or negative', async () => {
      await (service as any).handleSettlement({ ...settlementEvent, amount: 0 });
      expect(stripeService.createPayout).not.toHaveBeenCalled();
    });

    it('should create payout and update booking on valid settlement', async () => {
      stripeService.createPayout.mockResolvedValue('tr_test123');
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1', status: 'SETTLED' });

      await (service as any).handleSettlement(settlementEvent);
      expect(stripeService.createPayout).toHaveBeenCalledWith('acct_test', 8000, 'usd');
      expect(prisma.payout.create).toHaveBeenCalled();
      expect(prisma.booking.update).toHaveBeenCalled();
    });
  });

  describe('handleRefund', () => {
    const refundEvent = {
      bookingId: 'booking-1',
      refundRecordId: 'refund-1',
      paymentIntentId: 'pi_test',
      amount: 5000,
      reason: 'requested_by_customer',
    };

    it('should process refund and update booking status', async () => {
      prisma.refund.findFirst.mockResolvedValue({ id: 'refund-1' });
      prisma.refund.update.mockResolvedValue({ id: 'refund-1', status: 'COMPLETED' });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1', status: 'REFUNDED' });

      await (service as any).handleRefund(refundEvent);
      expect(stripeService.createRefund).toHaveBeenCalled();
    });

    it('should mark refund as FAILED on stripe error', async () => {
      stripeService.createRefund.mockRejectedValue(new Error('Stripe error'));
      prisma.refund.update.mockResolvedValue({ id: 'refund-1', status: 'FAILED' });

      await (service as any).handleRefund(refundEvent);
      expect(prisma.refund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('should retry updating refund status up to 3 times on db failure', async () => {
      jest.useFakeTimers();

      stripeService.createRefund.mockRejectedValue(new Error('Stripe error'));
      // First two DB updates fail, third succeeds
      prisma.refund.update
        .mockRejectedValueOnce(new Error('DB connection lost'))
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValueOnce({ id: 'refund-1', status: 'FAILED' });

      const promise = (service as any).handleRefund(refundEvent);

      // Advance timers for the retry delays (1s, 2s)
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      // Should have been called 3 times total
      expect(prisma.refund.update).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should log CRITICAL when all retry attempts are exhausted', async () => {
      jest.useFakeTimers();

      stripeService.createRefund.mockRejectedValue(new Error('Stripe error'));
      // All 3 DB update attempts fail
      prisma.refund.update.mockRejectedValue(new Error('DB permanently down'));

      const promise = (service as any).handleRefund(refundEvent);

      // Advance timers for retry delays
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      // All 3 attempts should have been made
      expect(prisma.refund.update).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe('handleDepositHold', () => {
    it('should call stripeService.holdDeposit', async () => {
      const event = { bookingId: 'booking-1', amount: 2000, paymentMethodId: 'pm_test' };
      await (service as any).handleDepositHold(event);
      expect(stripeService.holdDeposit).toHaveBeenCalled();
    });
  });

  describe('handleDepositRelease', () => {
    it('should release deposit if active hold exists', async () => {
      prisma.depositHold.findFirst.mockResolvedValue({
        id: 'hold-1',
        stripePaymentIntentId: 'pi_hold',
        status: 'AUTHORIZED',
      });

      await (service as any).handleDepositRelease({ bookingId: 'booking-1' });
      expect(stripeService.releaseDeposit).toHaveBeenCalled();
    });

    it('should skip release if no active hold', async () => {
      prisma.depositHold.findFirst.mockResolvedValue(null);

      await (service as any).handleDepositRelease({ bookingId: 'booking-1' });
      expect(stripeService.releaseDeposit).not.toHaveBeenCalled();
    });
  });

  describe('handleDepositCapture', () => {
    it('should capture deposit if active hold exists', async () => {
      prisma.depositHold.findFirst.mockResolvedValue({
        id: 'hold-1',
        stripePaymentIntentId: 'pi_hold',
        status: 'AUTHORIZED',
      });

      await (service as any).handleDepositCapture({ bookingId: 'booking-1' });
      expect(stripeService.captureDeposit).toHaveBeenCalled();
    });

    it('should skip capture if no active hold', async () => {
      prisma.depositHold.findFirst.mockResolvedValue(null);

      await (service as any).handleDepositCapture({ bookingId: 'booking-1' });
      expect(stripeService.captureDeposit).not.toHaveBeenCalled();
    });
  });
});
