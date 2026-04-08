import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { AvailabilityService } from '../../listings/services/availability.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';
import { getQueueToken } from '@nestjs/bull';

/**
 * INTEGRATION TESTS: Booking ↔ Availability
 * 
 * These tests validate the integration between the booking system and availability system:
 * 1. Booking creation checks availability
 * 2. Availability reservation on booking confirmation
 * 3. Availability release on booking cancellation
 * 4. Multi-unit inventory allocation
 * 5. Concurrent availability operations
 * 6. Availability summary updates
 * 
 * Integration Points Tested:
 * - Booking creation → Availability check
 * - Payment success → Availability reservation
 * - Booking cancellation → Availability release
 * - Booking completion → Availability slot update
 * - Multi-unit listing → Inventory unit allocation
 */
describe('Booking ↔ Availability Integration Tests', () => {
  let bookingsService: BookingsService;
  let stateMachineService: BookingStateMachineService;
  let availabilityService: AvailabilityService;
  let prisma: any;
  let cache: any;
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
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      availabilitySlot: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryUnit: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      bookingStateHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
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
        findMany: jest.fn(),
      },
      payout: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        await callback(prisma);
        return { id: 'booking-1' };
      }),
      $executeRawUnsafe: jest.fn(),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
    };

    bookingsQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        BookingStateMachineService,
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: getQueueToken('bookings'), useValue: bookingsQueue },
      ],
    }).compile();

    bookingsService = module.get<BookingsService>(BookingsService);
    stateMachineService = module.get<BookingStateMachineService>(BookingStateMachineService);
    availabilityService = module.get<AvailabilityService>(AvailabilityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BOOKING CREATION → AVAILABILITY CHECK', () => {
    it('should check availability before creating booking', async () => {
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
      prisma.availability.findMany.mockResolvedValue([]); // No blocked dates
      prisma.inventoryUnit.findMany.mockResolvedValue([]); // Single-unit listing
      prisma.booking.findMany.mockResolvedValue([]); // No existing bookings
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      const result = await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          listingId: 'listing-1',
          status: { in: ['PENDING_OWNER_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] },
        }),
      });
      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should reject booking when dates are not available', async () => {
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
      prisma.availability.findMany.mockResolvedValue([]); // No blocked dates
      prisma.inventoryUnit.findMany.mockResolvedValue([]); // Single-unit listing
      prisma.booking.findMany.mockResolvedValue([
        // Existing booking conflicts
        {
          id: 'existing-booking',
          startDate: new Date('2023-01-05'),
          endDate: new Date('2023-01-15'),
        },
      ]);

      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow('not available');
    });

    it('should reject booking when availability rules block dates', async () => {
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
      prisma.availability.findMany.mockResolvedValue([
        {
          id: 'avail-1',
          status: 'BLOCKED',
          startDate: new Date('2023-01-05'),
          endDate: new Date('2023-01-15'),
        },
      ]);
      prisma.inventoryUnit.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]);

      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow('not available');
    });
  });

  describe('PAYMENT SUCCESS → AVAILABILITY RESERVATION', () => {
    it('should reserve availability slot when booking is confirmed', async () => {
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
        endDate: new Date('2023-02-10'),
        inventoryUnitId: null,
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.conditionReport.findFirst.mockResolvedValue(null);
      prisma.inventoryUnit.findMany.mockResolvedValue([]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

      const result = await stateMachineService.transition(
        'booking-1',
        'COMPLETE_PAYMENT',
        'renter-1',
        'RENTER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CONFIRMED);
      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listingId: 'listing-1',
          status: 'BOOKED',
          bookingId: 'booking-1',
        }),
      });
    });

    it('should reserve specific inventory unit for multi-unit listing', async () => {
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
        endDate: new Date('2023-02-10'),
        inventoryUnitId: 'unit-1',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.conditionReport.findFirst.mockResolvedValue(null);
      prisma.inventoryUnit.findMany.mockResolvedValue([
        { id: 'unit-1', listingId: 'listing-1', isActive: true },
      ]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);
      prisma.availabilitySlot.findMany.mockResolvedValue([]);
      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

      const result = await stateMachineService.transition(
        'booking-1',
        'COMPLETE_PAYMENT',
        'renter-1',
        'RENTER',
      );

      expect(result.success).toBe(true);
      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: 'unit-1',
          status: 'BOOKED',
          bookingId: 'booking-1',
        }),
      });
    });
  });

  describe('BOOKING CANCELLATION → AVAILABILITY RELEASE', () => {
    it('should release availability slot when booking is cancelled', async () => {
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
        startDate: new Date('2023-01-10'),
        endDate: new Date('2023-01-15'),
        inventoryUnitId: 'unit-1',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CANCELLED);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bookingId: 'booking-1',
          status: 'BOOKED',
          inventoryUnitId: 'unit-1',
        }),
        data: { status: 'AVAILABLE', bookingId: null },
      });
    });

    it('should release availability without inventory unit for single-unit listing', async () => {
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
        startDate: new Date('2023-01-10'),
        endDate: new Date('2023-01-15'),
        inventoryUnitId: null,
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bookingId: 'booking-1',
          status: 'BOOKED',
          inventoryUnitId: null,
        }),
        data: { status: 'AVAILABLE', bookingId: null },
      });
    });
  });

  describe('BOOKING COMPLETION → AVAILABILITY SLOT UPDATE', () => {
    it('should update availability slot status to COMPLETED when booking completes', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
        renterId: 'renter-1',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          ownerId: 'owner-1',
          title: 'Test Listing',
          owner: { id: 'owner-1' },
        },
        startDate: new Date('2023-01-10'),
        endDate: new Date('2023-01-15'),
        inventoryUnitId: 'unit-1',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.payout.create.mockResolvedValue({ id: 'payout-1' });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
      prisma.auditLog.findUnique.mockResolvedValue({ newValues: '{}' });
      prisma.conditionReport.findFirst.mockResolvedValue(null);
      prisma.dispute.findFirst.mockResolvedValue(null);
      prisma.depositHold.findMany.mockResolvedValue([]);
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });

      const result = await stateMachineService.transition(
        'booking-1',
        'APPROVE_RETURN',
        'owner-1',
        'OWNER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.COMPLETED);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bookingId: 'booking-1',
          status: 'BOOKED',
        }),
        data: { status: 'COMPLETED' },
      });
    });
  });

  describe('MULTI-UNIT INVENTORY ALLOCATION', () => {
    it('should allocate available unit when multiple exist', async () => {
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

      const inventoryUnits = [
        { id: 'unit-1', listingId: 'listing-1', isActive: true },
        { id: 'unit-2', listingId: 'listing-1', isActive: true },
        { id: 'unit-3', listingId: 'listing-1', isActive: true },
      ];

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.availability.findMany.mockResolvedValue([]);
      prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);
      prisma.availabilitySlot.findMany.mockResolvedValue([]); // No conflicts for unit-1
      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      const result = await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: 'unit-1',
          status: 'RESERVED',
        }),
      });
    });

    it('should try next unit when first has conflicts', async () => {
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

      const inventoryUnits = [
        { id: 'unit-1', listingId: 'listing-1', isActive: true },
        { id: 'unit-2', listingId: 'listing-1', isActive: true },
      ];

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.availability.findMany.mockResolvedValue([]);
      prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      // First call: unit-1 has conflicts
      prisma.availabilitySlot.findMany.mockResolvedValueOnce([
        { id: 'slot-1', status: 'BOOKED' },
      ]);
      // Second call: unit-2 has no conflicts
      prisma.availabilitySlot.findMany.mockResolvedValueOnce([]);
      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-2' });
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      const result = await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: 'unit-2',
        }),
      });
    });

    it('should fail when all units have conflicts', async () => {
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

      const inventoryUnits = [
        { id: 'unit-1', listingId: 'listing-1', isActive: true },
        { id: 'unit-2', listingId: 'listing-1', isActive: true },
      ];

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.availability.findMany.mockResolvedValue([]);
      prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);
      prisma.availabilitySlot.findMany.mockResolvedValue([
        { id: 'slot-1', status: 'BOOKED' },
      ]);

      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow('No available inventory units');
    });
  });

  describe('CONCURRENT AVAILABILITY OPERATIONS', () => {
    it('should handle concurrent booking attempts with availability checks', async () => {
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
      prisma.inventoryUnit.findMany.mockResolvedValue([]); // Single-unit listing
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      // First booking succeeds
      prisma.booking.create.mockResolvedValueOnce({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      // Second booking fails due to constraint
      const constraintError = new Error('Unique constraint failed');
      prisma.booking.create.mockRejectedValueOnce(constraintError);

      const booking1Promise = bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      const booking2Promise = bookingsService.create('renter-2', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      const results = await Promise.allSettled([booking1Promise, booking2Promise]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });

    it('should handle concurrent cancellation and reservation', async () => {
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
        startDate: new Date('2023-01-10'),
        endDate: new Date('2023-01-15'),
        inventoryUnitId: 'unit-1',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      // First operation succeeds
      prisma.booking.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.availabilitySlot.updateMany.mockResolvedValueOnce({ count: 1 });

      // Second operation fails due to state change
      prisma.booking.updateMany.mockResolvedValue({ count: 0 });

      const cancelPromise = stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');
      const completePromise = stateMachineService.transition('booking-1', 'COMPLETE', 'owner-1', 'OWNER');

      const results = await Promise.allSettled([cancelPromise, completePromise]);

      // One should succeed, one should fail
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBe(1);
    });
  });

  describe('AVAILABILITY SUMMARY UPDATES', () => {
    it('should invalidate availability cache on booking creation', async () => {
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
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(cache.del).toHaveBeenCalledWith(`availability:listing-1`);
    });

    it('should invalidate availability cache on booking cancellation', async () => {
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
        startDate: new Date('2023-01-10'),
        endDate: new Date('2023-01-15'),
        inventoryUnitId: 'unit-1',
      };

      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findMany.mockResolvedValue([]);

      await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(cache.del).toHaveBeenCalledWith(`availability:listing-1`);
    });
  });

  describe('ADVISORY LOCK INTEGRATION', () => {
    it('should use advisory locks for availability reservation in booking creation', async () => {
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
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock($1)',
        expect.any(Number),
      );
    });
  });
});
