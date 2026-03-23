import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type {
  AiProviderPort,
  EmbeddingRequest,
  EmbeddingResponse,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../ports/ai-provider.port';
import { CacheService } from '@/common/cache/cache.service';

/**
 * OpenAI implementation of AiProviderPort.
 *
 * This is the only class that knows about the OpenAI API. All domain services
 * must depend on AiProviderPort, not this concrete class.
 *
 * Contract:
 *   - complete() must never throw — provider errors return fromProvider: false
 *   - embed() must never throw — provider errors return null
 *   - latencyMs is always measured and included in the response
 */
@Injectable()
export class OpenAiProviderAdapter implements AiProviderPort {
  private readonly logger = new Logger(OpenAiProviderAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly cacheTtl: number;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.model = this.config.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo';
    this.cacheTtl = this.config.get<number>('AI_RESPONSE_CACHE_TTL') ?? 3_600;
  }

  /**
   * Cache key for deterministic completions.
   * The key is bound to the prompt identity and the exact message payload so
   * any change in system prompt, user content, or model version busts the cache.
   */
  private buildCacheKey(request: LlmCompletionRequest): string {
    const raw = `${request.promptId}:${request.promptVersion}:${this.model}:${JSON.stringify(request.messages)}`;
    return `ai:completion:${createHash('sha256').update(raw).digest('hex')}`;
  }

  /**
   * Returns true for prompts that are deterministic and safe to cache.
   * Conversational / streaming prompts (ai-concierge) are excluded because
   * reply context differs per session.
   */
  private isCacheable(request: LlmCompletionRequest): boolean {
    const CACHEABLE_PROMPT_PREFIXES = ['listing.'];
    return CACHEABLE_PROMPT_PREFIXES.some((prefix) =>
      request.promptId.startsWith(prefix),
    );
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const fallback = (latencyMs = 0): LlmCompletionResponse => ({
      content: '',
      model: 'none',
      fromProvider: false,
      latencyMs,
      promptId: request.promptId,
      promptVersion: request.promptVersion,
    });

    if (!this.apiKey) {
      this.logger.debug(
        `OPENAI_API_KEY not set — skipping provider call [${request.promptId}@${request.promptVersion}]`,
      );
      return fallback();
    }

    // --- Cache lookup (deterministic prompts only) ---
    const cacheKey = this.buildCacheKey(request);
    if (this.isCacheable(request)) {
      const hit = await this.cache.get<LlmCompletionResponse>(cacheKey);
      if (hit) {
        this.logger.debug(
          `AI cache hit [${request.promptId}@${request.promptVersion}]`,
        );
        return { ...hit, fromProvider: false };
      }
    }

    const start = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          max_tokens: request.maxTokens ?? 500,
          temperature: request.temperature ?? 0.7,
        }),
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.warn(
          `OpenAI completion failed [${request.promptId}@${request.promptVersion}]: ${response.status} ${errorBody}`,
        );
        return fallback(latencyMs);
      }

      const data = await response.json();
      const content: string = data?.choices?.[0]?.message?.content?.trim() ?? '';

      this.logger.debug(
        `AI completion ok [${request.promptId}@${request.promptVersion}] ` +
          `model=${data.model} latency=${latencyMs}ms tokens=${data?.usage?.total_tokens ?? '?'}`,
      );

      const result: LlmCompletionResponse = {
        content,
        model: data.model ?? this.model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens as number,
              completionTokens: data.usage.completion_tokens as number,
              totalTokens: data.usage.total_tokens as number,
            }
          : undefined,
        fromProvider: true,
        latencyMs,
        promptId: request.promptId,
        promptVersion: request.promptVersion,
      };

      // --- Cache store (deterministic prompts only) ---
      if (this.isCacheable(request) && content) {
        await this.cache.set(cacheKey, result, this.cacheTtl);
      }

      return result;
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.logger.error(
        `OpenAI completion error [${request.promptId}@${request.promptVersion}]`,
        error,
      );
      return fallback(latencyMs);
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse | null> {
    if (!this.apiKey) {
      return null;
    }

    const start = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: request.text,
        }),
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        this.logger.error(`OpenAI embedding API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const vector = data?.data?.[0]?.embedding;

      if (!Array.isArray(vector)) {
        return null;
      }

      return {
        vector: vector as number[],
        model: (data.model as string) ?? 'text-embedding-3-small',
        latencyMs,
      };
    } catch (error) {
      this.logger.error('OpenAI embedding error', error);
      return null;
    }
  }
}
