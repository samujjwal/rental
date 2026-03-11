import { Test, TestingModule } from '@nestjs/testing';
import { MultiModalSearchService } from './multi-modal-search.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('MultiModalSearchService', () => {
  let service: MultiModalSearchService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'l1', title: 'Cozy Room', city: 'Kathmandu', price: 2000, averageRating: 4.5 },
          { id: 'l2', title: 'Mountain View', city: 'Pokhara', price: 3000, averageRating: 4.8 },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
      searchEvent: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'se-1', ...data })),
        findUnique: jest.fn().mockResolvedValue({ id: 'se-1', clickedListings: [], metadata: {} }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(100),
        aggregate: jest.fn().mockResolvedValue({ _avg: { responseTimeMs: 50 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      userSearchProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'usp-1' }),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiModalSearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), del: jest.fn() } },
      ],
    }).compile();

    service = module.get<MultiModalSearchService>(MultiModalSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return search results for text query', async () => {
      const result = await service.search({
        searchType: 'TEXT',
        query: 'room Kathmandu',
        filters: { country: 'NP' },
        page: 1,
        limit: 10,
      });
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(prisma.searchEvent.create).toHaveBeenCalled();
    });

    it('should search by map bounds', async () => {
      const result = await service.search({
        searchType: 'MAP',
        location: { latitude: 27.5, longitude: 85.5, radiusKm: 50 },
        page: 1,
        limit: 10,
      });
      expect(result).toBeDefined();
    });
  });

  describe('recordClick', () => {
    it('should update search event with click data', async () => {
      prisma.searchEvent.findMany.mockResolvedValue([{ id: 'se-1', metadata: {} }]);
      await service.recordClick('se-1', 'l1');
      expect(prisma.searchEvent.update).toHaveBeenCalled();
    });
  });

  describe('getSearchAnalytics', () => {
    it('should return analytics summary', async () => {
      const result = await service.getSearchAnalytics('NP', 7);
      expect(result).toBeDefined();
      expect(result.totalSearches).toBeDefined();
    });
  });

  describe('getPersonalizationSignals', () => {
    it('should return defaults for user without profile', async () => {
      const result = await service.getPersonalizationSignals('user-1');
      expect(result).toBeDefined();
      expect(result.preferredLocations).toEqual([]);
      expect(result.preferredCategories).toEqual([]);
    });

    it('should return profile for existing user', async () => {
      prisma.userSearchProfile.findUnique.mockResolvedValue({
        userId: 'user-1',
        preferences: { priceRange: [1000, 5000] },
      });
      const result = await service.getPersonalizationSignals('user-1');
      expect(result).toBeDefined();
    });
  });
});
