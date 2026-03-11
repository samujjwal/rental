import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('~/lib/api-client', () => ({
  api: mockApi,
}));

import { aiApi, type GenerateDescriptionParams } from './ai';

describe('aiApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDescription', () => {
    const baseParams: GenerateDescriptionParams = {
      title: '2BHK Apartment in Kathmandu',
      category: 'APARTMENT',
      city: 'Kathmandu',
      features: ['parking', 'balcony'],
      amenities: ['wifi', 'hot-water'],
      condition: 'GOOD',
      basePrice: 15000,
    };

    it('calls POST /ai/generate-description with params', async () => {
      const mockResult = { description: 'A nice apartment', model: 'gpt-4', tokens: 120 };
      mockApi.post.mockResolvedValue(mockResult);
      const result = await aiApi.generateDescription(baseParams);
      expect(mockApi.post).toHaveBeenCalledWith('/ai/generate-description', baseParams);
      expect(result).toEqual(mockResult);
    });

    it('returns description and model', async () => {
      mockApi.post.mockResolvedValue({ description: 'Spacious room', model: 'gpt-3.5-turbo' });
      const result = await aiApi.generateDescription({ title: 'Room' });
      expect(result.description).toBe('Spacious room');
      expect(result.model).toBe('gpt-3.5-turbo');
    });

    it('handles optional tokens field', async () => {
      mockApi.post.mockResolvedValue({ description: 'Desc', model: 'gpt-4' });
      const result = await aiApi.generateDescription({ title: 'Test' });
      expect(result.tokens).toBeUndefined();
    });

    it('sends minimal params with only title', async () => {
      mockApi.post.mockResolvedValue({ description: 'Generated', model: 'gpt-4', tokens: 50 });
      await aiApi.generateDescription({ title: 'Studio' });
      expect(mockApi.post).toHaveBeenCalledWith('/ai/generate-description', { title: 'Studio' });
    });

    it('propagates API errors', async () => {
      mockApi.post.mockRejectedValue(new Error('AI service unavailable'));
      await expect(aiApi.generateDescription(baseParams)).rejects.toThrow('AI service unavailable');
    });

    it('sends features and amenities arrays', async () => {
      const params: GenerateDescriptionParams = {
        title: 'Flat',
        features: ['garden', 'rooftop'],
        amenities: ['gym', 'pool'],
      };
      mockApi.post.mockResolvedValue({ description: 'D', model: 'm' });
      await aiApi.generateDescription(params);
      expect(mockApi.post).toHaveBeenCalledWith('/ai/generate-description', params);
    });
  });
});
