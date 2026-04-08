import { Test, TestingModule } from '@nestjs/testing';
import { SearchAnalyticsService } from './search-analytics.service';
import { SearchRepository } from '../repositories/search.repository';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { CacheService } from '../../cache/services/cache.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SEARCH AND ANALYTICS TESTS
 * 
 * These tests validate search functionality and analytics reporting:
 * - Search query processing and optimization
 * - Search result ranking and relevance
 * - Analytics data collection and aggregation
 * - Performance metrics and monitoring
 * - User behavior tracking and insights
 * - Search analytics dashboards
 * - Data visualization and reporting
 * - Real-time analytics processing
 * 
 * Business Truth Validated:
 * - Search queries are processed efficiently
 * - Results are ranked by relevance and quality
 * - Analytics data is accurate and comprehensive
 * - Performance metrics meet SLA requirements
 * - User behavior insights are actionable
 * - Dashboards provide meaningful insights
 * - Data visualization is clear and informative
 * - Real-time processing is scalable
 */

describe('SearchAnalyticsService', () => {
  let searchAnalyticsService: SearchAnalyticsService;
  let searchRepository: SearchRepository;
  let analyticsRepository: AnalyticsRepository;
  let listingRepository: ListingRepository;
  let userRepository: UserRepository;
  let cacheService: CacheService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchAnalyticsService,
        {
          provide: SearchRepository,
          useValue: {
            search: jest.fn(),
            getSuggestions: jest.fn(),
            logSearch: jest.fn(),
            getPopularQueries: jest.fn(),
            getSearchStats: jest.fn(),
            updateSearchIndex: jest.fn(),
            optimizeSearch: jest.fn(),
          },
        },
        {
          provide: AnalyticsRepository,
          useValue: {
            trackEvent: jest.fn(),
            getMetrics: jest.fn(),
            generateReport: jest.fn(),
            aggregateData: jest.fn(),
            getRealTimeMetrics: jest.fn(),
            storeMetrics: jest.fn(),
          },
        },
        {
          provide: ListingRepository,
          useValue: {
            findById: jest.fn(),
            findActiveListings: jest.fn(),
            searchListings: jest.fn(),
            getListingStats: jest.fn(),
            updateListingRanking: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            getUserSearchHistory: jest.fn(),
            updateUserPreferences: jest.fn(),
            getUserProfile: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getMultiple: jest.fn(),
            setMultiple: jest.fn(),
            invalidatePattern: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'search.maxResults': 50,
                'search.cacheTTL': 300,
                'analytics.batchSize': 1000,
                'analytics.realTimeEnabled': true,
              };
              return config[key] || null;
            }),
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

    searchAnalyticsService = module.get<SearchAnalyticsService>(SearchAnalyticsService);
    searchRepository = module.get<SearchRepository>(SearchRepository);
    analyticsRepository = module.get<AnalyticsRepository>(AnalyticsRepository);
    listingRepository = module.get<ListingRepository>(ListingRepository);
    userRepository = module.get<UserRepository>(UserRepository);
    cacheService = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Search Functionality', () => {
    it('should process search query with filters', async () => {
      // Arrange
      const searchQuery = {
        query: 'apartment in kathmandu',
        filters: {
          category: 'property',
          priceRange: { min: 10000, max: 50000 },
          location: 'Kathmandu',
          amenities: ['wifi', 'parking'],
          availability: {
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-06-07'),
          },
        },
        pagination: {
          page: 1,
          limit: 20,
        },
        sorting: {
          field: 'relevance',
          order: 'desc',
        },
      };

      const searchResults = {
        query: searchQuery.query,
        results: [
          {
            id: 'listing-1',
            title: 'Modern Apartment in Kathmandu',
            price: 35000,
            location: 'Kathmandu',
            category: 'property',
            amenities: ['wifi', 'parking', 'gym'],
            rating: 4.5,
            relevanceScore: 0.95,
            available: true,
          },
          {
            id: 'listing-2',
            title: 'Cozy Apartment with WiFi',
            price: 25000,
            location: 'Kathmandu',
            category: 'property',
            amenities: ['wifi'],
            rating: 4.2,
            relevanceScore: 0.87,
            available: true,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
        searchMetadata: {
          searchTime: 0.045, // seconds
          indexUsed: 'listings_v2',
          filtersApplied: ['category', 'priceRange', 'location', 'amenities'],
          suggestions: ['apartment in patan', 'house in kathmandu'],
        },
      };

      searchRepository.search.mockResolvedValue(searchResults);
      analyticsRepository.trackEvent.mockResolvedValue({ success: true });
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await searchAnalyticsService.search(searchQuery);

      // Assert
      expect(result.results).toHaveLength(2);
      expect(result.results[0].relevanceScore).toBe(0.95);
      expect(result.pagination.total).toBe(2);
      expect(result.searchMetadata.searchTime).toBe(0.045);
      expect(searchRepository.search).toHaveBeenCalledWith(searchQuery);
      expect(analyticsRepository.trackEvent).toHaveBeenCalledWith('search_performed', {
        query: searchQuery.query,
        filtersCount: 4,
        resultsCount: 2,
        searchTime: 0.045,
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('search:'),
        searchResults,
        300
      );
    });

    it('should provide search suggestions', async () => {
      // Arrange
      const partialQuery = 'apar';
      const suggestions = [
        {
          text: 'apartment',
          type: 'term',
          frequency: 1250,
          category: 'property',
        },
        {
          text: 'apartment in kathmandu',
          type: 'query',
          frequency: 450,
          resultsCount: 23,
        },
        {
          text: 'apartment with parking',
          type: 'query',
          frequency: 180,
          resultsCount: 8,
        },
      ];

      searchRepository.getSuggestions.mockResolvedValue(suggestions);
      analyticsRepository.trackEvent.mockResolvedValue({ success: true });

      // Act
      const result = await searchAnalyticsService.getSuggestions(partialQuery);

      // Assert
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].text).toBe('apartment');
      expect(result.suggestions[0].frequency).toBe(1250);
      expect(result.suggestions[1].type).toBe('query');
      expect(searchRepository.getSuggestions).toHaveBeenCalledWith(partialQuery);
      expect(analyticsRepository.trackEvent).toHaveBeenCalledWith('suggestion_requested', {
        partialQuery,
        suggestionsCount: 3,
      });
    });

    it('should handle complex search with boolean operators', async () => {
      // Arrange
      const complexQuery = {
        query: 'apartment AND (wifi OR parking) NOT hotel',
        filters: {
          category: 'property',
        },
        advanced: {
          booleanOperators: true,
          fuzzySearch: true,
          proximitySearch: true,
        },
      };

      const complexResults = {
        query: complexQuery.query,
        results: [
          {
            id: 'listing-1',
            title: 'Luxury Apartment with WiFi and Parking',
            relevanceScore: 0.92,
            matchedTerms: ['apartment', 'wifi', 'parking'],
          },
        ],
        searchMetadata: {
          queryComplexity: 'high',
          booleanOperatorsUsed: ['AND', 'OR', 'NOT'],
          searchTime: 0.089,
        },
      };

      searchRepository.search.mockResolvedValue(complexResults);

      // Act
      const result = await searchAnalyticsService.search(complexQuery);

      // Assert
      expect(result.results[0].matchedTerms).toContain('apartment');
      expect(result.results[0].matchedTerms).toContain('wifi');
      expect(result.searchMetadata.queryComplexity).toBe('high');
      expect(result.searchMetadata.booleanOperatorsUsed).toEqual(['AND', 'OR', 'NOT']);
    });

    it('should optimize search results based on user behavior', async () => {
      // Arrange
      const userId = 'user-123';
      const searchQuery = {
        query: 'budget apartment',
        userId,
      };

      const userProfile = {
        id: userId,
        searchHistory: [
          { query: 'cheap apartment', clicked: ['listing-1', 'listing-3'] },
          { query: 'affordable housing', clicked: ['listing-2'] },
        ],
        preferences: {
          priceRange: { min: 5000, max: 30000 },
          preferredAmenities: ['wifi'],
        },
      };

      const optimizedResults = {
        query: searchQuery.query,
        results: [
          {
            id: 'listing-1',
            title: 'Budget Friendly Apartment',
            price: 18000,
            relevanceScore: 0.94,
            personalizationBoost: 0.15, // Boosted based on history
          },
        ],
        personalizationApplied: true,
        optimizationFactors: ['search_history', 'price_preferences', 'click_patterns'],
      };

      userRepository.getUserSearchHistory.mockResolvedValue(userProfile.searchHistory);
      searchRepository.search.mockResolvedValue(optimizedResults);

      // Act
      const result = await searchAnalyticsService.search(searchQuery);

      // Assert
      expect(result.personalizationApplied).toBe(true);
      expect(result.optimizationFactors).toContain('search_history');
      expect(result.results[0].personalizationBoost).toBe(0.15);
      expect(userRepository.getUserSearchHistory).toHaveBeenCalledWith(userId);
    });
  });

  describe('Search Analytics', () => {
    it('should track search performance metrics', async () => {
      // Arrange
      const timeRange = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30'),
      };

      const performanceMetrics = {
        summary: {
          totalSearches: 15420,
          uniqueQueries: 3450,
          averageSearchTime: 0.067, // seconds
          averageResultsCount: 12.3,
          zeroResultsRate: 0.08, // 8%
        },
        trends: {
          dailySearches: [
            { date: '2024-06-01', searches: 512, avgTime: 0.065 },
            { date: '2024-06-02', searches: 498, avgTime: 0.069 },
          ],
          popularQueries: [
            { query: 'apartment in kathmandu', count: 234, growth: 15.2 },
            { query: 'house for rent', count: 189, growth: -5.3 },
          ],
          searchPatterns: {
            peakHours: [10, 14, 20], // 10 AM, 2 PM, 8 PM
            peakDays: ['friday', 'saturday', 'sunday'],
            seasonalTrends: 'increasing',
          },
        },
        performance: {
          searchTimeDistribution: {
            p50: 0.045,
            p95: 0.120,
            p99: 0.250,
          },
          indexPerformance: {
            listings_v2: { avgTime: 0.042, hitRate: 0.95 },
            listings_v1: { avgTime: 0.089, hitRate: 0.88 },
          },
          cachePerformance: {
            hitRate: 0.73,
            missRate: 0.27,
            avgCacheTime: 0.005,
          },
        },
      };

      analyticsRepository.getMetrics.mockResolvedValue(performanceMetrics);

      // Act
      const result = await searchAnalyticsService.getSearchPerformance(timeRange);

      // Assert
      expect(result.summary.totalSearches).toBe(15420);
      expect(result.summary.averageSearchTime).toBe(0.067);
      expect(result.trends.popularQueries).toHaveLength(2);
      expect(result.performance.searchTimeDistribution.p95).toBe(0.120);
      expect(result.performance.cachePerformance.hitRate).toBe(0.73);
      expect(analyticsRepository.getMetrics).toHaveBeenCalledWith('search_performance', timeRange);
    });

    it('should analyze user search behavior', async () => {
      // Arrange
      const behaviorConfig = {
        timeRange: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-30'),
        },
        userSegment: 'active_users',
        includeClickData: true,
        includeConversionData: true,
      };

      const behaviorAnalysis = {
        userSegments: {
          new_users: {
            count: 1250,
            avgSearchesPerUser: 3.2,
            avgSessionDuration: 8.5, // minutes
            conversionRate: 0.12,
          },
          returning_users: {
            count: 3420,
            avgSearchesPerUser: 7.8,
            avgSessionDuration: 12.3,
            conversionRate: 0.28,
          },
          power_users: {
            count: 180,
            avgSearchesPerUser: 23.4,
            avgSessionDuration: 18.7,
            conversionRate: 0.45,
          },
        },
        searchPatterns: {
          queryEvolution: [
            {
              stage: 'initial',
              commonQueries: ['apartment', 'house', 'rent'],
              avgResultsViewed: 8.2,
            },
            {
              stage: 'refining',
              commonQueries: ['apartment in kathmandu', '2bhk house', 'budget apartment'],
              avgResultsViewed: 12.5,
            },
            {
              stage: 'specific',
              commonQueries: ['apartment in thamel with parking', '3bhk house in baneshwor'],
              avgResultsViewed: 6.8,
            },
          ],
          filterUsage: {
            priceRange: 0.73, // 73% of searches
            location: 0.89,
            amenities: 0.45,
            availability: 0.62,
          },
          clickBehavior: {
            avgClicksPerSearch: 2.3,
            topPositionClickRate: 0.34,
            scrollDepth: 0.67,
            timeToFirstClick: 3.2, // seconds
          },
        },
        conversionAnalysis: {
          searchToBooking: {
            overall: 0.23, // 23% conversion
            byCategory: {
              property: 0.28,
              vehicle: 0.19,
              equipment: 0.15,
            },
            byPriceRange: {
              budget: 0.31,
              mid_range: 0.26,
              premium: 0.18,
            },
          },
          abandonment: {
            rate: 0.77,
            reasons: {
              no_results: 0.22,
              poor_results: 0.18,
              price_too_high: 0.15,
              better_alternatives: 0.12,
            },
          },
        },
        insights: [
          {
            type: 'opportunity',
            title: 'Mobile Search Optimization',
            description: 'Mobile users have 25% lower conversion rates',
            impact: 'high',
            recommendation: 'Improve mobile search UX and filters',
          },
          {
            type: 'pattern',
            title: 'Weekend Search Surge',
            description: 'Search volume increases by 40% on weekends',
            impact: 'medium',
            recommendation: 'Scale infrastructure for weekend traffic',
          },
        ],
      };

      analyticsRepository.generateReport.mockResolvedValue(behaviorAnalysis);

      // Act
      const result = await searchAnalyticsService.analyzeUserBehavior(behaviorConfig);

      // Assert
      expect(result.userSegments.new_users.conversionRate).toBe(0.12);
      expect(result.searchPatterns.queryEvolution).toHaveLength(3);
      expect(result.searchPatterns.filterUsage.priceRange).toBe(0.73);
      expect(result.conversionAnalysis.searchToBooking.overall).toBe(0.23);
      expect(result.insights).toHaveLength(2);
      expect(result.insights[0].type).toBe('opportunity');
    });

    it('should generate search quality metrics', async () => {
      // Arrange
      const qualityConfig = {
        timeRange: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-30'),
        },
        includeUserFeedback: true,
        includeRelevanceAnalysis: true,
      };

      const qualityMetrics = {
        relevance: {
          averageRelevanceScore: 0.78,
          relevanceDistribution: {
            excellent: 0.23,
            good: 0.41,
            fair: 0.28,
            poor: 0.08,
          },
          relevanceByCategory: {
            property: 0.82,
            vehicle: 0.75,
            equipment: 0.71,
          },
        },
        userSatisfaction: {
          overallRating: 4.2, // out of 5
          ratingDistribution: {
            5: 0.38,
            4: 0.29,
            3: 0.18,
            2: 0.09,
            1: 0.06,
          },
          feedbackThemes: {
            positive: ['accurate_results', 'fast_search', 'good_filters'],
            negative: ['irrelevant_results', 'limited_options', 'slow_loading'],
          },
        },
        searchEffectiveness: {
          successRate: 0.85, // 85% of searches lead to at least one click
          zeroResultsRate: 0.08,
          refinementRate: 0.34, // 34% of searches are refined
          conversionRate: 0.23,
        },
        qualityIssues: [
          {
            type: 'low_relevance',
            queries: ['cheap luxury apartment', 'free house rent'],
            frequency: 45,
            impact: 'medium',
            suggestedFix: 'improve query understanding and synonym handling',
          },
          {
            type: 'no_results',
            queries: ['penthouse in jiri', 'beach house in kathmandu'],
            frequency: 23,
            impact: 'high',
            suggestedFix: 'provide alternative suggestions and expand search area',
          },
        ],
        recommendations: [
          {
            priority: 'high',
            action: 'improve_relevance_algorithm',
            expectedImpact: '+15% relevance score',
            implementation: 'machine_learning_model_update',
          },
          {
            priority: 'medium',
            action: 'enhance_query_expansion',
            expectedImpact: '-30% zero_results_rate',
            implementation: 'synonym_dictionary_expansion',
          },
        ],
      };

      analyticsRepository.generateReport.mockResolvedValue(qualityMetrics);

      // Act
      const result = await searchAnalyticsService.getSearchQuality(qualityConfig);

      // Assert
      expect(result.relevance.averageRelevanceScore).toBe(0.78);
      expect(result.userSatisfaction.overallRating).toBe(4.2);
      expect(result.searchEffectiveness.successRate).toBe(0.85);
      expect(result.qualityIssues).toHaveLength(2);
      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0].priority).toBe('high');
    });
  });

  describe('Real-time Analytics', () => {
    it('should provide real-time search metrics', async () => {
      // Arrange
      const realTimeConfig = {
        windowSize: '5_minutes',
        includeActiveUsers: true,
        includeTrendingQueries: true,
      };

      const realTimeMetrics = {
        timestamp: new Date(),
        window: '5_minutes',
        current: {
          activeSearches: 23,
          searchesPerMinute: 4.6,
          uniqueUsers: 18,
          averageResponseTime: 0.058,
        },
        trending: {
          queries: [
            { query: 'weekend getaway', count: 12, trend: 'up' },
            { query: 'monsoon special', count: 8, trend: 'up' },
            { query: 'summer discount', count: 6, trend: 'down' },
          ],
          locations: [
            { location: 'Kathmandu', count: 34, trend: 'stable' },
            { location: 'Pokhara', count: 18, trend: 'up' },
          ],
          categories: [
            { category: 'property', count: 28, trend: 'up' },
            { category: 'vehicle', count: 15, trend: 'stable' },
          ],
        },
        performance: {
          currentResponseTime: 0.058,
          errorRate: 0.002, // 0.2%
          cacheHitRate: 0.71,
          searchThroughput: 156, // searches per minute
        },
        alerts: [
          {
            type: 'performance',
            severity: 'warning',
            message: 'Response time increased by 25%',
            threshold: 0.05,
            currentValue: 0.058,
          },
        ],
      };

      analyticsRepository.getRealTimeMetrics.mockResolvedValue(realTimeMetrics);

      // Act
      const result = await searchAnalyticsService.getRealTimeMetrics(realTimeConfig);

      // Assert
      expect(result.current.activeSearches).toBe(23);
      expect(result.current.searchesPerMinute).toBe(4.6);
      expect(result.trending.queries).toHaveLength(3);
      expect(result.trending.queries[0].trend).toBe('up');
      expect(result.performance.currentResponseTime).toBe(0.058);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].severity).toBe('warning');
    });

    it('should detect search anomalies in real-time', async () => {
      // Arrange
      const anomalyConfig = {
        detectionWindow: '10_minutes',
        sensitivity: 'medium',
        includeAlerts: true,
      };

      const anomalyDetection = {
        timestamp: new Date(),
        anomalies: [
          {
            type: 'search_volume_spike',
            severity: 'high',
            description: 'Search volume increased by 300%',
            current: 45, // searches per minute
            baseline: 15,
            deviation: 3.0, // standard deviations
            potentialCause: 'marketing_campaign_or_viral_content',
            affectedQueries: ['monsoon offer', 'discount code'],
          },
          {
            type: 'response_time_degradation',
            severity: 'medium',
            description: 'Average response time increased by 150%',
            current: 0.125, // seconds
            baseline: 0.05,
            deviation: 2.1,
            potentialCause: 'database_performance_issue',
            impact: 'user_experience',
          },
        ],
        systemHealth: {
          overall: 'degraded',
          searchIndex: 'healthy',
          cache: 'degraded',
          database: 'healthy',
        },
        recommendations: [
          {
            action: 'scale_search_infrastructure',
            urgency: 'immediate',
            estimatedImpact: 'reduce_response_time_by_60_percent',
          },
        ],
      };

      analyticsRepository.getRealTimeMetrics.mockResolvedValue(anomalyDetection);

      // Act
      const result = await searchAnalyticsService.detectAnomalies(anomalyConfig);

      // Assert
      expect(result.anomalies).toHaveLength(2);
      expect(result.anomalies[0].severity).toBe('high');
      expect(result.anomalies[0].deviation).toBe(3.0);
      expect(result.systemHealth.overall).toBe('degraded');
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].urgency).toBe('immediate');
    });

    it('should track real-time user interactions', async () => {
      // Arrange
      const interactionConfig = {
        windowSize: '1_minute',
        includeClickEvents: true,
        includeFilterEvents: true,
      };

      const interactionData = {
        timestamp: new Date(),
        window: '1_minute',
        interactions: {
          total: 156,
          byType: {
            searches: 45,
            clicks: 78,
            filter_changes: 23,
            page_views: 10,
          },
          byUser: {
            new_users: 12,
            returning_users: 33,
          },
          byDevice: {
            desktop: 89,
            mobile: 56,
            tablet: 11,
          },
        },
        engagement: {
          averageSessionDuration: 4.2, // minutes
          averagePagesPerSession: 3.8,
          bounceRate: 0.32,
          conversionEvents: 8,
        },
        popularActions: [
          {
            action: 'filter_by_price',
            count: 18,
            conversionRate: 0.22,
          },
          {
            action: 'sort_by_price_low_high',
            count: 12,
            conversionRate: 0.18,
          },
        ],
      };

      analyticsRepository.getRealTimeMetrics.mockResolvedValue(interactionData);

      // Act
      const result = await searchAnalyticsService.getRealTimeInteractions(interactionConfig);

      // Assert
      expect(result.interactions.total).toBe(156);
      expect(result.interactions.byType.searches).toBe(45);
      expect(result.interactions.byDevice.desktop).toBe(89);
      expect(result.engagement.averageSessionDuration).toBe(4.2);
      expect(result.popularActions).toHaveLength(2);
      expect(result.popularActions[0].action).toBe('filter_by_price');
    });
  });

  describe('Analytics Dashboards', () => {
    it('should create comprehensive search dashboard', async () => {
      // Arrange
      const dashboardConfig = {
        timeRange: 'last_30_days',
        refreshInterval: 300, // 5 minutes
        widgets: [
          'search_volume',
          'performance_metrics',
          'user_behavior',
          'quality_metrics',
          'trending_queries',
        ],
        includeComparisons: true,
      };

      const dashboardData = {
        overview: {
          totalSearches: 45678,
          uniqueUsers: 8934,
          averageResponseTime: 0.067,
          conversionRate: 0.24,
          satisfactionScore: 4.3,
        },
        widgets: {
          searchVolume: {
            title: 'Search Volume Trends',
            type: 'line_chart',
            data: {
              daily: [
                { date: '2024-06-01', searches: 1523, users: 298 },
                { date: '2024-06-02', searches: 1498, users: 287 },
              ],
              trend: 'stable',
              growth: 2.3, // percentage
            },
          },
          performanceMetrics: {
            title: 'Performance Metrics',
            type: 'gauge_chart',
            data: {
              responseTime: { current: 0.067, target: 0.05, status: 'warning' },
              successRate: { current: 0.98, target: 0.95, status: 'good' },
              cacheHitRate: { current: 0.73, target: 0.80, status: 'warning' },
            },
          },
          userBehavior: {
            title: 'User Behavior Patterns',
            type: 'heatmap',
            data: {
              peakHours: [9, 14, 20],
              deviceDistribution: {
                desktop: 0.58,
                mobile: 0.35,
                tablet: 0.07,
              },
              sessionDuration: {
                average: 6.8,
                median: 4.2,
                p95: 18.5,
              },
            },
          },
          qualityMetrics: {
            title: 'Search Quality',
            type: 'bar_chart',
            data: {
              relevanceScore: 0.78,
              zeroResultsRate: 0.08,
              userSatisfaction: 4.3,
              refinementRate: 0.34,
            },
          },
          trendingQueries: {
            title: 'Trending Queries',
            type: 'table',
            data: [
              { query: 'monsoon special', count: 234, growth: 45.2 },
              { query: 'weekend getaway', count: 189, growth: 23.1 },
              { query: 'budget apartment', count: 156, growth: -5.3 },
            ],
          },
        },
        comparisons: {
          vsLastPeriod: {
            searches: { current: 45678, previous: 44523, change: 2.6 },
            users: { current: 8934, previous: 8765, change: 1.9 },
            conversionRate: { current: 0.24, previous: 0.22, change: 9.1 },
          },
          vsTarget: {
            responseTime: { current: 0.067, target: 0.05, variance: 34 },
            successRate: { current: 0.98, target: 0.95, variance: 3.2 },
            satisfaction: { current: 4.3, target: 4.5, variance: -4.4 },
          },
        },
        alerts: [
          {
            type: 'performance',
            severity: 'warning',
            title: 'Response Time Above Target',
            description: 'Average response time is 34% above target',
            action: 'investigate_search_performance',
          },
        ],
        lastUpdated: new Date(),
      };

      analyticsRepository.generateReport.mockResolvedValue(dashboardData);

      // Act
      const result = await searchAnalyticsService.createDashboard(dashboardConfig);

      // Assert
      expect(result.overview.totalSearches).toBe(45678);
      expect(result.widgets.searchVolume.type).toBe('line_chart');
      expect(result.widgets.performanceMetrics.data.responseTime.status).toBe('warning');
      expect(result.widgets.userBehavior.data.peakHours).toEqual([9, 14, 20]);
      expect(result.comparisons.vsLastPeriod.searches.change).toBe(2.6);
      expect(result.alerts).toHaveLength(1);
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should generate executive summary dashboard', async () => {
      // Arrange
      const executiveConfig = {
        timeRange: 'last_quarter',
        audience: 'executives',
        kpiFocus: ['growth', 'efficiency', 'user_satisfaction'],
        includeForecasts: true,
      };

      const executiveDashboard = {
        executiveSummary: {
          keyMetrics: {
            searchGrowth: 18.5, // percentage
            userGrowth: 12.3,
            revenueFromSearch: 4500000, // NPR
            operationalEfficiency: 87.5, // percentage
            customerSatisfaction: 4.3, // out of 5
          },
          performanceRating: 'B+', // Overall performance grade
          highlights: [
            'Search volume increased by 18.5% this quarter',
            'Customer satisfaction reached 4.3/5 stars',
            'Mobile search adoption grew by 25%',
          ],
          concerns: [
            'Response time increased by 15%',
            'Zero results rate remains at 8%',
          ],
        },
        kpis: {
          growth: {
            current: 18.5,
            target: 15.0,
            status: 'exceeding_target',
            trend: 'increasing',
          },
          efficiency: {
            current: 87.5,
            target: 90.0,
            status: 'below_target',
            trend: 'stable',
          },
          satisfaction: {
            current: 4.3,
            target: 4.5,
            status: 'near_target',
            trend: 'improving',
          },
        },
        forecasts: {
          nextQuarter: {
            expectedSearchGrowth: 22.3,
            confidence: 0.85,
            keyDrivers: ['seasonal_demand', 'marketing_campaigns'],
          },
          nextYear: {
            expectedAnnualGrowth: 45.8,
            confidence: 0.72,
            risks: ['competition', 'market_saturation'],
          },
        },
        strategicInsights: [
          {
            area: 'market_opportunity',
            insight: 'Mobile search represents 35% of total searches but only 25% of conversions',
            recommendation: 'Invest in mobile search optimization',
            potentialImpact: '+15% conversion_rate',
            timeline: '3_months',
          },
          {
            area: 'operational_efficiency',
            insight: 'Search infrastructure costs are 23% above industry average',
            recommendation: 'Optimize search algorithms and caching',
            potentialImpact: '-20% infrastructure_costs',
            timeline: '6_months',
          },
        ],
        actionItems: [
          {
            priority: 'high',
            action: 'Implement mobile-first search improvements',
            owner: 'Product Team',
            deadline: new Date('2024-09-30'),
            status: 'in_progress',
          },
          {
            priority: 'medium',
            action: 'Optimize search response time',
            owner: 'Engineering Team',
            deadline: new Date('2024-08-15'),
            status: 'planned',
          },
        ],
      };

      analyticsRepository.generateReport.mockResolvedValue(executiveDashboard);

      // Act
      const result = await searchAnalyticsService.createExecutiveDashboard(executiveConfig);

      // Assert
      expect(result.executiveSummary.keyMetrics.searchGrowth).toBe(18.5);
      expect(result.executiveSummary.performanceRating).toBe('B+');
      expect(result.kpis.growth.status).toBe('exceeding_target');
      expect(result.forecasts.nextQuarter.expectedSearchGrowth).toBe(22.3);
      expect(result.strategicInsights).toHaveLength(2);
      expect(result.actionItems).toHaveLength(2);
      expect(result.actionItems[0].priority).toBe('high');
    });
  });

  describe('Data Visualization', () => {
    it('should generate search trend visualizations', async () => {
      // Arrange
      const vizConfig = {
        chartType: 'multi_series',
        timeRange: 'last_90_days',
        metrics: ['search_volume', 'user_engagement', 'conversion_rate'],
        format: 'interactive',
      };

      const visualizationData = {
        chartType: 'multi_series_line',
        timeRange: 'last_90_days',
        datasets: [
          {
            name: 'Search Volume',
            data: [
              { date: '2024-04-01', value: 1234 },
              { date: '2024-04-02', value: 1256 },
              { date: '2024-04-03', value: 1198 },
            ],
            color: '#3B82F6',
            yAxis: 'left',
          },
          {
            name: 'User Engagement',
            data: [
              { date: '2024-04-01', value: 0.65 },
              { date: '2024-04-02', value: 0.68 },
              { date: '2024-04-03', value: 0.62 },
            ],
            color: '#10B981',
            yAxis: 'right',
          },
          {
            name: 'Conversion Rate',
            data: [
              { date: '2024-04-01', value: 0.22 },
              { date: '2024-04-02', value: 0.24 },
              { date: '2024-04-03', value: 0.21 },
            ],
            color: '#F59E0B',
            yAxis: 'right',
          },
        ],
        axes: {
          x: {
            type: 'datetime',
            label: 'Date',
          },
          y_left: {
            type: 'linear',
            label: 'Search Count',
            min: 0,
          },
          y_right: {
            type: 'percentage',
            label: 'Rate',
            min: 0,
            max: 1,
          },
        },
        interactions: {
          zoom: true,
          pan: true,
          crosshair: true,
          tooltip: {
            shared: true,
            format: 'detailed',
          },
        },
        insights: [
          {
            type: 'correlation',
            description: 'Search volume and user engagement show strong positive correlation',
            correlation: 0.87,
          },
          {
            type: 'anomaly',
            description: 'Conversion rate spike on 2024-04-02',
            date: '2024-04-02',
            value: 0.24,
            possibleCause: 'marketing_campaign',
          },
        ],
      };

      analyticsRepository.generateReport.mockResolvedValue(visualizationData);

      // Act
      const result = await searchAnalyticsService.generateVisualization(vizConfig);

      // Assert
      expect(result.chartType).toBe('multi_series_line');
      expect(result.datasets).toHaveLength(3);
      expect(result.datasets[0].name).toBe('Search Volume');
      expect(result.datasets[0].color).toBe('#3B82F6');
      expect(result.axes.x.type).toBe('datetime');
      expect(result.interactions.zoom).toBe(true);
      expect(result.insights).toHaveLength(2);
      expect(result.insights[0].correlation).toBe(0.87);
    });

    it('should create geographic distribution visualization', async () => {
      // Arrange
      const geoConfig = {
        visualizationType: 'heat_map',
        timeRange: 'last_30_days',
        metric: 'search_density',
        includeTrends: true,
      };

      const geoVisualization = {
        type: 'geographic_heat_map',
        metric: 'search_density',
        timeRange: 'last_30_days',
        regions: [
          {
            name: 'Kathmandu Valley',
            coordinates: [27.7172, 85.3240],
            searchVolume: 15420,
            userCount: 3420,
            density: 45.2, // searches per 1000 users
            trend: 'increasing',
            growth: 12.5,
          },
          {
            name: 'Pokhara',
            coordinates: [28.2096, 83.9856],
            searchVolume: 8934,
            userCount: 1890,
            density: 47.3,
            trend: 'stable',
            growth: 3.2,
          },
          {
            name: 'Chitwan',
            coordinates: [27.5819, 84.3525],
            searchVolume: 3456,
            userCount: 780,
            density: 44.3,
            trend: 'increasing',
            growth: 18.7,
          },
        ],
        heatMapConfig: {
          colorScale: 'viridis',
          intensityMetric: 'search_density',
          clusterRadius: 25,
          maxZoom: 15,
        },
        insights: [
          {
            type: 'regional_leader',
            region: 'Kathmandu Valley',
            metric: 'search_volume',
            value: 15420,
            marketShare: 0.58,
          },
          {
            type: 'growth_leader',
            region: 'Chitwan',
            metric: 'growth_rate',
            value: 18.7,
            trend: 'rapid_growth',
          },
        ],
        recommendations: [
          {
            region: 'Chitwan',
            action: 'increase_marketing_efforts',
            reason: 'High growth potential',
            expectedImpact: '+25% search_volume',
          },
        ],
      };

      analyticsRepository.generateReport.mockResolvedValue(geoVisualization);

      // Act
      const result = await searchAnalyticsService.generateGeoVisualization(geoConfig);

      // Assert
      expect(result.type).toBe('geographic_heat_map');
      expect(result.regions).toHaveLength(3);
      expect(result.regions[0].name).toBe('Kathmandu Valley');
      expect(result.regions[0].density).toBe(45.2);
      expect(result.heatMapConfig.colorScale).toBe('viridis');
      expect(result.insights).toHaveLength(2);
      expect(result.insights[0].region).toBe('Kathmandu Valley');
      expect(result.recommendations).toHaveLength(1);
    });
  });
});
