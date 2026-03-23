import { api } from "~/lib/api-client";
import type { ListingInput } from "~/lib/validation/listing";

export interface GenerateDescriptionParams {
  title: string;
  category?: string;
  city?: string;
  features?: string[];
  amenities?: string[];
  condition?: string;
  basePrice?: number;
}

export interface GenerateDescriptionResult {
  description: string;
  model: string;
  tokens?: number;
}

export interface GenerateListingSuggestionsParams {
  title?: string;
  description?: string;
  category?: string;
  location?: any;
  currentData: Partial<ListingInput>;
}

export interface ListingSuggestion {
  type: 'pricing' | 'title' | 'description' | 'location' | 'features' | 'images';
  field: keyof ListingInput;
  suggestion: string;
  confidence: number;
  reasoning: string;
}

export interface GenerateListingSuggestionsResult {
  suggestions: ListingSuggestion[];
  /**
   * False when the AI provider was explicitly unavailable.
   * Callers MUST NOT show synthetic data when this is false.
   * Optional for backward-compat with legacy mocks that omit the field.
   */
  fromProvider?: boolean;
}

export interface MarketInsights {
  category: string;
  /** ISO 4217 currency code for all price fields. */
  currency?: string;
  averagePrice: number;
  priceRange: { min: number; max: number };
  demand: 'high' | 'medium' | 'low';
  popularFeatures: string[];
  seasonalTrends: string[];
  competitorCount: number;
}

export const aiApi = {
  async generateDescription(
    params: GenerateDescriptionParams
  ): Promise<GenerateDescriptionResult> {
    return api.post<GenerateDescriptionResult>("/ai/generate-description", params);
  },

  async generateListingSuggestions(
    params: GenerateListingSuggestionsParams
  ): Promise<GenerateListingSuggestionsResult> {
    return api.post<GenerateListingSuggestionsResult>("/ai/listing-suggestions", params);
  },

  async getMarketInsights(category: string): Promise<MarketInsights> {
    return api.get<MarketInsights>(`/ai/market-insights/${encodeURIComponent(category)}`);
  }
};
