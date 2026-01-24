import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '@/common/database/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('SearchService', () => {
  let service: SearchService;
  let elasticsearch: ElasticsearchService;
  let prisma: PrismaService;
  let cache: CacheService;

  const mockElasticsearchService = {
    search: jest.fn(),
    index: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
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
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchListings', () => {
    it('should return search results with filters', async () => {
      const mockEsResponse = {
        hits: {
          total: { value: 10 },
          hits: [
            {
              _id: 'listing-1',
              _source: {
                title: 'Test Listing',
                description: 'Test description',
                pricePerDay: 100,
                location: {
                  city: 'New York',
                  coordinates: { lat: 40.7128, lon: -74.006 },
                },
              },
              _score: 1.5,
            },
          ],
        },
        aggregations: {
          category: {
            buckets: [
              { key: 'vehicles', doc_count: 5 },
              { key: 'spaces', doc_count: 3 },
            ],
          },
          priceRanges: {
            buckets: [
              { key: '0-50', doc_count: 2 },
              { key: '50-100', doc_count: 4 },
            ],
          },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(mockEsResponse);
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.searchListings({
        query: 'car rental',
        category: 'vehicles',
        priceMin: 50,
        priceMax: 200,
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.aggregations).toBeDefined();
      expect(mockElasticsearchService.search).toHaveBeenCalled();
    });

    it('should apply geo-location filters', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: {},
      });

      await service.searchListings({
        query: '',
        location: { lat: 40.7128, lon: -74.006 },
        radius: 10,
        page: 1,
        limit: 10,
      });

      const searchCall = mockElasticsearchService.search.mock.calls[0][0];
      expect(searchCall.body.query.bool.filter).toContainEqual(
        expect.objectContaining({
          geo_distance: expect.any(Object),
        }),
      );
    });

    it('should return cached results when available', async () => {
      const cachedResults = {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        aggregations: {},
      };

      mockCacheService.get.mockResolvedValue(cachedResults);

      const result = await service.searchListings({
        query: 'test',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(cachedResults);
      expect(mockElasticsearchService.search).not.toHaveBeenCalled();
    });
  });

  describe('indexListing', () => {
    it('should index a listing in Elasticsearch', async () => {
      const mockListing = {
        id: 'listing-1',
        title: 'Test Listing',
        description: 'Test description',
        pricePerDay: 100,
        status: 'ACTIVE',
        category: { name: 'vehicles', slug: 'vehicles' },
        owner: {
          id: 'owner-1',
          firstName: 'John',
          lastName: 'Doe',
          averageRating: 4.5,
        },
        location: {
          city: 'New York',
          state: 'NY',
          coordinates: { latitude: 40.7128, longitude: -74.006 },
        },
        photos: [{ url: 'https://example.com/photo.jpg' }],
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockElasticsearchService.index.mockResolvedValue({ result: 'created' });

      await service.indexListing('listing-1');

      expect(mockElasticsearchService.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'listings',
          id: 'listing-1',
          body: expect.objectContaining({
            title: 'Test Listing',
            pricePerDay: 100,
          }),
        }),
      );
    });
  });

  describe('removeListing', () => {
    it('should remove a listing from Elasticsearch', async () => {
      mockElasticsearchService.delete.mockResolvedValue({ result: 'deleted' });

      await service.removeListing('listing-1');

      expect(mockElasticsearchService.delete).toHaveBeenCalledWith({
        index: 'listings',
        id: 'listing-1',
      });
    });
  });

  describe('getSuggestions', () => {
    it('should return autocomplete suggestions', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: {
          hits: [{ _source: { title: 'Car Rental' } }, { _source: { title: 'Cargo Van' } }],
        },
      });

      const suggestions = await service.getSuggestions('car');

      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('Car Rental');
      expect(suggestions).toContain('Cargo Van');
    });
  });

  describe('getSimilarListings', () => {
    it('should return similar listings', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: {
          hits: [{ _id: 'listing-2', _source: { title: 'Similar Listing' } }],
        },
      });

      const similar = await service.getSimilarListings('listing-1', 5);

      expect(similar).toHaveLength(1);
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              more_like_this: expect.any(Object),
            }),
          }),
        }),
      );
    });
  });

  describe('bulkIndexListings', () => {
    it('should bulk index multiple listings', async () => {
      const mockListings = [
        {
          id: 'listing-1',
          title: 'Listing 1',
          status: 'ACTIVE',
          category: { name: 'vehicles', slug: 'vehicles' },
          owner: { id: 'owner-1', firstName: 'John', lastName: 'Doe' },
        },
        {
          id: 'listing-2',
          title: 'Listing 2',
          status: 'ACTIVE',
          category: { name: 'spaces', slug: 'spaces' },
          owner: { id: 'owner-2', firstName: 'Jane', lastName: 'Smith' },
        },
      ];

      mockPrismaService.listing.findMany.mockResolvedValue(mockListings);
      mockElasticsearchService.bulk.mockResolvedValue({ errors: false });

      await service.bulkIndexListings(['listing-1', 'listing-2']);

      expect(mockElasticsearchService.bulk).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.arrayContaining([
            expect.objectContaining({ index: expect.any(Object) }),
            expect.objectContaining({ title: 'Listing 1' }),
          ]),
        }),
      );
    });
  });
});
