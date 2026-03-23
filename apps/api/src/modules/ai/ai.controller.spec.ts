import { AiController } from './ai.controller';

describe('AiController', () => {
  let controller: AiController;
  let aiService: any;
  let marketInsightsService: any;

  beforeEach(() => {
    aiService = {
      generateListingDescription: jest.fn().mockResolvedValue({
        description: 'A beautiful apartment in Kathmandu',
        model: 'gpt-4o',
        tokens: 120,
      }),
      generateListingSuggestions: jest.fn().mockResolvedValue({
        suggestions: [
          {
            type: 'pricing',
            field: 'basePrice',
            suggestion: '45',
            confidence: 0.8,
            reasoning: 'Similar listings in the area charge $40–$50/day.',
          },
        ],
        fromProvider: true,
      }),
    };

    marketInsightsService = {
      getForCategory: jest.fn().mockResolvedValue({
        category: 'Spaces',
        averagePrice: 42.5,
        priceRange: { min: 20, max: 100 },
        demand: 'medium',
        popularFeatures: ['WiFi', 'Parking'],
        seasonalTrends: [],
        competitorCount: 14,
      }),
    };

    controller = new AiController(aiService, marketInsightsService);
  });

  describe('generateDescription', () => {
    it('should return generated description', async () => {
      const dto = {
        title: 'Cozy Apartment',
        category: 'Apartment',
        city: 'Kathmandu',
        features: ['WiFi', 'Parking'],
      };

      const result = await controller.generateDescription(dto as any);

      expect(result).toBeDefined();
      expect(aiService.generateListingDescription).toHaveBeenCalledWith(dto);
    });
  });

  describe('generateListingSuggestions', () => {
    it('should return AI suggestions for a partial listing', async () => {
      const dto = {
        currentData: { title: 'Camera', category: 'Electronics', city: 'Kathmandu' },
      };

      const result = await controller.generateListingSuggestions(dto as any);

      expect(result.suggestions).toHaveLength(1);
      expect(result.fromProvider).toBe(true);
      expect(aiService.generateListingSuggestions).toHaveBeenCalledWith(dto);
    });

    it('returns empty suggestions when provider is unavailable', async () => {
      aiService.generateListingSuggestions.mockResolvedValueOnce({
        suggestions: [],
        fromProvider: false,
      });

      const result = await controller.generateListingSuggestions({
        currentData: {},
      });

      expect(result.suggestions).toHaveLength(0);
      expect(result.fromProvider).toBe(false);
    });
  });

  describe('getMarketInsights', () => {
    it('should return real market insights for a category slug', async () => {
      const result = await controller.getMarketInsights('spaces');

      expect(result).toBeDefined();
      expect(result.competitorCount).toBeGreaterThanOrEqual(0);
      expect(['high', 'medium', 'low']).toContain(result.demand);
      expect(marketInsightsService.getForCategory).toHaveBeenCalledWith('spaces');
    });
  });
});

