import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '~/lib/utils';
import { 
  Sparkles, 
  Lightbulb, 
  TrendingUp, 
  Calculator, 
  MapPin, 
  Camera,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { aiApi } from '~/lib/api/ai';
import type { ListingInput } from '~/lib/validation/listing';

interface AIListingAssistantProps {
  listingData: Partial<ListingInput>;
  category: string;
  onSuggestionApply: (field: keyof ListingInput, value: any) => void;
  className?: string;
}

interface AISuggestion {
  type: 'pricing' | 'title' | 'description' | 'location' | 'features' | 'images';
  field: keyof ListingInput;
  suggestion: string;
  confidence: number;
  reasoning: string;
  applied?: boolean;
}

interface MarketInsight {
  category: string;
  averagePrice: number;
  priceRange: { min: number; max: number };
  demand: 'high' | 'medium' | 'low';
  popularFeatures: string[];
  seasonalTrends: string[];
  competitorCount: number;
}

export function AIListingAssistant({
  listingData,
  category,
  onSuggestionApply,
  className
}: AIListingAssistantProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [marketInsights, setMarketInsights] = useState<MarketInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'insights'>('suggestions');
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  // Generate AI suggestions when listing data changes
  useEffect(() => {
    if (listingData.title || listingData.description || listingData.category || category) {
      void generateSuggestions();
    }
  }, [listingData, category]);

  // Fetch market insights when category changes
  useEffect(() => {
    if (category) {
      void fetchMarketInsights();
    }
  }, [category]);

  const generateSuggestions = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = await aiApi.generateListingSuggestions({
        currentData: listingData,
        category,
      });

      setSuggestions(response.suggestions || []);
    } catch (error) {
      console.error('Failed to generate AI suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [listingData]);

  const fetchMarketInsights = useCallback(async () => {
    try {
      const insights = await aiApi.getMarketInsights(category);
      setMarketInsights(insights);
    } catch (error) {
      console.error('Failed to fetch market insights:', error);
    }
  }, [category]);

  const applySuggestion = useCallback((suggestion: AISuggestion) => {
    onSuggestionApply(suggestion.field, suggestion.suggestion);
    setAppliedSuggestions(prev => new Set(prev).add(`${suggestion.field}-${suggestion.suggestion}`));
  }, [onSuggestionApply]);

  const getSuggestionIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'pricing':
        return <Calculator className="w-4 h-4" />;
      case 'title':
      case 'description':
        return <Lightbulb className="w-4 h-4" />;
      case 'location':
        return <MapPin className="w-4 h-4" />;
      case 'features':
        return <Sparkles className="w-4 h-4" />;
      case 'images':
        return <Camera className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getDemandColor = (demand: MarketInsight['demand']) => {
    switch (demand) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-red-600 bg-red-50';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className={cn('bg-card rounded-lg shadow-md p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {t('listing.aiAssistant', 'AI Assistant')}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={cn(
              'px-3 py-1 rounded-md text-sm font-medium transition-colors',
              activeTab === 'suggestions'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {t('listing.suggestions', 'Suggestions')}
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={cn(
              'px-3 py-1 rounded-md text-sm font-medium transition-colors',
              activeTab === 'insights'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {t('listing.insights', 'Market Insights')}
          </button>
        </div>
      </div>

      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              {t('listing.generatingSuggestions', 'Generating AI suggestions...')}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('listing.noSuggestions', 'Add more details to get AI suggestions')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">
                  {t('listing.aiSuggestions', 'AI Suggestions')}
                </h4>
              </div>
              {suggestions.map((suggestion, index) => {
                const isApplied = appliedSuggestions.has(`${suggestion.field}-${suggestion.suggestion}`);
                return (
                  <div
                    key={index}
                    className={cn(
                      'border rounded-lg p-4 transition-all',
                      isApplied
                        ? 'border-success bg-success/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn(
                          'p-2 rounded-full',
                          getConfidenceColor(suggestion.confidence)
                        )}>
                          {getSuggestionIcon(suggestion.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-foreground">
                              {t(`listing.fields.${suggestion.field}`, suggestion.field)}
                            </h4>
                            <span className={cn(
                              'text-xs px-2 py-1 rounded-full',
                              getConfidenceColor(suggestion.confidence)
                            )}>
                              {Math.round(suggestion.confidence * 100)}% {t('listing.confidence', 'confidence')}
                            </span>
                            {isApplied && (
                              <CheckCircle className="w-4 h-4 text-success" />
                            )}
                          </div>
                          <p className="text-sm text-foreground mb-2">
                            {suggestion.suggestion}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.reasoning}
                          </p>
                        </div>
                      </div>
                      {!isApplied && (
                        <button
                          onClick={() => applySuggestion(suggestion)}
                          className="ml-4 px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          {t('listing.apply', 'Apply')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={generateSuggestions}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-input rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {t('listing.regenerateSuggestions', 'Regenerate Suggestions')}
          </button>
        </div>
      )}

      {activeTab === 'insights' && marketInsights && (
        <div className="space-y-6">
          {/* Demand Indicator */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <h4 className="font-medium text-foreground mb-1">
                {t('listing.marketDemand', 'Market Demand')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('listing.currentDemand', 'Current demand for this category')}
              </p>
            </div>
            <div className={cn(
              'px-3 py-1 rounded-full text-sm font-medium',
              getDemandColor(marketInsights.demand)
            )}>
              {t(
                `listing.demand.${marketInsights.demand}`,
                marketInsights.demand.toUpperCase()
              )}
            </div>
          </div>

          {/* Pricing Insights */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              {t('listing.pricingInsights', 'Pricing Insights')}
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold text-foreground">
                  {formatPrice(marketInsights.averagePrice)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('listing.averagePrice', 'Average Price')}
                </div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold text-success">
                  {formatPrice(marketInsights.priceRange.min)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('listing.minPrice', 'Min Price')}
                </div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold text-destructive">
                  {formatPrice(marketInsights.priceRange.max)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('listing.maxPrice', 'Max Price')}
                </div>
              </div>
            </div>
          </div>

          {/* Popular Features */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t('listing.popularFeatures', 'Popular Features')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {marketInsights.popularFeatures.map((feature, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* Seasonal Trends */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">
              {t('listing.seasonalTrends', 'Seasonal Trends')}
            </h4>
            <ul className="space-y-2">
              {marketInsights.seasonalTrends.map((trend, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  {trend}
                </li>
              ))}
            </ul>
          </div>

          {/* Competition */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">
              {t('listing.competition', 'Competition')}
            </h4>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-foreground">
                {marketInsights.competitorCount}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('listing.similarListings', 'similar listings in your area')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
