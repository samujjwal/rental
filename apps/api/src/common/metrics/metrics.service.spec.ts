import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let prisma: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      booking: {
        count: jest.fn().mockResolvedValue(50),
      },
      user: {
        count: jest.fn().mockResolvedValue(100),
      },
      listing: {
        count: jest.fn().mockResolvedValue(30),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500000 }, _avg: { amount: 10000 }, _count: 50 }),
        count: jest.fn().mockResolvedValue(5),
      },
      dispute: {
        count: jest.fn().mockResolvedValue(2),
      },
      trustScore: {
        count: jest.fn().mockResolvedValue(10),
      },
      platformMetric: {
        createMany: jest.fn().mockResolvedValue({ count: 10 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('captureSnapshot', () => {
    it('should capture metric snapshots', async () => {
      const snapshots = await service.captureSnapshot('HOURLY');

      expect(snapshots.length).toBeGreaterThan(0);
      expect(prisma.platformMetric.createMany).toHaveBeenCalled();

      for (const snapshot of snapshots) {
        expect(snapshot.name).toBeDefined();
        expect(snapshot.value).toBeDefined();
        expect(snapshot.period).toBe('HOURLY');
      }
    });

    it('should capture booking, user, listing, revenue, dispute metrics', async () => {
      const snapshots = await service.captureSnapshot();

      const metricNames = snapshots.map((s) => s.name);
      expect(metricNames).toContain('bookings.new');
      expect(metricNames).toContain('users.active');
      expect(metricNames).toContain('listings.active');
      expect(metricNames).toContain('revenue.gmv');
      expect(metricNames).toContain('disputes.open');
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return dashboard metrics', async () => {
      const dashboard = await service.getDashboardMetrics();

      expect(dashboard.bookings).toBeDefined();
      expect(dashboard.revenue).toBeDefined();
      expect(dashboard.users).toBeDefined();
      expect(dashboard.listings).toBeDefined();
      expect(dashboard.disputes).toBeDefined();
    });

    it('should cache dashboard metrics', async () => {
      await service.getDashboardMetrics();
      expect(cache.set).toHaveBeenCalledWith('metrics:dashboard', expect.any(Object), 3600);
    });

    it('should return cached metrics on second call', async () => {
      const mockDashboard = {
        bookings: { total: 50, active: 10, completedToday: 5, cancelledToday: 1, conversionRate: 20 },
        revenue: { gmv30d: 500000, avgBookingValue: 10000, refundRate: 2 },
        users: { totalActive: 100, newThisWeek: 5, superhostCount: 10 },
        listings: { total: 30, activeListings: 25, avgUtilization: 0 },
        disputes: { openCount: 2, avgResolutionHours: 0 },
      };
      cache.get.mockResolvedValue(mockDashboard);

      const result = await service.getDashboardMetrics();
      expect(result).toEqual(mockDashboard);
      expect(prisma.booking.count).not.toHaveBeenCalled();
    });
  });

  describe('queryMetrics', () => {
    it('should query metrics by name and date range', async () => {
      prisma.platformMetric.findMany.mockResolvedValue([
        { name: 'bookings.new', value: 10, dimensions: {}, period: 'HOURLY', periodStart: new Date() },
      ]);

      const results = await service.queryMetrics(
        'bookings.new',
        new Date('2025-01-01'),
        new Date('2025-12-31'),
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('bookings.new');
    });
  });
});
