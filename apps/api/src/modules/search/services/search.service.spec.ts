import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';

describe('SearchService', () => {
  let service: SearchService;
  let elasticsearch: ElasticsearchService;

  const mockElasticsearchService = {
    search: jest.fn(),
    index: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
    get: jest.fn(),
  };

  const mockPrismaService = {
    listing: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
        { provide: ElasticsearchService, useValue: mockElasticsearchService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    elasticsearch = module.get<ElasticsearchService>(ElasticsearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return search results', async () => {
      const mockEsResponse = {
        hits: {
          total: { value: 10 },
          hits: [
            {
              _id: 'listing-1',
              _source: {
                title: 'Test Listing',
                description: 'Test description',
                basePrice: 100,
              },
              _score: 1.5,
            },
          ],
        },
        aggregations: {},
      };

      // Ensure mock match overload
      mockElasticsearchService.search.mockResolvedValue(mockEsResponse as any);

      const result = await service.search({
        query: 'car rental',
      });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(mockElasticsearchService.search).toHaveBeenCalled();
    });
  });

  describe('autocomplete', () => {
    it('should return suggestions', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: {
          hits: [{ _source: { title: 'Car Rental' } }, { _source: { title: 'Cargo Van' } }],
        },
      } as any);

      const suggestions = await service.autocomplete('car');
      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('Car Rental');
    });
  });

  describe('findSimilar', () => {
    it('should return similar listings', async () => {
      // Mock get first
      mockElasticsearchService.get.mockResolvedValue({
        _source: { categoryId: 'cat-1', location: { lat: 0, lon: 0 } },
      } as any);

      // Mock search
      mockElasticsearchService.search.mockResolvedValue({
        hits: {
          hits: [{ _id: 'listing-2', _source: { title: 'Similar Listing' } }],
        },
      } as any);

      const similar = await service.findSimilar('listing-1');

      expect(similar).toHaveLength(1);
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.any(Object),
            }),
          }),
        }),
      );
    });
  });
});
