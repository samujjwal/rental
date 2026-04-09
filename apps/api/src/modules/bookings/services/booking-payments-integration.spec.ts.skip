import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { BookingsService } from './bookings.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';

/**
 * INTEGRATION TESTS: Booking ↔ Payments
 * 
 * These tests validate the integration between the booking system and payment system:
 * 1. Payment intent creation flow
 * 2. Payment success/failure handling
 * 3. Refund integration with booking cancellation
 * 4. Payout integration after booking completion
 * 5. Payment state changes affecting booking state
 * 6. Concurrent payment operations
 * 
 * Integration Points Tested:
 * - Booking creation → Payment intent creation
 * - Payment success → Booking state transition to CONFIRMED
 * - Payment failure → Booking state transition to PAYMENT_FAILED
 * - Booking cancellation → Refund initiation
 * - Booking completion → Payout creation
 * - Stripe webhook handlers
 */
describe('Booking ↔ Payments Integration Tests', () => {
  let bookingsService: BookingsService;
  let stateMachineService: BookingStateMachineService;
  let calculationService: BookingCalculationService;
  let prisma: any;
  let cache: any;
  let paymentsQueue: any;
  let bookingsQueue: any;

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      listing: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      availability: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      availabilitySlot: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryUnit: {
        findMany: jest.fn(),
      },
      bookingStateHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      payout: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      refund: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      paymentIntent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      paymentCommand: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        await callback(prisma);
        return { id: 'booking-1' };
      }),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
    };

    paymentsQueue = {
      add: jest.fn(),
    };

    bookingsQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        BookingStateMachineService,
        BookingCalculationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: getQueueToken('payments'), useValue: paymentsQueue },
        { provide: getQueueToken('bookings'), useValue: bookingsQueue },
      ],
    }).compile();

    bookingsService = module.get<BookingsService>(BookingsService);
    stateMachineService = module.get<BookingStateMachineService>(BookingStateMachineService);
    calculationService = module.get<BookingCalculationService>(BookingCalculationService);

    // Mock the calculateRefund method
    jest.spyOn(calculationService, 'calculateRefund').mockResolvedValue({
      refundAmount: 800,
      platformFeeRefund: 90,
      serviceFeeRefund: 45,
      depositRefund: 200,
      penalty: 50,
      reason: 'Partial refund',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BOOKING CREATION → PAYMENT INTENT', () => {
    it('should create payment intent when booking is created', async () => {
      const mockListing = {
        id: 'listing-1',
        ownerId: 'owner-1',
        title: 'Test Listing',
        basePrice: 100,
        dailyPrice: 100,
        currency: 'USD',
        pricingMode: 'PER_DAY',
        isActive: true,
      };

      const mockBooking = {
        id: 'booking-1',
        renterId: 'renter-1',
        listingId: 'listing-1',
        status: BookingStatus.PENDING_PAYMENT,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-10'),
        totalPrice: 900,
        platformFee: 90,
        serviceFee: 45,
        securityDeposit: 200,
        currency: 'USD',
      };

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.availability.findMany.mockResolvedValue([]);
      prisma.inventoryUnit.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.create.mockResolvedValue(mockBooking);
      prisma.paymentIntent.create.mockResolvedValue({ id: 'pi_123' });

      const result = await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.paymentIntent.create).toHaveBeenCalled();
      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should handle payment intent creation failure gracefully', async () => {
      const mockListing = {
        id: 'listing-1',
        ownerId: 'owner-1',
        title: 'Test Listing',
        basePrice: 100,
        dailyPrice: 100,
        currency: 'USD',
        pricingMode: 'PER_DAY',
        isActive: true,
      };

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.availability.findMany.mockResolvedValue([]);
      prisma.inventoryUnit.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });
      prisma.paymentIntent.create.mockRejectedValue(new Error('Stripe API error'));

      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow();
    });
  });

  describe('PAYMENT SUCCESS → BOOKING CONFIRMED', () => {
    it('should transition booking to CONFIRMED on payment success', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
        startDate: new Date('2023-02-01'),
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.conditionReport.findFirst.mockResolvedValue(null);
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
      prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });
      prisma.depositHold.findMany.mockResolvedValue([]);

      const result = await stateMachineService.transition(
        'booking-1',
        'COMPLETE_PAYMENT',
        'renter-1',
        'RENTER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CONFIRMED);
      expect(paymentsQueue.add).toHaveBeenCalledWith(
        'hold-deposit',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should schedule reminder notification on booking confirmation', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
        startDate: new Date('2023-02-01'),
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.conditionReport.findFirst.mockResolvedValue(null);

      await stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');

      // Verify reminder notification is scheduled
      expect(cache.publish).toHaveBeenCalledWith(
        'booking:state-change',
        expect.objectContaining({
          bookingId: 'booking-1',
          newState: BookingStatus.CONFIRMED,
        }),
      );
    });
  });

  describe('PAYMENT FAILURE → BOOKING PAYMENT_FAILED', () => {
    it('should transition booking to PAYMENT_FAILED on payment failure', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const result = await stateMachineService.transition(
        'booking-1',
        'FAIL_PAYMENT',
        'system-1',
        'SYSTEM',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.PAYMENT_FAILED);
      expect(bookingsQueue.add).toHaveBeenCalledWith(
        'expire-payment-failed',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should schedule grace period expiration on payment failure', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await stateMachineService.transition('booking-1', 'FAIL_PAYMENT', 'system-1', 'SYSTEM');

      expect(bookingsQueue.add).toHaveBeenCalledWith(
        'expire-payment-failed',
        expect.objectContaining({
          bookingId: 'booking-1',
        }),
        expect.objectContaining({
          delay: 24 * 60 * 60 * 1000, // 24 hours
        }),
      );
    });
  });

  describe('BOOKING CANCELLATION → REFUND INITIATION', () => {
    it('should initiate refund when booking is cancelled', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
        },
        paymentIntentId: 'pi_123',
        totalPrice: 900,
        currency: 'USD',
        startDate: new Date('2023-01-10'),
        endDate: new Date('2023-01-15'),
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.refund.findFirst.mockResolvedValue(null);
      prisma.refund.create.mockResolvedValue({ id: 'refund-1' });

      const result = await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CANCELLED);
      expect(prisma.refund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          amount: 800,
          currency: 'USD',
          status: 'PENDING',
        }),
      });
      expect(paymentsQueue.add).toHaveBeenCalledWith(
        'process-refund',
        expect.objectContaining({
          bookingId: 'booking-1',
          amount: 800,
        }),
        expect.any(Object),
      );
    });

    it('should not create duplicate refund for already cancelled booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.CANCELLED,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
        },
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.refund.findFirst.mockResolvedValue({ id: 'refund-1' });

      const result = await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });
  });

  describe('BOOKING COMPLETION → PAYOUT CREATION', () => {
    it('should create payout when booking completes', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
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
        ownerEarnings: 800,
        currency: 'USD',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
      prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });
      prisma.conditionReport.findFirst.mockResolvedValue(null);
      prisma.dispute.findFirst.mockResolvedValue(null);
      prisma.depositHold.findMany.mockResolvedValue([]);

      const result = await stateMachineService.transition(
        'booking-1',
        'APPROVE_RETURN',
        'owner-1',
        'OWNER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.COMPLETED);
      expect(prisma.payout.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerId: 'owner-1',
          amount: 800,
          currency: 'USD',
          status: 'PENDING',
        }),
      });
      expect(paymentsQueue.add).toHaveBeenCalledWith(
        'process-payout',
        expect.objectContaining({
          payoutId: 'payout-1',
          ownerId: 'owner-1',
          amount: 800,
        }),
        expect.any(Object),
      );
    });

    it('should enqueue payout job with retry configuration', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
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
        ownerEarnings: 800,
        currency: 'USD',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
      prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });
      prisma.conditionReport.findFirst.mockResolvedValue(null);
      prisma.dispute.findFirst.mockResolvedValue(null);
      prisma.depositHold.findMany.mockResolvedValue([]);

      await stateMachineService.transition('booking-1', 'APPROVE_RETURN', 'owner-1', 'OWNER');

      expect(paymentsQueue.add).toHaveBeenCalledWith(
        'process-payout',
        expect.any(Object),
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      );
    });
  });

  describe('DEPOSIT HOLD ON CONFIRMATION', () => {
    it('should create deposit hold when booking is confirmed', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
        startDate: new Date('2023-02-01'),
        depositAmount: 200,
        currency: 'USD',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.conditionReport.findFirst.mockResolvedValue(null);

      await stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');

      expect(paymentsQueue.add).toHaveBeenCalledWith(
        'hold-deposit',
        expect.objectContaining({
          bookingId: 'booking-1',
          amount: 200,
          currency: 'USD',
        }),
        expect.any(Object),
      );
    });

    it('should skip deposit hold when no deposit required', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
        startDate: new Date('2023-02-01'),
        depositAmount: 0, // No deposit
        currency: 'USD',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.conditionReport.findFirst.mockResolvedValue(null);

      await stateMachineService.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER');

      expect(paymentsQueue.add).not.toHaveBeenCalledWith(
        'hold-deposit',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('DEPOSIT RELEASE ON COMPLETION', () => {
    it('should release deposit when booking completes without damage', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
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
        ownerEarnings: 800,
        currency: 'USD',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
      prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });
      prisma.conditionReport.findFirst.mockResolvedValue(null);
      prisma.dispute.findFirst.mockResolvedValue(null);
      prisma.depositHold.findMany.mockResolvedValue([
        { id: 'hold-1', amount: 200, currency: 'USD' },
      ]);

      await stateMachineService.transition('booking-1', 'APPROVE_RETURN', 'owner-1', 'OWNER');

      expect(paymentsQueue.add).toHaveBeenCalledWith(
        'release-deposit',
        expect.objectContaining({
          bookingId: 'booking-1',
        }),
        expect.any(Object),
      );
    });

    it('should hold deposit when damage is reported', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
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
        ownerEarnings: 800,
        currency: 'USD',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
      prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });
      prisma.conditionReport.findFirst.mockResolvedValue({
        damages: '[{"type": "scratch", "cost": 50}]',
      }); // Damage reported

      await stateMachineService.transition('booking-1', 'APPROVE_RETURN', 'owner-1', 'OWNER');

      expect(paymentsQueue.add).not.toHaveBeenCalledWith(
        'release-deposit',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('PAYMENT RETRY FLOW', () => {
    it('should allow payment retry from PAYMENT_FAILED state', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PAYMENT_FAILED,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      const result = await stateMachineService.transition(
        'booking-1',
        'RETRY_PAYMENT',
        'renter-1',
        'RENTER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should cancel booking after grace period expiration', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PAYMENT_FAILED,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.refund.findFirst.mockResolvedValue(null);
      prisma.refund.create.mockResolvedValue({ id: 'refund-1' });

      const result = await stateMachineService.transition(
        'booking-1',
        'EXPIRE',
        'system-1',
        'SYSTEM',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CANCELLED);
    });
  });

  describe('CONCURRENT PAYMENT OPERATIONS', () => {
    it('should handle concurrent payment success and cancellation', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        renter: { id: 'renter-1' },
        startDate: new Date('2023-02-01'),
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      // First operation succeeds
      prisma.booking.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.conditionReport.findFirst.mockResolvedValueOnce(null);

      // Second operation fails due to state change
      prisma.booking.updateMany.mockResolvedValue({ count: 0 });

      const paymentPromise = stateMachineService.transition(
        'booking-1',
        'COMPLETE_PAYMENT',
        'renter-1',
        'RENTER',
      );

      const cancelPromise = stateMachineService.transition(
        'booking-1',
        'CANCEL',
        'renter-1',
        'RENTER',
      );

      const results = await Promise.allSettled([paymentPromise, cancelPromise]);

      // One should succeed, one should fail
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBe(1);
    });
  });
});
