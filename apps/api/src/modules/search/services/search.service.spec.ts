import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { EmbeddingService } from '../../ai/services/embedding.service';

describe('SearchService', () => {
  let service: SearchService;

  const mockEmbeddingService = {
    generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    searchSimilar: jest.fn().mockResolvedValue([]),
  };

  const mockPrismaService = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'listing-1' }]),
    listing: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return search results', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.listing.count.mockResolvedValue(10);
      mockPrismaService.listing.findMany.mockResolvedValue([
        {
          id: 'listing-1',
          title: 'Test Listing',
          description: 'Test description',
          slug: 'test-listing',
          basePrice: 100,
          currency: 'USD',
          city: 'New York',
          state: 'NY',
          country: 'USA',
          latitude: 40.7128,
          longitude: -74.006,
          photos: [],
          status: 'AVAILABLE',
          verificationStatus: 'VERIFIED',
          averageRating: 4.5,
          totalReviews: 10,
          bookingMode: 'INSTANT_BOOK',
          condition: 'Excellent',
          features: ['wifi', 'parking'],
          owner: { id: 'owner-1', firstName: 'John', lastName: 'Doe', averageRating: 4.5 },
          category: { id: 'cat-1', name: 'Cars', slug: 'cars' },
        },
      ]);

      const result = await service.search({
        query: 'car rental',
      });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.results[0].title).toBe('Test Listing');
    });
  });

  describe('autocomplete', () => {
    it('should return suggestions', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.listing.findMany.mockResolvedValue([
        { title: 'Car Rental' },
        { title: 'Cargo Van' },
      ]);

      const suggestions = await service.autocomplete('car');
      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('Car Rental');
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('findSimilar', () => {
    it('should return similar listings', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.listing.findUnique.mockResolvedValue({
        categoryId: 'cat-1',
        city: 'New York',
        state: 'NY',
        latitude: 40.7128,
        longitude: -74.006,
        basePrice: 100,
        features: ['wifi', 'parking'],
      });

      mockPrismaService.listing.findMany.mockResolvedValue([
        {
          id: 'listing-2',
          title: 'Similar Listing',
          description: 'Similar description',
          slug: 'similar-listing',
          city: 'New York',
          state: 'NY',
          country: 'USA',
          latitude: 40.7138,
          longitude: -74.0016,
          basePrice: 110,
          currency: 'USD',
          photos: [],
          owner: { id: 'owner-2', firstName: 'Jane', lastName: 'Doe', averageRating: 4.8 },
          category: { id: 'cat-1', name: 'Cars', slug: 'cars' },
          averageRating: 4.8,
          totalReviews: 25,
          bookingMode: 'INSTANT_BOOK',
          condition: 'Good',
          features: ['wifi', 'parking'],
        },
      ]);

      const similar = await service.findSimilar('listing-1');

      expect(similar).toHaveLength(1);
      expect(similar[0].title).toBe('Similar Listing');
    });
  });

  // ---------- Geo search tests ----------
  describe('search — geo/proximity filtering', () => {
    const baseListing = (id: string, lat: number, lon: number, title = 'Listing') => ({
      id,
      title,
      description: 'desc',
      slug: id,
      basePrice: 100,
      currency: 'NPR',
      city: 'Kathmandu',
      state: 'Bagmati',
      country: 'Nepal',
      latitude: lat,
      longitude: lon,
      photos: [],
      status: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      averageRating: 4.0,
      totalReviews: 5,
      bookingMode: 'INSTANT_BOOK',
      condition: 'Good',
      features: [],
      owner: { id: 'owner-1', firstName: 'Ram', lastName: 'Sharma', averageRating: 4.0 },
      category: { id: 'cat-1', name: 'Tools', slug: 'tools' },
    });

    beforeEach(() => {
      mockCacheService.get.mockResolvedValue(null);
    });

    it('should filter listings within radius (Haversine)', async () => {
      // Center: Kathmandu (27.7172, 85.3240)
      // Nearby: ~2 km away (within 5km radius)
      // Far: ~50 km away (outside 5km radius)
      mockPrismaService.listing.findMany.mockResolvedValue([
        baseListing('near-1', 27.7200, 85.3300, 'Nearby Listing'),  // ~0.7 km
        baseListing('far-1', 27.25, 85.32, 'Far Listing'),            // ~52 km
      ]);

      const result = await service.search({
        location: { lat: 27.7172, lon: 85.3240, radius: '5km' },
      });

      // Only the nearby listing should pass the Haversine filter
      expect(result.results.some((r) => r.id === 'near-1')).toBe(true);
      expect(result.results.some((r) => r.id === 'far-1')).toBe(false);
    });

    it('should include distance in results for geo search', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([
        baseListing('near-1', 27.7200, 85.3300, 'Nearby'),
      ]);

      const result = await service.search({
        location: { lat: 27.7172, lon: 85.3240, radius: '10km' },
      });

      expect(result.results).toHaveLength(1);
      // Distance should be populated and roughly < 1 km
      const dist = result.results[0].distance;
      expect(dist).toBeDefined();
      expect(dist).toBeLessThan(2);
    });

    it('should sort results by distance when sort=distance', async () => {
      // Provide listings in reverse distance order
      mockPrismaService.listing.findMany.mockResolvedValue([
        baseListing('mid-1', 27.74, 85.33, 'Mid'),     // ~2.6 km
        baseListing('near-1', 27.718, 85.325, 'Near'),  // ~0.1 km
        baseListing('far-3', 27.76, 85.34, 'Farther'),  // ~5 km
      ]);

      const result = await service.search({
        location: { lat: 27.7172, lon: 85.3240, radius: '10km' },
        sort: 'distance',
      });

      const ids = result.results.map((r) => r.id);
      expect(ids[0]).toBe('near-1');
      // The mid listing should come before the farther one
      const midIdx = ids.indexOf('mid-1');
      const farIdx = ids.indexOf('far-3');
      expect(midIdx).toBeLessThan(farIdx);
    });

    it('should apply bounding-box pre-filter in the Prisma where clause', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([]);
      mockPrismaService.listing.count.mockResolvedValue(0);

      await service.search({
        location: { lat: 27.7172, lon: 85.3240, radius: '10km' },
      });

      // Verify that findMany was called with latitude/longitude bounding box
      const findManyCall = mockPrismaService.listing.findMany.mock.calls[0][0];
      expect(findManyCall.where.latitude).toBeDefined();
      expect(findManyCall.where.latitude.gte).toBeDefined();
      expect(findManyCall.where.latitude.lte).toBeDefined();
      expect(findManyCall.where.longitude).toBeDefined();
      expect(findManyCall.where.longitude.gte).toBeDefined();
      expect(findManyCall.where.longitude.lte).toBeDefined();

      // Bounding box should be roughly ±0.09 degrees for 10km radius (10/111)
      const latDelta = findManyCall.where.latitude.lte - findManyCall.where.latitude.gte;
      expect(latDelta).toBeGreaterThan(0.15);
      expect(latDelta).toBeLessThan(0.25);
    });

    it('should default to 25km radius when no radius specified', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([
        baseListing('within-25km', 27.90, 85.40, 'Within 25km'),  // ~21 km
      ]);

      const result = await service.search({
        location: { lat: 27.7172, lon: 85.3240 },
      });

      // With default 25km radius, a listing 21km away should be included
      expect(result.results.some((r) => r.id === 'within-25km')).toBe(true);
    });

    it('should handle radius in miles', async () => {
      // 3mi ≈ 4.83km
      mockPrismaService.listing.findMany.mockResolvedValue([
        baseListing('close', 27.72, 85.33, 'Close'),   // ~0.7 km — within 3mi
        baseListing('far', 27.78, 85.38, 'Far'),         // ~9 km — outside 3mi
      ]);

      const result = await service.search({
        location: { lat: 27.7172, lon: 85.3240, radius: '3mi' },
      });

      expect(result.results.some((r) => r.id === 'close')).toBe(true);
      expect(result.results.some((r) => r.id === 'far')).toBe(false);
    });

    it('should exclude listings with null coordinates', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([
        baseListing('has-coords', 27.72, 85.33, 'Valid'),
        { ...baseListing('no-lat', 0, 85.33, 'No Lat'), latitude: null },
        { ...baseListing('no-lon', 27.72, 0, 'No Lon'), longitude: null },
      ]);

      const result = await service.search({
        location: { lat: 27.7172, lon: 85.3240, radius: '5km' },
      });

      expect(result.results.some((r) => r.id === 'has-coords')).toBe(true);
      expect(result.results.some((r) => r.id === 'no-lat')).toBe(false);
      expect(result.results.some((r) => r.id === 'no-lon')).toBe(false);
    });
  });
});
