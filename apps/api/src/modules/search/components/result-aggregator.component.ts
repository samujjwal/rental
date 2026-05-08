/**
 * Result Aggregator Component
 * 
 * Aggregates and formats search results from various sources.
 * Handles result merging, scoring, and pagination.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SearchResult } from '../services/search.service';

export interface AggregationOptions {
  maxResults?: number;
  deduplicate?: boolean;
  sortBy?: 'relevance' | 'distance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  includeDistance?: boolean;
  distanceMap?: Map<string, number>;
}

export interface AggregatedResult {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}

@Injectable()
export class ResultAggregatorComponent {
  private readonly logger = new Logger(ResultAggregatorComponent.name);

  /**
   * Format a Prisma listing into a SearchResult
   */
  formatSearchResult(listing: any, score?: number, distance?: number): SearchResult {
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      slug: listing.slug,
      categoryName: listing.category?.name || '',
      categorySlug: listing.category?.slug || '',
      city: listing.city,
      state: listing.state,
      country: listing.country,
      location: {
        lat: listing.latitude,
        lon: listing.longitude,
      },
      basePrice: Number(listing.basePrice),
      currency: listing.currency,
      photos: Array.isArray(listing.photos) ? listing.photos : [],
      ownerName: `${listing.owner.firstName} ${listing.owner.lastName}`.trim(),
      ownerRating: listing.owner.averageRating || 0,
      averageRating: listing.averageRating || 0,
      totalReviews: listing.totalReviews || 0,
      bookingMode: listing.bookingMode,
      condition: listing.condition,
      features: Array.isArray(listing.features) ? listing.features : [],
      score,
      distance,
      createdAt: listing.createdAt,
    };
  }

  /**
   * Format multiple listings into SearchResults
   */
  formatSearchResults(listings: any[], distanceMap?: Map<string, number>): SearchResult[] {
    return listings.map((listing) =>
      this.formatSearchResult(
        listing,
        undefined,
        distanceMap?.get(listing.id),
      ),
    );
  }

  /**
   * Merge multiple result sets, deduplicating by ID
   */
  mergeResults(...resultSets: SearchResult[][]): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const results of resultSets) {
      for (const result of results) {
        // Keep the first occurrence or the one with a higher score
        if (!merged.has(result.id) || (result.score && (!merged.get(result.id).score || result.score > merged.get(result.id).score))) {
          merged.set(result.id, result);
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Sort results by the specified criteria
   */
  sortResults(results: SearchResult[], sortBy: AggregationOptions['sortBy']): SearchResult[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'relevance':
        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case 'distance':
        sorted.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        break;
      case 'price_asc':
        sorted.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case 'price_desc':
        sorted.sort((a, b) => b.basePrice - a.basePrice);
        break;
      case 'rating':
        sorted.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'newest':
        sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
        break;
      default:
        // Default to relevance
        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    return sorted;
  }

  /**
   * Paginate results
   */
  paginateResults(results: SearchResult[], page: number, size: number): {
    paginated: SearchResult[];
    hasMore: boolean;
  } {
    const startIndex = (page - 1) * size;
    const paginated = results.slice(startIndex, startIndex + size);
    const hasMore = startIndex + size < results.length;

    return { paginated, hasMore };
  }

  /**
   * Aggregate results with options
   */
  aggregate(
    resultSets: SearchResult[][],
    options: AggregationOptions = {},
  ): AggregatedResult {
    const {
      maxResults,
      deduplicate = true,
      sortBy = 'relevance',
      includeDistance = false,
      distanceMap,
    } = options;

    // Merge results
    let merged = deduplicate ? this.mergeResults(...resultSets) : resultSets.flat();

    // Apply distance if available
    if (includeDistance && distanceMap) {
      merged = merged.map((result) => ({
        ...result,
        distance: distanceMap.get(result.id),
      }));
    }

    // Sort results
    merged = this.sortResults(merged, sortBy);

    // Limit results if specified
    if (maxResults) {
      merged = merged.slice(0, maxResults);
    }

    return {
      results: merged,
      total: merged.length,
      hasMore: false, // HasMore is determined by pagination
    };
  }

  /**
   * Calculate relevance score for a listing based on query
   */
  calculateRelevanceScore(listing: any, query?: string): number {
    if (!query) return 1;

    const queryLower = query.toLowerCase();
    const titleLower = (listing.title || '').toLowerCase();
    const descriptionLower = (listing.description || '').toLowerCase();
    const cityLower = (listing.city || '').toLowerCase();

    let score = 0;

    // Exact title match
    if (titleLower === queryLower) score += 1.0;
    // Title contains query
    else if (titleLower.includes(queryLower)) score += 0.8;
    // Description contains query
    else if (descriptionLower.includes(queryLower)) score += 0.5;
    // City contains query
    else if (cityLower.includes(queryLower)) score += 0.3;

    // Boost for verified listings
    if (listing.verificationStatus === 'VERIFIED') score += 0.2;

    // Boost for high-rated listings
    if (listing.averageRating >= 4.5) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate similarity score between two listings
   */
  calculateSimilarityScore(listing1: any, listing2: any): number {
    let score = 0;

    // Same category
    if (listing1.categoryId === listing2.categoryId) score += 0.4;

    // Same city/state
    if (listing1.city === listing2.city && listing1.state === listing2.state) score += 0.3;

    // Similar price (within 20%)
    const price1 = Number(listing1.basePrice);
    const price2 = Number(listing2.basePrice);
    if (price1 > 0 && price2 > 0) {
      const priceRatio = Math.min(price1, price2) / Math.max(price1, price2);
      if (priceRatio >= 0.8) score += 0.2;
    }

    // Similar features
    if (listing1.features && listing2.features) {
      const commonFeatures = listing1.features.filter((f: string) => 
        listing2.features.includes(f)
      );
      const featureOverlap = commonFeatures.length / Math.max(listing1.features.length, listing2.features.length);
      score += featureOverlap * 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Build aggregations (category, price range, etc.) for faceted search
   */
  async buildAggregations(listings: any[]): Promise<any> {
    const categories = new Map<string, number>();
    const priceRanges = new Map<string, number>();

    for (const listing of listings) {
      // Category aggregation
      if (listing.category?.name) {
        categories.set(listing.category.name, (categories.get(listing.category.name) || 0) + 1);
      }

      // Price range aggregation
      const price = Number(listing.basePrice);
      if (!isNaN(price)) {
        const range = this.getPriceRange(price);
        priceRanges.set(range, (priceRanges.get(range) || 0) + 1);
      }
    }

    return {
      categories: Array.from(categories.entries()).map(([name, count]) => ({ name, count })),
      priceRanges: Array.from(priceRanges.entries()).map(([range, count]) => ({ range, count })),
    };
  }

  /**
   * Get price range label for a price value
   */
  private getPriceRange(price: number): string {
    if (price < 50) return '0-50';
    if (price < 100) return '50-100';
    if (price < 200) return '100-200';
    if (price < 500) return '200-500';
    if (price < 1000) return '500-1000';
    return '1000+';
  }
}
