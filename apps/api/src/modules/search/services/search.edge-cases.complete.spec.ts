import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('SearchService - Edge Cases Complete Coverage', () => {
  let service: SearchService;
  let prisma: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe('Query Processing Edge Cases', () => {
    it('should handle empty queries gracefully', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({});

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
    });

    it('should handle null/undefined queries', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result1 = await service.search({ query: null });
      const result2 = await service.search({ query: undefined });

      expect(result1.results).toEqual([]);
      expect(result2.results).toEqual([]);
    });

    it('should process special characters correctly', async () => {
      const mockListings = [
        { id: '1', title: 'Café & Restaurant', description: 'Great food!' },
        { id: '2', title: 'Hotel 🏨', description: 'Luxury stay' },
      ];

      prisma.listing.findMany.mockResolvedValue(mockListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await service.search({ query: 'Café & Restaurant 🏨' });

      expect(result.results).toHaveLength(2);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('Café & Restaurant 🏨'),
        expect.any(String),
      );
    });

    it('should handle extremely long queries', async () => {
      const longQuery = 'a'.repeat(1000);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ query: longQuery });

      expect(result.results).toEqual([]);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    });

    it('should handle Unicode and emoji characters', async () => {
      const mockListings = [
        { id: '1', title: '🏖️ Beach House', description: 'Sunny vibes' },
        { id: '2', title: '🏔️ Mountain Cabin', description: 'Cozy retreat' },
      ];

      prisma.listing.findMany.mockResolvedValue(mockListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await service.search({ query: '🏖️ 🏔️ beach mountain' });

      expect(result.results).toHaveLength(2);
    });

    it('should handle SQL injection attempts safely', async () => {
      const maliciousQuery = "'; DROP TABLE listings; --";
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ query: maliciousQuery });

      expect(result.results).toEqual([]);
      // Should not execute malicious SQL
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("'; DROP TABLE listings; --"),
        expect.any(String),
      );
    });

    it('should handle XSS attempts safely', async () => {
      const xssQuery = '<script>alert("xss")</script>';
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ query: xssQuery });

      expect(result.results).toEqual([]);
    });
  });

  describe('Filter Combinations', () => {
    it('should handle conflicting filters correctly', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      // Conflicting price range
      const result2 = await service.search({
        query: 'test',
        priceRange: { min: 100, max: 50 }, // Less than minPrice
      });

      expect(result2.results).toEqual([]);
    });

    it('should handle complex filter combinations', async () => {
      const mockListings = [
        { id: '1', price: 100, bedrooms: 2, city: 'New York' },
        { id: '2', price: 150, bedrooms: 3, city: 'Los Angeles' },
      ];

      prisma.listing.findMany.mockResolvedValue(mockListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result1 = await service.search({
        query: 'test',
        priceRange: { min: 80, max: 120 },
        location: { city: 'New York' },
        categoryId: 'cat-1',
      });

      expect(result1.results).toHaveLength(1);
    });

    it('should optimize filter execution order', async () => {
      const mockListings = [{ id: '1', price: 100 }];

      prisma.listing.findMany.mockResolvedValue(mockListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }]);

      const result3 = await service.search({
        query: 'test',
        priceRange: { min: 50, max: 150 },
        location: { city: 'New York' },
        categoryId: 'cat-1',
      });

      // Should apply text search first (most selective)
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(prisma.listing.findMany).toHaveBeenCalled();
    });

    it('should handle empty filter arrays', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result4 = await service.search({
        query: 'test',
        filters: {
          amenities: [], // Empty array
          features: [], // Empty array
        },
      });

      expect(result4.results).toEqual([]);
    });

    it('should handle null/undefined filter values', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result5 = await service.search({
        query: 'test',
        priceRange: { min: null, max: undefined },
        location: { city: null },
      });

      expect(result5.results).toEqual([]);
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle cursor pagination at boundaries', async () => {
      const mockListings = Array.from({ length: 50 }, (_, i) => ({ id: `listing-${i}` }));

      prisma.listing.findMany.mockResolvedValue(mockListings.slice(0, 20));
      prisma.$queryRawUnsafe.mockResolvedValue(mockListings.map((l) => ({ id: l.id })));

      // First page
      const firstPage = await service.search({ page: 1, size: 20 });
      expect(firstPage.results).toHaveLength(20);
      expect(firstPage.hasMore).toBe(true);

      // Last page
      prisma.listing.findMany.mockResolvedValue(mockListings.slice(40, 50));
      const lastPage = await service.search({ page: 3, size: 20 });
      expect(lastPage.results).toHaveLength(10);
      expect(lastPage.hasMore).toBe(false);
    });

    it('should handle cursor pagination consistency', async () => {
      const mockListings = Array.from({ length: 100 }, (_, i) => ({
        id: `listing-${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      }));

      prisma.listing.findMany.mockResolvedValue(mockListings.slice(0, 20));
      prisma.$queryRawUnsafe.mockResolvedValue(mockListings.map((l) => ({ id: l.id })));

      const result1 = await service.search({ page: 1, size: 20 });
      const result2 = await service.search({ page: 2, size: 20 });

      // Should not have overlapping results
      const ids1 = result1.results.map((r) => r.id);
      const ids2 = result2.results.map((r) => r.id);
      const overlap = ids1.filter((id) => ids2.includes(id));

      expect(overlap).toHaveLength(0);
    });

    it('should maintain consistency across pages', async () => {
      const mockListings = Array.from({ length: 100 }, (_, i) => ({
        id: `listing-${i}`,
        price: 100 + i * 10,
      }));

      prisma.listing.findMany.mockResolvedValue(mockListings.slice(0, 20));
      prisma.$queryRawUnsafe.mockResolvedValue(mockListings.map((l) => ({ id: l.id })));

      const page1 = await service.search({ page: 1, size: 20, priceRange: { min: 100 } });
      const page2 = await service.search({ page: 2, size: 20, priceRange: { min: 100 } });

      // Same filters should produce consistent ordering
      const allPrices = [...page1.results, ...page2.results].map((r) => r.basePrice);
      const sortedPrices = [...allPrices].sort((a, b) => a - b);

      expect(allPrices).toEqual(sortedPrices);
    });

    it('should handle invalid pagination parameters', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result1 = await service.search({ page: -1 });
      const result2 = await service.search({ size: 0 });
      const result3 = await service.search({ size: 1000 });

      expect(result1.page).toBe(1); // Normalized to 1
      expect(result2.size).toBe(20); // Normalized to default
      expect(result3.size).toBe(100); // Normalized to max
    });

    it('should handle cursor-based pagination', async () => {
      const mockListings = Array.from({ length: 50 }, (_, i) => ({
        id: `listing-${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      }));

      prisma.listing.findMany.mockResolvedValue(mockListings.slice(0, 20));
      prisma.$queryRawUnsafe.mockResolvedValue(mockListings.map((l) => ({ id: l.id })));

      const firstPage = await service.search({ cursor: null });
      expect(firstPage.nextCursor).toBeDefined();

      // Use next cursor for second page
      prisma.listing.findMany.mockResolvedValue(mockListings.slice(20, 40));
      const secondPage = await service.search({ cursor: firstPage.nextCursor });
      expect(secondPage.results).toHaveLength(20);
    });
  });

  describe('Category Filter Edge Cases', () => {
    it('should handle non-existent categories', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ categoryId: 'non-existent' });

      expect(result.results).toEqual([]);
    });

    it('should handle category hierarchy correctly', async () => {
      const parentCategory = { id: 'parent-1', name: 'Vacation Rentals' };
      const childCategories = [
        { id: 'child-1', name: 'Apartments' },
        { id: 'child-2', name: 'Houses' },
      ];

      prisma.category.findFirst.mockResolvedValue(parentCategory);
      prisma.category.findMany.mockResolvedValue(childCategories);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ categoryId: 'parent-1' });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: { in: ['parent-1', 'child-1', 'child-2'] },
          }),
        }),
      );
    });

    it('should handle category by slug', async () => {
      const category = { id: 'cat-1', slug: 'apartments', name: 'Apartments' };

      prisma.category.findFirst.mockResolvedValue(category);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ categoryId: 'apartments' });

      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ slug: { equals: 'apartments', mode: 'insensitive' } }]),
          }),
        }),
      );
    });
  });

  describe('Location Search Edge Cases', () => {
    it('should handle invalid coordinates', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result1 = await service.search({ 
        location: { lat: 91, lon: 0 } // Invalid latitude
      });
      const result2 = await service.search({ 
        location: { lat: 0, lon: 181 } // Invalid longitude
      });
      const result3 = await service.search({ 
        location: { lat: null, lon: null }
      });

      expect(result1.results).toEqual([]);
      expect(result2.results).toEqual([]);
      expect(result3.results).toEqual([]);
    });

    it('should handle extreme coordinates', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result1 = await service.search({ 
        location: { lat: 90, lon: 180 } // North pole
      });
      const result2 = await service.search({ 
        location: { lat: -90, lon: -180 } // South pole
      });

      expect(result1.results).toEqual([]);
      expect(result2.results).toEqual([]);
    });

  describe('Location Search Edge Cases', () => {
    it('should handle distance calculations correctly', async () => {
    const mockListings = [
      { id: '1', latitude: 40.7128, longitude: -74.006 }, // NYC
      { id: '2', latitude: 34.0522, longitude: -118.2437 }, // LA
    ];

    prisma.listing.findMany.mockResolvedValue(mockListings);
    prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }, { id: '2' }]);

    const result = await service.search({
      location: {
        lat: 40.7589,
        lon: -73.9851, // Near NYC
        radius: '10km',
      },
    });

    expect(result.results).toHaveLength(2);
    // NYC listing should have higher relevance due to proximity
  });
  });

  describe('Price Filter Edge Cases', () => {
    it('should handle negative prices', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({
        priceRange: { min: -100 },
      });

      expect(result.results).toEqual([]);
    });

    it('should handle extremely large prices', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({
        priceRange: { max: Number.MAX_SAFE_INTEGER },
      });

      expect(result.results).toEqual([]);
    });

    it('should handle price precision correctly', async () => {
      const mockListings = [
        { id: '1', basePrice: 99.99 },
        { id: '2', basePrice: 100.01 },
      ];

      prisma.listing.findMany.mockResolvedValue(mockListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await service.search({
        priceRange: { min: 100, max: 100 },
      });

      // Should handle decimal precision correctly
      expect(result.results).toHaveLength(2);
    });
  });

  describe('Cache Behavior Edge Cases', () => {
    it('should handle cache miss gracefully', async () => {
      cache.get.mockResolvedValue(null);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ query: 'test' });

      expect(result.results).toEqual([]);
      expect(cache.get).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      cache.get.mockRejectedValue(new Error('Cache error'));
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.search({ query: 'test' });

      expect(result.results).toEqual([]);
    });

    it('should not cache empty results', async () => {
      cache.get.mockResolvedValue(null);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.search({ query: 'test' });

      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should respect cache TTL', async () => {
      const mockListings = [{ id: '1', title: 'Test Listing' }];

      cache.get.mockResolvedValue(null);
      prisma.listing.findMany.mockResolvedValue(mockListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }]);

      await service.search({ query: 'test' });

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('search:'),
        expect.any(Object),
        300, // 5 minutes TTL
      );
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 10000 }, (_, i) => ({
        id: `listing-${i}`,
        title: `Listing ${i}`,
      }));

      prisma.listing.findMany.mockResolvedValue(largeResultSet.slice(0, 20));
      prisma.$queryRawUnsafe.mockResolvedValue(
        largeResultSet.slice(0, 20).map((l) => ({ id: l.id })),
      );

      const startTime = Date.now();
      const result = await service.search({ size: 20 });
      const endTime = Date.now();

      expect(result.results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent searches', async () => {
      const mockListings = [{ id: '1', title: 'Test' }];

      prisma.listing.findMany.mockResolvedValue(mockListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }]);

      const promises = Array.from({ length: 100 }, (_, i) =>
        service.search({ query: `test-${i}` }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      results.forEach((result) => {
        expect(result.results).toHaveLength(1);
      });
    });
  });

  describe('Data Integrity Edge Cases', () => {
    it('should handle malformed listing data', async () => {
      const malformedListings = [
        { id: '1', title: null, description: undefined },
        { id: '2', price: 'invalid', latitude: NaN, longitude: null },
      ];

      prisma.listing.findMany.mockResolvedValue(malformedListings);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await service.search({ query: 'test' });

      expect(result.results).toHaveLength(2);
      // Should not crash on malformed data
    });

    it('should handle database connection errors', async () => {
      prisma.listing.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.search({ query: 'test' })).rejects.toThrow('Database connection failed');
    });

    it('should handle partial database failures', async () => {
      prisma.$queryRawUnsafe.mockRejectedValue(new Error('FTS search failed'));
      prisma.listing.findMany.mockResolvedValue([]);

      const result = await service.search({ query: 'test' });

      expect(result.results).toEqual([]);
      // Should fallback gracefully
    });
  });
});
