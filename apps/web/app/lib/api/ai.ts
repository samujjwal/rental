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
}

export interface MarketInsights {
  category: string;
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
    // Mock implementation for now - in production this would call the actual AI service
    const suggestions: ListingSuggestion[] = [];
    
    // Generate mock suggestions based on current data
    if (!params.currentData.title && params.currentData.category) {
      suggestions.push({
        type: 'title',
        field: 'title',
        suggestion: `Premium ${params.currentData.category} for rent - Excellent condition`,
        confidence: 0.85,
        reasoning: 'Titles with category and condition keywords perform better'
      });
    }

    if (!params.currentData.description && params.currentData.title) {
      suggestions.push({
        type: 'description',
        field: 'description',
        suggestion: `This is a well-maintained ${params.currentData.category || 'item'} available for rent. Perfect for short-term use with all necessary features included.`,
        confidence: 0.9,
        reasoning: 'Descriptive descriptions with key features convert better'
      });
    }

    if (!params.currentData.basePrice && params.currentData.category) {
      const mockPrices: Record<string, number> = {
        'electronics': 5000,
        'furniture': 3000,
        'tools': 2000,
        'vehicles': 10000,
        'clothing': 1500
      };
      const suggestedPrice = mockPrices[params.currentData.category.toLowerCase()] || 2500;
      
      suggestions.push({
        type: 'pricing',
        field: 'basePrice',
        suggestion: suggestedPrice.toString(),
        confidence: 0.8,
        reasoning: `Based on market data for ${params.currentData.category} in your area`
      });
    }

    return { suggestions };
  },

  async getMarketInsights(category: string): Promise<MarketInsights> {
    // Mock implementation - in production this would fetch real market data
    const mockInsights: Record<string, MarketInsights> = {
      'electronics': {
        category: 'electronics',
        averagePrice: 5000,
        priceRange: { min: 2000, max: 15000 },
        demand: 'high',
        popularFeatures: ['Warranty', 'Original packaging', 'Accessories included'],
        seasonalTrends: ['Higher demand during holiday seasons', 'New releases drive up prices'],
        competitorCount: 45
      },
      'furniture': {
        category: 'furniture',
        averagePrice: 3000,
        priceRange: { min: 1000, max: 8000 },
        demand: 'medium',
        popularFeatures: ['Assembly included', 'Delivery available', 'Condition reports'],
        seasonalTrends: ['Higher demand during moving seasons', 'Office furniture demand stable'],
        competitorCount: 32
      },
      'tools': {
        category: 'tools',
        averagePrice: 2000,
        priceRange: { min: 500, max: 6000 },
        demand: 'medium',
        popularFeatures: ['Maintenance records', 'Case included', 'Brand reputation'],
        seasonalTrends: ['Higher demand in spring/summer', 'Power tools peak during construction season'],
        competitorCount: 28
      }
    };

    return mockInsights[category.toLowerCase()] || {
      category,
      averagePrice: 2500,
      priceRange: { min: 1000, max: 5000 },
      demand: 'medium',
      popularFeatures: ['Good condition', 'Well maintained', 'Quality brand'],
      seasonalTrends: ['Steady demand throughout year'],
      competitorCount: 25
    };
  }
};
