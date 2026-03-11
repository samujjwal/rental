import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  const userId = 'user-owner-1';

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      listing: {
        findMany: jest.fn(),
      },
      booking: {
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getPerformanceMetrics', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        averageRating: 4.2,
        responseRate: 85,
        responseTime: '2.5',
      });
      prisma.listing.findMany.mockResolvedValue([
        { id: 'l1', title: 'Drill', basePrice: 30, views: 100, viewCount: 100, averageRating: 4.5, totalBookings: 5 },
        { id: 'l2', title: 'Saw', basePrice: 40, views: 50, viewCount: 50, averageRating: 4.0, totalBookings: 3 },
      ]);
      // count calls: bookingsAll, bookingsPeriod, bookingsPrev
      prisma.booking.count
        .mockResolvedValueOnce(8) // all
        .mockResolvedValueOnce(3) // period
        .mockResolvedValueOnce(2) // prev
        .mockResolvedValueOnce(8) // acceptance total
        .mockResolvedValueOnce(6); // acceptance accepted
      prisma.booking.aggregate
        .mockResolvedValueOnce({ _sum: { totalPrice: 1200 } }) // all revenue
        .mockResolvedValueOnce({ _sum: { totalPrice: 500 } }) // period revenue
        .mockResolvedValueOnce({ _sum: { totalPrice: 300 } }); // prev revenue
      prisma.booking.findMany.mockResolvedValue([]); // monthly data
      prisma.booking.groupBy.mockResolvedValue([]); // top listings stats
    });

    it('should return performance overview', async () => {
      const result = await service.getPerformanceMetrics(userId);

      expect(result.overview).toBeDefined();
      expect(result.overview.totalViews).toBe(150);
      expect(result.overview.totalBookings).toBe(8);
      expect(result.overview.averageRating).toBe(4.2);
    });

    it('should return earnings data', async () => {
      const result = await service.getPerformanceMetrics(userId);

      expect(result.earnings.total).toBe(1200);
      expect(result.earnings.thisMonth).toBe(500);
      expect(result.earnings.lastMonth).toBe(300);
    });

    it('should calculate bookings change percentage', async () => {
      const result = await service.getPerformanceMetrics(userId);

      // (3 - 2) / 2 * 100 = 50
      expect(result.overview.bookingsChange).toBe(50);
    });

    it('should handle user with no listings / zero views', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.booking.count.mockReset();
      prisma.booking.count
        .mockResolvedValueOnce(0) // bookingsAll
        .mockResolvedValueOnce(0) // bookingsPeriod
        .mockResolvedValueOnce(0) // bookingsPrev
        .mockResolvedValueOnce(0) // acceptance total
        .mockResolvedValueOnce(0); // acceptance accepted
      prisma.booking.aggregate.mockReset();
      prisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: null } });
      prisma.booking.groupBy.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]); // monthly data

      const result = await service.getPerformanceMetrics(userId);

      expect(result.overview.totalViews).toBe(0);
      expect(result.overview.conversionRate).toBe(0);
      expect(result.earnings.total).toBe(0);
    });

    it('should accept different period values', async () => {
      const result7 = await service.getPerformanceMetrics(userId, '7days');
      expect(result7.overview).toBeDefined();
    });

    it('should return response metrics', async () => {
      const result = await service.getPerformanceMetrics(userId);

      expect(result.responseMetrics.responseRate).toBe(85);
      expect(result.responseMetrics.averageResponseTime).toBe(2.5);
    });
  });

  describe('getInsights', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        averageRating: 4.5,
        responseRate: 90,
      });
      prisma.listing.findMany
        .mockResolvedValueOnce([ // owner listings
          { id: 'l1', title: 'Drill', basePrice: 30, photos: ['a.jpg', 'b.jpg'], averageRating: 4.5 },
        ])
        .mockResolvedValueOnce([ // competitor listings (all platform)
          { basePrice: 30 },
          { basePrice: 40 },
          { basePrice: 50 },
        ]);
      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', listingId: 'l1', startDate: new Date('2025-01-01'), endDate: new Date('2025-01-03'), createdAt: new Date(), totalAmount: 60, totalPrice: 60 },
      ]);
    });

    it('should return insights with score', async () => {
      const result = await service.getInsights(userId);

      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
      expect(result.insights).toBeInstanceOf(Array);
    });

    it('should suggest adding more photos when average < 4', async () => {
      prisma.listing.findMany
        .mockReset()
        .mockResolvedValueOnce([
          { id: 'l1', title: 'Drill', basePrice: 30, photos: ['a.jpg'], averageRating: 4.5 },
        ])
        .mockResolvedValueOnce([]);
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getInsights(userId);

      const photoInsight = result.insights.find((i: any) => i.id === 'more-photos');
      expect(photoInsight).toBeDefined();
    });

    it('should suggest creating listing when no listings exist', async () => {
      prisma.listing.findMany.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getInsights(userId);

      const noListing = result.insights.find((i: any) => i.id === 'no-listings');
      expect(noListing).toBeDefined();
      expect(noListing.type).toBe('opportunity');
    });

    it('should return seasonal trends', async () => {
      const result = await service.getInsights(userId);

      expect(result.seasonalTrends).toBeInstanceOf(Array);
      result.seasonalTrends.forEach((t: any) => {
        expect(['high', 'medium', 'low']).toContain(t.demand);
      });
    });

    it('should return competitor analysis', async () => {
      const result = await service.getInsights(userId);

      expect(result.competitorAnalysis).toBeDefined();
      expect(result.competitorAnalysis.averagePrice).toBeDefined();
      expect(['above', 'below', 'at']).toContain(result.competitorAnalysis.pricePosition);
    });

    it('should return customer segments', async () => {
      const result = await service.getInsights(userId);

      expect(result.customerSegments).toBeInstanceOf(Array);
    });

    it('should return optimizations', async () => {
      const result = await service.getInsights(userId);

      expect(result.optimizations).toBeInstanceOf(Array);
      expect(result.optimizations.length).toBeGreaterThan(0);
    });
  });
});
