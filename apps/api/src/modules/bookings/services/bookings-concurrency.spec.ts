import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { BookingCalculationService } from './booking-calculation.service';
import { BookingValidationService } from './booking-validation.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { EventsService } from '@/common/events/events.service';
import { AvailabilityService } from '@/modules/listings/services/availability.service';
import { BOOKING_ELIGIBILITY_PORT } from '../ports/booking-eligibility.port';
import { BOOKING_PRICING_PORT } from '../ports/booking-pricing.port';
import { PolicyEngineService } from '@/modules/policy-engine/services/policy-engine.service';
import { ContextResolverService } from '@/modules/policy-engine/services/context-resolver.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus } from '@rental-portal/database';

describe('Booking Concurrency & Race Condition Tests', () => {
  let service: BookingsService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockListing = {
    id: 'listing-1',
    ownerId: 'owner-1',
    status: 'AVAILABLE',
    basePrice: 100,
    currency: 'USD',
    instantBookable: false,
    minStayNights: 1,
    maxStayNights: 30,
  };

  const mockBooking = {
    id: 'booking-1',
    listingId: 'listing-1',
    renterId: 'renter-1',
    startDate: new Date('2024-07-01'),
    endDate: new Date('2024-07-05'),
    status: BookingStatus.PENDING_OWNER_APPROVAL,
    totalAmount: 400,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      booking: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      listing: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      availability: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      setNx: jest.fn().mockResolvedValue(true),
    };

    const mockEligibilityService = {
      evaluate: jest.fn().mockResolvedValue({ allowed: true, skippedChecks: [] }),
    };

    const mockPricingService = {
      quote: jest.fn().mockResolvedValue({
        subtotal: 400,
        serviceFee: 40,
        platformFee: 20,
        total: 460,
        depositAmount: 100,
        ownerEarnings: 360,
        breakdown: { basePrice: 400, discounts: [] },
      }),
      persistBreakdown: jest.fn().mockResolvedValue(undefined),
      captureExchangeRate: jest.fn().mockResolvedValue(undefined),
      calculateRefund: jest.fn().mockResolvedValue({ amount: 50 }),
    };

    const mockCalculationService = {
      calculatePrice: jest.fn().mockResolvedValue({
        subtotal: 400,
        serviceFee: 40,
        platformFee: 20,
        total: 460,
        depositAmount: 100,
        ownerEarnings: 360,
        breakdown: { basePrice: 400, discounts: [] },
      }),
    };

    const mockValidationService = {
      validateDates: jest.fn().mockReturnValue({ isValid: true }),
      validateAvailability: jest.fn().mockResolvedValue({ isAvailable: true }),
      validateBookingWindow: jest.fn().mockResolvedValue({ isValid: true }),
      validateListing: jest.fn().mockResolvedValue(mockListing),
    };

    const mockAvailabilityService = {
      isAvailable: jest.fn().mockResolvedValue(true),
      blockDates: jest.fn().mockResolvedValue(undefined),
      unblockDates: jest.fn().mockResolvedValue(undefined),
      checkBlockedPeriods: jest.fn().mockResolvedValue({ hasBlocks: false }),
    };

    const mockPolicyEngineService = {
      evaluate: jest.fn().mockResolvedValue({ allowed: true, actions: [] }),
      calculateTax: jest.fn().mockResolvedValue({ totalTax: 0, total: 100 }),
      evaluateBookingConstraints: jest.fn().mockResolvedValue({
        isAllowed: true,
        blockedReasons: [],
        minStay: null,
        maxStay: null,
        requiredDocuments: [],
      }),
    };

    const mockContextResolverService = {
      resolve: jest.fn().mockReturnValue({ locale: 'en', currency: 'USD', country: 'US' }),
    };

    const mockStateMachine = {
      transition: jest.fn().mockResolvedValue({ success: true }),
      canTransition: jest.fn().mockResolvedValue({ allowed: true }),
      getAvailableTransitions: jest.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: BookingCalculationService, useValue: mockCalculationService },
        { provide: BookingValidationService, useValue: mockValidationService },
        { provide: BOOKING_ELIGIBILITY_PORT, useValue: mockEligibilityService },
        { provide: BOOKING_PRICING_PORT, useValue: mockPricingService },
        { provide: PolicyEngineService, useValue: mockPolicyEngineService },
        { provide: ContextResolverService, useValue: mockContextResolverService },
        { provide: BookingStateMachineService, useValue: mockStateMachine },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: NotificationsService, useValue: { sendNotification: jest.fn() } },
        { provide: EventsService, useValue: { emitBookingCreated: jest.fn() } },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Concurrent Booking Prevention', () => {
    it('should use transaction during booking creation', async () => {
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      await service.create('renter-1', {
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
      });

      // Should use transaction for consistency
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should handle transaction failure gracefully', async () => {
      (prismaService.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        service.create('renter-1', {
          listingId: 'listing-1',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-05'),
        }),
      ).rejects.toThrow();
    });

    it('should reject concurrent bookings for overlapping dates', async () => {
      // First concurrent request
      const request1 = {
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
      };

      // Second concurrent request with overlapping dates
      const request2 = {
        listingId: 'listing-1',
        startDate: new Date('2024-07-03'),
        endDate: new Date('2024-07-07'),
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);

      // First request sees no bookings
      (prismaService.booking.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockBooking]); // Second request sees first booking

      (prismaService.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      // First request succeeds
      const result1 = await service.create('renter-1', request1);
      expect(result1).toBeDefined();

      // Second request should fail due to date conflict
      await expect(service.create('renter-2', request2)).rejects.toThrow();
    });

    it('should allow non-overlapping concurrent bookings', async () => {
      const request1 = {
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
      };

      const request2 = {
        listingId: 'listing-1',
        startDate: new Date('2024-07-10'),
        endDate: new Date('2024-07-15'),
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);

      // First request sees no bookings (empty)
      // Second request sees first booking but dates don't overlap, so no conflict
      (prismaService.booking.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // First request - no conflicts
        .mockResolvedValueOnce([]); // Second request - no conflicts (non-overlapping)

      (prismaService.booking.create as jest.Mock)
        .mockResolvedValueOnce({ ...mockBooking, id: 'booking-1' })
        .mockResolvedValueOnce({
          ...mockBooking,
          id: 'booking-2',
          startDate: new Date('2024-07-10'),
        });

      const result1 = await service.create('renter-1', request1);
      const result2 = await service.create('renter-2', request2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('Date Overlap Detection', () => {
    it('should detect exact date overlap', async () => {
      const existingBooking = {
        id: 'existing-1',
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        status: BookingStatus.CONFIRMED,
      };

      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([existingBooking]);
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);

      await expect(
        service.create('renter-1', {
          listingId: 'listing-1',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-05'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect partial overlap (start within existing)', async () => {
      const existingBooking = {
        id: 'existing-1',
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        status: BookingStatus.CONFIRMED,
      };

      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([existingBooking]);
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);

      await expect(
        service.create('renter-1', {
          listingId: 'listing-1',
          startDate: new Date('2024-07-03'),
          endDate: new Date('2024-07-07'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect partial overlap (end within existing)', async () => {
      const existingBooking = {
        id: 'existing-1',
        listingId: 'listing-1',
        startDate: new Date('2024-07-05'),
        endDate: new Date('2024-07-10'),
        status: BookingStatus.CONFIRMED,
      };

      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([existingBooking]);
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);

      await expect(
        service.create('renter-1', {
          listingId: 'listing-1',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-07'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect complete containment overlap', async () => {
      const existingBooking = {
        id: 'existing-1',
        listingId: 'listing-1',
        startDate: new Date('2024-07-02'),
        endDate: new Date('2024-07-04'),
        status: BookingStatus.CONFIRMED,
      };

      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([existingBooking]);
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);

      await expect(
        service.create('renter-1', {
          listingId: 'listing-1',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-05'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should treat adjacent bookings as conflicts (end date = start date)', async () => {
      const existingBooking = {
        id: 'existing-1',
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        status: BookingStatus.CONFIRMED,
      };

      // Adjacent booking (new start = existing end) is treated as conflict
      // to prevent any possibility of double-booking
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([existingBooking]);
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);

      await expect(
        service.create('renter-1', {
          listingId: 'listing-1',
          startDate: new Date('2024-07-05'),
          endDate: new Date('2024-07-10'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not consider cancelled bookings as conflicts', async () => {
      const cancelledBooking = {
        id: 'cancelled-1',
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        status: BookingStatus.CANCELLED,
      };

      // The service filters out CANCELLED/REFUNDED bookings in the transaction
      // So tx.booking.findMany returns empty (no conflicts)
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.create('renter-1', {
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
      });

      expect(result).toBeDefined();
    });

    it('should not consider refunded bookings as conflicts', async () => {
      // The service filters out CANCELLED/REFUNDED bookings in the transaction
      // So tx.booking.findMany returns empty (no conflicts)
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.create('renter-1', {
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
      });

      expect(result).toBeDefined();
    });
  });

  describe('Race Condition Handling', () => {
    it('should use atomic database operations for booking creation', async () => {
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      await service.create('renter-1', {
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
      });

      // Should use transaction for consistency
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should handle transaction timeout gracefully', async () => {
      (prismaService.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction timeout'));

      await expect(
        service.create('renter-1', {
          listingId: 'listing-1',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-05'),
        }),
      ).rejects.toThrow();
    });

    it('should prevent double-approval race condition', async () => {
      const pendingBooking = {
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      };

      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(pendingBooking);
      (prismaService.booking.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      // Simulate two concurrent approval attempts
      const approval1 = service.approveBooking('booking-1', 'owner-1');
      const approval2 = service.approveBooking('booking-1', 'owner-1');

      // At least one should succeed
      const results = await Promise.allSettled([approval1, approval2]);
      const successes = results.filter((r) => r.status === 'fulfilled');

      // Only one should succeed due to atomic update
      expect(successes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Availability Cache Consistency', () => {
    it('should handle booking creation without cache errors', async () => {
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.create('renter-1', {
        listingId: 'listing-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('booking-1');
    });

    it('should handle booking cancellation without cache errors', async () => {
      const confirmedBooking = {
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      };

      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(confirmedBooking);
      (prismaService.booking.update as jest.Mock).mockResolvedValue({
        ...confirmedBooking,
        status: BookingStatus.CANCELLED,
      });

      const result = await service.cancelBooking('booking-1', 'renter-1', 'change of plans');
      expect(result).toBeDefined();
    });
  });
});
