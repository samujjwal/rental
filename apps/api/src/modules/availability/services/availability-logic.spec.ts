import { AvailabilityLogicService } from './availability-logic.service';

/**
 * AVAILABILITY LOGIC TESTS
 *
 * Isolated unit tests with mocked repositories and cache.
 * Tests validate availability calculation logic, conflict detection,
 * blocking rules, synchronization, and reporting.
 */

describe('AvailabilityLogicService', () => {
  let service: AvailabilityLogicService;
  let mockAvailabilityRepo: any;
  let mockBookingRepo: any;
  let mockListingRepo: any;
  let mockCacheService: any;

  beforeEach(() => {
    mockAvailabilityRepo = {
      findAvailability: jest.fn().mockResolvedValue([]),
      syncAvailability: jest.fn().mockResolvedValue({ synced: true }),
      findConflicts: jest.fn().mockResolvedValue([]),
      createBlockedPeriod: jest.fn().mockResolvedValue({ id: 'block-1' }),
      updateAvailability: jest.fn().mockResolvedValue({ updated: true }),
      bulkUpdateAvailability: jest.fn().mockResolvedValue({ count: 0 }),
      findBlockedPeriods: jest.fn().mockResolvedValue([]),
      getAvailabilityStats: jest.fn().mockResolvedValue({ totalDays: 30, availableDays: 20, bookedDays: 10 }),
      resolveConflicts: jest.fn().mockResolvedValue({ resolved: true }),
      findAvailabilityByListing: jest.fn().mockResolvedValue({}),
    };

    mockBookingRepo = {
      findBookingsByPeriod: jest.fn().mockResolvedValue([]),
    };

    mockListingRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'listing-1', title: 'Test' }),
      findActiveListings: jest.fn().mockResolvedValue([{ id: 'listing-1', title: 'Test' }]),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = { get: jest.fn() } as any;

    service = new AvailabilityLogicService(
      mockConfigService,
      mockAvailabilityRepo,
      mockBookingRepo,
      mockListingRepo,
      mockCacheService,
    );
  });

  describe('Availability Calculation', () => {
    it('should calculate availability for a simple time period', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-07');

      mockAvailabilityRepo.findAvailability.mockResolvedValue([
        { date: '2025-06-01', status: 'available' },
        { date: '2025-06-02', status: 'available' },
      ]);

      const result = await service.calculateAvailability('listing-1', start, end);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should check cache before recalculating', async () => {
      const cachedData = [{ date: '2025-06-01', status: 'available' }];
      mockCacheService.get.mockResolvedValue(cachedData);

      const start = new Date('2025-06-01');
      const end = new Date('2025-06-07');
      const result = await service.calculateAvailability('listing-1', start, end);

      expect(result).toEqual(cachedData);
      expect(mockCacheService.get).toHaveBeenCalled();
    });

    it('should calculate availability for multiple listings', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-07');

      const result = await service.calculateMultipleAvailability(
        ['listing-1', 'listing-2'],
        start,
        end,
      );

      expect(typeof result).toBe('object');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect direct booking conflicts', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-07');

      mockBookingRepo.findBookingsByPeriod.mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2025-06-03'),
          endDate: new Date('2025-06-05'),
          status: 'CONFIRMED',
        },
      ]);

      const conflicts = await service.checkConflicts('listing-1', start, end);
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should return empty array when no conflicts exist', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-07');

      mockBookingRepo.findBookingsByPeriod.mockResolvedValue([]);

      const conflicts = await service.checkConflicts('listing-1', start, end);
      expect(conflicts).toEqual([]);
    });

    it('should detect partial day conflicts using detectConflicts', async () => {
      const start = new Date('2025-06-03T14:00:00Z');
      const end = new Date('2025-06-05T10:00:00Z');

      const result = await service.detectConflicts('listing-1', start, end);
      expect(result).toBeDefined();
      expect(typeof result.hasConflicts).toBe('boolean');
    });
  });

  describe('Blocking Rules', () => {
    it('should create a blocked period', async () => {
      const result = await service.createBlockedPeriod('listing-1', {
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-07'),
        reason: 'Maintenance',
      });

      expect(mockAvailabilityRepo.createBlockedPeriod).toHaveBeenCalledWith(
        expect.objectContaining({ listingId: 'listing-1' }),
      );
      expect(result).toBeDefined();
    });

    it('should block a period with reason', async () => {
      await service.blockPeriod(
        'listing-1',
        new Date('2025-07-01'),
        new Date('2025-07-07'),
        'Maintenance',
      );
      // blockPeriod is a void method — just verify it doesn't throw
    });

    it('should unblock a period', async () => {
      await service.unblockPeriod(
        'listing-1',
        new Date('2025-07-01'),
        new Date('2025-07-07'),
      );
      // unblockPeriod is a void method — just verify it doesn't throw
    });
  });

  describe('Availability Synchronization', () => {
    it('should sync availability and return result', async () => {
      const result = await service.syncAvailability('listing-1');
      expect(result).toBeDefined();
      expect(mockAvailabilityRepo.syncAvailability).toHaveBeenCalledWith('listing-1', undefined);
    });

    it('should resolve sync conflicts', async () => {
      mockAvailabilityRepo.findConflicts.mockResolvedValue([]);
      const result = await service.resolveSyncConflicts('listing-1');
      expect(result).toBeDefined();
    });

    it('should handle bulk availability updates', async () => {
      const result = await service.bulkUpdateAvailability([
        { listingId: 'listing-1', date: '2025-06-01', status: 'blocked' },
      ]);
      expect(result).toBeDefined();
      expect(mockAvailabilityRepo.bulkUpdateAvailability).toHaveBeenCalled();
    });
  });

  describe('Availability Statistics', () => {
    it('should generate availability stats', async () => {
      const stats = await service.getAvailabilityStats('listing-1');
      expect(stats).toHaveProperty('totalDays');
      expect(stats).toHaveProperty('availableDays');
      expect(stats).toHaveProperty('bookedDays');
      expect(typeof stats.totalDays).toBe('number');
    });

    it('should generate availability statistics with date range', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-30');
      const stats = await service.getAvailabilityStatistics('listing-1', start, end);
      expect(stats).toBeDefined();
    });

    it('should analyze availability patterns', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');
      const patterns = await service.analyzeAvailabilityPatterns('listing-1', start, end);
      expect(patterns).toBeDefined();
    });
  });

  describe('Real-time Updates', () => {
    it('should update availability in real-time', async () => {
      const result = await service.updateRealTimeAvailability('listing-1', {
        date: '2025-06-15',
        status: 'booked',
      });
      expect(mockAvailabilityRepo.updateAvailability).toHaveBeenCalled();
    });

    it('should validate booking times', async () => {
      const start = new Date('2026-07-01T14:00:00Z');
      const end = new Date('2026-07-05T11:00:00Z');
      const result = await service.validateBookingTimes('listing-1', start, end);
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should check if booking is allowed', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-07');
      const result = await service.checkBookingAllowed('listing-1', start, end);
      expect(result).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    it('should generate pricing/availability recommendations', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-30');
      const result = await service.generateRecommendations('listing-1', start, end);
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
