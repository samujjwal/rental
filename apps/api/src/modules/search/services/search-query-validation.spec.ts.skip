import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { SearchQueryValidator } from './search-query-validator.service';
import { AnalyticsService } from '../services/analytics.service';
import { CacheService } from '../../cache/cache.service';

/**
 * SEARCH/ANALYTICS QUERY VALIDATION TESTS
 * 
 * These tests validate search query processing and analytics data integrity:
 * - Search query parsing and validation
 * - Filter and sorting logic
 * - Analytics data collection
 * - Query optimization
 * - Search result accuracy
 * 
 * Business Truth Validated:
 * - Search queries return accurate results
 * - Filters work correctly
 * - Analytics data is properly collected
 * - Search performance is optimized
 * - Query validation prevents abuse
 */

describe('SearchQueryValidator', () => {
  let validator: SearchQueryValidator;
  let searchService: SearchService;
  let analyticsService: AnalyticsService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchQueryValidator,
        {
          provide: SearchService,
          useValue: {
            search: jest.fn(),
            getSuggestions: jest.fn(),
            getPopularSearches: jest.fn(),
          },
        },
        {
          provide: AnalyticsService,
          useValue: {
            trackSearch: jest.fn(),
            getSearchMetrics: jest.fn(),
            updateSearchIndex: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();

    validator = module.get<SearchQueryValidator>(SearchQueryValidator);
    searchService = module.get<SearchService>(SearchService);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    cacheService = module.get<CacheService>(CacheService);
  });

  describe('Query Validation', () => {
    it('should validate basic search queries', async () => {
      const query = {
        q: 'apartment in Kathmandu',
        limit: 10,
        offset: 0,
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedQuery).toEqual(query);
    });

    it('should reject invalid search queries', async () => {
      const query = {
        q: '', // Empty query
        limit: -1, // Invalid limit
        offset: -10, // Invalid offset
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Query cannot be empty');
      expect(result.errors).toContain('Limit must be positive');
      expect(result.errors).toContain('Offset must be non-negative');
    });

    it('should sanitize potentially dangerous queries', async () => {
      const query = {
        q: '<script>alert("xss")</script> apartment',
        filters: {
          price: 'DROP TABLE listings; --',
        },
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery.q).not.toContain('<script>');
      expect(result.sanitizedQuery.filters.price).not.toContain('DROP TABLE');
    });

    it('should validate complex filter queries', async () => {
      const query = {
        q: 'luxury apartment',
        filters: {
          price_min: 1000,
          price_max: 5000,
          bedrooms: 2,
          bathrooms: 2,
          amenities: ['wifi', 'parking', 'gym'],
          property_type: 'apartment',
          location: 'Kathmandu',
          available_from: '2024-06-01',
          available_to: '2024-12-31',
        },
        sort: 'price_asc',
        limit: 20,
        offset: 0,
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedQuery.filters.price_min).toBe(1000);
      expect(result.sanitizedQuery.filters.price_max).toBe(5000);
    });

    it('should reject invalid filter values', async () => {
      const query = {
        q: 'apartment',
        filters: {
          price_min: -100, // Negative price
          price_max: 0, // Zero price
          bedrooms: 10, // Too many bedrooms
          bathrooms: -1, // Negative bathrooms
          amenities: 'not-an-array', // Should be array
          available_from: 'invalid-date', // Invalid date
        },
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum price must be positive');
      expect(result.errors).toContain('Maximum price must be positive');
      expect(result.errors).toContain('Bedrooms cannot exceed 5');
      expect(result.errors).toContain('Bathrooms must be positive');
      expect(result.errors).toContain('Amenities must be an array');
    });

    it('should validate geo-spatial queries', async () => {
      const query = {
        q: 'apartment near me',
        location: {
          lat: 27.7172,
          lng: 85.3240,
          radius: 5, // 5km radius
        },
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery.location.lat).toBe(27.7172);
      expect(result.sanitizedQuery.location.lng).toBe(85.3240);
      expect(result.sanitizedQuery.location.radius).toBe(5);
    });

    it('should reject invalid geo-spatial queries', async () => {
      const query = {
        q: 'apartment',
        location: {
          lat: 91, // Invalid latitude
          lng: 181, // Invalid longitude
          radius: -1, // Negative radius
        },
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Latitude must be between -90 and 90');
      expect(result.errors).toContain('Longitude must be between -180 and 180');
      expect(result.errors).toContain('Radius must be positive');
    });
  });

  describe('Search Query Processing', () => {
    it('should process natural language queries', async () => {
      const query = '2 bedroom apartment in Kathmandu under 3000 per month with parking';
      
      const processed = await validator.processNaturalLanguageQuery(query);
      
      expect(processed.q).toBe('apartment Kathmandu');
      expect(processed.filters.bedrooms).toBe(2);
      expect(processed.filters.price_max).toBe(3000);
      expect(processed.filters.amenities).toContain('parking');
    });

    it('should extract location from queries', async () => {
      const queries = [
        'apartment in Kathmandu',
        'house near Lalitpur',
        'flat in Pokhara city',
        'rental in Bhaktapur area',
      ];

      for (const query of queries) {
        const processed = await validator.processNaturalLanguageQuery(query);
        expect(processed.location).toBeDefined();
        expect(processed.location).toMatch(/Kathmandu|Lalitpur|Pokhara|Bhaktapur/);
      }
    });

    it('should handle price range queries', async () => {
      const queries = [
        'apartment under 2000',
        'house above 5000',
        'flat between 3000 and 4000',
        'rental around 2500',
      ];

      const expected = [
        { price_max: 2000 },
        { price_min: 5000 },
        { price_min: 3000, price_max: 4000 },
        { price_min: 2250, price_max: 2750 }, // Around 2500 ± 10%
      ];

      for (let i = 0; i < queries.length; i++) {
        const processed = await validator.processNaturalLanguageQuery(queries[i]);
        expect(processed.filters).toMatchObject(expected[i]);
      }
    });

    it('should extract property features', async () => {
      const query = '3 bedroom 2 bathroom apartment with wifi parking gym balcony';
      
      const processed = await validator.processNaturalLanguageQuery(query);
      
      expect(processed.filters.bedrooms).toBe(3);
      expect(processed.filters.bathrooms).toBe(2);
      expect(processed.filters.amenities).toContain('wifi');
      expect(processed.filters.amenities).toContain('parking');
      expect(processed.filters.amenities).toContain('gym');
      expect(processed.filters.amenities).toContain('balcony');
    });

    it('should handle ambiguous queries', async () => {
      const query = 'nice place to stay';
      
      const processed = await validator.processNaturalLanguageQuery(query);
      
      expect(processed.q).toBe('nice place stay');
      expect(processed.suggestions).toBeDefined();
      expect(processed.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Search Performance Optimization', () => {
    it('should cache popular search results', async () => {
      const query = {
        q: 'apartment Kathmandu',
        limit: 10,
        offset: 0,
      };

      // Mock cache miss
      cacheService.exists.mockResolvedValue(false);
      searchService.search.mockResolvedValue({
        listings: [],
        total: 0,
        took: 50,
      });

      const result = await validator.searchWithCache(query);
      
      expect(cacheService.set).toHaveBeenCalled();
      expect(searchService.search).toHaveBeenCalledWith(query);
    });

    it('should return cached results for popular queries', async () => {
      const query = {
        q: 'apartment Kathmandu',
        limit: 10,
        offset: 0,
      };

      const cachedResult = {
        listings: [{ id: '1', title: 'Test Apartment' }],
        total: 1,
        took: 5,
      };

      // Mock cache hit
      cacheService.exists.mockResolvedValue(true);
      cacheService.get.mockResolvedValue(cachedResult);

      const result = await validator.searchWithCache(query);
      
      expect(cacheService.get).toHaveBeenCalled();
      expect(searchService.search).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
    });

    it('should implement query rate limiting', async () => {
      const userId = 'user-123';
      const query = { q: 'apartment', limit: 10 };

      // Mock rate limit check
      cacheService.get.mockResolvedValue(null); // No previous queries

      const result = await validator.checkRateLimit(userId, query);
      
      expect(result.allowed).toBe(true);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should block abusive queries', async () => {
      const userId = 'abusive-user';
      const query = { q: 'apartment', limit: 10 };

      // Mock rate limit exceeded
      cacheService.get.mockResolvedValue('100'); // 100 queries in last minute

      const result = await validator.checkRateLimit(userId, query);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
    });
  });

  describe('Analytics Integration', () => {
    it('should track search queries for analytics', async () => {
      const query = {
        q: 'luxury apartment',
        filters: { price_max: 5000 },
        userId: 'user-123',
      };

      const searchResult = {
        listings: [{ id: '1' }, { id: '2' }],
        total: 2,
        took: 45,
      };

      searchService.search.mockResolvedValue(searchResult);

      await validator.searchWithAnalytics(query);
      
      expect(analyticsService.trackSearch).toHaveBeenCalledWith({
        query: query.q,
        filters: query.filters,
        resultCount: 2,
        searchTime: 45,
        userId: 'user-123',
        timestamp: expect.any(Date),
      });
    });

    it('should collect search performance metrics', async () => {
      const queries = [
        { q: 'apartment', took: 30 },
        { q: 'house', took: 45 },
        { q: 'flat', took: 25 },
      ];

      for (const queryData of queries) {
        searchService.search.mockResolvedValue({
          listings: [],
          total: 0,
          took: queryData.took,
        });

        await validator.searchWithAnalytics({ q: queryData.q });
      }

      expect(analyticsService.trackSearch).toHaveBeenCalledTimes(3);
      
      // Verify performance tracking
      const calls = analyticsService.trackSearch.mock.calls;
      expect(calls[0][0].searchTime).toBe(30);
      expect(calls[1][0].searchTime).toBe(45);
      expect(calls[2][0].searchTime).toBe(25);
    });

    it('should generate search suggestions based on analytics', async () => {
      const popularSearches = [
        'apartment Kathmandu',
        'house Lalitpur',
        'flat Pokhara',
      ];

      analyticsService.getPopularSearches.mockResolvedValue(popularSearches);

      const suggestions = await validator.getSearchSuggestions('ap');
      
      expect(suggestions).toContain('apartment Kathmandu');
      expect(suggestions).not.toContain('house Lalitpur');
    });

    it('should update search index based on user behavior', async () => {
      const searchBehavior = {
        query: 'apartment',
        clickedListing: 'listing-123',
        timeToClick: 5000, // 5 seconds
      };

      await validator.updateSearchIndex(searchBehavior);
      
      expect(analyticsService.updateSearchIndex).toHaveBeenCalledWith({
        query: searchBehavior.query,
        listingId: searchBehavior.clickedListing,
        clickThroughRate: expect.any(Number),
        relevanceScore: expect.any(Number),
      });
    });
  });

  describe('Query Security', () => {
    it('should prevent SQL injection in search queries', async () => {
      const maliciousQueries = [
        "'; DROP TABLE listings; --",
        "' OR '1'='1",
        "'; UPDATE listings SET price=0; --",
        "' UNION SELECT * FROM users --",
      ];

      for (const query of maliciousQueries) {
        const result = await validator.validateQuery({ q: query });
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedQuery.q).not.toContain('DROP TABLE');
        expect(result.sanitizedQuery.q).not.toContain('UPDATE');
        expect(result.sanitizedQuery.q).not.toContain('UNION');
      }
    });

    it('should prevent XSS in search queries', async () => {
      const xssQueries = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '"><script>alert("xss")</script>',
      ];

      for (const query of xssQueries) {
        const result = await validator.validateQuery({ q: query });
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedQuery.q).not.toContain('<script>');
        expect(result.sanitizedQuery.q).not.toContain('javascript:');
        expect(result.sanitizedQuery.q).not.toContain('onerror');
      }
    });

    it('should validate query length limits', async () => {
      const shortQuery = 'a';
      const longQuery = 'a'.repeat(1000);

      const shortResult = await validator.validateQuery({ q: shortQuery });
      const longResult = await validator.validateQuery({ q: longQuery });

      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('Query too short');

      expect(longResult.isValid).toBe(false);
      expect(longResult.errors).toContain('Query too long');
    });

    it('should sanitize special characters in filters', async () => {
      const query = {
        q: 'apartment',
        filters: {
          location: 'Kathmandu\' OR 1=1 --',
          amenities: ['wifi<script>', 'parking"'],
        },
      };

      const result = await validator.validateQuery(query);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery.filters.location).not.toContain('OR 1=1');
      expect(result.sanitizedQuery.filters.amenities[0]).not.toContain('<script>');
    });
  });

  describe('Search Result Validation', () => {
    it('should validate search result structure', async () => {
      const query = { q: 'apartment', limit: 10 };
      const mockResults = {
        listings: [
          {
            id: '1',
            title: 'Test Apartment',
            price: 2000,
            location: { lat: 27.7172, lng: 85.3240 },
            images: ['image1.jpg'],
            amenities: ['wifi', 'parking'],
          },
        ],
        total: 1,
        took: 45,
        facets: {
          price_ranges: [{ min: 1000, max: 3000, count: 10 }],
          amenities: [{ name: 'wifi', count: 8 }],
        },
      };

      searchService.search.mockResolvedValue(mockResults);

      const result = await validator.searchWithValidation(query);
      
      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]).toHaveProperty('id');
      expect(result.listings[0]).toHaveProperty('title');
      expect(result.listings[0]).toHaveProperty('price');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('took');
      expect(result).toHaveProperty('facets');
    });

    it('should handle empty search results gracefully', async () => {
      const query = { q: 'nonexistent', limit: 10 };
      
      searchService.search.mockResolvedValue({
        listings: [],
        total: 0,
        took: 5,
        facets: {},
      });

      const result = await validator.searchWithValidation(query);
      
      expect(result.listings).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should validate listing data integrity', async () => {
      const invalidResults = {
        listings: [
          {
            id: '', // Empty ID
            title: 'Test',
            price: -1000, // Negative price
            location: null, // Missing location
          },
        ],
        total: 1,
        took: 45,
      };

      searchService.search.mockResolvedValue(invalidResults);

      const result = await validator.searchWithValidation({ q: 'test' });
      
      expect(result.listings).toHaveLength(0); // Invalid listing filtered out
      expect(result.warnings).toContain('Invalid listing data filtered');
    });
  });
});
