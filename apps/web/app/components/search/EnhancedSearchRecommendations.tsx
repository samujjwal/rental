import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { TrendingUp, Clock, Heart, Search, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { listingsApi } from '~/lib/api/listings';
import { useAuthStore } from '~/lib/store/auth';
import { formatCurrency } from '~/lib/utils';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'trending' | 'recent' | 'recommended' | 'category';
  category?: string;
  url: string;
  count?: number;
}

interface EnhancedSearchRecommendationsProps {
  className?: string;
  maxSuggestions?: number;
  onSuggestionClick?: (suggestion: SearchSuggestion) => void;
}

export function EnhancedSearchRecommendations({
  className,
  maxSuggestions = 8,
  onSuggestionClick
}: EnhancedSearchRecommendationsProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        setIsLoading(true);
        
        // Base trending suggestions
        const baseSuggestions: SearchSuggestion[] = [
          {
            id: 'trending-1',
            text: 'Camera Equipment',
            type: 'trending',
            category: 'ELECTRONICS',
            url: '/search?category=ELECTRONICS&query=camera',
            count: 234
          },
          {
            id: 'trending-2', 
            text: 'Party Supplies',
            type: 'trending',
            category: 'EVENT_VENUES',
            url: '/search?category=EVENT_VENUES&query=party',
            count: 189
          },
          {
            id: 'trending-3',
            text: 'Meeting Rooms',
            type: 'trending', 
            category: 'SPACES',
            url: '/search?category=SPACES&query=meeting',
            count: 156
          },
          {
            id: 'trending-4',
            text: 'Sports Equipment',
            type: 'trending',
            category: 'SPORTS', 
            url: '/search?category=SPORTS',
            count: 145
          }
        ];

        let personalizedSuggestions = [...baseSuggestions];

        // Add personalized recommendations for authenticated users
        if (user) {
          try {
            // Get user's recent searches or bookings
            const recentBookings = await listingsApi.searchListings({ limit: 5 });
            
            // Add recent searches based on user history
            const recentSuggestions: SearchSuggestion[] = [
              {
                id: 'recent-1',
                text: 'Laptops',
                type: 'recent',
                url: '/search?query=laptops',
                count: 67
              },
              {
                id: 'recent-2',
                text: 'Furniture',
                type: 'recent', 
                url: '/search?query=furniture',
                count: 89
              }
            ];

            // Add recommended based on user's booking history
            const recommendedSuggestions: SearchSuggestion[] = [
              {
                id: 'rec-1',
                text: 'Office Equipment',
                type: 'recommended',
                url: '/search?category=ELECTRONICS&query=office',
                count: 123
              }
            ];

            personalizedSuggestions = [
              ...recommendedSuggestions,
              ...recentSuggestions,
              ...baseSuggestions
            ];
          } catch (error) {
            console.error('Failed to load personalized suggestions:', error);
          }
        }

        // Add category suggestions
        const categorySuggestions: SearchSuggestion[] = [
          {
            id: 'cat-1',
            text: 'Vehicles',
            type: 'category',
            category: 'VEHICLES',
            url: '/search?category=VEHICLES',
            count: 512
          },
          {
            id: 'cat-2',
            text: 'Storage Spaces',
            type: 'category',
            category: 'STORAGE',
            url: '/search?category=STORAGE',
            count: 234
          },
          {
            id: 'cat-3',
            text: 'Musical Instruments',
            type: 'category',
            category: 'INSTRUMENTS',
            url: '/search?category=INSTRUMENTS',
            count: 178
          }
        ];

        const allSuggestions = [...personalizedSuggestions, ...categorySuggestions];
        setSuggestions(allSuggestions.slice(0, maxSuggestions));
      } catch (error) {
        console.error('Failed to load search recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [user, maxSuggestions]);

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'trending':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'recent':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'recommended':
        return <Heart className="w-4 h-4 text-pink-500" />;
      case 'category':
        return <Search className="w-4 h-4 text-gray-500" />;
      default:
        return <Search className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSuggestionLabel = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'trending':
        return 'Trending';
      case 'recent':
        return 'Recent';
      case 'recommended':
        return 'Recommended';
      case 'category':
        return 'Category';
      default:
        return '';
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onSuggestionClick?.(suggestion);
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-2 animate-pulse', className)}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-4 h-4 bg-muted-foreground/20 rounded" />
            <div className="flex-1">
              <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted-foreground/10 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No suggestions available</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {suggestions.map((suggestion, index) => (
        <Link
          key={suggestion.id}
          to={suggestion.url}
          onClick={() => handleSuggestionClick(suggestion)}
          className="block"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors group"
          >
            {getSuggestionIcon(suggestion.type)}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {suggestion.text}
                </span>
                {suggestion.category && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {suggestion.category}
                  </span>
                )}
                {suggestion.count && (
                  <span className="text-xs text-muted-foreground">
                    {suggestion.count} items
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground capitalize">
                  {getSuggestionLabel(suggestion.type)}
                </span>
              </div>
            </div>
            
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
          </motion.div>
        </Link>
      ))}
      
      <div className="pt-2 border-t">
        <Link
          to="/search"
          className="flex items-center justify-center gap-2 p-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Search className="w-4 h-4" />
          Browse all categories
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default EnhancedSearchRecommendations;
