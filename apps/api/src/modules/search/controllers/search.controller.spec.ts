import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from '../services/search.service';
import { RecommendationService } from '../services/recommendation.service';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: jest.Mocked<SearchService>;
  let recommendationService: jest.Mocked<RecommendationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: {
            search: jest.fn(),
            autocomplete: jest.fn(),
            getSuggestions: jest.fn(),
            findSimilar: jest.fn(),
            getPopularSearches: jest.fn(),
          },
        },
        {
          provide: RecommendationService,
          useValue: {
            getRecommendations: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SearchController);
    searchService = module.get(SearchService) as jest.Mocked<SearchService>;
    recommendationService = module.get(RecommendationService) as jest.Mocked<RecommendationService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── search ──
  describe('search', () => {
    it('builds search query from query params', async () => {
      searchService.search.mockResolvedValue({ listings: [], total: 0 } as any);
      await controller.search('camera', 'c1', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1, 10);
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'camera', categoryId: 'c1', page: 1, size: 10 }),
      );
    });

    it('adds location when lat/lon provided', async () => {
      searchService.search.mockResolvedValue({ listings: [] } as any);
      await controller.search(undefined, undefined, 27.7, 85.3, '5km', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ location: { lat: 27.7, lon: 85.3, radius: '5km' } }),
      );
    });

    it('adds priceRange when min/max provided', async () => {
      searchService.search.mockResolvedValue({ listings: [] } as any);
      await controller.search(undefined, undefined, undefined, undefined, undefined, 100, 500, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ priceRange: { min: 100, max: 500 } }),
      );
    });

    it('normalizes INSTANT booking mode to INSTANT_BOOK', async () => {
      searchService.search.mockResolvedValue({ listings: [] } as any);
      await controller.search(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'instant', undefined, undefined, undefined, undefined, undefined, undefined);
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ filters: expect.objectContaining({ bookingMode: 'INSTANT_BOOK' }) }),
      );
    });

    it('splits features by comma', async () => {
      searchService.search.mockResolvedValue({ listings: [] } as any);
      await controller.search(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'wifi,parking', undefined, undefined, undefined);
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ filters: expect.objectContaining({ features: ['wifi', 'parking'] }) }),
      );
    });
  });

  // ── advancedSearch ──
  describe('advancedSearch', () => {
    it('delegates full query body to service', async () => {
      const body = { query: 'drone', categoryId: 'c2' };
      searchService.search.mockResolvedValue({ listings: [] } as any);
      await controller.advancedSearch(body as any);
      expect(searchService.search).toHaveBeenCalledWith(body);
    });
  });

  // ── autocomplete ──
  describe('autocomplete', () => {
    it('delegates query and limit', async () => {
      searchService.autocomplete.mockResolvedValue(['camera', 'camcorder'] as any);
      const result = await controller.autocomplete('cam', 5);
      expect(searchService.autocomplete).toHaveBeenCalledWith('cam', 5);
      expect(result).toHaveLength(2);
    });
  });

  // ── getSuggestions ──
  describe('getSuggestions', () => {
    it('delegates to service', async () => {
      searchService.getSuggestions.mockResolvedValue({ listings: [], categories: [] } as any);
      await controller.getSuggestions('cam');
      expect(searchService.getSuggestions).toHaveBeenCalledWith('cam');
    });
  });

  // ── findSimilar ──
  describe('findSimilar', () => {
    it('delegates listingId and limit', async () => {
      searchService.findSimilar.mockResolvedValue([] as any);
      await controller.findSimilar('l1', 5);
      expect(searchService.findSimilar).toHaveBeenCalledWith('l1', 5);
    });
  });

  // ── getPopularSearches ──
  describe('getPopularSearches', () => {
    it('wraps result in { searches }', async () => {
      searchService.getPopularSearches.mockResolvedValue(['camera', 'laptop'] as any);
      const result = await controller.getPopularSearches(10);
      expect(result).toEqual({ searches: ['camera', 'laptop'] });
    });
  });

  // ── getRecommendations ──
  describe('getRecommendations', () => {
    it('defaults limit to 20', async () => {
      recommendationService.getRecommendations.mockResolvedValue([] as any);
      await controller.getRecommendations('u1', undefined);
      expect(recommendationService.getRecommendations).toHaveBeenCalledWith('u1', 20);
    });

    it('caps limit at 50', async () => {
      recommendationService.getRecommendations.mockResolvedValue([] as any);
      await controller.getRecommendations('u1', 100);
      expect(recommendationService.getRecommendations).toHaveBeenCalledWith('u1', 50);
    });
  });

  // ── getStats ──
  describe('getStats', () => {
    it('returns static postgresql message', async () => {
      const result = await controller.getStats();
      expect(result).toEqual({ message: 'Search statistics - PostgreSQL based', type: 'postgresql' });
    });
  });

  // ── getNearbyListings ──
  describe('getNearbyListings', () => {
    it('parses coordinates and defaults radius/limit', async () => {
      searchService.search.mockResolvedValue({ listings: [] } as any);
      await controller.getNearbyListings('27.7', '85.3', undefined, undefined);
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { lat: 27.7, lon: 85.3, radius: '10km' },
          size: 20,
        }),
      );
    });

    it('uses custom radius and limit', async () => {
      searchService.search.mockResolvedValue({ listings: [] } as any);
      await controller.getNearbyListings('27.7', '85.3', '5', '10');
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { lat: 27.7, lon: 85.3, radius: '5km' },
          size: 10,
        }),
      );
    });
  });
});
