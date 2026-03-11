import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceSearchController } from './marketplace-search.controller';
import { MultiModalSearchService } from '../services/multi-modal-search.service';

describe('MarketplaceSearchController', () => {
  let controller: MarketplaceSearchController;
  let service: jest.Mocked<MultiModalSearchService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceSearchController],
      providers: [
        {
          provide: MultiModalSearchService,
          useValue: {
            search: jest.fn(),
            recordClick: jest.fn(),
            recordConversion: jest.fn(),
            getSearchAnalytics: jest.fn(),
            getPersonalizationSignals: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(MarketplaceSearchController);
    service = module.get(MultiModalSearchService) as jest.Mocked<MultiModalSearchService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── search ──

  describe('search', () => {
    it('merges userId and converts filter dates', async () => {
      const dto = {
        query: 'beach',
        mode: 'text',
        filters: { startDate: '2026-04-01', endDate: '2026-04-05', minPrice: 50 },
      };
      service.search.mockResolvedValue({ results: [] as any[], total: 0 } as any);

      const result = await controller.search('u1', dto as any);

      expect(service.search).toHaveBeenCalledWith({
        ...dto,
        userId: 'u1',
        filters: {
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-04-05'),
          minPrice: 50,
        },
      });
      expect(result).toEqual({ results: [] as any[], total: 0 });
    });

    it('handles dto without filters', async () => {
      const dto = { query: 'mountain', mode: 'text' };
      service.search.mockResolvedValue({ results: [] as any[] } as any);

      await controller.search('u1', dto as any);

      expect(service.search).toHaveBeenCalledWith({
        ...dto,
        userId: 'u1',
        filters: undefined,
      });
    });

    it('propagates service error', async () => {
      service.search.mockRejectedValue(new Error('Search failed'));
      await expect(controller.search('u1', {} as any)).rejects.toThrow('Search failed');
    });
  });

  // ── recordClick ──

  describe('recordClick', () => {
    it('delegates to service', async () => {
      service.recordClick.mockResolvedValue(undefined as any);
      await controller.recordClick({ searchEventId: 'se1', listingId: 'l1' } as any);
      expect(service.recordClick).toHaveBeenCalledWith('se1', 'l1');
    });
  });

  // ── recordConversion ──

  describe('recordConversion', () => {
    it('delegates to service', async () => {
      service.recordConversion.mockResolvedValue(undefined as any);
      await controller.recordConversion({ searchEventId: 'se1', listingId: 'l1' } as any);
      expect(service.recordConversion).toHaveBeenCalledWith('se1', 'l1');
    });
  });

  // ── getAnalytics ──

  describe('getAnalytics', () => {
    it('delegates query params to service', async () => {
      const query = { country: 'NP', days: 30 };
      service.getSearchAnalytics.mockResolvedValue({ totalSearches: 100 } as any);

      const result = await controller.getAnalytics(query as any);

      expect(service.getSearchAnalytics).toHaveBeenCalledWith('NP', 30);
      expect(result).toEqual({ totalSearches: 100 });
    });
  });

  // ── getPersonalization ──

  describe('getPersonalization', () => {
    it('delegates userId to service', async () => {
      service.getPersonalizationSignals.mockResolvedValue({ preferences: [] } as any);

      const result = await controller.getPersonalization('u1');

      expect(service.getPersonalizationSignals).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ preferences: [] });
    });

    it('propagates service error', async () => {
      service.getPersonalizationSignals.mockRejectedValue(new Error('User not found'));
      await expect(controller.getPersonalization('bad')).rejects.toThrow('User not found');
    });
  });
});
