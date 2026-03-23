import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiService, GenerateDescriptionDto } from './ai.service';
import { AI_PROVIDER_PORT, type AiProviderPort } from '../ports/ai-provider.port';
import { PROMPT_LISTING_GENERATE_DESCRIPTION } from '../prompts/prompt-registry';

describe('AiService', () => {
  let service: AiService;
  let aiProvider: jest.Mocked<AiProviderPort>;

  beforeEach(async () => {
    aiProvider = {
      complete: jest.fn().mockResolvedValue({
        content: '',
        model: 'provider-unavailable',
        fromProvider: false,
        latencyMs: 1,
        promptId: PROMPT_LISTING_GENERATE_DESCRIPTION.promptId,
        promptVersion: PROMPT_LISTING_GENERATE_DESCRIPTION.version,
      }),
      embed: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_PROVIDER_PORT, useValue: aiProvider },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe('generateListingDescription', () => {
    it('should throw BadRequestException for short title', async () => {
      await expect(
        service.generateListingDescription({ title: 'ab' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty title', async () => {
      await expect(
        service.generateListingDescription({ title: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return template-based description when no API key', async () => {
      const dto: GenerateDescriptionDto = {
        title: 'Power Drill',
        category: 'tool',
        city: 'Portland',
      };

      const result = await service.generateListingDescription(dto);

      expect(result.model).toBe('template');
      expect(result.description).toContain('Power Drill');
      expect(result.description).toContain('Portland');
      expect(result.description).toContain('tool');
    });

    it('should include features in template fallback', async () => {
      const dto: GenerateDescriptionDto = {
        title: 'Electric Scooter',
        features: ['40mph top speed', 'GPS tracking', 'Long battery'],
      };

      const result = await service.generateListingDescription(dto);

      expect(result.description).toContain('40mph top speed');
      expect(result.description).toContain('GPS tracking');
    });

    it('should include price in template fallback', async () => {
      const dto: GenerateDescriptionDto = {
        title: 'Camera Kit',
        basePrice: 75,
      };

      const result = await service.generateListingDescription(dto);

      expect(result.description).toContain('$75/day');
    });

    it('should include condition in template fallback', async () => {
      const dto: GenerateDescriptionDto = {
        title: 'Mountain Bike',
        condition: 'LIKE_NEW',
      };

      const result = await service.generateListingDescription(dto);

      expect(result.description).toContain('like new');
    });

    it('should handle minimal dto (title only)', async () => {
      const result = await service.generateListingDescription({ title: 'Tent' });

      expect(result.model).toBe('template');
      expect(result.description).toContain('Tent');
      expect(result.description).toContain('Book now');
    });

    it('should fall back to template when provider is unavailable', async () => {
      aiProvider.complete.mockResolvedValueOnce({
        content: '',
        model: 'provider-unavailable',
        fromProvider: false,
        latencyMs: 10,
        promptId: PROMPT_LISTING_GENERATE_DESCRIPTION.promptId,
        promptVersion: PROMPT_LISTING_GENERATE_DESCRIPTION.version,
      });

      const result = await service.generateListingDescription({
        title: 'Test Item',
      });

      expect(result.model).toBe('template');
      expect(result.description).toContain('Test Item');
    });

    it('should use template-fallback label when provider responds without content', async () => {
      aiProvider.complete.mockResolvedValueOnce({
        content: '',
        model: 'gpt-5.4-mini',
        fromProvider: true,
        latencyMs: 25,
        promptId: PROMPT_LISTING_GENERATE_DESCRIPTION.promptId,
        promptVersion: PROMPT_LISTING_GENERATE_DESCRIPTION.version,
      });

      const result = await service.generateListingDescription({
        title: 'Test Item',
      });

      expect(result.model).toBe('template-fallback');
    });

    it('should return AI-generated description on success', async () => {
      aiProvider.complete.mockResolvedValueOnce({
        content: 'AI generated description here.',
        model: 'gpt-5.4-mini',
        fromProvider: true,
        latencyMs: 50,
        promptId: PROMPT_LISTING_GENERATE_DESCRIPTION.promptId,
        promptVersion: PROMPT_LISTING_GENERATE_DESCRIPTION.version,
        usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
      });

      const result = await service.generateListingDescription({
        title: 'Electric Guitar',
        category: 'instruments',
        city: 'Nashville',
      });

      expect(result.description).toBe('AI generated description here.');
      expect(result.model).toBe('gpt-5.4-mini');
      expect(result.tokens).toBe(50);
    });
  });
});
