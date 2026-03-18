import { AnalyticsWarehouseService } from './analytics-warehouse.service';

describe('AnalyticsWarehouseService (unit)', () => {
  let service: AnalyticsWarehouseService;
  let prisma: any;

  const start = new Date('2025-01-01T00:00:00Z');
  const end = new Date('2025-01-07T23:59:59Z');

  beforeEach(() => {
    prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: 0 } }),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      refund: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      listing: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      review: {
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 0 } }),
      },
      searchEvent: { count: jest.fn().mockResolvedValue(0) },
      message: { count: jest.fn().mockResolvedValue(0) },
      session: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const config = { get: jest.fn() };
    service = new AnalyticsWarehouseService(prisma, config as any);
  });

  describe('generateDashboard', () => {
    it('returns a dashboard with correct period and all metric sections', async () => {
      const dashboard = await service.generateDashboard(start, end);
      expect(dashboard.period).toEqual({ start, end });
      expect(dashboard.metrics).toHaveProperty('bookings');
      expect(dashboard.metrics).toHaveProperty('revenue');
      expect(dashboard.metrics).toHaveProperty('users');
      expect(dashboard.metrics).toHaveProperty('listings');
      expect(dashboard.metrics).toHaveProperty('engagement');
      expect(Array.isArray(dashboard.trends)).toBe(true);
    });

    it('computes booking completionRate correctly', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { status: 'CONFIRMED', totalPrice: '100', listing: { category: { name: 'Tech' }, city: 'Kathmandu' } },
        { status: 'CANCELLED', totalPrice: '50', listing: { category: { name: 'Tech' }, city: 'Pokhara' } },
      ]);
      const dashboard = await service.generateDashboard(start, end);
      // 1 confirmed out of 2 = 50%
      expect(dashboard.metrics.bookings.total).toBe(2);
      expect(dashboard.metrics.bookings.completionRate).toBe(50);
    });

    it('computes revenue totals from succeeded payments', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { amount: '1000', fee: '100', createdAt: new Date('2025-01-03'), booking: {} },
        { amount: '2000', fee: '200', createdAt: new Date('2025-01-05'), booking: {} },
      ]);
      const dashboard = await service.generateDashboard(start, end);
      expect(dashboard.metrics.revenue.total).toBe(3000);
      expect(dashboard.metrics.revenue.platformFees).toBe(300);
      expect(dashboard.metrics.revenue.ownerEarnings).toBe(2700);
    });

    it('sets growth = 0 when previous period has no payments', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      const dashboard = await service.generateDashboard(start, end);
      expect(dashboard.metrics.revenue.growth).toBe(0);
    });

    it('computes conversion rate as 0 when no searches', async () => {
      prisma.searchEvent.count.mockResolvedValue(0);
      const dashboard = await service.generateDashboard(start, end);
      expect(dashboard.metrics.engagement.conversionRate).toBe(0);
    });

    it('computes average session duration in minutes', async () => {
      const sessionStart = new Date('2025-01-03T10:00:00Z');
      const sessionEnd = new Date('2025-01-03T10:30:00Z'); // 30 min
      prisma.session.findMany.mockResolvedValue([{ createdAt: sessionStart, updatedAt: sessionEnd }]);
      const dashboard = await service.generateDashboard(start, end);
      expect(dashboard.metrics.engagement.averageSessionDuration).toBeCloseTo(30, 0);
    });

    it('builds trends array with correct metric names', async () => {
      const dashboard = await service.generateDashboard(start, end);
      const metricNames = dashboard.trends.map(t => t.metric);
      expect(metricNames).toContain('Bookings');
      expect(metricNames).toContain('Revenue');
      expect(metricNames).toContain('New Users');
      expect(metricNames).toContain('Conversion Rate');
    });
  });

  describe('generateCohortAnalysis', () => {
    it('returns empty cohort stub without throwing', async () => {
      const result = await service.generateCohortAnalysis('week');
      expect(result).toEqual({ cohorts: [], retention: [] });
    });
  });

  describe('generatePredictions', () => {
    it('returns forecast and recommendations', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { amount: '3000', fee: '300', createdAt: new Date() },
      ]);
      const result = await service.generatePredictions();
      expect(result).toHaveProperty('revenueForecast');
      expect(result).toHaveProperty('demandForecast');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
