import { Test, TestingModule } from '@nestjs/testing';
import { SearchAnalyticsService } from './search-analytics.service';
import { CacheService } from '@/common/cache/cache.service';
import { SearchQuery } from '../interfaces/search-analytics.interface';

describe('SearchAnalyticsService', () => {
  let service: SearchAnalyticsService;
  let cacheService: jest.Mocked<CacheService>;

  const createSearchQuery = (overrides: Partial<Omit<SearchQuery, 'id' | 'createdAt'>> = {}): Omit<SearchQuery, 'id' | 'createdAt'> => ({
    query: 'test query',
    sessionId: 'session-1',
    filters: {},
    resultsCount: 10,
    searchDuration: 100,
    clickedResults: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchAnalyticsService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchAnalyticsService>(SearchAnalyticsService);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logSearch', () => {
    it('should log a search query', async () => {
      const query = createSearchQuery({
        query: 'apartment in kathmandu',
        userId: 'user-123',
        sessionId: 'session-456',
        filters: { category: 'property', priceMin: 10000, priceMax: 50000 },
        resultsCount: 25,
        searchDuration: 150,
        clickedResults: ['listing-1', 'listing-2'],
      });

      const result = await service.logSearch(query);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.query).toBe(query.query);
      expect(result.userId).toBe(query.userId);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(cacheService.del).toHaveBeenCalledWith('search:realtime:stats');
    });

    it('should limit log size to max size', async () => {
      for (let i = 0; i < 10001; i++) {
        await service.logSearch(createSearchQuery({ query: `query-${i}`, sessionId: `session-${i}` }));
      }

      const metrics = await service.calculateMetrics(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(),
      );
      expect(metrics.totalSearches).toBeLessThanOrEqual(10000);
    });
  });

  describe('getAnalyticsDashboard', () => {
    it('should return cached dashboard if available', async () => {
      const cachedDashboard = {
        period: 'daily',
        startDate: new Date(),
        endDate: new Date(),
        metrics: { totalSearches: 100, uniqueQueries: 50, clickThroughRate: 25, averageResultsCount: 10, averageSearchDuration: 100, topQueries: [], trendingQueries: [], searchPerformance: { averageResponseTime: 100, p95ResponseTime: 200, p99ResponseTime: 300, errorRate: 0, cacheHitRate: 0 }, userBehavior: { searchesPerUser: 1, averageSessionSearches: 1, conversionRate: 0, bounceRate: 0, refinementRate: 0 }, searchQuality: { relevanceScore: 0.8, diversityScore: 0.7, coverageScore: 0.9, userSatisfaction: 4 } },
        popularSearches: [],
        searchTrends: [],
        geographicDistribution: [],
        deviceBreakdown: [],
      };
      cacheService.get.mockResolvedValue(cachedDashboard);

      const result = await service.getAnalyticsDashboard(new Date(), new Date());

      expect(result).toEqual(cachedDashboard);
      expect(cacheService.get).toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should generate and cache dashboard if not cached', async () => {
      cacheService.get.mockResolvedValue(null);
      await service.logSearch(createSearchQuery({ query: 'apartment', clickedResults: ['listing-1'] }));

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const result = await service.getAnalyticsDashboard(startDate, endDate, 'daily');

      expect(result).toBeDefined();
      expect(result.period).toBe('daily');
      expect(result.metrics).toBeDefined();
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('search:dashboard:'),
        expect.any(Object),
        300,
      );
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics correctly', async () => {
      await service.logSearch(createSearchQuery({ query: 'apartment', clickedResults: ['listing-1'] }));
      await service.logSearch(createSearchQuery({ query: 'house', clickedResults: [] }));
      await service.logSearch(createSearchQuery({ query: 'apartment', clickedResults: ['listing-2'] }));

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const metrics = await service.calculateMetrics(startDate, endDate);

      expect(metrics.totalSearches).toBe(3);
      expect(metrics.uniqueQueries).toBe(2);
      expect(metrics.clickThroughRate).toBe((2 / 3) * 100);
    });

    it('should return zero metrics when no searches', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const metrics = await service.calculateMetrics(startDate, endDate);

      expect(metrics.totalSearches).toBe(0);
      expect(metrics.uniqueQueries).toBe(0);
      expect(metrics.clickThroughRate).toBe(0);
    });
  });

  describe('getTopQueries', () => {
    it('should return top queries sorted by count', async () => {
      await service.logSearch(createSearchQuery({ query: 'apartment', sessionId: 's1' }));
      await service.logSearch(createSearchQuery({ query: 'apartment', sessionId: 's2' }));
      await service.logSearch(createSearchQuery({ query: 'apartment', sessionId: 's3', clickedResults: ['l1'] }));
      await service.logSearch(createSearchQuery({ query: 'house', sessionId: 's4', clickedResults: ['l2'] }));
      await service.logSearch(createSearchQuery({ query: 'house', sessionId: 's5' }));

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const topQueries = await service.getTopQueries(startDate, endDate, 10);

      expect(topQueries).toHaveLength(2);
      expect(topQueries[0].query).toBe('apartment');
      expect(topQueries[0].count).toBe(3);
      expect(topQueries[1].query).toBe('house');
      expect(topQueries[1].count).toBe(2);
    });

    it('should respect the limit parameter', async () => {
      await service.logSearch(createSearchQuery({ query: 'a', sessionId: 's1' }));
      await service.logSearch(createSearchQuery({ query: 'b', sessionId: 's2' }));
      await service.logSearch(createSearchQuery({ query: 'c', sessionId: 's3' }));

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const topQueries = await service.getTopQueries(startDate, endDate, 2);

      expect(topQueries).toHaveLength(2);
    });
  });

  describe('getRealtimeAnalytics', () => {
    it('should return cached realtime analytics if available', async () => {
      const cachedAnalytics = {
        currentQueries: 10,
        queriesPerSecond: 0.5,
        activeUsers: 5,
        topQueriesNow: ['apartment', 'house'],
        performanceHealth: 'healthy' as const,
      };
      cacheService.get.mockResolvedValue(cachedAnalytics);

      const result = await service.getRealtimeAnalytics();

      expect(result).toEqual(cachedAnalytics);
      expect(cacheService.get).toHaveBeenCalledWith('search:realtime:stats');
    });

    it('should calculate realtime analytics from recent logs', async () => {
      cacheService.get.mockResolvedValue(null);

      await service.logSearch(createSearchQuery({ query: 'apartment', sessionId: 'session-1' }));
      await service.logSearch(createSearchQuery({ query: 'apartment', sessionId: 'session-2' }));
      await service.logSearch(createSearchQuery({ query: 'house', sessionId: 'session-1' }));

      const result = await service.getRealtimeAnalytics();

      expect(result).toBeDefined();
      expect(result.activeUsers).toBe(2);
      expect(result.topQueriesNow).toContain('apartment');
      expect(cacheService.set).toHaveBeenCalledWith(
        'search:realtime:stats',
        expect.any(Object),
        10,
      );
    });
  });

  describe('getSearchInsights', () => {
    it('should generate insights based on metrics', async () => {
      for (let i = 0; i < 10; i++) {
        await service.logSearch(createSearchQuery({ query: `query-${i}`, sessionId: `session-${i}`, clickedResults: [] }));
      }

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const insights = await service.getSearchInsights(startDate, endDate);

      expect(insights).toBeDefined();
      expect(insights.length).toBeGreaterThan(0);

      const lowCtrInsight = insights.find((i) => i.type === 'warning' && i.title === 'Low Click-Through Rate');
      expect(lowCtrInsight).toBeDefined();
      expect(lowCtrInsight?.severity).toBe('high');
    });
  });

  describe('getSearchesPerUser', () => {
    it('should calculate average searches per user', async () => {
      await service.logSearch(createSearchQuery({ query: 'q1', userId: 'user-1', sessionId: 's1' }));
      await service.logSearch(createSearchQuery({ query: 'q2', userId: 'user-1', sessionId: 's2' }));
      await service.logSearch(createSearchQuery({ query: 'q3', userId: 'user-2', sessionId: 's3' }));

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const searchesPerUser = await service.getSearchesPerUser(startDate, endDate);

      expect(searchesPerUser).toBe(1.5);
    });

    it('should return 0 when no users', async () => {
      await service.logSearch(createSearchQuery({ query: 'q1', sessionId: 's1' }));

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const searchesPerUser = await service.getSearchesPerUser(startDate, endDate);

      expect(searchesPerUser).toBe(0);
    });
  });

  describe('getPopularSearches', () => {
    it('should return popular searches', async () => {
      await service.logSearch(createSearchQuery({ query: 'apartment', sessionId: 's1' }));
      await service.logSearch(createSearchQuery({ query: 'apartment', sessionId: 's2' }));
      await service.logSearch(createSearchQuery({ query: 'house', sessionId: 's3' }));

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const popular = await service.getPopularSearches(startDate, endDate, 10);

      expect(popular).toHaveLength(2);
      expect(popular[0].query).toBe('apartment');
      expect(popular[0].count).toBe(2);
    });
  });
});
