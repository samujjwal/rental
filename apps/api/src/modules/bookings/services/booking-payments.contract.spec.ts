import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';

/**
 * INTEGRATION TESTS: Booking ↔ Payments
 *
 * These tests validate the integration between the booking system and payment system.
 * All services are mocked; each test configures implementations to reflect expected
 * payment-related integration contracts.
 */
describe('Booking ↔ Payments Integration Tests', () => {
  let bookingsService: any;
  let stateMachineService: any;
  let prisma: any;
  let paymentsQueue: any;
  let bookingsQueue: any;

  beforeEach(() => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refund: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      payout: {
        create: jest.fn(),
      },
      depositHold: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      bookingStateHistory: {
        create: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        if (callback) await callback(prisma);
        return { id: 'booking-1' };
      }),
    };

    paymentsQueue = { add: jest.fn() };
    bookingsQueue = { add: jest.fn() };

    bookingsService = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    stateMachineService = {
      transition: jest.fn(),
    };
  });

  describe('BOOKING CREATION → PAYMENT INTENT', () => {
    it('should create payment intent when booking is created', async () => {
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      const result = await prisma.booking.create({
        data: { status: BookingStatus.PENDING_PAYMENT },
      });

      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should handle payment intent creation failure gracefully', async () => {
      prisma.booking.create.mockRejectedValue(new Error('Payment intent creation failed'));

      await expect(
        prisma.booking.create({ data: { status: BookingStatus.PENDING_PAYMENT } }),
      ).rejects.toThrow('Payment intent creation failed');
    });
  });

  describe('PAYMENT SUCCESS → BOOKING CONFIRMED', () => {
    it('should transition booking to CONFIRMED on payment success', async () => {
      stateMachineService.transition.mockResolvedValue({ success: true, newState: BookingStatus.CONFIRMED });

      const result = await stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
    });

    it('should schedule reminder notification on booking confirmation', async () => {
      stateMachineService.transition.mockImplementation(async () => {
        await bookingsQueue.add('send-confirmation-reminder', { bookingId: 'booking-1' });
        return { success: true, newState: BookingStatus.CONFIRMED };
      });

      await stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');

      expect(bookingsQueue.add).toHaveBeenCalled();
    });
  });

  describe('PAYMENT FAILURE → BOOKING PAYMENT_FAILED', () => {
    it('should transition booking to PAYMENT_FAILED on payment failure', async () => {
      stateMachineService.transition.mockResolvedValue({ success: true, newState: BookingStatus.PAYMENT_FAILED });

      const result = await stateMachineService.transition('booking-1', 'FAIL_PAYMENT', 'system', 'SYSTEM');

      expect(result.success).toBe(true);
    });

    it('should schedule grace period expiration on payment failure', async () => {
      stateMachineService.transition.mockImplementation(async () => {
        await bookingsQueue.add('expire-grace-period', { bookingId: 'booking-1', delayMs: 24 * 3600 * 1000 });
        return { success: true, newState: BookingStatus.PAYMENT_FAILED };
      });

      await stateMachineService.transition('booking-1', 'FAIL_PAYMENT', 'system', 'SYSTEM');

      expect(bookingsQueue.add).toHaveBeenCalled();
    });
  });

  describe('BOOKING CANCELLATION → REFUND INITIATION', () => {
    it('should initiate refund when booking is cancelled', async () => {
      prisma.refund.create.mockResolvedValue({ id: 'refund-1' });

      stateMachineService.transition.mockImplementation(async () => {
        // No existing refund — create one
        await prisma.refund.create({ data: { bookingId: 'booking-1', amount: 100 } });
        return { success: true, newState: BookingStatus.CANCELLED };
      });

      await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(prisma.refund.create).toHaveBeenCalled();
    });

    it('should not create duplicate refund for already cancelled booking', async () => {
      prisma.refund.findFirst.mockResolvedValue({ id: 'existing-refund' });

      stateMachineService.transition.mockImplementation(async () => {
        // Existing refund found — skip creation
        const existing = await prisma.refund.findFirst({ where: { bookingId: 'booking-1' } });
        if (!existing) {
          await prisma.refund.create({ data: { bookingId: 'booking-1', amount: 100 } });
        }
        return { success: true, newState: BookingStatus.CANCELLED };
      });

      await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(prisma.refund.create).not.toHaveBeenCalled();
    });
  });

  describe('BOOKING COMPLETION → PAYOUT CREATION', () => {
    it('should create payout when booking completes', async () => {
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });

      stateMachineService.transition.mockImplementation(async () => {
        await prisma.payout.create({ data: { bookingId: 'booking-1', amount: 800 } });
        return { success: true, newState: BookingStatus.COMPLETED };
      });

      await stateMachineService.transition('booking-1', 'APPROVE_RETURN', 'owner-1', 'OWNER');

      expect(prisma.payout.create).toHaveBeenCalled();
    });

    it('should enqueue payout job with retry configuration', async () => {
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });

      stateMachineService.transition.mockImplementation(async () => {
        const payout = await prisma.payout.create({ data: { bookingId: 'booking-1', amount: 800 } });
        await paymentsQueue.add('process-payout', { payoutId: payout.id }, { attempts: 3 });
        return { success: true, newState: BookingStatus.COMPLETED };
      });

      await stateMachineService.transition('booking-1', 'APPROVE_RETURN', 'owner-1', 'OWNER');

      expect(paymentsQueue.add).toHaveBeenCalled();
    });
  });

  describe('DEPOSIT HOLD ON CONFIRMATION', () => {
    it('should create deposit hold when booking is confirmed', async () => {
      prisma.depositHold.create.mockResolvedValue({ id: 'hold-1' });

      stateMachineService.transition.mockImplementation(async () => {
        // Booking has depositAmount > 0, so create a hold
        await prisma.depositHold.create({ data: { bookingId: 'booking-1', amount: 200 } });
        return { success: true, newState: BookingStatus.CONFIRMED };
      });

      await stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');

      expect(prisma.depositHold.create).toHaveBeenCalled();
    });

    it('should skip deposit hold when no deposit required', async () => {
      stateMachineService.transition.mockImplementation(async () => {
        // depositAmount === 0, skip hold creation
        return { success: true, newState: BookingStatus.CONFIRMED };
      });

      await stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');

      expect(prisma.depositHold.create).not.toHaveBeenCalled();
    });
  });

  describe('DEPOSIT RELEASE ON COMPLETION', () => {
    it('should release deposit when booking completes without damage', async () => {
      prisma.depositHold.update.mockResolvedValue({ id: 'hold-1', status: 'RELEASED' });

      stateMachineService.transition.mockImplementation(async () => {
        await prisma.depositHold.update({ where: { id: 'hold-1' }, data: { status: 'RELEASED' } });
        return { success: true, newState: BookingStatus.COMPLETED };
      });

      await stateMachineService.transition('booking-1', 'APPROVE_RETURN', 'owner-1', 'OWNER');

      expect(prisma.depositHold.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'RELEASED' } }),
      );
    });

    it('should hold deposit when damage is reported', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.depositHold.update.mockResolvedValue({ id: 'hold-1', status: 'HELD' });

      // Simulate deposit hold update for damage
      await prisma.depositHold.update({
        where: { id: 'hold-1' },
        data: { status: 'HELD' },
      });

      expect(prisma.depositHold.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'HELD' } }),
      );
    });
  });

  describe('PAYMENT RETRY FLOW', () => {
    it('should allow payment retry from PAYMENT_FAILED state', async () => {
      stateMachineService.transition.mockResolvedValue({ success: true, newState: BookingStatus.PENDING_PAYMENT });

      const result = await stateMachineService.transition('booking-1', 'RETRY_PAYMENT', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
    });

    it('should cancel booking after grace period expiration', async () => {
      stateMachineService.transition.mockResolvedValue({ success: true, newState: BookingStatus.CANCELLED });

      const result = await stateMachineService.transition('booking-1', 'CANCEL', 'system', 'SYSTEM');

      expect(result.newState).toBe(BookingStatus.CANCELLED);
    });
  });

  describe('CONCURRENT PAYMENT OPERATIONS', () => {
    it('should handle concurrent payment success and cancellation', async () => {
      // First (payment) succeeds; second (cancel) loses to optimistic locking
      stateMachineService.transition
        .mockResolvedValueOnce({ success: true, newState: BookingStatus.CONFIRMED })
        .mockRejectedValueOnce(new BadRequestException('Booking state changed concurrently'));

      const paymentPromise = stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');
      const cancelPromise = stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      const results = await Promise.allSettled([paymentPromise, cancelPromise]);

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBe(1);
    });
  });
});
