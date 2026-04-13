import { Test, TestingModule } from '@nestjs/testing';
import { SearchAnalyticsController } from './search-analytics.controller';
import { SearchAnalyticsService } from '../services/search-analytics.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { ForbiddenException } from '@nestjs/common';

describe('SearchAnalyticsController', () => {
  let controller: SearchAnalyticsController;
  let searchAnalyticsService: jest.Mocked<SearchAnalyticsService>;

  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchAnalyticsController],
      providers: [
        {
          provide: SearchAnalyticsService,
          useValue: {
            logSearch: jest.fn(),
            getAnalyticsDashboard: jest.fn(),
            calculateMetrics: jest.fn(),
            getTopQueries: jest.fn(),
            getTrendingQueries: jest.fn(),
            getRealtimeAnalytics: jest.fn(),
            getSearchInsights: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SearchAnalyticsController>(SearchAnalyticsController);
    searchAnalyticsService = module.get(SearchAnalyticsService) as jest.Mocked<SearchAnalyticsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('logSearch', () => {
    it('should log search successfully', async () => {
      const logSearchDto = {
        userId: 'user-123',
        query: 'apartment in kathmandu',
        filters: { location: 'Kathmandu', priceMin: 1000, priceMax: 5000 },
        resultsCount: 25,
        clickedResults: ['listing-1', 'listing-2'],
        searchDuration: 150,
        sessionId: 'session-abc',
      };

      searchAnalyticsService.logSearch.mockResolvedValue(undefined);

      const result = await controller.logSearch(logSearchDto);

      expect(searchAnalyticsService.logSearch).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'apartment in kathmandu',
        filters: { location: 'Kathmandu', priceMin: 1000, priceMax: 5000 },
        resultsCount: 25,
        clickedResults: ['listing-1', 'listing-2'],
        searchDuration: 150,
        sessionId: 'session-abc',
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Search logged successfully' });
    });

    it('should handle optional fields', async () => {
      const logSearchDto = {
        userId: 'user-123',
        query: 'house',
      };

      searchAnalyticsService.logSearch.mockResolvedValue(undefined);

      const result = await controller.logSearch(logSearchDto as any);

      expect(searchAnalyticsService.logSearch).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'house',
        filters: {},
        clickedResults: [],
        resultsCount: undefined,
        searchDuration: undefined,
        sessionId: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('should handle service errors gracefully', async () => {
      const logSearchDto = {
        userId: 'user-123',
        query: 'apartment',
      };

      searchAnalyticsService.logSearch.mockRejectedValue(new Error('Database error'));

      const result = await controller.logSearch(logSearchDto as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle unknown errors', async () => {
      const logSearchDto = {
        userId: 'user-123',
        query: 'apartment',
      };

      searchAnalyticsService.logSearch.mockRejectedValue('Unknown error');

      const result = await controller.logSearch(logSearchDto as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to log search');
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard data for admin', async () => {
      const getDashboardDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        period: '30d' as const,
      };

      const mockDashboard = {
        period: '30d',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        metrics: {
          totalSearches: 15000,
          uniqueQueries: 8000,
          averageResultsCount: 24.5,
          clickThroughRate: 42.3,
          averageSearchDuration: 145,
          topQueries: [{ query: 'apartment', count: 2500, clickThroughRate: 45 }],
          trendingQueries: [{ query: 'furnished apartment', growthRate: 150, currentCount: 500, previousCount: 200 }],
          searchPerformance: { averageResponseTime: 145, p95ResponseTime: 200, p99ResponseTime: 300, errorRate: 0.5, cacheHitRate: 85 },
          userBehavior: { searchesPerUser: 4.3, averageSessionSearches: 3.2, conversionRate: 12.5, bounceRate: 35, refinementRate: 28 },
          searchQuality: { relevanceScore: 85, diversityScore: 78, coverageScore: 92, userSatisfaction: 87 },
        },
        popularSearches: [{ query: 'apartment', count: 2500, conversionRate: 12.5, avgBookingValue: 45000 }],
        searchTrends: [{ date: new Date('2025-01-01'), totalSearches: 500, uniqueQueries: 350, clickThroughRate: 42 }],
        geographicDistribution: [{ region: 'Kathmandu', searchCount: 8500, userCount: 3200, conversionRate: 12.5 }],
        deviceBreakdown: [{ deviceType: 'mobile', searchCount: 9000, percentage: 60, avgResponseTime: 150 }],
      };

      searchAnalyticsService.getAnalyticsDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard(getDashboardDto);

      expect(searchAnalyticsService.getAnalyticsDashboard).toHaveBeenCalledWith(
        getDashboardDto.startDate,
        getDashboardDto.endDate,
        '30d'
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDashboard);
    });

    it('should handle service errors', async () => {
      const getDashboardDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      };

      searchAnalyticsService.getAnalyticsDashboard.mockRejectedValue(new Error('Service unavailable'));

      const result = await controller.getDashboard(getDashboardDto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });
  });

  describe('getMetrics', () => {
    it('should return search metrics', async () => {
      const getTrendsDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      };

      const mockMetrics = {
        totalSearches: 15000,
        uniqueQueries: 8000,
        averageResultsCount: 24.5,
        clickThroughRate: 42.3,
        averageSearchDuration: 145,
        topQueries: [{ query: 'apartment', count: 2500, clickThroughRate: 45 }],
        trendingQueries: [{ query: 'furnished apartment', growthRate: 150, currentCount: 500, previousCount: 200 }],
        searchPerformance: { averageResponseTime: 145, p95ResponseTime: 200, p99ResponseTime: 300, errorRate: 0.5, cacheHitRate: 85 },
        userBehavior: { searchesPerUser: 4.3, averageSessionSearches: 3.2, conversionRate: 12.5, bounceRate: 35, refinementRate: 28 },
        searchQuality: { relevanceScore: 85, diversityScore: 78, coverageScore: 92, userSatisfaction: 87 },
      };

      searchAnalyticsService.calculateMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics(getTrendsDto);

      expect(searchAnalyticsService.calculateMetrics).toHaveBeenCalledWith(
        getTrendsDto.startDate,
        getTrendsDto.endDate
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMetrics);
    });

    it('should handle errors', async () => {
      const getTrendsDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      };

      searchAnalyticsService.calculateMetrics.mockRejectedValue(new Error('Calculation failed'));

      const result = await controller.getMetrics(getTrendsDto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Calculation failed');
    });
  });

  describe('getTopQueries', () => {
    it('should return top queries', async () => {
      const getTopQueriesDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        limit: 10,
      };

      const mockTopQueries = [
        { query: 'apartment', count: 2500, clickThroughRate: 45 },
        { query: 'house', count: 1800, clickThroughRate: 38 },
        { query: 'room', count: 1200, clickThroughRate: 32 },
      ];

      searchAnalyticsService.getTopQueries.mockResolvedValue(mockTopQueries);

      const result = await controller.getTopQueries(getTopQueriesDto);

      expect(searchAnalyticsService.getTopQueries).toHaveBeenCalledWith(
        getTopQueriesDto.startDate,
        getTopQueriesDto.endDate,
        10
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTopQueries);
    });

    it('should use default limit', async () => {
      const getTopQueriesDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      };

      searchAnalyticsService.getTopQueries.mockResolvedValue([]);

      await controller.getTopQueries(getTopQueriesDto as any);

      expect(searchAnalyticsService.getTopQueries).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        undefined
      );
    });
  });

  describe('getTrendingQueries', () => {
    it('should return trending queries with comparison', async () => {
      const getTrendsDto = {
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-31'),
      };

      const mockTrending = [
        { query: 'furnished apartment', growthRate: 150, currentCount: 500, previousCount: 200 },
        { query: 'parking included', growthRate: 133, currentCount: 350, previousCount: 150 },
      ];

      searchAnalyticsService.getTrendingQueries.mockResolvedValue(mockTrending);

      const result = await controller.getTrendingQueries(getTrendsDto);

      // Should calculate previous period based on date range
      expect(searchAnalyticsService.getTrendingQueries).toHaveBeenCalledWith(
        getTrendsDto.startDate,
        getTrendsDto.endDate
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTrending);
    });

    it('should handle errors', async () => {
      const getTrendsDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      };

      searchAnalyticsService.getTrendingQueries.mockRejectedValue(new Error('Failed'));

      const result = await controller.getTrendingQueries(getTrendsDto);

      expect(result.success).toBe(false);
    });
  });

  describe('getRealtimeAnalytics', () => {
    it('should return realtime analytics', async () => {
      const mockRealtime = {
        currentQueries: 45,
        queriesPerSecond: 12,
        activeUsers: 120,
        topQueriesNow: ['apartment', 'house', 'flat'],
        performanceHealth: 'healthy' as const,
      };

      searchAnalyticsService.getRealtimeAnalytics.mockResolvedValue(mockRealtime);

      const result = await controller.getRealtimeAnalytics();

      expect(searchAnalyticsService.getRealtimeAnalytics).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRealtime);
    });

    it('should handle errors', async () => {
      searchAnalyticsService.getRealtimeAnalytics.mockRejectedValue(new Error('Connection lost'));

      const result = await controller.getRealtimeAnalytics();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection lost');
    });
  });

  describe('getInsights', () => {
    it('should return search insights', async () => {
      const getTrendsDto = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      };

      const mockInsights = [
        { type: 'trend' as const, title: 'Increasing demand', description: 'Search volume up', metric: 'searches', change: 15, recommendation: 'Increase inventory', severity: 'low' as const },
        { type: 'opportunity' as const, title: 'Wifi feature popular', description: 'Users prefer wifi', metric: 'feature_preferences', change: 7200, recommendation: 'Highlight wifi', severity: 'medium' as const },
      ];

      searchAnalyticsService.getSearchInsights.mockResolvedValue(mockInsights);

      const result = await controller.getInsights(getTrendsDto);

      expect(searchAnalyticsService.getSearchInsights).toHaveBeenCalledWith(
        getTrendsDto.startDate,
        getTrendsDto.endDate
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInsights);
    });
  });

  describe('authorization', () => {
    it('should have JWT guard on dashboard endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', SearchAnalyticsController.prototype.getDashboard);
      expect(guards).toBeDefined();
    });

    it('should have Roles guard on protected endpoints', () => {
      const dashboardGuards = Reflect.getMetadata('__guards__', SearchAnalyticsController.prototype.getDashboard);
      const metricsGuards = Reflect.getMetadata('__guards__', SearchAnalyticsController.prototype.getMetrics);
      expect(dashboardGuards).toBeDefined();
      expect(metricsGuards).toBeDefined();
    });

    it('should require ADMIN role for protected endpoints', () => {
      const dashboardRoles = Reflect.getMetadata('roles', SearchAnalyticsController.prototype.getDashboard);
      const metricsRoles = Reflect.getMetadata('roles', SearchAnalyticsController.prototype.getMetrics);
      expect(dashboardRoles).toContain('ADMIN');
      expect(metricsRoles).toContain('ADMIN');
    });

    it('should allow public access to logSearch endpoint', () => {
      const logSearchGuards = Reflect.getMetadata('__guards__', SearchAnalyticsController.prototype.logSearch);
      expect(logSearchGuards).toBeUndefined();
    });
  });

  describe('date range validation', () => {
    it('should handle invalid date ranges', async () => {
      const getTrendsDto = {
        startDate: new Date('2025-01-31'),
        endDate: new Date('2025-01-01'), // End before start
      };

      searchAnalyticsService.getTrendingQueries.mockResolvedValue([]);

      // Controller passes dates as-is, service should handle validation
      const result = await controller.getTrendingQueries(getTrendsDto);

      expect(searchAnalyticsService.getTrendingQueries).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should handle same start and end dates', async () => {
      const getTrendsDto = {
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-15'),
      };

      searchAnalyticsService.calculateMetrics.mockResolvedValue({} as any);

      await controller.getMetrics(getTrendsDto);

      expect(searchAnalyticsService.calculateMetrics).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('response structure', () => {
    it('should return standardized success response', async () => {
      const logSearchDto = { userId: 'user-123', query: 'test' };
      searchAnalyticsService.logSearch.mockResolvedValue(undefined);

      const result = await controller.logSearch(logSearchDto as any);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).not.toHaveProperty('error');
    });

    it('should return standardized error response', async () => {
      const logSearchDto = { userId: 'user-123', query: 'test' };
      searchAnalyticsService.logSearch.mockRejectedValue(new Error('Failed'));

      const result = await controller.logSearch(logSearchDto as any);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result).not.toHaveProperty('data');
    });
  });

  describe('performance considerations', () => {
    it('should handle large date ranges', async () => {
      const getTrendsDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-31'), // 1 year range
      };

      const mockMetrics = { totalSearches: 180000 };
      searchAnalyticsService.calculateMetrics.mockResolvedValue(mockMetrics as any);

      const result = await controller.getMetrics(getTrendsDto);

      expect(result.success).toBe(true);
    });

    it('should handle concurrent requests', async () => {
      searchAnalyticsService.getRealtimeAnalytics.mockResolvedValue({
        currentQueries: 10,
        queriesPerSecond: 5,
        activeUsers: 20,
        topQueriesNow: ['apartment', 'wifi'],
        performanceHealth: 'healthy',
      });

      const promises = Array(5).fill(null).map(() => controller.getRealtimeAnalytics());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});
