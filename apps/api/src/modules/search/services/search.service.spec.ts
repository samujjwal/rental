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
});
