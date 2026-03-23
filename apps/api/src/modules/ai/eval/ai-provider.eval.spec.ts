/**
 * AI Provider Golden-Test Evaluation Harness
 *
 * These tests pin the observable AI platform contracts so any silent regression
 * (wrong prompt ID, version mismatch, missing fallback, prompt removed) is caught
 * by CI before it reaches production.
 *
 * Design constraints:
 *  - All tests run WITHOUT a real OpenAI API key (OPENAI_API_KEY is unset).
 *  - No HTTP calls are made. Tests rely only on in-process behaviour.
 *  - Assertion style: explicit literals for promptId/promptVersion so drift is visible.
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAiProviderAdapter } from '../adapters/openai-provider.adapter';
import { AiService } from '../services/ai.service';
import { AI_PROVIDER_PORT } from '../ports/ai-provider.port';
import { CacheService } from '@/common/cache/cache.service';
import {
  PROMPT_LISTING_GENERATE_DESCRIPTION,
  PROMPT_LISTING_GENERATE_SUGGESTIONS,
  PROMPT_CONCIERGE_INTENT_CLASSIFY,
  PROMPT_CONCIERGE_GENERATE_RESPONSE,
} from '../prompts/prompt-registry';
import type { LlmCompletionRequest } from '../ports/ai-provider.port';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeConfigService(overrides: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: (key: string, defaultValue?: unknown) => overrides[key] ?? defaultValue,
  } as unknown as ConfigService;
}

function makeCacheService() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as any;
}

// ─── 1. Prompt Registry Contract ────────────────────────────────────────────

describe('Prompt Registry — golden asset contracts', () => {
  it('listing.generate-description has stable ID and version 1.0.0', () => {
    expect(PROMPT_LISTING_GENERATE_DESCRIPTION.promptId).toBe('listing.generate-description');
    expect(PROMPT_LISTING_GENERATE_DESCRIPTION.version).toBe('1.0.0');
    expect(PROMPT_LISTING_GENERATE_DESCRIPTION.systemPrompt.length).toBeGreaterThan(50);
  });

  it('listing.generate-suggestions has stable ID and version 1.0.0', () => {
    expect(PROMPT_LISTING_GENERATE_SUGGESTIONS.promptId).toBe('listing.generate-suggestions');
    expect(PROMPT_LISTING_GENERATE_SUGGESTIONS.version).toBe('1.0.0');
    expect(PROMPT_LISTING_GENERATE_SUGGESTIONS.systemPrompt.length).toBeGreaterThan(50);
  });

  it('ai-concierge.intent-classify has stable ID and version 1.0.0', () => {
    expect(PROMPT_CONCIERGE_INTENT_CLASSIFY.promptId).toBe('ai-concierge.intent-classify');
    expect(PROMPT_CONCIERGE_INTENT_CLASSIFY.version).toBe('1.0.0');
    expect(PROMPT_CONCIERGE_INTENT_CLASSIFY.systemPrompt.length).toBeGreaterThan(50);
  });

  it('ai-concierge.generate-response has stable ID and version 1.0.0', () => {
    expect(PROMPT_CONCIERGE_GENERATE_RESPONSE.promptId).toBe('ai-concierge.generate-response');
    expect(PROMPT_CONCIERGE_GENERATE_RESPONSE.version).toBe('1.0.0');
    expect(PROMPT_CONCIERGE_GENERATE_RESPONSE.systemPrompt.length).toBeGreaterThan(50);
  });

  it('all registered prompts have a non-empty description', () => {
    for (const asset of [
      PROMPT_LISTING_GENERATE_DESCRIPTION,
      PROMPT_CONCIERGE_INTENT_CLASSIFY,
      PROMPT_CONCIERGE_GENERATE_RESPONSE,
    ]) {
      expect(asset.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── 2. OpenAiProviderAdapter — no API key (fallback path) ──────────────────

describe('OpenAiProviderAdapter — fallback when OPENAI_API_KEY absent', () => {
  let adapter: OpenAiProviderAdapter;

  beforeEach(() => {
    adapter = new OpenAiProviderAdapter(makeConfigService({}), makeCacheService()); // no API key
  });

  const request: LlmCompletionRequest = {
    promptId: PROMPT_LISTING_GENERATE_DESCRIPTION.promptId,
    promptVersion: PROMPT_LISTING_GENERATE_DESCRIPTION.version,
    messages: [
      { role: 'system', content: PROMPT_LISTING_GENERATE_DESCRIPTION.systemPrompt },
      { role: 'user', content: 'Camera rental, Kathmandu, excellent condition' },
    ],
  };

  it('returns fromProvider: false when API key is absent', async () => {
    const result = await adapter.complete(request);
    expect(result.fromProvider).toBe(false);
  });

  it('echoes promptId back in response', async () => {
    const result = await adapter.complete(request);
    expect(result.promptId).toBe('listing.generate-description');
  });

  it('echoes promptVersion back in response', async () => {
    const result = await adapter.complete(request);
    expect(result.promptVersion).toBe('1.0.0');
  });

  it('does not throw — returns empty content string', async () => {
    const result = await adapter.complete(request);
    expect(typeof result.content).toBe('string');
  });

  it('embed() returns null when API key is absent', async () => {
    const result = await adapter.embed({ text: 'test' });
    expect(result).toBeNull();
  });
});

// ─── 3. AiService — fallback description generation ─────────────────────────

describe('AiService — listing description fallback when provider unavailable', () => {
  let aiService: AiService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        OpenAiProviderAdapter,
        {
          provide: ConfigService,
          useValue: makeConfigService({}), // no API key → fallback
        },
        {
          provide: CacheService,
          useValue: makeCacheService(),
        },
        {
          provide: AI_PROVIDER_PORT,
          useExisting: OpenAiProviderAdapter,
        },
      ],
    }).compile();

    aiService = module.get(AiService);
  });

  it('returns a non-empty fallback description', async () => {
    const result = await aiService.generateListingDescription({
      title: 'Sony A7III Camera',
      category: 'electronics',
      city: 'Kathmandu',
    });
    expect(result.description.length).toBeGreaterThan(10);
  });

  it('fallback model label is template-based (not a real model name)', async () => {
    const result = await aiService.generateListingDescription({
      title: 'Mountain Bike',
      category: 'sports',
    });
    expect(result.model).toMatch(/template/i);
  });

  it('throws on title shorter than 3 characters', async () => {
    await expect(
      aiService.generateListingDescription({ title: 'AB' }),
    ).rejects.toBeDefined();
  });
});

// ─── 4. OpenAiProviderAdapter — prompt version integrity ────────────────────

describe('OpenAiProviderAdapter — prompt version passthrough', () => {
  let adapter: OpenAiProviderAdapter;

  beforeEach(() => {
    adapter = new OpenAiProviderAdapter(makeConfigService({}), makeCacheService());
  });

  it.each([
    [PROMPT_LISTING_GENERATE_DESCRIPTION.promptId, PROMPT_LISTING_GENERATE_DESCRIPTION.version],
    [PROMPT_LISTING_GENERATE_SUGGESTIONS.promptId, PROMPT_LISTING_GENERATE_SUGGESTIONS.version],
    [PROMPT_CONCIERGE_INTENT_CLASSIFY.promptId, PROMPT_CONCIERGE_INTENT_CLASSIFY.version],
    [PROMPT_CONCIERGE_GENERATE_RESPONSE.promptId, PROMPT_CONCIERGE_GENERATE_RESPONSE.version],
  ])('response carries promptId=%s promptVersion=%s', async (id, version) => {
    const result = await adapter.complete({
      promptId: id,
      promptVersion: version,
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result.promptId).toBe(id);
    expect(result.promptVersion).toBe(version);
  });
});

// ─── 5. AiService — listing suggestions fallback when provider unavailable ──

describe('AiService — listing suggestions fallback contract', () => {
  let aiService: AiService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        OpenAiProviderAdapter,
        {
          provide: ConfigService,
          useValue: makeConfigService({}), // no API key → fallback
        },
        {
          provide: CacheService,
          useValue: makeCacheService(),
        },
        {
          provide: AI_PROVIDER_PORT,
          useExisting: OpenAiProviderAdapter,
        },
      ],
    }).compile();

    aiService = module.get(AiService);
  });

  it('returns empty suggestions array (not mock data) when provider unavailable', async () => {
    const result = await aiService.generateListingSuggestions({
      currentData: { title: 'Camera', category: 'electronics' },
    });
    // fromProvider: false signals to callers that they must NOT display fabricated data.
    expect(result.fromProvider).toBe(false);
    expect(result.suggestions).toEqual([]);
  });
});

