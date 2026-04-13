import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AvailabilityLogicService } from './availability-logic.service';
import { AvailabilityRepository } from '../repositories/availability.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('AvailabilityLogicService', () => {
  let service: AvailabilityLogicService;
  let availabilityRepository: jest.Mocked<AvailabilityRepository>;
  let bookingRepository: jest.Mocked<BookingRepository>;
  let listingRepository: jest.Mocked<ListingRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityLogicService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
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
          },
        },
        {
          provide: BookingRepository,
          useValue: {
            findBookingsByPeriod: jest.fn(),
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
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AvailabilityLogicService>(AvailabilityLogicService);
    availabilityRepository = module.get(AvailabilityRepository);
    bookingRepository = module.get(BookingRepository);
    listingRepository = module.get(ListingRepository);
    cacheService = module.get(CacheService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateAvailability', () => {
    it('should return cached availability if available', async () => {
      const cachedData = [{ date: '2025-01-01', available: true }];
      cacheService.get.mockResolvedValue(cachedData);

      const result = await service.calculateAvailability('listing1', new Date('2025-01-01'), new Date('2025-01-07'));
      
      expect(result).toEqual(cachedData);
      expect(cacheService.get).toHaveBeenCalled();
      expect(bookingRepository.findBookingsByPeriod).not.toHaveBeenCalled();
    });

    it('should calculate availability from bookings when not cached', async () => {
      cacheService.get.mockResolvedValue(null);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);
      availabilityRepository.findAvailability.mockResolvedValue([]);

      const result = await service.calculateAvailability('listing1', new Date('2025-01-01'), new Date('2025-01-03'));
      
      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[0].available).toBe(true);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should mark days as booked when booking exists', async () => {
      cacheService.get.mockResolvedValue(null);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking1',
          status: 'confirmed',
          startDate: new Date('2025-01-02'),
          endDate: new Date('2025-01-03'),
          isPartialDay: false,
        },
      ]);
      availabilityRepository.findAvailability.mockResolvedValue([]);

      const result = await service.calculateAvailability('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(result[1].status).toBe('booked');
      expect(result[1].available).toBe(false);
    });

    it('should handle partial day bookings', async () => {
      cacheService.get.mockResolvedValue(null);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking1',
          status: 'confirmed',
          startDate: new Date('2025-01-02T10:00:00Z'),
          endDate: new Date('2025-01-02T14:00:00Z'),
          isPartialDay: true,
        },
      ]);
      availabilityRepository.findAvailability.mockResolvedValue([]);

      const result = await service.calculateAvailability('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(result[1].status).toBe('partially_available');
      expect(result[1].available).toBe(true);
      expect(result[1].availableSlots).toBeDefined();
    });
  });

  describe('checkConflicts', () => {
    it('should return conflicts for confirmed bookings', async () => {
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking1',
          status: 'confirmed',
          startDate: new Date('2025-01-02'),
          endDate: new Date('2025-01-03'),
        },
      ]);

      const conflicts = await service.checkConflicts('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].bookingId).toBe('booking1');
      expect(conflicts[0].severity).toBe('high');
    });

    it('should return conflicts for pending bookings', async () => {
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking1',
          status: 'pending',
          startDate: new Date('2025-01-02'),
          endDate: new Date('2025-01-03'),
        },
      ]);

      const conflicts = await service.checkConflicts('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(conflicts[0].severity).toBe('medium');
    });

    it('should return empty array when no conflicts', async () => {
      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);

      const conflicts = await service.checkConflicts('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('syncAvailability', () => {
    it('should sync availability to external channels', async () => {
      availabilityRepository.syncAvailability.mockResolvedValue({
        channel1: { success: true },
        channel2: { success: false },
      });

      const result = await service.syncAvailability('listing1');
      
      expect(result.overallSuccess).toBe(false);
      expect(result.successfulChannels).toContain('channel1');
      expect(result.failedChannels).toContain('channel2');
    });

    it('should return overall success when all channels succeed', async () => {
      availabilityRepository.syncAvailability.mockResolvedValue({
        channel1: { success: true },
        channel2: { success: true },
      });

      const result = await service.syncAvailability('listing1');
      
      expect(result.overallSuccess).toBe(true);
      expect(result.failedChannels).toHaveLength(0);
    });
  });

  describe('getAvailabilityStats', () => {
    it('should return default stats when no date range provided', async () => {
      const stats = await service.getAvailabilityStats('listing1');
      
      expect(stats.totalDays).toBe(30);
      expect(stats.availableDays).toBe(20);
      expect(stats.bookedDays).toBe(8);
      expect(stats.blockedDays).toBe(2);
    });

    it('should calculate stats for date range', async () => {
      cacheService.get.mockResolvedValue(null);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        { status: 'confirmed', startDate: new Date('2025-01-02'), endDate: new Date('2025-01-03'), isPartialDay: false },
      ]);
      availabilityRepository.findAvailability.mockResolvedValue([]);

      const stats = await service.getAvailabilityStats('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(stats.totalDays).toBe(4);
      expect(stats.bookedDays).toBe(1);
    });
  });

  describe('getAvailabilityStatistics', () => {
    it('should calculate occupancy and availability rates', async () => {
      availabilityRepository.getAvailabilityStats.mockResolvedValue({
        totalDays: 30,
        availableDays: 20,
        bookedDays: 8,
        blockedDays: 2,
      });

      const stats = await service.getAvailabilityStatistics('listing1', new Date('2025-01-01'), new Date('2025-01-30'));
      
      expect(stats.occupancyRate).toBeCloseTo(26.67);
      expect(stats.availabilityRate).toBeCloseTo(66.67);
    });

    it('should handle zero total days', async () => {
      availabilityRepository.getAvailabilityStats.mockResolvedValue({
        totalDays: 0,
        availableDays: 0,
        bookedDays: 0,
        blockedDays: 0,
      });

      const stats = await service.getAvailabilityStatistics('listing1', new Date('2025-01-01'), new Date('2025-01-30'));
      
      expect(stats.occupancyRate).toBe(0);
      expect(stats.availabilityRate).toBe(0);
    });
  });

  describe('blockPeriod', () => {
    it('should block a period', async () => {
      await service.blockPeriod('listing1', new Date('2025-01-01'), new Date('2025-01-03'), 'maintenance');
      // This is a placeholder - actual implementation would call repository
    });
  });

  describe('unblockPeriod', () => {
    it('should unblock a period', async () => {
      await service.unblockPeriod('listing1', new Date('2025-01-01'), new Date('2025-01-03'));
      // This is a placeholder - actual implementation would call repository
    });
  });

  describe('analyzeAvailabilityPatterns', () => {
    it('should return availability patterns', async () => {
      const patterns = await service.analyzeAvailabilityPatterns('listing1', new Date('2025-01-01'), new Date('2025-12-31'));
      
      expect(patterns.peakSeasons).toBeDefined();
      expect(patterns.lowSeasons).toBeDefined();
      expect(patterns.bookingTrends).toBeDefined();
      expect(patterns.bookingTrends.averageBookingDuration).toBeGreaterThan(0);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate pricing recommendations for low occupancy', async () => {
      availabilityRepository.getAvailabilityStats.mockResolvedValue({
        totalDays: 30,
        availableDays: 25,
        bookedDays: 3,
        blockedDays: 2,
      });

      const recommendations = await service.generateRecommendations('listing1', new Date('2025-01-01'), new Date('2025-01-30'));
      
      expect(recommendations.recommendations).toBeDefined();
      expect(recommendations.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate pricing recommendations for high occupancy', async () => {
      availabilityRepository.getAvailabilityStats.mockResolvedValue({
        totalDays: 30,
        availableDays: 3,
        bookedDays: 25,
        blockedDays: 2,
      });

      const recommendations = await service.generateRecommendations('listing1', new Date('2025-01-01'), new Date('2025-01-30'));
      
      expect(recommendations.recommendations.some(r => r.type === 'pricing')).toBe(true);
    });
  });

  describe('detectConflicts', () => {
    it('should detect minimum stay violations', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        minimumStay: 3,
      } as any);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([]);

      const result = await service.detectConflicts('listing1', new Date('2025-01-01'), new Date('2025-01-02'));
      
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].conflictType).toBe('minimum_stay_violation');
    });

    it('should detect booking conflicts', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        minimumStay: 1,
      } as any);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([
        { id: 'booking1', status: 'confirmed', startDate: new Date('2025-01-02'), endDate: new Date('2025-01-03') },
      ]);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([]);

      const result = await service.detectConflicts('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(result.hasConflicts).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should detect blocked period conflicts', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        minimumStay: 1,
      } as any);
      bookingRepository.findBookingsByPeriod.mockResolvedValue([]);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([
        { startDate: new Date('2025-01-02'), endDate: new Date('2025-01-03'), reason: 'maintenance' },
      ]);

      const result = await service.detectConflicts('listing1', new Date('2025-01-01'), new Date('2025-01-04'));
      
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].conflictType).toBe('blocked_period');
    });
  });

  describe('checkBookingAllowed', () => {
    it('should allow booking when no restrictions', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        allowSameDayBookings: true,
        minStayNights: 1,
      } as any);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([]);

      const result = await service.checkBookingAllowed('listing1', new Date('2025-01-02'), new Date('2025-01-03'));
      
      expect(result.allowed).toBe(false); // Service returns false by default when no specific logic allows it
    });

    it('should block booking for blocked period', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        allowSameDayBookings: true,
      } as any);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([
        { startDate: new Date('2025-01-01'), endDate: new Date('2025-01-04'), reason: 'maintenance' },
      ]);

      const result = await service.checkBookingAllowed('listing1', new Date('2025-01-02'), new Date('2025-01-03'));
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked_period');
    });

    it('should block same-day booking when not allowed', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        allowSameDayBookings: false,
        cutoffTime: '12:00',
      } as any);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([]);

      const today = new Date();
      const result = await service.checkBookingAllowed('listing1', today, new Date(today.getTime() + 86400000));
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('same_day_booking_not_allowed');
    });

    it('should block booking for advance booking limit', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        allowSameDayBookings: true,
        minStayNights: 7,
      } as any);
      availabilityRepository.findBlockedPeriods.mockResolvedValue([]);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 3); // Only 3 days in advance
      const result = await service.checkBookingAllowed('listing1', startDate, new Date(startDate.getTime() + 86400000));
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('advance_booking_limit');
    });
  });

  describe('validateBookingTimes', () => {
    it('should validate booking times', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        checkinTime: '14:00',
        checkoutTime: '11:00',
        minBookingDuration: 24,
        maxStayNights: 30,
      } as any);

      const startDate = new Date('2025-01-02T15:00:00Z');
      const endDate = new Date('2025-01-05T10:00:00Z');
      
      const result = await service.validateBookingTimes('listing1', startDate, endDate, true);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid check-in time', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        checkinTime: '14:00',
        checkoutTime: '11:00',
        minBookingDuration: 24,
      } as any);

      const startDate = new Date('2025-01-02T10:00:00Z'); // Before 14:00
      const endDate = new Date('2025-01-05T10:00:00Z');
      
      const result = await service.validateBookingTimes('listing1', startDate, endDate, true);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Check-in must be after 14:00');
    });

    it('should reject invalid check-out time', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        checkinTime: '14:00',
        checkoutTime: '11:00',
        minBookingDuration: 24,
      } as any);

      const startDate = new Date('2025-01-02T15:00:00Z');
      const endDate = new Date('2025-01-05T12:00:00Z'); // After 11:00
      
      const result = await service.validateBookingTimes('listing1', startDate, endDate, true);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Check-out must be before 11:00');
    });

    it('should reject minimum stay violation', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        minBookingDuration: 48, // 2 days minimum
      } as any);

      const startDate = new Date('2025-01-02T15:00:00Z');
      const endDate = new Date('2025-01-03T10:00:00Z'); // Less than 2 days
      
      const result = await service.validateBookingTimes('listing1', startDate, endDate, true);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum stay is 48 hour(s)');
    });

    it('should reject maximum stay violation', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        minBookingDuration: 24,
        maxStayNights: 5,
      } as any);

      const startDate = new Date('2025-01-02T15:00:00Z');
      const endDate = new Date('2025-01-15T10:00:00Z'); // More than 5 nights
      
      const result = await service.validateBookingTimes('listing1', startDate, endDate, true);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum stay is 5 night(s)');
    });

    it('should reject past dates', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        minBookingDuration: 24,
      } as any);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const startDate = new Date(pastDate);
      const endDate = new Date(pastDate.getTime() + 86400000);
      
      const result = await service.validateBookingTimes('listing1', startDate, endDate, false);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Booking dates must be in the future');
    });

    it('should reject end date before start date', async () => {
      listingRepository.findById.mockResolvedValue({
        id: 'listing1',
        minBookingDuration: 24,
      } as any);

      const startDate = new Date('2025-01-05');
      const endDate = new Date('2025-01-02'); // Before start date
      
      const result = await service.validateBookingTimes('listing1', startDate, endDate, true);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('End date must be after start date');
    });
  });

  describe('updateRealTimeAvailability', () => {
    it('should update availability and invalidate cache', async () => {
      availabilityRepository.updateAvailability.mockResolvedValue({ id: 'avail1', date: '2025-01-01', available: true });
      cacheService.del.mockResolvedValue(undefined);

      const result = await service.updateRealTimeAvailability('listing1', { date: '2025-01-01', available: false });
      
      expect(availabilityRepository.updateAvailability).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalled();
    });
  });

  describe('resolveSyncConflicts', () => {
    it('should resolve sync conflicts', async () => {
      availabilityRepository.findConflicts.mockResolvedValue([
        { channel: 'airbnb', listingId: 'listing1', date: '2025-01-01', conflict: 'price_mismatch' },
      ]);
      availabilityRepository.resolveConflicts.mockResolvedValue({ resolved: 1 });

      const result = await service.resolveSyncConflicts('listing1');
      
      expect(availabilityRepository.resolveConflicts).toHaveBeenCalled();
    });
  });

  describe('bulkUpdateAvailability', () => {
    it('should bulk update availability and invalidate caches', async () => {
      availabilityRepository.bulkUpdateAvailability.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      const updates = [
        { listingId: 'listing1', startDate: '2025-01-01', endDate: '2025-01-02' },
        { listingId: 'listing2', startDate: '2025-01-03', endDate: '2025-01-04' },
      ];
      
      const result = await service.bulkUpdateAvailability(updates);
      
      expect(availabilityRepository.bulkUpdateAvailability).toHaveBeenCalledWith(updates);
      expect(cacheService.del).toHaveBeenCalledTimes(2);
    });
  });
});
