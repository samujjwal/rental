import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityLogicService } from './availability-logic.service';
import { AvailabilityRepository } from '../repositories/availability.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { CacheService } from '../../cache/services/cache.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AVAILABILITY LOGIC TESTS
 * 
 * These tests validate availability calculation and management:
 * - Availability calculation algorithms
 * - Conflict detection and resolution
 * - Blocking rules and constraints
 * - Availability synchronization
 * - Performance optimization
 * - Real-time availability updates
 * - Availability caching strategies
 * - Availability reporting and analytics
 * 
 * Business Truth Validated:
 * - Availability is calculated accurately across time periods
 * - Conflicts are detected and resolved properly
 * - Blocking rules prevent invalid bookings
 * - Availability syncs across all systems
 * - Performance is optimized for high-load scenarios
 * - Real-time updates maintain data consistency
 */

describe('AvailabilityLogicService', () => {
  let availabilityLogicService: AvailabilityLogicService;
  let availabilityRepository: AvailabilityRepository;
  let bookingRepository: BookingRepository;
  let listingRepository: ListingRepository;
  let cacheService: CacheService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityLogicService,
        {
          provide: AvailabilityRepository,
          useValue: {
            findAvailability: jest.fn(),
            createAvailability: jest.fn(),
            updateAvailability: jest.fn(),
            deleteAvailability: jest.fn(),
            findConflicts: jest.fn(),
            findBlockedPeriods: jest.fn(),
            syncAvailability: jest.fn(),
            getAvailabilityStats: jest.fn(),
            bulkUpdateAvailability: jest.fn(),
            findAvailabilityByListing: jest.fn(),
            createBlockedPeriod: jest.fn(),
            removeBlockedPeriod: jest.fn(),
          },
        },
        {
          provide: BookingRepository,
          useValue: {
            findBookingsByListing: jest.fn(),
            findBookingsByPeriod: jest.fn(),
            findConfirmedBookings: jest.fn(),
            findPendingBookings: jest.fn(),
            countBookingsByListing: jest.fn(),
          },
        },
        {
          provide: ListingRepository,
          useValue: {
            findById: jest.fn(),
            findActiveListings: jest.fn(),
            updateListingStatus: jest.fn(),
            getListingsByCategory: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            flush: jest.fn(),
            getMultiple: jest.fn(),
            setMultiple: jest.fn(),
            invalidatePattern: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    availabilityLogicService = module.get<AvailabilityLogicService>(AvailabilityLogicService);
    availabilityRepository = module.get<AvailabilityRepository>(AvailabilityRepository);
    bookingRepository = module.get<BookingRepository>(BookingRepository);
    listingRepository = module.get<ListingRepository>(ListingRepository);
    cacheService = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Availability Calculation', () => {
    it('should calculate availability for a simple time period', async () => {
      // Arrange
      const listingId = 'listing-123';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-07');
      
      const existingBookings = [
        {
          id: 'booking-1',
          listingId,
          startDate: new Date('2024-06-03'),
          endDate: new Date('2024-06-05'),
          status: 'confirmed',
        },
      ];

      const expectedAvailability = [
        { date: '2024-06-01', available: true, status: 'available' },
        { date: '2024-06-02', available: true, status: 'available' },
        { date: '2024-06-03', available: false, status: 'booked', bookingId: 'booking-1' },
        { date: '2024-06-04', available: false, status: 'booked', bookingId: 'booking-1' },
        { date: '2024-06-05', available: false, status: 'booked', bookingId: 'booking-1' },
        { date: '2024-06-06', available: true, status: 'available' },
        { date: '2024-06-07', available: true, status: 'available' },
      ];

      bookingRepository.findBookingsByPeriod.mockResolvedValue(existingBookings);
      availabilityRepository.findAvailability.mockResolvedValue(expectedAvailability);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await availabilityLogicService.calculateAvailability(listingId, startDate, endDate);

      // Assert
      expect(result).toHaveLength(7);
      expect(result[0].available).toBe(true);
      expect(result[2].available).toBe(false);
      expect(result[2].status).toBe('booked');
      expect(result[2].bookingId).toBe('booking-1');
      expect(bookingRepository.findBookingsByPeriod).toHaveBeenCalledWith(listingId, startDate, endDate);
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('availability:'),
        expectedAvailability,
        expect.any(Number)
      );
    });

    it('should calculate availability with multiple overlapping bookings', async () => {
      // Arrange
      const listingId = 'listing-456';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-10');
      
      const overlappingBookings = [
        {
          id: 'booking-1',
          listingId,
          startDate: new Date('2024-06-02'),
          endDate: new Date('2024-06-04'),
          status: 'confirmed',
        },
        {
          id: 'booking-2',
          listingId,
          startDate: new Date('2024-06-05'),
          endDate: new Date('2024-06-07'),
          status: 'confirmed',
        },
        {
          id: 'booking-3',
          listingId,
          startDate: new Date('2024-06-08'),
          endDate: new Date('2024-06-09'),
          status: 'pending',
        },
      ];

      bookingRepository.findBookingsByPeriod.mockResolvedValue(overlappingBookings);

      // Act
      const result = await availabilityLogicService.calculateAvailability(listingId, startDate, endDate);

      // Assert
      expect(result).toHaveLength(10);
      
      // Check booked periods
      const bookedDays = result.filter(day => !day.available);
      expect(bookedDays).toHaveLength(6); // 3 days + 3 days + 2 days
      
      // Check pending bookings are marked differently
      const pendingDays = result.filter(day => day.status === 'pending');
      expect(pendingDays).toHaveLength(2);
      
      // Check available days
      const availableDays = result.filter(day => day.available);
      expect(availableDays).toHaveLength(4);
    });

    it('should handle partial day availability', async () => {
      // Arrange
      const listingId = 'listing-789';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-02');
      
      const partialDayBooking = {
        id: 'booking-partial',
        listingId,
        startDate: new Date('2024-06-01T14:00:00Z'),
        endDate: new Date('2024-06-01T18:00:00Z'),
        status: 'confirmed',
        isPartialDay: true,
      };

      bookingRepository.findBookingsByPeriod.mockResolvedValue([partialDayBooking]);

      // Act
      const result = await availabilityLogicService.calculateAvailability(listingId, startDate, endDate);

      // Assert
      expect(result).toHaveLength(2);
      
      // Should show partial availability for June 1st
      const june1 = result.find(day => day.date === '2024-06-01');
      expect(june1?.available).toBe(true);
      expect(june1?.status).toBe('partially_available');
      expect(june1?.availableSlots).toContain('morning');
      expect(june1?.availableSlots).toContain('evening');
      expect(june1?.availableSlots).not.toContain('afternoon');
    });

    it('should calculate availability for multiple listings', async () => {
      // Arrange
      const listingIds = ['listing-1', 'listing-2', 'listing-3'];
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-03');
      
      const listingsData = [
        { id: 'listing-1', title: 'Property 1', isActive: true },
        { id: 'listing-2', title: 'Property 2', isActive: true },
        { id: 'listing-3', title: 'Property 3', isActive: false }, // Inactive
      ];

      const availabilityData = {
        'listing-1': [
          { date: '2024-06-01', available: true, status: 'available' },
          { date: '2024-06-02', available: false, status: 'booked' },
          { date: '2024-06-03', available: true, status: 'available' },
        ],
        'listing-2': [
          { date: '2024-06-01', available: true, status: 'available' },
          { date: '2024-06-02', available: true, status: 'available' },
          { date: '2024-06-03', available: true, status: 'available' },
        ],
        'listing-3': [], // Inactive listing
      };

      listingRepository.findActiveListings.mockResolvedValue(listingsData.filter(l => l.isActive));
      availabilityRepository.findAvailabilityByListing.mockResolvedValue(availabilityData);

      // Act
      const result = await availabilityLogicService.calculateMultipleAvailability(listingIds, startDate, endDate);

      // Assert
      expect(Object.keys(result)).toHaveLength(2); // Only active listings
      expect(result['listing-1']).toHaveLength(3);
      expect(result['listing-2']).toHaveLength(3);
      expect(result['listing-3']).toBeUndefined();
    });

    it('should handle availability calculation with caching', async () => {
      // Arrange
      const listingId = 'listing-cached';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-05');
      const cacheKey = `availability:${listingId}:${startDate.getTime()}:${endDate.getTime()}`;
      
      const cachedAvailability = [
        { date: '2024-06-01', available: true, status: 'available' },
        { date: '2024-06-02', available: true, status: 'available' },
        { date: '2024-06-03', available: false, status: 'booked' },
        { date: '2024-06-04', available: true, status: 'available' },
        { date: '2024-06-05', available: true, status: 'available' },
      ];

      cacheService.get.mockResolvedValue(cachedAvailability);

      // Act
      const result = await availabilityLogicService.calculateAvailability(listingId, startDate, endDate);

      // Assert
      expect(result).toEqual(cachedAvailability);
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(bookingRepository.findBookingsByPeriod).not.toHaveBeenCalled(); // Should use cache
    });
  });

  describe('Conflict Detection', () => {
    it('should detect direct booking conflicts', async () => {
      // Arrange
      const listingId = 'listing-conflict';
      const newBooking = {
        startDate: new Date('2024-06-05'),
        endDate: new Date('2024-06-08'),
      };

      const existingBookings = [
        {
          id: 'booking-1',
          startDate: new Date('2024-06-03'),
          endDate: new Date('2024-06-07'),
          status: 'confirmed',
        },
      ];

      bookingRepository.findBookingsByPeriod.mockResolvedValue(existingBookings);

      // Act
      const result = await availabilityLogicService.detectConflicts(listingId, newBooking.startDate, newBooking.endDate);

      // Assert
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].bookingId).toBe('booking-1');
      expect(result.conflicts[0].conflictType).toBe('overlap');
      expect(result.conflicts[0].conflictDays).toContain('2024-06-05');
      expect(result.conflicts[0].conflictDays).toContain('2024-06-06');
      expect(result.conflicts[0].conflictDays).toContain('2024-06-07');
    });

    it('should detect multiple conflicts with different bookings', async () => {
      // Arrange
      const listingId = 'listing-multi-conflict';
      const newBooking = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
      };

      const existingBookings = [
        {
          id: 'booking-1',
          startDate: new Date('2024-06-02'),
          endDate: new Date('2024-06-04'),
          status: 'confirmed',
        },
        {
          id: 'booking-2',
          startDate: new Date('2024-06-08'),
          endDate: new Date('2024-06-10'),
          status: 'confirmed',
        },
        {
          id: 'booking-3',
          startDate: new Date('2024-06-12'),
          endDate: new Date('2024-06-14'),
          status: 'pending',
        },
      ];

      bookingRepository.findBookingsByPeriod.mockResolvedValue(existingBookings);

      // Act
      const result = await availabilityLogicService.detectConflicts(listingId, newBooking.startDate, newBooking.endDate);

      // Assert
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(3);
      
      // Check conflict types
      const confirmedConflicts = result.conflicts.filter(c => c.conflictType === 'confirmed_overlap');
      const pendingConflicts = result.conflicts.filter(c => c.conflictType === 'pending_overlap');
      
      expect(confirmedConflicts).toHaveLength(2);
      expect(pendingConflicts).toHaveLength(1);
    });

    it('should detect edge conflicts (adjacent bookings)', async () => {
      // Arrange
      const listingId = 'listing-edge-conflict';
      const newBooking = {
        startDate: new Date('2024-06-05'),
        endDate: new Date('2024-06-07'),
      };

      const adjacentBookings = [
        {
          id: 'booking-1',
          startDate: new Date('2024-06-03'),
          endDate: new Date('2024-06-05'), // Ends on same day
          status: 'confirmed',
        },
        {
          id: 'booking-2',
          startDate: new Date('2024-06-07'),
          endDate: new Date('2024-06-09'), // Starts on same day
          status: 'confirmed',
        },
      ];

      bookingRepository.findBookingsByPeriod.mockResolvedValue(adjacentBookings);

      // Act
      const result = await availabilityLogicService.detectConflicts(listingId, newBooking.startDate, newBooking.endDate);

      // Assert
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(2);
      
      // Check edge conflict detection
      const edgeConflicts = result.conflicts.filter(c => c.conflictType === 'edge_conflict');
      expect(edgeConflicts).toHaveLength(2);
    });

    it('should detect conflicts with blocked periods', async () => {
      // Arrange
      const listingId = 'listing-blocked';
      const newBooking = {
        startDate: new Date('2024-06-10'),
        endDate: new Date('2024-06-15'),
      };

      const blockedPeriods = [
        {
          id: 'block-1',
          startDate: new Date('2024-06-12'),
          endDate: new Date('2024-06-13'),
          reason: 'maintenance',
          type: 'maintenance',
        },
      ];

      availabilityRepository.findBlockedPeriods.mockResolvedValue(blockedPeriods);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);

      // Act
      const result = await availabilityLogicService.detectConflicts(listingId, newBooking.startDate, newBooking.endDate);

      // Assert
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('blocked_period');
      expect(result.conflicts[0].blockReason).toBe('maintenance');
    });

    it('should return no conflicts for available period', async () => {
      // Arrange
      const listingId = 'listing-available';
      const newBooking = {
        startDate: new Date('2024-06-20'),
        endDate: new Date('2024-06-25'),
      };

      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([]);

      // Act
      const result = await availabilityLogicService.detectConflicts(listingId, newBooking.startDate, newBooking.endDate);

      // Assert
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.availableDays).toHaveLength(6); // 20, 21, 22, 23, 24, 25
    });

    it('should handle conflict detection with minimum stay requirements', async () => {
      // Arrange
      const listingId = 'listing-min-stay';
      const newBooking = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'), // 2 nights
      };

      const listing = {
        id: listingId,
        minimumStay: 3, // 3 nights minimum
      };

      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);
      listingRepository.findById.mockResolvedValue(listing);

      // Act
      const result = await availabilityLogicService.detectConflicts(listingId, newBooking.startDate, newBooking.endDate);

      // Assert
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('minimum_stay_violation');
      expect(result.conflicts[0].requiredMinimumStay).toBe(3);
      expect(result.conflicts[0].requestedStay).toBe(2);
    });
  });

  describe('Blocking Rules', () => {
    it('should create blocked periods for maintenance', async () => {
      // Arrange
      const listingId = 'listing-maintenance';
      const blockData = {
        startDate: new Date('2024-06-10'),
        endDate: new Date('2024-06-12'),
        reason: 'Annual maintenance',
        type: 'maintenance',
        notifyBookers: true,
      };

      const createdBlock = {
        id: 'block-123',
        listingId,
        ...blockData,
        createdAt: new Date(),
      };

      availabilityRepository.createBlockedPeriod.mockResolvedValue(createdBlock);

      // Act
      const result = await availabilityLogicService.createBlockedPeriod(listingId, blockData);

      // Assert
      expect(result.id).toBe('block-123');
      expect(result.reason).toBe('Annual maintenance');
      expect(result.type).toBe('maintenance');
      expect(availabilityRepository.createBlockedPeriod).toHaveBeenCalledWith(listingId, blockData);
    });

    it('should prevent booking during blocked periods', async () => {
      // Arrange
      const listingId = 'listing-blocked-booking';
      const bookingAttempt = {
        startDate: new Date('2024-06-11'),
        endDate: new Date('2024-06-13'),
      };

      const blockedPeriods = [
        {
          id: 'block-1',
          startDate: new Date('2024-06-10'),
          endDate: new Date('2024-06-12'),
          reason: 'maintenance',
          type: 'maintenance',
        },
      ];

      availabilityRepository.findBlockedPeriods.mockResolvedValue(blockedPeriods);

      // Act
      const result = await availabilityLogicService.checkBookingAllowed(listingId, bookingAttempt.startDate, bookingAttempt.endDate);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked_period');
      expect(result.blockDetails).toEqual(blockedPeriods[0]);
    });

    it('should handle seasonal blocking rules', async () => {
      // Arrange
      const listingId = 'listing-seasonal';
      const bookingDate = new Date('2024-12-25'); // Christmas
      
      const listing = {
        id: listingId,
        seasonalRules: [
          {
            season: 'winter_holidays',
            startDate: new Date('2024-12-20'),
            endDate: new Date('2025-01-05'),
            blockNewBookings: true,
            reason: 'Winter holiday season',
          },
        ],
      };

      listingRepository.findById.mockResolvedValue(listing);

      // Act
      const result = await availabilityLogicService.checkBookingAllowed(listingId, bookingDate, bookingDate);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('seasonal_block');
      expect(result.season).toBe('winter_holidays');
    });

    it('should apply advance booking restrictions', async () => {
      // Arrange
      const listingId = 'listing-advance';
      const bookingDate = new Date('2024-12-01'); // 6 months from now
      const currentDate = new Date('2024-06-01');
      
      const listing = {
        id: listingId,
        advanceBookingLimit: 90, // 90 days maximum
      };

      listingRepository.findById.mockResolvedValue(listing);

      // Act
      const result = await availabilityLogicService.checkBookingAllowed(listingId, bookingDate, bookingDate);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('advance_booking_limit');
      expect(result.maxAdvanceDays).toBe(90);
      expect(result.requestedAdvanceDays).toBeGreaterThan(90);
    });

    it('should handle checkout/checkin time restrictions', async () => {
      // Arrange
      const listingId = 'listing-checkin';
      const booking = {
        startDate: new Date('2024-06-01T15:00:00Z'), // 3 PM
        endDate: new Date('2024-06-03T11:00:00Z'), // 11 AM
      };

      const listing = {
        id: listingId,
        checkinTime: '15:00', // 3 PM
        checkoutTime: '11:00', // 11 AM
        minBookingDuration: 24, // 24 hours minimum
      };

      listingRepository.findById.mockResolvedValue(listing);

      // Act
      const result = await availabilityLogicService.validateBookingTimes(listingId, booking.startDate, booking.endDate);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.checkinValid).toBe(true);
      expect(result.checkoutValid).toBe(true);
      expect(result.durationValid).toBe(true);
    });

    it('should block same-day bookings when not allowed', async () => {
      // Arrange
      const listingId = 'listing-no-same-day';
      const currentDate = new Date('2024-06-01T10:00:00Z');
      const bookingDate = new Date('2024-06-01'); // Today
      
      const listing = {
        id: listingId,
        allowSameDayBookings: false,
        cutoffTime: '12:00', // 12 PM cutoff
      };

      listingRepository.findById.mockResolvedValue(listing);

      // Act
      const result = await availabilityLogicService.checkBookingAllowed(listingId, bookingDate, bookingDate);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('same_day_booking_not_allowed');
      expect(result.cutoffTime).toBe('12:00');
    });
  });

  describe('Availability Synchronization', () => {
    it('should sync availability across all channels', async () => {
      // Arrange
      const listingId = 'listing-sync';
      const syncData = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30'),
        channels: ['website', 'airbnb', 'booking.com'],
      };

      const syncResults = {
        website: { success: true, syncedAt: new Date() },
        airbnb: { success: true, syncedAt: new Date(), externalId: 'airbnb-123' },
        'booking.com': { success: false, error: 'API timeout' },
      };

      availabilityRepository.syncAvailability.mockResolvedValue(syncResults);

      // Act
      const result = await availabilityLogicService.syncAvailability(listingId, syncData);

      // Assert
      expect(result.overallSuccess).toBe(false); // One channel failed
      expect(result.channelResults).toEqual(syncResults);
      expect(result.successfulChannels).toHaveLength(2);
      expect(result.failedChannels).toHaveLength(1);
      expect(availabilityRepository.syncAvailability).toHaveBeenCalledWith(listingId, syncData);
    });

    it('should handle real-time availability updates', async () => {
      // Arrange
      const listingId = 'listing-realtime';
      const updateData = {
        date: '2024-06-15',
        status: 'booked',
        bookingId: 'booking-456',
        source: 'website',
      };

      const updatedAvailability = {
        date: '2024-06-15',
        available: false,
        status: 'booked',
        bookingId: 'booking-456',
        lastUpdated: new Date(),
        updatedBy: 'system',
      };

      availabilityRepository.updateAvailability.mockResolvedValue(updatedAvailability);
      cacheService.del.mockResolvedValue(true);

      // Act
      const result = await availabilityLogicService.updateRealTimeAvailability(listingId, updateData);

      // Assert
      expect(result.status).toBe('booked');
      expect(result.bookingId).toBe('booking-456');
      expect(availabilityRepository.updateAvailability).toHaveBeenCalledWith(listingId, updateData);
      expect(cacheService.del).toHaveBeenCalledWith(expect.stringContaining('availability:'));
    });

    it('should resolve sync conflicts between channels', async () => {
      // Arrange
      const listingId = 'listing-conflict-sync';
      const conflicts = [
        {
          date: '2024-06-10',
          website: { available: true, status: 'available' },
          airbnb: { available: false, status: 'booked', bookingId: 'airbnb-789' },
          'booking.com': { available: false, status: 'booked', bookingId: 'bdc-456' },
        },
      ];

      const resolution = {
        date: '2024-06-10',
        resolvedStatus: 'booked',
        resolvedBookingId: 'airbnb-789',
        resolutionRule: 'earliest_booking_wins',
        channelsUpdated: ['website', 'booking.com'],
      };

      availabilityRepository.findConflicts.mockResolvedValue(conflicts);
      availabilityRepository.resolveConflicts.mockResolvedValue(resolution);

      // Act
      const result = await availabilityLogicService.resolveSyncConflicts(listingId);

      // Assert
      expect(result.resolvedStatus).toBe('booked');
      expect(result.resolutionRule).toBe('earliest_booking_wins');
      expect(result.channelsUpdated).toContain('website');
      expect(availabilityRepository.resolveConflicts).toHaveBeenCalledWith(listingId, conflicts);
    });

    it('should handle bulk availability updates', async () => {
      // Arrange
      const bulkUpdates = [
        {
          listingId: 'listing-1',
          date: '2024-06-01',
          status: 'booked',
          bookingId: 'booking-1',
        },
        {
          listingId: 'listing-2',
          date: '2024-06-01',
          status: 'blocked',
          blockReason: 'maintenance',
        },
        {
          listingId: 'listing-3',
          date: '2024-06-01',
          status: 'available',
        },
      ];

      const bulkResults = {
        successful: 2,
        failed: 1,
        results: [
          { success: true, listingId: 'listing-1' },
          { success: true, listingId: 'listing-2' },
          { success: false, listingId: 'listing-3', error: 'Listing not found' },
        ],
      };

      availabilityRepository.bulkUpdateAvailability.mockResolvedValue(bulkResults);

      // Act
      const result = await availabilityLogicService.bulkUpdateAvailability(bulkUpdates);

      // Assert
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(availabilityRepository.bulkUpdateAvailability).toHaveBeenCalledWith(bulkUpdates);
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large date ranges efficiently', async () => {
      // Arrange
      const listingId = 'listing-large-range';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31'); // Full year
      
      configService.get.mockReturnValue(1000); // Cache for 1000 seconds
      
      // Mock performance monitoring
      const startTime = Date.now();
      
      const availabilityData = Array.from({ length: 366 }, (_, i) => ({
        date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
        available: Math.random() > 0.3,
        status: Math.random() > 0.3 ? 'available' : 'booked',
      }));

      availabilityRepository.findAvailability.mockResolvedValue(availabilityData);

      // Act
      const result = await availabilityLogicService.calculateAvailability(listingId, startDate, endDate);

      // Assert
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(result).toHaveLength(366);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('availability:'),
        availabilityData,
        1000
      );
    });

    it('should use caching for frequently accessed availability', async () => {
      // Arrange
      const listingId = 'listing-popular';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-07');
      
      // First call - cache miss
      cacheService.get.mockResolvedValueOnce(null);
      const availabilityData = [
        { date: '2024-06-01', available: true, status: 'available' },
        { date: '2024-06-02', available: true, status: 'available' },
      ];
      availabilityRepository.findAvailability.mockResolvedValue(availabilityData);
      cacheService.set.mockResolvedValue(true);

      // Second call - cache hit
      cacheService.get.mockResolvedValueOnce(availabilityData);

      // Act
      const result1 = await availabilityLogicService.calculateAvailability(listingId, startDate, endDate);
      const result2 = await availabilityLogicService.calculateAvailability(listingId, startDate, endDate);

      // Assert
      expect(result1).toEqual(availabilityData);
      expect(result2).toEqual(availabilityData);
      expect(availabilityRepository.findAvailability).toHaveBeenCalledTimes(1); // Only called once
      expect(cacheService.get).toHaveBeenCalledTimes(2);
      expect(cacheService.set).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent availability requests', async () => {
      // Arrange
      const listingId = 'listing-concurrent';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-05');
      
      const availabilityData = Array.from({ length: 5 }, (_, i) => ({
        date: `2024-06-${String(i + 1).padStart(2, '0')}`,
        available: true,
        status: 'available',
      }));

      availabilityRepository.findAvailability.mockResolvedValue(availabilityData);
      cacheService.get.mockResolvedValue(null);

      // Act - Make concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, () => 
        availabilityLogicService.calculateAvailability(listingId, startDate, endDate)
      );
      
      const results = await Promise.all(concurrentRequests);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toEqual(availabilityData);
      });
      
      // Should handle concurrent requests efficiently
      expect(availabilityRepository.findAvailability).toHaveBeenCalledTimes(10);
    });

    it('should optimize database queries for multiple listings', async () => {
      // Arrange
      const listingIds = ['listing-1', 'listing-2', 'listing-3', 'listing-4', 'listing-5'];
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-03');
      
      const listingsData = listingIds.map(id => ({ id, isActive: true }));
      const availabilityData = listingIds.reduce((acc, id) => {
        acc[id] = Array.from({ length: 3 }, (_, i) => ({
          date: `2024-06-${String(i + 1).padStart(2, '0')}`,
          available: true,
          status: 'available',
        }));
        return acc;
      }, {});

      listingRepository.findActiveListings.mockResolvedValue(listingsData);
      availabilityRepository.findAvailabilityByListing.mockResolvedValue(availabilityData);

      // Act
      const startTime = Date.now();
      const result = await availabilityLogicService.calculateMultipleAvailability(listingIds, startDate, endDate);
      const endTime = Date.now();

      // Assert
      expect(Object.keys(result)).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Should use optimized queries
      expect(listingRepository.findActiveListings).toHaveBeenCalledTimes(1);
      expect(availabilityRepository.findAvailabilityByListing).toHaveBeenCalledTimes(1);
    });
  });

  describe('Availability Analytics', () => {
    it('should generate availability statistics', async () => {
      // Arrange
      const listingId = 'listing-stats';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');
      
      const statsData = {
        totalDays: 30,
        availableDays: 20,
        bookedDays: 8,
        blockedDays: 2,
        occupancyRate: 26.67,
        availabilityRate: 66.67,
        revenuePotential: 300000,
        actualRevenue: 80000,
        averageDailyRate: 10000,
      };

      availabilityRepository.getAvailabilityStats.mockResolvedValue(statsData);

      // Act
      const result = await availabilityLogicService.getAvailabilityStatistics(listingId, startDate, endDate);

      // Assert
      expect(result.totalDays).toBe(30);
      expect(result.availableDays).toBe(20);
      expect(result.occupancyRate).toBe(26.67);
      expect(result.availabilityRate).toBe(66.67);
      expect(availabilityRepository.getAvailabilityStats).toHaveBeenCalledWith(listingId, startDate, endDate);
    });

    it('should identify availability patterns', async () => {
      // Arrange
      const listingId = 'listing-patterns';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const patterns = {
        peakSeasons: [
          { season: 'summer', months: [6, 7, 8], occupancyRate: 85 },
          { season: 'winter_holidays', months: [12, 1], occupancyRate: 75 },
        ],
        lowSeasons: [
          { season: 'monsoon', months: [7, 8], occupancyRate: 45 },
        ],
        bookingTrends: {
          averageBookingDuration: 3.2,
          mostBookedDays: ['friday', 'saturday'],
          leadTimeAverage: 14, // days
        },
      };

      availabilityRepository.getAvailabilityStats.mockResolvedValue(patterns);

      // Act
      const result = await availabilityLogicService.analyzeAvailabilityPatterns(listingId, startDate, endDate);

      // Assert
      expect(result.peakSeasons).toHaveLength(2);
      expect(result.lowSeasons).toHaveLength(1);
      expect(result.bookingTrends.averageBookingDuration).toBe(3.2);
      expect(result.bookingTrends.mostBookedDays).toContain('friday');
    });

    it('should generate availability recommendations', async () => {
      // Arrange
      const listingId = 'listing-recommendations';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');
      
      const analytics = {
        occupancyRate: 45, // Low occupancy
        averageDailyRate: 8000, // Could be higher
        blockedDays: 5, // Many blocked days
        lastMinuteBookings: 20, // High last-minute bookings
      };

      availabilityRepository.getAvailabilityStats.mockResolvedValue(analytics);

      // Act
      const result = await availabilityLogicService.generateRecommendations(listingId, startDate, endDate);

      // Assert
      expect(result.recommendations).toHaveLength.greaterThan(0);
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'pricing',
          action: 'increase_rates',
          reason: expect.stringContaining('low occupancy'),
        })
      );
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'availability',
          action: 'reduce_blocked_periods',
          reason: expect.stringContaining('many blocked days'),
        })
      );
    });
  });
});
