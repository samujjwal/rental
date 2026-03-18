import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { 
  Search, 
  Filter, 
  X, 
  TrendingUp, 
  Clock, 
  MapPin, 
  Calendar,
  DollarSign,
  Star,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { listingsApi } from '~/lib/api/listings';
import { useAuthStore } from '~/lib/store/auth';
import { useTranslation } from 'react-i18next';
import type { Listing } from '~/types/listing';

interface SearchFilters {
  query: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: string;
  endDate?: string;
  rating?: number;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'newest' | 'distance';
}

interface SearchSuggestion {
  id: string;
  type: 'query' | 'category' | 'location' | 'listing';
  title: string;
  subtitle?: string;
  image?: string;
  price?: number;
  rating?: number;
  popularity?: number;
  reason?: string;
}

interface PredictiveRecommendation {
  type: 'trending' | 'recently_viewed' | 'similar' | 'recommended';
  title: string;
  items: Listing[];
  reason: string;
}

export function AdvancedSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get('query') || '',
    category: searchParams.get('category') || undefined,
    location: searchParams.get('location') || undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    rating: searchParams.get('rating') ? Number(searchParams.get('rating')) : undefined,
    sortBy: (searchParams.get('sortBy') as any) || 'relevance'
  });

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recommendations, setRecommendations] = useState<PredictiveRecommendation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trendingQueries, setTrendingQueries] = useState<string[]>([]);

  // Simple debounce implementation
  const debounce = useCallback((func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        // Mock implementation for now - in production this would call the actual API
        const mockSuggestions: SearchSuggestion[] = [
          {
            id: '1',
            type: 'query',
            title: query,
            subtitle: 'Search query',
            popularity: 0.8
          },
          {
            id: '2',
            type: 'category',
            title: 'electronics',
            subtitle: 'Popular category',
            popularity: 0.9
          }
        ];
        setSuggestions(mockSuggestions);
      } catch (error) {
        console.error('Failed to fetch search suggestions:', error);
      }
    }, 300),
    []
  );

  // Fetch recommendations and trending queries
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        // Mock implementation for now - in production this would call the actual APIs
        const mockRecommendations: PredictiveRecommendation[] = [
          {
            type: 'trending',
            title: 'Trending Near You',
            reason: 'Based on popular searches in your area',
            items: []
          },
          {
            type: 'recommended',
            title: 'Recommended for You',
            reason: 'Based on your search history and preferences',
            items: []
          }
        ];
        
        const mockTrendingQueries = [
          'camera rental',
          'furniture for rent',
          'power tools',
          'party supplies',
          'electronics rental'
        ];
        
        setRecommendations(mockRecommendations);
        setTrendingQueries(mockTrendingQueries);
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      }
    };

    fetchRecommendations();
  }, [user?.id]);

  // Handle query changes
  useEffect(() => {
    if (filters.query) {
      debouncedSearch(filters.query);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [filters.query, debouncedSearch]);

  const handleSearch = useCallback(async (searchFilters: SearchFilters = filters) => {
    setIsSearching(true);
    setShowSuggestions(false);
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(searchFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);

    try {
      // Navigate to search results
      navigate(`/search?${params.toString()}`);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [filters, navigate, setSearchParams]);

  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case 'query':
        setFilters(prev => ({ ...prev, query: suggestion.title }));
        handleSearch({ ...filters, query: suggestion.title });
        break;
      case 'category':
        setFilters(prev => ({ ...prev, category: suggestion.title }));
        handleSearch({ ...filters, category: suggestion.title });
        break;
      case 'location':
        setFilters(prev => ({ ...prev, location: suggestion.title }));
        handleSearch({ ...filters, location: suggestion.title });
        break;
      case 'listing':
        navigate(`/listings/${suggestion.id}`);
        break;
    }
    setShowSuggestions(false);
  }, [filters, handleSearch, navigate]);

  const clearFilters = useCallback(() => {
    setFilters({
      query: '',
      sortBy: 'relevance'
    });
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const getSortIcon = (sortBy: string) => {
    switch (sortBy) {
      case 'price_low':
      case 'price_high':
        return <DollarSign className="w-4 h-4" />;
      case 'rating':
        return <Star className="w-4 h-4" />;
      case 'newest':
        return <Clock className="w-4 h-4" />;
      case 'distance':
        return <MapPin className="w-4 h-4" />;
      default:
        return <TrendingUp className="w-4 h-4" />;
    }
  };

  const renderSuggestion = (suggestion: SearchSuggestion) => {
    const icons = {
      query: <Search className="w-4 h-4 text-muted-foreground" />,
      category: <Sparkles className="w-4 h-4 text-primary" />,
      location: <MapPin className="w-4 h-4 text-success" />,
      listing: <Star className="w-4 h-4 text-warning" />
    };

    return (
      <button
        key={suggestion.id}
        onClick={() => handleSuggestionClick(suggestion)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors text-left"
      >
        <div className="flex-shrink-0">
          {icons[suggestion.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">
            {suggestion.title}
          </div>
          {suggestion.subtitle && (
            <div className="text-sm text-muted-foreground truncate">
              {suggestion.subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {suggestion.price && (
            <span className="text-sm font-medium text-foreground">
              ${suggestion.price}
            </span>
          )}
          {suggestion.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-sm">{suggestion.rating}</span>
            </div>
          )}
          {suggestion.popularity && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-xs text-muted-foreground">
                {Math.round(suggestion.popularity * 100)}%
              </span>
            </div>
          )}
        </div>
      </button>
    );
  };

  const renderRecommendation = (recommendation: PredictiveRecommendation) => {
    const icons = {
      trending: <TrendingUp className="w-4 h-4 text-green-500" />,
      recently_viewed: <Clock className="w-4 h-4 text-blue-500" />,
      similar: <Sparkles className="w-4 h-4 text-purple-500" />,
      recommended: <Star className="w-4 h-4 text-yellow-500" />
    };

    return (
      <div key={recommendation.type} className="space-y-3">
        <div className="flex items-center gap-2">
          {icons[recommendation.type]}
          <h3 className="font-semibold text-foreground">{recommendation.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendation.items.slice(0, 6).map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/listings/${item.id}`)}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors text-left"
            >
              {item.images?.[0] && (
                <img
                  src={item.images[0]}
                  alt={item.title}
                  className="w-12 h-12 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {item.title}
                </div>
                <div className="text-sm text-muted-foreground">
                  ${item.basePrice}/day
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
              onFocus={() => setShowSuggestions(true)}
              placeholder={t('search.placeholder', 'Search for items, categories, or locations...')}
              className="w-full pl-10 pr-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
            {filters.query && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, query: '' }))}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 border rounded-lg transition-colors',
              showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            )}
          >
            <Filter className="w-4 h-4" />
            {t('search.filters', 'Filters')}
          </button>

          <button
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {t('search.search', 'Search')}
          </button>
        </div>

        {/* Search Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="p-2">
              {suggestions.map(renderSuggestion)}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="border rounded-lg p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{t('search.advancedFilters', 'Advanced Filters')}</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t('search.clearAll', 'Clear All')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('search.category', 'Category')}
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">{t('search.allCategories', 'All Categories')}</option>
                <option value="electronics">Electronics</option>
                <option value="furniture">Furniture</option>
                <option value="tools">Tools</option>
                <option value="vehicles">Vehicles</option>
                <option value="clothing">Clothing</option>
              </select>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('search.location', 'Location')}
              </label>
              <input
                type="text"
                value={filters.location || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value || undefined }))}
                placeholder={t('search.enterLocation', 'Enter location...')}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('search.priceRange', 'Price Range')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.minPrice || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder={t('search.minPrice', 'Min')}
                  className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                />
                <span className="text-muted-foreground">-</span>
                <input
                  type="number"
                  value={filters.maxPrice || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder={t('search.maxPrice', 'Max')}
                  className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('search.dateRange', 'Date Range')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value || undefined }))}
                  className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                />
                <span className="text-muted-foreground">-</span>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value || undefined }))}
                  className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('search.minRating', 'Minimum Rating')}
              </label>
              <select
                value={filters.rating || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">{t('search.anyRating', 'Any Rating')}</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
                <option value="1">1+ Stars</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('search.sortBy', 'Sort By')}
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="relevance">{t('search.relevance', 'Relevance')}</option>
                <option value="price_low">{t('search.priceLowToHigh', 'Price: Low to High')}</option>
                <option value="price_high">{t('search.priceHighToLow', 'Price: High to Low')}</option>
                <option value="rating">{t('search.rating', 'Rating')}</option>
                <option value="newest">{t('search.newest', 'Newest')}</option>
                <option value="distance">{t('search.distance', 'Distance')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Trending Queries */}
      {trendingQueries.length > 0 && !filters.query && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            {t('search.trendingQueries', 'Trending Searches')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {trendingQueries.map((query, index) => (
              <button
                key={index}
                onClick={() => {
                  setFilters(prev => ({ ...prev, query }));
                  handleSearch({ ...filters, query });
                }}
                className="px-3 py-1 bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded-full text-sm transition-colors"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Predictive Recommendations */}
      {recommendations.length > 0 && !filters.query && (
        <div className="space-y-6">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            {t('search.recommendedForYou', 'Recommended for You')}
          </h3>
          {recommendations.map(renderRecommendation)}
        </div>
      )}
    </div>
  );
}
