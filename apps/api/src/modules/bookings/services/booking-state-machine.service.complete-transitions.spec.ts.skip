import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { BookingStateMachineService, BookingTransition } from './booking-state-machine.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BookingCalculationService } from './booking-calculation.service';
import { BookingStatus } from '@rental-portal/database';
import { Queue } from 'bull';
import { i18nBadRequest, i18nForbidden } from '@/common/errors/i18n-exceptions';

/**
 * COMPREHENSIVE STATE MACHINE TRANSITION TESTS
 * 
 * These tests validate ALL valid and invalid state transitions for the booking state machine.
 * Each test validates:
 * 1. Exact state transitions
 * 2. Role-based authorization
 * 3. Side effects (DB updates, events, notifications)
 * 4. Invalid transition rejection
 * 5. Concurrent state change handling
 * 
 * States: DRAFT, PENDING, PENDING_PAYMENT, PENDING_OWNER_APPROVAL, CONFIRMED, 
 *         IN_PROGRESS, CANCELLED, PAYMENT_FAILED, DISPUTED, COMPLETED, 
 *         AWAITING_RETURN_INSPECTION, REFUNDED, SETTLED
 */
describe('BookingStateMachineService - Complete Transition Validation', () => {
  let service: BookingStateMachineService;
  let prisma: any;
  let cacheService: any;
  let notificationsService: any;
  let calculationService: any;
  let paymentsQueue: any;
  let bookingsQueue: any;

  const mockBooking = {
    id: 'booking-1',
    status: BookingStatus.DRAFT,
    renterId: 'renter-1',
    listingId: 'listing-1',
    listing: {
      id: 'listing-1',
      ownerId: 'owner-1',
      title: 'Test Listing',
      owner: {
        id: 'owner-1',
        stripeConnectId: 'acct_123',
      },
    },
    renter: {
      id: 'renter-1',
    },
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      bookingStateHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      payout: {
        create: jest.fn(),
      },
      refund: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      conditionReport: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      dispute: {
        findFirst: jest.fn(),
      },
      depositHold: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        await callback(prisma);
        return [mockBooking];
      }),
    };

    cacheService = {
      del: jest.fn(),
      publish: jest.fn(),
    };

    notificationsService = {
      sendNotification: jest.fn(),
    };

    calculationService = {
      calculateRefund: jest.fn(),
    };

    paymentsQueue = {
      add: jest.fn(),
    };

    bookingsQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cacheService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: BookingCalculationService, useValue: calculationService },
        { provide: getQueueToken('payments'), useValue: paymentsQueue },
        { provide: getQueueToken('bookings'), useValue: bookingsQueue },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('VALID TRANSITIONS - All State Paths', () => {
    describe('DRAFT State Transitions', () => {
      it('should transition DRAFT → PENDING_OWNER_APPROVAL (SUBMIT_REQUEST)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.DRAFT,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'SUBMIT_REQUEST',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
        expect(prisma.booking.updateMany).toHaveBeenCalledWith({
          where: { id: 'booking-1', status: BookingStatus.DRAFT },
          data: { status: BookingStatus.PENDING_OWNER_APPROVAL },
        });
        expect(prisma.bookingStateHistory.create).toHaveBeenCalledWith({
          data: {
            bookingId: 'booking-1',
            fromStatus: BookingStatus.DRAFT,
            toStatus: BookingStatus.PENDING_OWNER_APPROVAL,
            changedBy: 'renter-1',
            metadata: undefined,
          },
        });
      });
    });

    describe('PENDING_OWNER_APPROVAL State Transitions', () => {
      it('should transition PENDING_OWNER_APPROVAL → PENDING_PAYMENT (OWNER_APPROVE)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'OWNER_APPROVE',
          'owner-1',
          'OWNER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.PENDING_PAYMENT);
      });

      it('should transition PENDING_OWNER_APPROVAL → CANCELLED (OWNER_REJECT)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'OWNER_REJECT',
          'owner-1',
          'OWNER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
      });

      it('should transition PENDING_OWNER_APPROVAL → CANCELLED (CANCEL by renter)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'CANCEL',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
      });

      it('should transition PENDING_OWNER_APPROVAL → CANCELLED (EXPIRE by system)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'EXPIRE',
          'system-1',
          'SYSTEM',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
      });
    });

    describe('PENDING_PAYMENT State Transitions', () => {
      it('should transition PENDING_PAYMENT → CONFIRMED (COMPLETE_PAYMENT)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_PAYMENT,
          startDate: new Date('2023-02-01'),
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.conditionReport.findFirst.mockResolvedValue(null);

        const result = await service.transition(
          'booking-1',
          'COMPLETE_PAYMENT',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CONFIRMED);
        expect(notificationsService.sendNotification).toHaveBeenCalled();
        expect(paymentsQueue.add).toHaveBeenCalledWith(
          'hold-deposit',
          expect.any(Object),
          expect.any(Object),
        );
      });

      it('should transition PENDING_PAYMENT → PAYMENT_FAILED (FAIL_PAYMENT)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_PAYMENT,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'FAIL_PAYMENT',
          'system-1',
          'SYSTEM',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.PAYMENT_FAILED);
        expect(notificationsService.sendNotification).toHaveBeenCalled();
        expect(bookingsQueue.add).toHaveBeenCalled();
      });

      it('should transition PENDING_PAYMENT → CANCELLED (EXPIRE timeout)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_PAYMENT,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'EXPIRE',
          'system-1',
          'SYSTEM',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
      });

      it('should transition PENDING_PAYMENT → CANCELLED (CANCEL by renter)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_PAYMENT,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'CANCEL',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
      });
    });

    describe('PAYMENT_FAILED State Transitions', () => {
      it('should transition PAYMENT_FAILED → PENDING_PAYMENT (RETRY_PAYMENT)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PAYMENT_FAILED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'RETRY_PAYMENT',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.PENDING_PAYMENT);
      });

      it('should transition PAYMENT_FAILED → CANCELLED (EXPIRE grace period)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PAYMENT_FAILED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'EXPIRE',
          'system-1',
          'SYSTEM',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
      });

      it('should transition PAYMENT_FAILED → CANCELLED (CANCEL by renter)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PAYMENT_FAILED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'CANCEL',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
      });
    });

    describe('CONFIRMED State Transitions', () => {
      it('should transition CONFIRMED → IN_PROGRESS (START_RENTAL)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.CONFIRMED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.conditionReport.findFirst.mockResolvedValue(null);

        const result = await service.transition(
          'booking-1',
          'START_RENTAL',
          'owner-1',
          'OWNER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.IN_PROGRESS);
        expect(prisma.conditionReport.create).toHaveBeenCalled();
      });

      it('should transition CONFIRMED → CANCELLED (CANCEL before start)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.CONFIRMED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.refund.findFirst.mockResolvedValue(null);
        calculationService.calculateRefund.mockResolvedValue({
          refundAmount: 100,
          reason: 'Full refund',
        });

        const result = await service.transition(
          'booking-1',
          'CANCEL',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.CANCELLED);
        expect(paymentsQueue.add).toHaveBeenCalledWith(
          'process-refund',
          expect.any(Object),
          expect.any(Object),
        );
      });
    });

    describe('IN_PROGRESS State Transitions', () => {
      it('should transition IN_PROGRESS → AWAITING_RETURN_INSPECTION (REQUEST_RETURN)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.IN_PROGRESS,
          listing: {
            id: 'listing-1',
            ownerId: 'owner-1',
            title: 'Test Listing',
            owner: { id: 'owner-1' },
          },
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.conditionReport.findFirst.mockResolvedValue(null);

        const result = await service.transition(
          'booking-1',
          'REQUEST_RETURN',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.AWAITING_RETURN_INSPECTION);
        expect(prisma.conditionReport.create).toHaveBeenCalled();
        expect(notificationsService.sendNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'owner-1',
            type: 'BOOKING_REMINDER',
          }),
        );
      });

      it('should transition IN_PROGRESS → DISPUTED (INITIATE_DISPUTE during rental)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.IN_PROGRESS,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.user.findMany.mockResolvedValue([
          { id: 'admin-1' },
          { id: 'admin-2' },
        ]);

        const result = await service.transition(
          'booking-1',
          'INITIATE_DISPUTE',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.DISPUTED);
        expect(notificationsService.sendNotification).toHaveBeenCalledTimes(3); // 2 admins + 1 notification
      });
    });

    describe('AWAITING_RETURN_INSPECTION State Transitions', () => {
      it('should transition AWAITING_RETURN_INSPECTION → COMPLETED (APPROVE_RETURN)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.AWAITING_RETURN_INSPECTION,
          ownerEarnings: 900,
          currency: 'USD',
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
        prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        prisma.conditionReport.findFirst.mockResolvedValue(null);
        prisma.dispute.findFirst.mockResolvedValue(null);
        prisma.depositHold.findMany.mockResolvedValue([]);
        prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });

        const result = await service.transition(
          'booking-1',
          'APPROVE_RETURN',
          'owner-1',
          'OWNER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.COMPLETED);
        expect(prisma.payout.create).toHaveBeenCalled();
        expect(paymentsQueue.add).toHaveBeenCalledWith(
          'process-payout',
          expect.any(Object),
          expect.any(Object),
        );
      });

      it('should transition AWAITING_RETURN_INSPECTION → DISPUTED (REJECT_RETURN)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.AWAITING_RETURN_INSPECTION,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

        const result = await service.transition(
          'booking-1',
          'REJECT_RETURN',
          'owner-1',
          'OWNER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.DISPUTED);
        expect(notificationsService.sendNotification).toHaveBeenCalled();
      });

      it('should transition AWAITING_RETURN_INSPECTION → COMPLETED (EXPIRE auto-approve)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.AWAITING_RETURN_INSPECTION,
          ownerEarnings: 900,
          currency: 'USD',
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
        prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        prisma.conditionReport.findFirst.mockResolvedValue(null);
        prisma.dispute.findFirst.mockResolvedValue(null);
        prisma.depositHold.findMany.mockResolvedValue([]);
        prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });

        const result = await service.transition(
          'booking-1',
          'EXPIRE',
          'system-1',
          'SYSTEM',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.COMPLETED);
      });
    });

    describe('COMPLETED State Transitions', () => {
      it('should transition COMPLETED → SETTLED (SETTLE)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.COMPLETED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'SETTLE',
          'system-1',
          'SYSTEM',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.SETTLED);
      });

      it('should transition COMPLETED → DISPUTED (INITIATE_DISPUTE post-completion)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.COMPLETED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

        const result = await service.transition(
          'booking-1',
          'INITIATE_DISPUTE',
          'renter-1',
          'RENTER',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.DISPUTED);
      });
    });

    describe('CANCELLED State Transitions', () => {
      it('should transition CANCELLED → REFUNDED (REFUND)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.CANCELLED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'REFUND',
          'system-1',
          'SYSTEM',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.REFUNDED);
      });
    });

    describe('DISPUTED State Transitions', () => {
      it('should transition DISPUTED → COMPLETED (RESOLVE_DISPUTE_OWNER_FAVOR)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.DISPUTED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'RESOLVE_DISPUTE_OWNER_FAVOR',
          'admin-1',
          'ADMIN',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.COMPLETED);
      });

      it('should transition DISPUTED → REFUNDED (RESOLVE_DISPUTE_RENTER_FAVOR)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.DISPUTED,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.transition(
          'booking-1',
          'RESOLVE_DISPUTE_RENTER_FAVOR',
          'admin-1',
          'ADMIN',
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(BookingStatus.REFUNDED);
      });
    });
  });

  describe('INVALID TRANSITIONS - Negative Testing', () => {
    describe('Invalid State Combinations', () => {
      it('should reject DRAFT → CONFIRMED (invalid transition)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.DRAFT,
        });

        await expect(
          service.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject CONFIRMED → DRAFT (invalid transition)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.CONFIRMED,
        });

        await expect(
          service.transition('booking-1', 'SUBMIT_REQUEST', 'renter-1', 'RENTER'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject COMPLETED → CANCELLED (invalid transition)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.COMPLETED,
        });

        await expect(
          service.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject SETTLED → COMPLETED (invalid transition - terminal state)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.SETTLED,
        });

        await expect(
          service.transition('booking-1', 'COMPLETE', 'system-1', 'SYSTEM'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject REFUNDED → CANCELLED (invalid transition - terminal state)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.REFUNDED,
        });

        await expect(
          service.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Invalid Role Authorization', () => {
      it('should reject OWNER trying to SUBMIT_REQUEST (renter-only)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.DRAFT,
        });

        await expect(
          service.transition('booking-1', 'SUBMIT_REQUEST', 'owner-1', 'OWNER'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject RENTER trying to OWNER_APPROVE (owner-only)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
        });

        await expect(
          service.transition('booking-1', 'OWNER_APPROVE', 'renter-1', 'RENTER'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject RENTER trying to APPROVE_RETURN (owner-only)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.AWAITING_RETURN_INSPECTION,
        });

        await expect(
          service.transition('booking-1', 'APPROVE_RETURN', 'renter-1', 'RENTER'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject OWNER trying to RESOLVE_DISPUTE (admin-only)', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.DISPUTED,
        });

        await expect(
          service.transition('booking-1', 'RESOLVE_DISPUTE_OWNER_FAVOR', 'owner-1', 'OWNER'),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Invalid Actor Identity', () => {
      it('should reject wrong RENTER trying to transition', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          renterId: 'renter-1', // Actual renter
        });

        await expect(
          service.transition('booking-1', 'CANCEL', 'renter-2', 'RENTER'), // Wrong renter
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject wrong OWNER trying to transition', async () => {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          listing: {
            id: 'listing-1',
            ownerId: 'owner-1', // Actual owner
            title: 'Test Listing',
            owner: { id: 'owner-1' },
          },
        });

        await expect(
          service.transition('booking-1', 'OWNER_APPROVE', 'owner-2', 'OWNER'), // Wrong owner
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('CONCURRENT STATE CHANGES - Race Condition Handling', () => {
    it('should reject transition when state changed concurrently', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });
      
      // Simulate concurrent update: updateMany returns count: 0 (no rows updated)
      prisma.booking.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should succeed when state unchanged during transition', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });
      
      // Simulate successful update: updateMany returns count: 1
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.transition(
        'booking-1',
        'OWNER_APPROVE',
        'owner-1',
        'OWNER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.PENDING_PAYMENT);
    });
  });

  describe('SIDE EFFECTS VALIDATION', () => {
    it('should create state history entry on transition', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      await service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER');

      expect(prisma.bookingStateHistory.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-1',
          fromStatus: BookingStatus.PENDING_OWNER_APPROVAL,
          toStatus: BookingStatus.PENDING_PAYMENT,
          changedBy: 'owner-1',
          metadata: undefined,
        },
      });
    });

    it('should invalidate cache on transition', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      await service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER');

      expect(cacheService.del).toHaveBeenCalledWith('booking:booking-1');
    });

    it('should publish state change event on transition', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      await service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER');

      expect(cacheService.publish).toHaveBeenCalledWith(
        'booking:state-change',
        expect.objectContaining({
          bookingId: 'booking-1',
          newState: BookingStatus.PENDING_PAYMENT,
          renterId: 'renter-1',
          ownerId: 'owner-1',
          listingId: 'listing-1',
        }),
      );
    });

    it('should include metadata in state history when provided', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      const metadata = { reason: 'Owner approved request', notes: 'All good' };
      await service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER', metadata);

      expect(prisma.bookingStateHistory.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-1',
          fromStatus: BookingStatus.PENDING_OWNER_APPROVAL,
          toStatus: BookingStatus.PENDING_PAYMENT,
          changedBy: 'owner-1',
          metadata: JSON.stringify(metadata),
        },
      });
    });
  });

  describe('AVAILABLE TRANSITIONS QUERY', () => {
    it('should return available transitions for RENTER from PENDING_OWNER_APPROVAL', () => {
      const transitions = service.getAvailableTransitions(
        BookingStatus.PENDING_OWNER_APPROVAL,
        'RENTER',
      );

      expect(transitions).toEqual(['CANCEL']);
    });

    it('should return available transitions for OWNER from PENDING_OWNER_APPROVAL', () => {
      const transitions = service.getAvailableTransitions(
        BookingStatus.PENDING_OWNER_APPROVAL,
        'OWNER',
      );

      expect(transitions).toEqual(['OWNER_APPROVE', 'OWNER_REJECT']);
    });

    it('should return available transitions for SYSTEM from PENDING_PAYMENT', () => {
      const transitions = service.getAvailableTransitions(
        BookingStatus.PENDING_PAYMENT,
        'SYSTEM',
      );

      expect(transitions).toEqual(['COMPLETE_PAYMENT', 'FAIL_PAYMENT', 'EXPIRE']);
    });

    it('should return empty array for terminal states', () => {
      const transitions = service.getAvailableTransitions(
        BookingStatus.SETTLED,
        'SYSTEM',
      );

      expect(transitions).toEqual([]);
    });

    it('should return empty array when role has no permissions', () => {
      const transitions = service.getAvailableTransitions(
        BookingStatus.DISPUTED,
        'RENTER',
      );

      expect(transitions).toEqual([]);
    });
  });

  describe('CAN TRANSITION CHECK', () => {
    it('should return allowed: true for valid transition', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });

      const result = await service.canTransition(
        'booking-1',
        'OWNER_APPROVE',
        'OWNER',
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return allowed: false for invalid transition', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.DRAFT,
      });

      const result = await service.canTransition(
        'booking-1',
        'COMPLETE_PAYMENT',
        'RENTER',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No valid transition');
    });

    it('should return allowed: false for unauthorized role', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });

      const result = await service.canTransition(
        'booking-1',
        'OWNER_APPROVE',
        'RENTER',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Role RENTER not authorized');
    });

    it('should return allowed: false for non-existent booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      const result = await service.canTransition(
        'booking-1',
        'OWNER_APPROVE',
        'OWNER',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Booking not found');
    });
  });

  describe('TERMINAL STATE DETECTION', () => {
    it('should identify SETTLED as terminal state', () => {
      expect(service.isTerminalState(BookingStatus.SETTLED)).toBe(true);
    });

    it('should identify REFUNDED as terminal state', () => {
      expect(service.isTerminalState(BookingStatus.REFUNDED)).toBe(true);
    });

    it('should identify CANCELLED as terminal state', () => {
      expect(service.isTerminalState(BookingStatus.CANCELLED)).toBe(true);
    });

    it('should not identify CONFIRMED as terminal state', () => {
      expect(service.isTerminalState(BookingStatus.CONFIRMED)).toBe(false);
    });

    it('should not identify IN_PROGRESS as terminal state', () => {
      expect(service.isTerminalState(BookingStatus.IN_PROGRESS)).toBe(false);
    });

    it('should not identify COMPLETED as terminal state', () => {
      expect(service.isTerminalState(BookingStatus.COMPLETED)).toBe(false);
    });
  });

  describe('STATE HISTORY RETRIEVAL', () => {
    it('should retrieve state history in chronological order', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          bookingId: 'booking-1',
          fromStatus: BookingStatus.DRAFT,
          toStatus: BookingStatus.PENDING_OWNER_APPROVAL,
          changedBy: 'renter-1',
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'history-2',
          bookingId: 'booking-1',
          fromStatus: BookingStatus.PENDING_OWNER_APPROVAL,
          toStatus: BookingStatus.PENDING_PAYMENT,
          changedBy: 'owner-1',
          createdAt: new Date('2023-01-02'),
        },
      ];

      prisma.bookingStateHistory.findMany.mockResolvedValue(mockHistory);

      const history = await service.getStateHistory('booking-1');

      expect(history).toEqual(mockHistory);
      expect(prisma.bookingStateHistory.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('COMPLETE LIFECYCLE TEST', () => {
    it('should handle complete booking lifecycle from DRAFT to SETTLED', async () => {
      const lifecycleSteps = [
        { from: BookingStatus.DRAFT, to: BookingStatus.PENDING_OWNER_APPROVAL, transition: 'SUBMIT_REQUEST', role: 'RENTER' },
        { from: BookingStatus.PENDING_OWNER_APPROVAL, to: BookingStatus.PENDING_PAYMENT, transition: 'OWNER_APPROVE', role: 'OWNER' },
        { from: BookingStatus.PENDING_PAYMENT, to: BookingStatus.CONFIRMED, transition: 'COMPLETE_PAYMENT', role: 'RENTER' },
        { from: BookingStatus.CONFIRMED, to: BookingStatus.IN_PROGRESS, transition: 'START_RENTAL', role: 'OWNER' },
        { from: BookingStatus.IN_PROGRESS, to: BookingStatus.AWAITING_RETURN_INSPECTION, transition: 'REQUEST_RETURN', role: 'RENTER' },
        { from: BookingStatus.AWAITING_RETURN_INSPECTION, to: BookingStatus.COMPLETED, transition: 'APPROVE_RETURN', role: 'OWNER' },
        { from: BookingStatus.COMPLETED, to: BookingStatus.SETTLED, transition: 'SETTLE', role: 'SYSTEM' },
      ];

      let currentStatus: BookingStatus = BookingStatus.DRAFT;

      for (const step of lifecycleSteps) {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: currentStatus,
          startDate: new Date('2023-02-01'),
          ownerEarnings: 900,
          currency: 'USD',
          listing: {
            id: 'listing-1',
            ownerId: 'owner-1',
            title: 'Test Listing',
            owner: { id: 'owner-1', stripeConnectId: 'acct_123' },
          },
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.conditionReport.findFirst.mockResolvedValue(null);
        prisma.dispute.findFirst.mockResolvedValue(null);
        prisma.depositHold.findMany.mockResolvedValue([]);
        prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
        prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });

        const result = await service.transition(
          'booking-1',
          step.transition as BookingTransition,
          step.role === 'RENTER' ? 'renter-1' : step.role === 'OWNER' ? 'owner-1' : 'system-1',
          step.role as any,
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(step.to);
        currentStatus = step.to;
      }

      // Verify final state
      expect(currentStatus).toBe(BookingStatus.SETTLED);
    });

    it('should handle cancellation lifecycle from PENDING_OWNER_APPROVAL to REFUNDED', async () => {
      const cancellationSteps = [
        { from: BookingStatus.PENDING_OWNER_APPROVAL, to: BookingStatus.CANCELLED, transition: 'CANCEL', role: 'RENTER' },
        { from: BookingStatus.CANCELLED, to: BookingStatus.REFUNDED, transition: 'REFUND', role: 'SYSTEM' },
      ];

      let currentStatus: BookingStatus = BookingStatus.PENDING_OWNER_APPROVAL;

      for (const step of cancellationSteps) {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: currentStatus,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.refund.findFirst.mockResolvedValue(null);
        calculationService.calculateRefund.mockResolvedValue({
          refundAmount: 100,
          reason: 'Full refund',
        });

        const result = await service.transition(
          'booking-1',
          step.transition as BookingTransition,
          step.role === 'RENTER' ? 'renter-1' : 'system-1',
          step.role as any,
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(step.to);
        currentStatus = step.to;
      }

      expect(currentStatus).toBe(BookingStatus.REFUNDED);
    });

    it('should handle dispute lifecycle from IN_PROGRESS to COMPLETED', async () => {
      const disputeSteps = [
        { from: BookingStatus.IN_PROGRESS, to: BookingStatus.DISPUTED, transition: 'INITIATE_DISPUTE', role: 'RENTER' },
        { from: BookingStatus.DISPUTED, to: BookingStatus.COMPLETED, transition: 'RESOLVE_DISPUTE_OWNER_FAVOR', role: 'ADMIN' },
      ];

      let currentStatus: BookingStatus = BookingStatus.IN_PROGRESS;

      for (const step of disputeSteps) {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBooking,
          status: currentStatus,
        });
        prisma.booking.updateMany.mockResolvedValue({ count: 1 });
        prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

        const result = await service.transition(
          'booking-1',
          step.transition as BookingTransition,
          step.role === 'RENTER' ? 'renter-1' : 'admin-1',
          step.role as any,
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(step.to);
        currentStatus = step.to;
      }

      expect(currentStatus).toBe(BookingStatus.COMPLETED);
    });
  });
});
