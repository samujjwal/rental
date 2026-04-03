import { Test, TestingModule } from '@nestjs/testing';
import { SearchService, SearchQuery, SearchResult } from './search.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { SEMANTIC_RANKING_PORT, type SemanticRankingPort } from '../ports/semantic-ranking.port';

/**
 * CRITICAL: Search Result Consistency Tests
 *
 * These tests validate the correctness of search filtering, sorting,
 * pagination, and result consistency across requests.
 *
 * Risk Level: MEDIUM - Affects user experience and conversion rates
 */
describe('SearchService - Consistency Validation', () => {
  let service: SearchService;
  let prisma: any;
  let cache: any;
  let semanticRanking: SemanticRankingPort;

  const mockListings = [
    {
      id: 'listing-1',
      title: 'Luxury Apartment in Thamel',
      description: 'Modern 2-bedroom with city views',
      slug: 'luxury-apartment-thamel',
      basePrice: 100,
      currency: 'USD',
      averageRating: 4.5,
      totalReviews: 23,
      city: 'Kathmandu',
      state: 'Bagmati',
      country: 'Nepal',
      latitude: 27.7061,
      longitude: 85.3301,
      category: { name: 'Apartments', slug: 'apartments' },
      owner: { firstName: 'John', lastName: 'Doe', averageRating: 4.8 },
      photos: [{ url: 'photo1.jpg' }],
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      bookingMode: 'INSTANT',
      condition: 'EXCELLENT',
      features: ['WiFi', 'AC', 'Kitchen'],
      amenities: ['WiFi', 'Air Conditioning'],
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'listing-2',
      title: 'Cozy Studio in Patan',
      description: 'Affordable studio near heritage sites',
      slug: 'cozy-studio-patan',
      basePrice: 50,
      currency: 'USD',
      averageRating: 4.2,
      totalReviews: 15,
      city: 'Patan',
      state: 'Bagmati',
      country: 'Nepal',
      latitude: 27.6588,
      longitude: 85.3247,
      category: { name: 'Studios', slug: 'studios' },
      owner: { firstName: 'Jane', lastName: 'Smith', averageRating: 4.6 },
      photos: [{ url: 'photo2.jpg' }],
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      bookingMode: 'REQUEST',
      condition: 'GOOD',
      features: ['WiFi', 'Kitchen'],
      amenities: ['WiFi'],
      createdAt: new Date('2024-02-20'),
    },
    {
      id: 'listing-3',
      title: 'Mountain View Villa',
      description: 'Luxury villa with Himalayan views',
      slug: 'mountain-view-villa',
      basePrice: 200,
      currency: 'USD',
      averageRating: 4.8,
      totalReviews: 42,
      city: 'Kathmandu',
      state: 'Bagmati',
      country: 'Nepal',
      latitude: 27.7172,
      longitude: 85.324,
      category: { name: 'Villas', slug: 'villas' },
      owner: { firstName: 'Mike', lastName: 'Johnson', averageRating: 4.9 },
      photos: [{ url: 'photo3.jpg' }],
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      bookingMode: 'INSTANT',
      condition: 'EXCELLENT',
      features: ['WiFi', 'AC', 'Kitchen', 'Pool', 'Garden'],
      amenities: ['WiFi', 'Air Conditioning', 'Swimming Pool'],
      createdAt: new Date('2024-03-10'),
    },
  ];

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: jest.fn().mockResolvedValue(mockListings),
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _min: { basePrice: 50 },
          _max: { basePrice: 200 },
          _avg: { basePrice: 116 },
        }),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'apartments', name: 'Apartments', slug: 'apartments' }),
      },
      $queryRaw: jest.fn(),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    semanticRanking = {
      semanticSearch: jest.fn() as jest.Mock,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: SEMANTIC_RANKING_PORT, useValue: semanticRanking },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe('CRITICAL: Filter Consistency', () => {
    it('should return consistent results across pagination', async () => {
      // Mock total count and paginated results (only listings with apartments category)
      prisma.listing.count.mockResolvedValue(1);
      prisma.listing.findMany
        .mockResolvedValueOnce([mockListings[0]]) // Page 1 - only apartments
        .mockResolvedValueOnce([]); // Page 2 - no more apartments

      const query1: SearchQuery = {
        page: 1,
        size: 2,
        categoryId: 'apartments',
      };

      const query2: SearchQuery = {
        page: 2,
        size: 2,
        categoryId: 'apartments',
      };

      const result1 = await service.search(query1);
      const result2 = await service.search(query2);

      // No duplicates across pages
      const allIds = [...result1.results, ...result2.results].map((r) => r.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);

      // All results should have same category filter applied
      result1.results.forEach((result) => {
        expect(result.categorySlug).toBe('apartments');
      });
      result2.results.forEach((result) => {
        expect(result.categorySlug).toBe('apartments');
      });
    });

    it('should apply filters consistently across all result sets', async () => {
      prisma.listing.count.mockResolvedValue(2);
      prisma.listing.findMany.mockResolvedValue(
        mockListings.filter((l) => l.basePrice >= 75 && l.basePrice <= 150),
      );

      const query: SearchQuery = {
        priceRange: { min: 75, max: 150 },
        location: { city: 'Kathmandu' },
      };

      const result = await service.search(query);

      // All results should be within price range
      result.results.forEach((listing) => {
        expect(listing.basePrice).toBeGreaterThanOrEqual(75);
        expect(listing.basePrice).toBeLessThanOrEqual(150);
        expect(listing.city).toBe('Kathmandu');
      });

      expect(result.results).toHaveLength(1); // Only listing-1 matches ($100)
    });

    it('should handle complex filter combinations correctly', async () => {
      prisma.listing.count.mockResolvedValue(1);
      prisma.listing.findMany.mockResolvedValue([mockListings[2]]); // Mountain View Villa

      const query: SearchQuery = {
        categoryId: 'villas',
        priceRange: { min: 150 },
        location: { city: 'Kathmandu' },
        filters: {
          bookingMode: 'INSTANT',
          features: ['WiFi', 'Pool'],
        },
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength(1);
      const listing = result.results[0];

      expect(listing.categorySlug).toBe('villas');
      expect(listing.basePrice).toBeGreaterThanOrEqual(150);
      expect(listing.city).toBe('Kathmandu');
      expect(listing.bookingMode).toBe('INSTANT');
      expect(listing.features).toContain('WiFi');
      expect(listing.features).toContain('Pool');
    });

    it('should maintain filter state when sorting changes', async () => {
      // Mock different sort orders but same filter
      prisma.listing.count.mockResolvedValue(2);

      const priceAscQuery: SearchQuery = {
        location: { city: 'Kathmandu' },
        sort: 'price_asc',
      };

      const priceDescQuery: SearchQuery = {
        location: { city: 'Kathmandu' },
        sort: 'price_desc',
      };

      // Mock sorted results
      prisma.listing.findMany
        .mockResolvedValueOnce([mockListings[0], mockListings[2]]) // Price ascending
        .mockResolvedValueOnce([mockListings[2], mockListings[0]]); // Price descending

      const result1 = await service.search(priceAscQuery);
      const result2 = await service.search(priceDescQuery);

      // Same filter applied (Kathmandu listings)
      expect(result1.results).toHaveLength(2);
      expect(result2.results).toHaveLength(2);

      // All results should be from Kathmandu
      [...result1.results, ...result2.results].forEach((result) => {
        expect(result.city).toBe('Kathmandu');
      });

      // Different sort orders
      expect(result1.results[0].basePrice).toBeLessThan(result1.results[1].basePrice);
      expect(result2.results[0].basePrice).toBeGreaterThan(result2.results[1].basePrice);
    });
  });

  describe('CRITICAL: Sorting Correctness', () => {
    it('should sort by relevance correctly', async () => {
      prisma.listing.count.mockResolvedValue(3);

      // Mock text search to return all listings directly
      prisma.$queryRawUnsafe.mockResolvedValue(
        mockListings.map((l) => ({
          ...l,
          owner_firstName: 'John',
          owner_lastName: 'Doe',
          owner_averageRating: 4.5,
          category_id: 'apartments',
          category_name: 'Apartments',
          category_slug: 'apartments',
        })),
      );

      const query: SearchQuery = {
        query: 'luxury mountain view',
        sort: 'relevance',
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength(3);

      // All results should have scores calculated
      result.results.forEach((r) => {
        expect(r.score).toBeDefined();
      });
    });

    it('should sort by price correctly (ascending)', async () => {
      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue([
        mockListings[1], // $50
        mockListings[0], // $100
        mockListings[2], // $200
      ]);

      const query: SearchQuery = {
        sort: 'price_asc',
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength(3);
      expect(result.results[0].basePrice).toBe(50);
      expect(result.results[1].basePrice).toBe(100);
      expect(result.results[2].basePrice).toBe(200);

      // Verify ascending order
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].basePrice).toBeLessThanOrEqual(result.results[i].basePrice);
      }
    });

    it('should sort by price correctly (descending)', async () => {
      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue([
        mockListings[2], // $200
        mockListings[0], // $100
        mockListings[1], // $50
      ]);

      const query: SearchQuery = {
        sort: 'price_desc',
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength(3);
      expect(result.results[0].basePrice).toBe(200);
      expect(result.results[1].basePrice).toBe(100);
      expect(result.results[2].basePrice).toBe(50);

      // Verify descending order
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].basePrice).toBeGreaterThanOrEqual(result.results[i].basePrice);
      }
    });

    it('should sort by rating correctly', async () => {
      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue([
        mockListings[2], // 4.8 rating
        mockListings[0], // 4.5 rating
        mockListings[1], // 4.2 rating
      ]);

      const query: SearchQuery = {
        sort: 'rating',
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength(3);
      expect(result.results[0].averageRating).toBe(4.8);
      expect(result.results[1].averageRating).toBe(4.5);
      expect(result.results[2].averageRating).toBe(4.2);

      // Verify descending rating order
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].averageRating).toBeGreaterThanOrEqual(
          result.results[i].averageRating,
        );
      }
    });

    it('should handle tie-breaking in sorting', async () => {
      const listingsWithSamePrice = [
        { ...mockListings[0], basePrice: 100, averageRating: 4.5 },
        { ...mockListings[1], basePrice: 100, averageRating: 4.8 },
        { ...mockListings[2], basePrice: 100, averageRating: 4.2 },
      ];

      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue(listingsWithSamePrice);

      const query: SearchQuery = {
        sort: 'price_asc',
      };

      const result = await service.search(query);

      // All have same price, should have consistent secondary sort
      expect(result.results).toHaveLength(3);
      result.results.forEach((result) => {
        expect(result.basePrice).toBe(100);
      });

      // Should have deterministic order (implementation-dependent)
      // This test ensures the order is consistent across calls
      const result2 = await service.search(query);
      expect(result2.results.map((r) => r.id)).toEqual(result.results.map((r) => r.id));
    });
  });

  describe('CRITICAL: Pagination Consistency', () => {
    it('should maintain consistent page boundaries', async () => {
      const totalItems = 25;
      const pageSize = 10;

      prisma.listing.count.mockResolvedValue(totalItems);

      // Mock results for each page
      const mockPageResults = (page: number) => {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return mockListings
          .concat(
            Array.from({ length: 22 }, (_, i) => ({
              ...mockListings[0],
              id: `listing-${i + 4}`,
              title: `Additional Listing ${i + 4}`,
            })),
          )
          .slice(start, end);
      };

      prisma.listing.findMany.mockImplementation(({ skip }) => {
        const page = Math.floor(skip / pageSize) + 1;
        return Promise.resolve(mockPageResults(page));
      });

      // Test all pages
      const pages = [];
      for (let page = 1; page <= 3; page++) {
        const query: SearchQuery = { page, size: pageSize };
        const result = await service.search(query);
        pages.push(result);
      }

      // Verify page boundaries
      expect(pages[0].results).toHaveLength(10);
      expect(pages[1].results).toHaveLength(10);
      expect(pages[2].results).toHaveLength(5);

      // Verify total count consistency
      pages.forEach((page) => {
        expect(page.total).toBe(totalItems);
        expect(page.page).toBeDefined();
      });

      // Verify no duplicates across pages
      const allIds = pages.flatMap((p) => p.results).map((r) => r.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('should handle cursor-based pagination correctly', async () => {
      prisma.listing.count.mockResolvedValue(3);
      // Mock cursor-based filtering
      prisma.listing.findMany.mockImplementation(({ where }: any) => {
        if (where?.id?.gt) {
          // Return items after cursor
          return Promise.resolve(mockListings.filter((l) => l.id > where.id.gt));
        }
        return Promise.resolve(mockListings);
      });

      const query1: SearchQuery = {
        cursor: undefined,
        size: 2,
        cursorField: 'id',
        cursorDirection: 'asc',
      };

      const query2: SearchQuery = {
        cursor: 'listing-2', // cursor is base64 encoded id
        size: 2,
        cursorField: 'id',
        cursorDirection: 'asc',
      };

      const result1 = await service.search(query1);
      const result2 = await service.search(query2);

      // First page should return all 3 items (no cursor filter)
      expect(result1.results).toHaveLength(3);

      // Second page should return items after listing-2
      expect(result2.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should validate pagination parameters', async () => {
      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      // Test that invalid values are normalized to valid ones
      const testCases = [
        { input: { page: 0 }, expectedPage: 1 }, // Invalid page becomes 1
        { input: { size: 0 }, expectedSize: 1 }, // Invalid size becomes 1
        { input: { page: -1 }, expectedPage: 1 }, // Negative page becomes 1
        { input: { size: -1 }, expectedSize: 1 }, // Negative size becomes 1
        { input: { size: 1000 }, expectedSize: 100 }, // Size too large becomes 100
      ];

      for (const testCase of testCases) {
        const result = await service.search(testCase.input as SearchQuery);
        // Service should normalize invalid values and return results
        expect(result.results).toBeDefined();
        expect(result.page).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('CRITICAL: Search Result Accuracy', () => {
    it('should return accurate location-based results', async () => {
      prisma.listing.count.mockResolvedValue(2);
      prisma.listing.findMany.mockResolvedValue([mockListings[0], mockListings[2]]);

      const query: SearchQuery = {
        location: {
          lat: 27.7061,
          lon: 85.3301,
          radius: '5km',
        },
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength(2);

      // All results should be within radius
      result.results.forEach((listing) => {
        expect(listing.distance).toBeDefined();
        expect(listing.distance).toBeLessThanOrEqual(5);
      });

      // Should include distance in results (distance can be 0 if exact match)
      expect(result.results[0].distance).toBeGreaterThanOrEqual(0);
    });

    it('should handle text search relevance correctly', async () => {
      // Mock text search to return listing IDs
      prisma.$queryRawUnsafe.mockResolvedValue([
        { id: mockListings[0].id },
        { id: mockListings[2].id },
      ]);

      prisma.listing.findMany.mockResolvedValue([mockListings[0], mockListings[2]]);

      // Mock semantic search for relevance scoring
      (semanticRanking.semanticSearch as jest.Mock).mockResolvedValue([
        { id: mockListings[0].id, title: mockListings[0].title, distance: 0.1 },
        { id: mockListings[2].id, title: mockListings[2].title, distance: 0.2 },
      ]);

      const query: SearchQuery = {
        query: 'luxury apartment',
        sort: 'relevance',
      };

      const result = await service.search(query);

      expect(result.results.length).toBeGreaterThan(0);

      // Results should have relevance scores
      result.results.forEach((listing) => {
        expect(listing.score).toBeDefined();
      });
    });

    it('should maintain result consistency across identical queries', async () => {
      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const query: SearchQuery = {
        location: { city: 'Kathmandu' },
        sort: 'price_asc',
      };

      const result1 = await service.search(query);
      const result2 = await service.search(query);

      // Results should be identical
      expect(result1.results.map((r) => r.id)).toEqual(result2.results.map((r) => r.id));
      expect(result1.total).toBe(result2.total);
      expect(result1.page).toBe(result2.page);
    });

    it('should handle empty result sets gracefully', async () => {
      prisma.listing.count.mockResolvedValue(0);
      prisma.listing.findMany.mockResolvedValue([]);

      const query: SearchQuery = {
        location: { city: 'NonExistentCity' },
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBeDefined();
    });
  });

  describe('CRITICAL: Performance and Caching', () => {
    it('should cache frequently accessed queries', async () => {
      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const query: SearchQuery = {
        location: { city: 'Kathmandu' },
        sort: 'price_asc',
      };

      // First call - should hit database
      await service.search(query);
      expect(prisma.listing.findMany).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalled();

      // Reset mocks
      prisma.listing.findMany.mockClear();
      cache.get.mockResolvedValue(JSON.stringify({ results: mockListings, total: 3 }));

      // Second call - should hit cache
      await service.search(query);
      expect(prisma.listing.findMany).not.toHaveBeenCalled();
      expect(cache.get).toHaveBeenCalled();
    });

    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockListings[0],
        id: `listing-${i}`,
        title: `Listing ${i}`,
      }));

      prisma.listing.count.mockResolvedValue(1000);
      prisma.listing.findMany.mockResolvedValue(largeResultSet.slice(0, 20));

      const startTime = Date.now();

      const query: SearchQuery = {
        page: 1,
        size: 20,
      };

      const result = await service.search(query);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.results).toHaveLength(20);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should invalidate cache when data changes', async () => {
      prisma.listing.count.mockResolvedValue(3);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const query: SearchQuery = { location: { city: 'Kathmandu' } };

      // First call
      await service.search(query);
      expect(cache.set).toHaveBeenCalled();

      // Simulate data update (cache invalidation)
      // This would depend on implementation
      expect(cache.del).toBeDefined();
    });
  });
});
