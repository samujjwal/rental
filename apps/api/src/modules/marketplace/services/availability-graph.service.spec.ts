import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityGraphService } from './availability-graph.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AvailabilityGraphService', () => {
  let service: AvailabilityGraphService;
  let prisma: any;

  const now = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);

  beforeEach(async () => {
    prisma = {
      availability: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data })),
      },
      listing: {
        findUnique: jest.fn().mockResolvedValue({ id: 'listing-1', basePrice: 3000 }),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityGraphService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn(), exists: jest.fn().mockResolvedValue(false), setNx: jest.fn().mockResolvedValue(true) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<AvailabilityGraphService>(AvailabilityGraphService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRealTimeAvailability', () => {
    it('should return available when no conflicts', async () => {
      const result = await service.checkRealTimeAvailability('listing-1', tomorrow, nextWeek);
      expect(result.available).toBe(true);
      expect(result.blockedDates).toHaveLength(0);
      expect(result.confirmedBookings).toBe(0);
    });

    it('should return unavailable when bookings exist', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { id: 'b-1', startDate: tomorrow, endDate: nextWeek, status: 'CONFIRMED' },
      ]);
      const result = await service.checkRealTimeAvailability('listing-1', tomorrow, nextWeek);
      expect(result.available).toBe(false);
      expect(result.confirmedBookings).toBe(1);
    });
  });

  describe('bulkCheckAvailability', () => {
    it('should check multiple listings at once', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { listingId: 'l2' },
      ]);
      const result = await service.bulkCheckAvailability(['l1', 'l2', 'l3'], tomorrow, nextWeek);
      expect(result.get('l1')).toBe(true);
      expect(result.get('l2')).toBe(false);
      expect(result.get('l3')).toBe(true);
    });
  });

  describe('getCalendarHeatmap', () => {
    it('should return heatmap for a month', async () => {
      const result = await service.getCalendarHeatmap('listing-1', 2025, 1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(31); // January has 31 days
      expect(result[0].status).toBe('available');
    });
  });

  describe('reserveSlot', () => {
    it('should create a booking when slot is available', async () => {
      const result = await service.reserveSlot({
        listingId: 'listing-1',
        userId: 'user-1',
        startDate: tomorrow,
        endDate: nextWeek,
        totalPrice: 21000,
        currency: 'NPR',
      });
      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
    });

    it('should throw when slot has conflicts', async () => {
      prisma.booking.findMany.mockResolvedValue([{ id: 'b-existing' }]);
      await expect(
        service.reserveSlot({
          listingId: 'listing-1',
          userId: 'user-1',
          startDate: tomorrow,
          endDate: nextWeek,
          totalPrice: 21000,
        }),
      ).rejects.toThrow('SLOT_CONFLICT');
    });
  });

  describe('getOccupancyStats', () => {
    it('should return occupancy statistics', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { startDate: new Date(Date.now() - 10 * 86400000), endDate: new Date(Date.now() - 5 * 86400000), status: 'COMPLETED' },
      ]);
      const result = await service.getOccupancyStats('listing-1', 90);
      expect(result.totalDays).toBe(90);
      expect(result.occupancyRate).toBeGreaterThanOrEqual(0);
      expect(result.occupancyRate).toBeLessThanOrEqual(1);
    });
  });
});
