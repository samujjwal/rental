import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService, GenerateDescriptionDto } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string | undefined> = {
          OPENAI_API_KEY: undefined, // No API key by default → template fallback
          OPENAI_MODEL: 'gpt-3.5-turbo',
        };
        return map[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: configService },
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

    it('should fall back to template on API error when key is set', async () => {
      // Reconfigure with API key
      configService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-fake-key';
        if (key === 'OPENAI_MODEL') return 'gpt-3.5-turbo';
        return undefined;
      });

      // Rebuild module to pick up new config
      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const svcWithKey = module.get<AiService>(AiService);

      // Mock global fetch to simulate failure
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        const result = await svcWithKey.generateListingDescription({
          title: 'Test Item',
        });

        expect(result.model).toBe('template-fallback');
        expect(result.description).toContain('Test Item');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should fall back to template on non-ok API response', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-fake-key';
        if (key === 'OPENAI_MODEL') return 'gpt-3.5-turbo';
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const svcWithKey = module.get<AiService>(AiService);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      try {
        const result = await svcWithKey.generateListingDescription({
          title: 'Test Item',
        });

        expect(result.model).toBe('template-fallback');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should return AI-generated description on success', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-fake-key';
        if (key === 'OPENAI_MODEL') return 'gpt-3.5-turbo';
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const svcWithKey = module.get<AiService>(AiService);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'AI generated description here.' } }],
          model: 'gpt-3.5-turbo',
          usage: { total_tokens: 50 },
        }),
      });

      try {
        const result = await svcWithKey.generateListingDescription({
          title: 'Electric Guitar',
          category: 'instruments',
          city: 'Nashville',
        });

        expect(result.description).toBe('AI generated description here.');
        expect(result.model).toBe('gpt-3.5-turbo');
        expect(result.tokens).toBe(50);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
