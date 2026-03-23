import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProcessor } from './payment.processor';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { StripeService } from '../services/stripe.service';
import { Job } from 'bull';
import { LedgerService } from '../services/ledger.service';
import { PaymentCommandLogService } from '../services/payment-command-log.service';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';

describe('PaymentProcessor', () => {
  let processor: PaymentProcessor;
  let bookingStateMachine: { transition: jest.Mock; getCurrentState: jest.Mock };

  const mockPrisma = {
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ledgerEntry: {
      findFirst: jest.fn(),
    },
    depositHold: {
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    payout: {
      create: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      update: jest.fn(),
    },
  };

  const mockEvents = {
    emitPaymentFailed: jest.fn(),
    emitEscrowFunded: jest.fn(),
    emitEscrowReleased: jest.fn(),
    emitPayoutReleased: jest.fn(),
  };

  const mockStripe = {
    createPayout: jest.fn(),
    createRefund: jest.fn(),
    holdDeposit: jest.fn(),
    releaseDeposit: jest.fn(),
    createPaymentIntent: jest.fn(),
  };

  const mockLedger = {
    recordPayoutWithBooking: jest.fn(),
    recordDepositRelease: jest.fn(),
  };

  const mockPaymentCommands = {
    markProcessing: jest.fn().mockResolvedValue(undefined),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };

  const createJob = <T>(data: T, opts: Partial<Job<T>> = {}): Job<T> =>
    ({
      data,
      queue: { add: jest.fn() },
      ...opts,
    }) as unknown as Job<T>;

  beforeEach(async () => {
    bookingStateMachine = {
      transition: jest.fn().mockResolvedValue({ success: true }),
      getCurrentState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsService, useValue: mockEvents },
        { provide: StripeService, useValue: mockStripe },
        { provide: LedgerService, useValue: mockLedger },
        { provide: PaymentCommandLogService, useValue: mockPaymentCommands },
        {
          provide: BookingStateMachineService,
          useValue: bookingStateMachine,
        },
      ],
    }).compile();

    processor = module.get<PaymentProcessor>(PaymentProcessor);
    jest.clearAllMocks();
  });

  // ─── retry-payment ─────────────────────────────────────────────────────────

  describe('handleRetryPayment', () => {
    const baseJobData = {
      paymentIntentId: 'pi_test123',
      bookingId: 'booking-1',
      attempt: 1,
      maxAttempts: 3,
    };

    it('should skip if payment is not in FAILED state', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      const result = await processor.handleRetryPayment(createJob(baseJobData));

      expect(result).toEqual({ success: false, attempt: 1 });
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('should mark payment for retry and return success', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        paymentIntentId: 'pi_test123',
        status: 'FAILED',
        booking: { renterId: 'renter-1', ownerId: 'owner-1' },
      });
      mockPrisma.payment.update.mockResolvedValue({});

      const result = await processor.handleRetryPayment(createJob(baseJobData));

      expect(result).toEqual({ success: true, attempt: 1 });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: 'PROCESSING' }),
        }),
      );
    });

    it('should permanently fail when max attempts reached', async () => {
      const payment = {
        id: 'pay-1',
        paymentIntentId: 'pi_test123',
        status: 'FAILED',
        amount: 10000,
        currency: 'NPR',
        booking: { renterId: 'renter-1', ownerId: 'owner-1' },
      };
      mockPrisma.payment.findFirst.mockResolvedValue(payment);
      mockPrisma.payment.update.mockResolvedValue({});
      const result = await processor.handleRetryPayment(
        createJob({ ...baseJobData, attempt: 3, maxAttempts: 3 }),
      );

      expect(result).toEqual({ success: false, attempt: 3 });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            failureReason: expect.stringContaining('Max retry attempts'),
          }),
        }),
      );
      expect(bookingStateMachine.transition).toHaveBeenCalledWith(
        'booking-1',
        'FAIL_PAYMENT',
        'system',
        'SYSTEM',
        expect.objectContaining({ reason: 'Max retry attempts reached', maxAttempts: 3 }),
      );
      expect(mockEvents.emitPaymentFailed).toHaveBeenCalled();
    });

    it('should schedule next retry with backoff on error', async () => {
      mockPrisma.payment.findFirst.mockRejectedValue(new Error('DB error'));
      const job = createJob({ ...baseJobData, attempt: 1, maxAttempts: 3 });

      const result = await processor.handleRetryPayment(job);

      expect(result).toEqual({ success: false, attempt: 1 });
      expect((job.queue as any).add).toHaveBeenCalledWith(
        'retry-payment',
        expect.objectContaining({ attempt: 2 }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it('should not schedule retry when at max attempts on error', async () => {
      mockPrisma.payment.findFirst.mockRejectedValue(new Error('DB error'));
      const job = createJob({ ...baseJobData, attempt: 3, maxAttempts: 3 });

      await processor.handleRetryPayment(job);

      expect((job.queue as any).add).not.toHaveBeenCalled();
    });
  });

  // ─── capture-escrow ────────────────────────────────────────────────────────

  describe('handleCaptureEscrow', () => {
    it('should return false when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      const result = await processor.handleCaptureEscrow(
        createJob({ bookingId: 'booking-1' }),
      );

      expect(result).toEqual({ captured: false });
    });

    it('should capture all held deposit holds', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        currency: 'NPR',
        depositHolds: [
          { id: 'dh-1', amount: 5000, status: 'HELD' },
          { id: 'dh-2', amount: 3000, status: 'HELD' },
        ],
      });
      mockPrisma.depositHold.update.mockResolvedValue({});

      const result = await processor.handleCaptureEscrow(
        createJob({ bookingId: 'booking-1', amount: 4000 }),
      );

      expect(result).toEqual({ captured: true });
      expect(mockPrisma.depositHold.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.depositHold.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dh-1' },
          data: expect.objectContaining({
            status: 'CAPTURED',
            deductedAmount: 4000,
          }),
        }),
      );
      expect(mockEvents.emitEscrowFunded).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          amount: 4000,
        }),
      );
    });

    it('should return false on DB error', async () => {
      mockPrisma.booking.findUnique.mockRejectedValue(new Error('DB error'));

      const result = await processor.handleCaptureEscrow(
        createJob({ bookingId: 'booking-1' }),
      );

      expect(result).toEqual({ captured: false });
    });
  });

  // ─── release-escrow ────────────────────────────────────────────────────────

  describe('handleReleaseEscrow', () => {
    it('should return false when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      const result = await processor.handleReleaseEscrow(
        createJob({ bookingId: 'booking-1', reason: 'cancellation' }),
      );

      expect(result).toEqual({ released: false });
    });

    it('should release all held/authorized deposit holds', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        renterId: 'renter-1',
        currency: 'NPR',
        depositHolds: [
          { id: 'dh-1', amount: 5000, status: 'HELD' },
        ],
      });
      mockPrisma.depositHold.update.mockResolvedValue({});

      const result = await processor.handleReleaseEscrow(
        createJob({ bookingId: 'booking-1', reason: 'cancellation' }),
      );

      expect(result).toEqual({ released: true });
      expect(mockPrisma.depositHold.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dh-1' },
          data: expect.objectContaining({
            status: 'RELEASED',
            releasedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockEvents.emitEscrowReleased).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          releasedTo: 'renter-1',
        }),
      );
    });

    it('should return false on DB error', async () => {
      mockPrisma.booking.findUnique.mockRejectedValue(new Error('DB error'));

      const result = await processor.handleReleaseEscrow(
        createJob({ bookingId: 'booking-1', reason: 'refund' }),
      );

      expect(result).toEqual({ released: false });
    });
  });

  // ─── process-payout ────────────────────────────────────────────────────────

  describe('handleProcessPayout', () => {
    it('should update payout, call Stripe, and emit event', async () => {
      mockPrisma.payout.update
        .mockResolvedValueOnce({
          id: 'payout-1',
          ownerId: 'owner-1',
          amount: 10000,
          currency: 'NPR',
          status: 'PROCESSING',
        })
        .mockResolvedValueOnce({
        id: 'payout-1',
        ownerId: 'owner-1',
        amount: 10000,
        currency: 'NPR',
        status: 'COMPLETED',
      });
      mockStripe.createPayout.mockResolvedValue('po_stripe_1');

      const result = await processor.handleProcessPayout(
        createJob({
          payoutId: 'payout-1',
          ownerId: 'owner-1',
          ownerStripeConnectId: 'acct_1',
          bookingIds: ['booking-1', 'booking-2'],
          amount: 10000,
          currency: 'NPR',
          commandId: 'cmd-1',
          timestamp: new Date().toISOString(),
        }),
      );

      expect(result).toEqual({ processed: true });
      expect(mockStripe.createPayout).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'acct_1', idempotencyKey: 'payout:payout-1' }),
      );
      expect(mockLedger.recordPayoutWithBooking).toHaveBeenCalledWith(
        'booking-1',
        'owner-1',
        10000,
        'NPR',
        'payout-1',
      );
      expect(mockEvents.emitPayoutReleased).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutId: 'payout-1',
          ownerId: 'owner-1',
          bookingIds: ['booking-1', 'booking-2'],
        }),
      );
    });

    it('should return false on payout failure', async () => {
      mockPrisma.payout.update.mockResolvedValue({ id: 'payout-1' });
      mockStripe.createPayout.mockRejectedValue(new Error('Stripe down'));

      const result = await processor.handleProcessPayout(
        createJob({
          payoutId: 'payout-1',
          ownerId: 'owner-1',
          ownerStripeConnectId: 'acct_1',
          bookingIds: ['booking-1'],
          amount: 5000,
          currency: 'NPR',
          commandId: 'cmd-1',
          timestamp: new Date().toISOString(),
        }),
      );

      expect(result).toEqual({ processed: false });
      expect(mockPaymentCommands.markFailed).toHaveBeenCalled();
    });
  });

  describe('handleRefund', () => {
    it('should mark refund processing and store provider refund id', async () => {
      mockPrisma.refund.update.mockResolvedValue({ id: 'refund-1' });
      mockStripe.createRefund.mockResolvedValue('re_123');

      const result = await processor.handleRefund(
        createJob({
          bookingId: 'booking-1',
          refundRecordId: 'refund-1',
          paymentIntentId: 'pi_1',
          amount: 2000,
          currency: 'NPR',
          reason: 'requested_by_customer',
          commandId: 'cmd-1',
          timestamp: new Date().toISOString(),
        }),
      );

      expect(result).toEqual({ refunded: true });
      expect(mockStripe.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'refund:refund-1' }),
      );
      expect(mockPrisma.refund.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: 'refund-1' },
          data: expect.objectContaining({ refundId: 're_123', status: 'PROCESSING' }),
        }),
      );
    });
  });

  describe('handleDepositRelease', () => {
    it('marks command completion and records deposit release ledger entry', async () => {
      mockPrisma.depositHold.findMany.mockResolvedValue([
        { id: 'dh-1', bookingId: 'booking-1', amount: 5000, currency: 'NPR', status: 'HELD', stripeId: 'dp_1' },
      ]);
      mockPrisma.depositHold.update.mockResolvedValue({});
      mockPrisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', renterId: 'renter-1', currency: 'NPR' });
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue(null);

      const result = await processor.handleDepositRelease(
        createJob({
          bookingId: 'booking-1',
          commandId: 'cmd-1',
          timestamp: new Date().toISOString(),
        }),
      );

      expect(result).toEqual({ released: true });
      expect(mockStripe.releaseDeposit).toHaveBeenCalledWith('dp_1');
      expect(mockLedger.recordDepositRelease).toHaveBeenCalledWith('booking-1', 'renter-1', 5000, 'NPR');
      expect(mockPaymentCommands.markCompleted).toHaveBeenCalledWith(
        'cmd-1',
        expect.objectContaining({ bookingId: 'booking-1', depositHoldIds: ['dh-1'] }),
      );
    });
  });
});
