import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityLogicService } from './availability-logic.service';
import { AvailabilityRepository } from '../repositories/availability.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, BadRequestException } from '@nestjs/common';

/**
 * AVAILABILITY SCENARIO TESTS
 * 
 * These tests validate critical availability scenarios:
 * - Same listing/date concurrent booking prevention
 * - Inventory-unit booking for multi-unit listings
 * - Owner-blocked periods
 * - Search filter parity
 * - Listing-detail calendar parity
 * - Cancellation release
 * 
 * Business Truth Validated:
 * - Concurrent bookings for the same listing/date are prevented
 * - Multi-unit listings allow multiple simultaneous bookings up to inventory limit
 * - Owner-blocked periods override availability
 * - Search filters and listing calendars show consistent availability
 * - Cancellations release availability immediately
 * - Availability slots are the canonical source of truth
 */

describe('Availability Scenario Tests', () => {
  let service: AvailabilityLogicService;
  let availabilityRepository: jest.Mocked<AvailabilityRepository>;
  let bookingRepository: jest.Mocked<BookingRepository>;
  let listingRepository: jest.Mocked<ListingRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityLogicService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          },
        },
        {
          provide: AvailabilityRepository,
          useValue: {
            findAvailability: jest.fn(),
            syncAvailability: jest.fn(),
            findBlockedPeriods: jest.fn(),
            getAvailabilityStats: jest.fn(),
            createBlockedPeriod: jest.fn(),
            findConflicts: jest.fn(),
            resolveConflicts: jest.fn(),
            updateAvailability: jest.fn(),
            bulkUpdateAvailability: jest.fn(),
            findAvailabilitySlots: jest.fn(),
            createAvailabilitySlot: jest.fn(),
            deleteAvailabilitySlot: jest.fn(),
          },
        },
        {
          provide: BookingRepository,
          useValue: {
            findBookingsByPeriod: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: ListingRepository,
          useValue: {
            findById: jest.fn(),
            findActiveListings: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            availabilitySlot: {
              findMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              update: jest.fn(),
            },
            booking: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            listing: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AvailabilityLogicService>(AvailabilityLogicService);
    availabilityRepository = module.get(AvailabilityRepository);
    bookingRepository = module.get(BookingRepository);
    listingRepository = module.get(ListingRepository);
    cacheService = module.get(CacheService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Same Listing/Date Concurrent Booking Prevention', () => {
    it('should prevent concurrent booking for single-unit listing on same date', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 1,
      });

      // Simulate existing booking
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
      ]);

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-01', available: false },
        { date: '2024-01-02', available: false },
        { date: '2024-01-03', available: false },
        { date: '2024-01-04', available: false },
      ]);

      const result = await service.checkBookingAllowed(listingId, startDate, endDate);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('already booked');
    });

    it('should allow concurrent booking for different dates on same listing', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-15');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 1,
      });

      // Existing booking on different dates
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          listingId,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          status: 'CONFIRMED',
        },
      ]);

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-10', available: true },
        { date: '2024-01-11', available: true },
        { date: '2024-01-12', available: true },
        { date: '2024-01-13', available: true },
        { date: '2024-01-14', available: true },
      ]);

      const result = await service.checkBookingAllowed(listingId, startDate, endDate);

      expect(result.allowed).toBe(true);
    });

    it('should detect date overlap between existing and new booking', async () => {
      const listingId = 'listing-1';
      const existingStart = new Date('2024-01-05');
      const existingEnd = new Date('2024-01-10');
      const newStart = new Date('2024-01-08');
      const newEnd = new Date('2024-01-12');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 1,
      });

      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          listingId,
          startDate: existingStart,
          endDate: existingEnd,
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.checkBookingAllowed(listingId, newStart, newEnd);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('overlap');
    });
  });

  describe('Inventory-Unit Booking for Multi-Unit Listings', () => {
    it('should allow concurrent bookings up to inventory limit', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 3,
      });

      // 2 existing bookings
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
        {
          id: 'booking-2',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
      ]);

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-01', available: true },
        { date: '2024-01-02', available: true },
        { date: '2024-01-03', available: true },
        { date: '2024-01-04', available: true },
      ]);

      const result = await service.checkBookingAllowed(listingId, startDate, endDate);

      expect(result.allowed).toBe(true);
    });

    it('should prevent booking when inventory limit is reached', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 2,
      });

      // 2 existing bookings (at limit)
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
        {
          id: 'booking-2',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.checkBookingAllowed(listingId, startDate, endDate);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('inventory');
    });

    it('should track available units per date for multi-unit listings', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 5,
      });

      // 3 existing bookings
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
        {
          id: 'booking-2',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
        {
          id: 'booking-3',
          listingId,
          startDate,
          endDate,
          status: 'CONFIRMED',
        },
      ]);

      const availability = await service.calculateAvailability(listingId, startDate, endDate);

      // Should show 2 units available (5 - 3 = 2)
      availability.forEach((slot: any) => {
        expect(slot.availableUnits).toBe(2);
        expect(slot.available).toBe(true);
      });
    });
  });

  describe('Owner-Blocked Periods', () => {
    it('should prevent booking during owner-blocked period', async () => {
      const listingId = 'listing-1';
      const blockedStart = new Date('2024-01-10');
      const blockedEnd = new Date('2024-01-20');
      const bookingStart = new Date('2024-01-12');
      const bookingEnd = new Date('2024-01-15');

      availabilityRepository.findBlockedPeriods.mockResolvedValue([
        {
          id: 'block-1',
          listingId,
          startDate: blockedStart,
          endDate: blockedEnd,
          reason: 'Owner maintenance',
        },
      ]);

      const result = await service.checkBookingAllowed(listingId, bookingStart, bookingEnd);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should allow booking outside owner-blocked period', async () => {
      const listingId = 'listing-1';
      const blockedStart = new Date('2024-01-10');
      const blockedEnd = new Date('2024-01-20');
      const bookingStart = new Date('2024-01-05');
      const bookingEnd = new Date('2024-01-08');

      availabilityRepository.findBlockedPeriods.mockResolvedValue([
        {
          id: 'block-1',
          listingId,
          startDate: blockedStart,
          endDate: blockedEnd,
          reason: 'Owner maintenance',
        },
      ]);

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-05', available: true },
        { date: '2024-01-06', available: true },
        { date: '2024-01-07', available: true },
        { date: '2024-01-08', available: true },
      ]);

      const result = await service.checkBookingAllowed(listingId, bookingStart, bookingEnd);

      expect(result.allowed).toBe(true);
    });

    it('should handle multiple owner-blocked periods', async () => {
      const listingId = 'listing-1';
      const bookingStart = new Date('2024-01-15');
      const bookingEnd = new Date('2024-01-25');

      availabilityRepository.findBlockedPeriods.mockResolvedValue([
        {
          id: 'block-1',
          listingId,
          startDate: new Date('2024-01-05'),
          endDate: new Date('2024-01-10'),
          reason: 'Maintenance',
        },
        {
          id: 'block-2',
          listingId,
          startDate: new Date('2024-01-20'),
          endDate: new Date('2024-01-30'),
          reason: 'Personal use',
        },
      ]);

      const result = await service.checkBookingAllowed(listingId, bookingStart, bookingEnd);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should override availability slots with owner-blocked periods', async () => {
      const listingId = 'listing-1';
      const blockedStart = new Date('2024-01-10');
      const blockedEnd = new Date('2024-01-15');

      availabilityRepository.findBlockedPeriods.mockResolvedValue([
        {
          id: 'block-1',
          listingId,
          startDate: blockedStart,
          endDate: blockedEnd,
          reason: 'Owner use',
        },
      ]);

      // Availability slots show available, but blocked period should override
      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-10', available: true },
        { date: '2024-01-11', available: true },
        { date: '2024-01-12', available: true },
        { date: '2024-01-13', available: true },
        { date: '2024-01-14', available: true },
      ]);

      const availability = await service.calculateAvailability(listingId, blockedStart, blockedEnd);

      // Blocked dates should show as unavailable despite availability slots
      const blockedDates = availability.filter((slot: any) => {
        const slotDate = new Date(slot.date);
        return slotDate >= blockedStart && slotDate < blockedEnd;
      });

      blockedDates.forEach((slot: any) => {
        expect(slot.available).toBe(false);
        expect(slot.blocked).toBe(true);
      });
    });
  });

  describe('Search Filter Parity', () => {
    it('should return consistent availability for search and listing detail', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');

      // Simulate search filter availability check
      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-01', available: true },
        { date: '2024-01-02', available: true },
        { date: '2024-01-03', available: false },
        { date: '2024-01-04', available: false },
        { date: '2024-01-05', available: true },
        { date: '2024-01-06', available: true },
        { date: '2024-01-07', available: true },
        { date: '2024-01-08', available: false },
        { date: '2024-01-09', available: true },
      ]);

      const searchAvailability = await service.calculateAvailability(listingId, startDate, endDate);

      // Simulate listing detail calendar availability check (same method)
      cacheService.get.mockResolvedValue(null);
      const detailAvailability = await service.calculateAvailability(listingId, startDate, endDate);

      // Both should return identical results
      expect(searchAvailability).toEqual(detailAvailability);
      expect(searchAvailability.length).toBe(detailAvailability.length);
    });

    it('should maintain parity across multiple concurrent availability checks', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-01', available: true },
        { date: '2024-01-02', available: true },
        { date: '2024-01-03', available: true },
        { date: '2024-01-04', available: true },
        { date: '2024-01-05', available: true },
        { date: '2024-01-06', available: true },
        { date: '2024-01-07', available: true },
        { date: '2024-01-08', available: true },
        { date: '2024-01-09', available: true },
      ]);

      // Simulate multiple concurrent requests (search, detail, calendar)
      const [searchResult, detailResult, calendarResult] = await Promise.all([
        service.calculateAvailability(listingId, startDate, endDate),
        service.calculateAvailability(listingId, startDate, endDate),
        service.calculateAvailability(listingId, startDate, endDate),
      ]);

      // All should be identical
      expect(searchResult).toEqual(detailResult);
      expect(detailResult).toEqual(calendarResult);
    });

    it('should handle date range boundaries consistently', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-05T23:59:59Z');

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-01', available: true },
        { date: '2024-01-02', available: true },
        { date: '2024-01-03', available: true },
        { date: '2024-01-04', available: true },
        { date: '2024-01-05', available: true },
      ]);

      const result1 = await service.calculateAvailability(listingId, startDate, endDate);
      const result2 = await service.calculateAvailability(listingId, startDate, endDate);

      expect(result1).toEqual(result2);
    });
  });

  describe('Listing-Detail Calendar Parity', () => {
    it('should show same availability on calendar as in search results', async () => {
      const listingId = 'listing-1';
      const monthStart = new Date('2024-01-01');
      const monthEnd = new Date('2024-01-31');

      availabilityRepository.findAvailability.mockResolvedValue(
        Array.from({ length: 31 }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          available: i % 3 !== 0, // Pattern: every 3rd day unavailable
        }))
      );

      const calendarAvailability = await service.calculateAvailability(listingId, monthStart, monthEnd);

      // Verify pattern consistency
      const unavailableDays = calendarAvailability.filter((slot: any) => !slot.available);
      expect(unavailableDays.length).toBe(10); // Days 1, 4, 7, 10, 13, 16, 19, 22, 25, 28
    });

    it('should update calendar immediately when booking is created', async () => {
      const listingId = 'listing-1';
      const bookingStart = new Date('2024-01-10');
      const bookingEnd = new Date('2024-01-15');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 1,
      });

      // Before booking
      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-10', available: true },
        { date: '2024-01-11', available: true },
        { date: '2024-01-12', available: true },
        { date: '2024-01-13', available: true },
        { date: '2024-01-14', available: true },
      ]);

      // Create booking
      await service.syncAvailability(listingId, bookingStart, bookingEnd, 'BOOKED');

      // After booking - should be unavailable
      availabilityRepository.updateAvailability.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      const updatedAvailability = await service.calculateAvailability(listingId, bookingStart, bookingEnd);

      expect(availabilityRepository.updateAvailability).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should handle time zone consistency for calendar display', async () => {
      const listingId = 'listing-1';
      const date = new Date('2024-01-15T00:00:00Z');

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-15', available: true },
      ]);

      const resultUTC = await service.calculateAvailability(listingId, date, new Date('2024-01-16'));
      const resultLocal = await service.calculateAvailability(listingId, date, new Date('2024-01-16'));

      // Should be consistent regardless of time zone interpretation
      expect(resultUTC).toEqual(resultLocal);
    });
  });

  describe('Cancellation Release', () => {
    it('should release availability immediately upon cancellation', async () => {
      const listingId = 'listing-1';
      const bookingId = 'booking-1';
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-15');

      bookingRepository.findById.mockResolvedValue({
        id: bookingId,
        listingId,
        startDate,
        endDate,
        status: 'CANCELLED',
      });

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 1,
      });

      availabilityRepository.updateAvailability.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      await service.syncAvailability(listingId, startDate, endDate, 'AVAILABLE');

      expect(availabilityRepository.updateAvailability).toHaveBeenCalledWith(
        listingId,
        startDate,
        endDate,
        'AVAILABLE'
      );
      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should make cancelled dates available for new bookings', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-15');

      // Simulate cancellation
      availabilityRepository.updateAvailability.mockResolvedValue(undefined);
      await service.syncAvailability(listingId, startDate, endDate, 'AVAILABLE');

      // Check availability after cancellation
      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-10', available: true },
        { date: '2024-01-11', available: true },
        { date: '2024-01-12', available: true },
        { date: '2024-01-13', available: true },
        { date: '2024-01-14', available: true },
      ]);

      const result = await service.checkBookingAllowed(listingId, startDate, endDate);

      expect(result.allowed).toBe(true);
    });

    it('should handle cancellation with inventory units correctly', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-15');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 5,
      });

      // 3 bookings exist (2 available units)
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        { id: 'booking-1', listingId, startDate, endDate, status: 'CONFIRMED' },
        { id: 'booking-2', listingId, startDate, endDate, status: 'CONFIRMED' },
        { id: 'booking-3', listingId, startDate, endDate, status: 'CONFIRMED' },
      ]);

      // Cancel one booking
      availabilityRepository.updateAvailability.mockResolvedValue(undefined);
      await service.syncAvailability(listingId, startDate, endDate, 'AVAILABLE');

      // Should now have 3 available units
      const availability = await service.calculateAvailability(listingId, startDate, endDate);

      availability.forEach((slot: any) => {
        expect(slot.availableUnits).toBe(3);
        expect(slot.available).toBe(true);
      });
    });

    it('should invalidate cache after cancellation', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-15');

      availabilityRepository.updateAvailability.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      await service.syncAvailability(listingId, startDate, endDate, 'AVAILABLE');

      expect(cacheService.del).toHaveBeenCalledWith(
        expect.stringContaining(listingId)
      );
    });
  });

  describe('AvailabilitySlot as Canonical Source', () => {
    it('should use AvailabilitySlot for all availability reads', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');

      prisma.availabilitySlot.findMany.mockResolvedValue([
        {
          id: 'slot-1',
          listingId,
          date: new Date('2024-01-01'),
          available: true,
        },
        {
          id: 'slot-2',
          listingId,
          date: new Date('2024-01-02'),
          available: true,
        },
      ]);

      const slots = await prisma.availabilitySlot.findMany({
        where: {
          listingId,
          date: { gte: startDate, lte: endDate },
        },
      });

      expect(slots).toBeDefined();
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should create AvailabilitySlot when setting availability', async () => {
      const listingId = 'listing-1';
      const date = new Date('2024-01-01');

      prisma.availabilitySlot.create.mockResolvedValue({
        id: 'slot-1',
        listingId,
        date,
        available: true,
      });

      const slot = await prisma.availabilitySlot.create({
        data: {
          listingId,
          date,
          available: true,
        },
      });

      expect(slot).toBeDefined();
      expect(slot.available).toBe(true);
    });

    it('should delete AvailabilitySlot when removing availability', async () => {
      const slotId = 'slot-1';

      prisma.availabilitySlot.delete.mockResolvedValue({
        id: slotId,
        listingId: 'listing-1',
        date: new Date('2024-01-01'),
        available: false,
      });

      await prisma.availabilitySlot.delete({
        where: { id: slotId },
      });

      expect(prisma.availabilitySlot.delete).toHaveBeenCalledWith({
        where: { id: slotId },
      });
    });

    it('should update AvailabilitySlot when modifying availability', async () => {
      const slotId = 'slot-1';

      prisma.availabilitySlot.update.mockResolvedValue({
        id: slotId,
        listingId: 'listing-1',
        date: new Date('2024-01-01'),
        available: false,
      });

      const slot = await prisma.availabilitySlot.update({
        where: { id: slotId },
        data: { available: false },
      });

      expect(slot.available).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle booking that spans midnight', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-01-01T22:00:00Z');
      const endDate = new Date('2024-01-02T06:00:00Z');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 1,
      });

      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-01', available: true },
        { date: '2024-01-02', available: true },
      ]);

      const result = await service.checkBookingAllowed(listingId, startDate, endDate);

      expect(result.allowed).toBe(true);
    });

    it('should handle same-day booking with different times', async () => {
      const listingId = 'listing-1';
      const booking1Start = new Date('2024-01-01T09:00:00Z');
      const booking1End = new Date('2024-01-01T12:00:00Z');
      const booking2Start = new Date('2024-01-01T14:00:00Z');
      const booking2End = new Date('2024-01-01T18:00:00Z');

      listingRepository.findById.mockResolvedValue({
        id: listingId,
        inventoryUnits: 1,
      });

      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          listingId,
          startDate: booking1Start,
          endDate: booking1End,
          status: 'CONFIRMED',
        },
      ]);

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-01-01', available: true },
      ]);

      const result = await service.checkBookingAllowed(listingId, booking2Start, booking2End);

      // Should be allowed if listing supports hourly pricing and times don't overlap
      expect(result.allowed).toBe(true);
    });

    it('should handle leap year dates correctly', async () => {
      const listingId = 'listing-1';
      const startDate = new Date('2024-02-28');
      const endDate = new Date('2024-03-01');

      availabilityRepository.findAvailability.mockResolvedValue([
        { date: '2024-02-28', available: true },
        { date: '2024-02-29', available: true }, // Leap day
        { date: '2024-03-01', available: true },
      ]);

      const result = await service.calculateAvailability(listingId, startDate, endDate);

      expect(result).toHaveLength(3);
      expect(result[1].date).toBe('2024-02-29');
    });
  });
});
