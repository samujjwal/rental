// ============================================================================
// AI Types
// Shared contract for AI feature requests and responses
// ============================================================================

/** Request to generate a structured listing description via LLM. */
export interface GenerateDescriptionRequest {
  title: string;
  category: string;
  features?: string[];
  location?: string;
  pricePerDay?: number;
}

/** Result from a listing description generation call. */
export interface GenerateDescriptionResult {
  description: string;
  promptId: string;
  promptVersion: string;
  fromProvider: boolean;
  latencyMs?: number;
  model?: string;
  usage?: AiTokenUsage;
}

/** A single AI-generated improvement suggestion for a listing. */
export interface ListingSuggestion {
  type: 'title' | 'description' | 'price' | 'feature' | 'image';
  suggestion: string;
  rationale?: string;
}

/** Result from a listing suggestions call. */
export interface GenerateListingSuggestionsResult {
  suggestions: ListingSuggestion[];
  promptId: string;
  promptVersion: string;
  fromProvider: boolean;
  latencyMs?: number;
  model?: string;
  usage?: AiTokenUsage;
}

/** Token usage metadata returned by the LLM provider. */
export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A single turn in an AI concierge conversation. */
export interface AiConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/** Request to the AI concierge endpoint. */
export interface AiConciergeRequest {
  message: string;
  conversationId?: string;
  context?: {
    listingId?: string;
    bookingId?: string;
    userId?: string;
  };
}

/** Response from the AI concierge endpoint. */
export interface AiConciergeResponse {
  reply: string;
  conversationId: string;
  intent?: string;
  fromProvider: boolean;
  latencyMs?: number;
}

/** Aggregated market insights for a listing category (all values from real DB data). */
export interface MarketInsights {
  categorySlug: string;
  averagePricePerDay: number;
  medianPricePerDay: number;
  activeListings: number;
  averageRating: number;
  topFeatures: string[];
  currency: string;
  computedAt: string;
}
