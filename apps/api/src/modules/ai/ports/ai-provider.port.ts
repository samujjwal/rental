/**
 * AI Provider Port — the single interface that all AI feature code must use.
 *
 * This is the anti-corruption layer between product domain logic and any
 * specific model provider (OpenAI, Anthropic, etc.). Swapping providers
 * requires only a new adapter that implements this interface; no domain
 * code needs to change.
 */

export interface LlmCompletionRequest {
  /** Unique prompt identifier for telemetry and version tracking. */
  promptId: string;
  /** Semantic version of the prompt asset used (e.g., "1.2.0"). */
  promptVersion: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  /** Optional correlation ID for end-to-end request tracing. */
  correlationId?: string;
}

export interface LlmCompletionResponse {
  content: string;
  /**
   * Settled model name including version, as returned by the provider.
   * Use this for telemetry, not the config-driven model name.
   */
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** True when the real provider was called; false when a fallback was used. */
  fromProvider: boolean;
  /** Latency in milliseconds for the provider call. */
  latencyMs: number;
  promptId: string;
  promptVersion: string;
}

export interface EmbeddingRequest {
  text: string;
  /** Optional correlation ID for tracing. */
  correlationId?: string;
}

export interface EmbeddingResponse {
  vector: number[];
  model: string;
  latencyMs: number;
}

export interface AiProviderPort {
  /**
   * Generate a chat completion.
   * Must never throw on provider errors — return a structured response with
   * fallback content and set `fromProvider: false` when the provider fails.
   */
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;

  /**
   * Generate a text embedding vector.
   * Returns null when the provider is unavailable or not configured.
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse | null>;
}

export const AI_PROVIDER_PORT = Symbol('AiProviderPort');
