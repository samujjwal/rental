/**
 * Search Ranking Service
 *
 * Computes composite ranking scores for search results based on multiple signals:
 * - Relevance (text match quality)
 * - Price competitiveness
 * - Host reliability (trust score)
 * - Availability (how often listed vs booked)
 * - Recency (freshness of listing)
 * - User preference matching (personalization)
 * - Location relevance (proximity to search center)
 * - Review quality (rating + volume)
 *
 * These signals are weighted and combined into a final ranking score.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { toNumber } from '@rental-portal/database';

// ─── Interfaces ───────────────────────────────────

export interface RankingSignals {
  relevance: number;         // 0-1: Text match quality
  priceCompetitiveness: number; // 0-1: How price compares to category average
  hostReliability: number;   // 0-1: Host trust/response score
  availability: number;      // 0-1: Booking openness
  recency: number;           // 0-1: How recently listed/updated
  reviewQuality: number;     // 0-1: Rating * log(reviewCount)
  locationRelevance: number; // 0-1: Proximity to search center
  completeness: number;      // 0-1: Profile/listing completeness
  bookingConversion: number; // 0-1: Views-to-booking ratio
}

export interface RankingConfig {
  weights: {
    relevance: number;
    priceCompetitiveness: number;
    hostReliability: number;
    availability: number;
    recency: number;
    reviewQuality: number;
    locationRelevance: number;
    completeness: number;
    bookingConversion: number;
  };
  boosts: {
    instantBook: number;     // Boost for instant-bookable listings
    verified: number;        // Boost for verified listings
    superhost: number;       // Boost for superhost listings
    featured: number;        // Boost for featured listings
    freshListing: number;    // Boost for listings < 7 days old
  };
}

export interface RankedResult {
  listingId: string;
  score: number;
  signals: RankingSignals;
  boosts: string[];
}

const DEFAULT_WEIGHTS: RankingConfig['weights'] = {
  relevance: 0.25,
  priceCompetitiveness: 0.12,
  hostReliability: 0.15,
  availability: 0.08,
  recency: 0.05,
  reviewQuality: 0.18,
  locationRelevance: 0.10,
  completeness: 0.04,
  bookingConversion: 0.03,
};

const DEFAULT_BOOSTS: RankingConfig['boosts'] = {
  instantBook: 1.05,
  verified: 1.08,
  superhost: 1.12,
  featured: 1.15,
  freshListing: 1.03,
};

@Injectable()
export class SearchRankingService {
  private readonly logger = new Logger(SearchRankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Calculate a weighted composite score from ranking signals.
   * Public utility for direct score computation without DB lookups.
   */
  calculateCompositeScore(
    signals: RankingSignals,
    boostFlags?: {
      instantBook?: boolean;
      verified?: boolean;
      superhost?: boolean;
      featured?: boolean;
      freshListing?: boolean;
    },
    config?: Partial<RankingConfig>,
  ): number {
    const weights = { ...DEFAULT_WEIGHTS, ...config?.weights };
    const boosts = { ...DEFAULT_BOOSTS, ...config?.boosts };

    let score =
      signals.relevance * weights.relevance +
      signals.priceCompetitiveness * weights.priceCompetitiveness +
      signals.hostReliability * weights.hostReliability +
      signals.availability * weights.availability +
      signals.recency * weights.recency +
      signals.reviewQuality * weights.reviewQuality +
      signals.locationRelevance * weights.locationRelevance +
      signals.completeness * weights.completeness +
      signals.bookingConversion * weights.bookingConversion;

    if (boostFlags?.instantBook) score *= boosts.instantBook;
    if (boostFlags?.verified) score *= boosts.verified;
    if (boostFlags?.superhost) score *= boosts.superhost;
    if (boostFlags?.featured) score *= boosts.featured;
    if (boostFlags?.freshListing) score *= boosts.freshListing;

    return Math.min(1, Math.round(score * 10000) / 10000);
  }

  /**
   * Rank a set of listing IDs based on composite signals.
   * Returns listings sorted by descending rank score.
   */
  async rankListings(
    listingIds: string[],
    searchContext: {
      query?: string;
      lat?: number;
      lon?: number;
      userId?: string;
      categoryId?: string;
    },
    config?: Partial<RankingConfig>,
  ): Promise<RankedResult[]> {
    if (listingIds.length === 0) return [];

    const weights = { ...DEFAULT_WEIGHTS, ...config?.weights };
    const boosts = { ...DEFAULT_BOOSTS, ...config?.boosts };

    // Batch load listing data
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: {
        owner: {
          select: {
            id: true,
            averageRating: true,
            totalReviews: true,
            responseRate: true,
          },
        },
        category: { select: { slug: true } },
      },
    });

    // Get category average price for competitiveness signal
    const categoryPrices = await this.getCategoryAveragePrices(listings);

    const results: RankedResult[] = [];

    for (const listing of listings) {
      const signals = this.computeSignals(listing, categoryPrices, searchContext);
      const appliedBoosts: string[] = [];

      // Compute weighted score
      let score =
        signals.relevance * weights.relevance +
        signals.priceCompetitiveness * weights.priceCompetitiveness +
        signals.hostReliability * weights.hostReliability +
        signals.availability * weights.availability +
        signals.recency * weights.recency +
        signals.reviewQuality * weights.reviewQuality +
        signals.locationRelevance * weights.locationRelevance +
        signals.completeness * weights.completeness +
        signals.bookingConversion * weights.bookingConversion;

      // Apply boosts
      if (listing.instantBookable) {
        score *= boosts.instantBook;
        appliedBoosts.push('instantBook');
      }
      if (listing.verificationStatus === 'VERIFIED' || listing.verificationStatus === 'APPROVED') {
        score *= boosts.verified;
        appliedBoosts.push('verified');
      }
      if (listing.featured) {
        score *= boosts.featured;
        appliedBoosts.push('featured');
      }

      const daysSinceCreation = (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 7) {
        score *= boosts.freshListing;
        appliedBoosts.push('freshListing');
      }

      // Host superhost boost
      if (
        listing.owner &&
        (listing.owner.averageRating ?? 0) >= 4.8 &&
        (listing.owner.totalReviews ?? 0) >= 20
      ) {
        score *= boosts.superhost;
        appliedBoosts.push('superhost');
      }

      results.push({
        listingId: listing.id,
        score: Math.round(score * 10000) / 10000,
        signals,
        boosts: appliedBoosts,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Compute individual ranking signals for a listing.
   */
  private computeSignals(
    listing: any,
    categoryPrices: Map<string, number>,
    context: { query?: string; lat?: number; lon?: number },
  ): RankingSignals {
    // 1. Relevance (text match — basic keyword check)
    let relevance = 0.5;
    if (context.query) {
      const q = context.query.toLowerCase();
      const title = (listing.title || '').toLowerCase();
      const desc = (listing.description || '').toLowerCase();
      if (title.includes(q)) relevance = 1.0;
      else if (desc.includes(q)) relevance = 0.8;
      else {
        const words = q.split(/\s+/);
        const matches = words.filter((w) => title.includes(w) || desc.includes(w));
        relevance = words.length > 0 ? 0.3 + (matches.length / words.length) * 0.5 : 0.5;
      }
    }

    // 2. Price competitiveness
    let priceCompetitiveness = 0.5;
    const avgPrice = categoryPrices.get(listing.categoryId || '');
    if (avgPrice && avgPrice > 0) {
      const ratio = toNumber(listing.basePrice) / avgPrice;
      // Lower price = more competitive: ratio < 1 is good
      priceCompetitiveness = Math.max(0, Math.min(1, 1 - (ratio - 0.5) / 1.5));
    }

    // 3. Host reliability
    const ownerRating = listing.owner?.averageRating ?? 0;
    const responseRate = listing.owner?.responseRate ?? 0;
    const hostReliability = (ownerRating / 5) * 0.6 + (responseRate / 100) * 0.4;

    // 4. Availability (inverse of booking density — more available = higher)
    const availability = Math.min(1, 1 - (listing.totalBookings || 0) / Math.max((listing.views || 1), 1));

    // 5. Recency (exponential decay over 90 days)
    const daysSinceUpdate = (Date.now() - listing.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-daysSinceUpdate / 90);

    // 6. Review quality (rating scaled by review count)
    const rating = listing.averageRating ?? 0;
    const reviewCount = listing.totalReviews ?? 0;
    const reviewQuality = reviewCount > 0
      ? (rating / 5) * Math.min(1, Math.log10(reviewCount + 1) / 2)
      : 0;

    // 7. Location relevance (distance-based decay, if search has lat/lon)
    let locationRelevance = 0.5;
    if (context.lat && context.lon && listing.latitude && listing.longitude) {
      const distance = this.haversineDistance(
        context.lat, context.lon,
        listing.latitude, listing.longitude,
      );
      // Within 5km = 1.0, decay over 50km
      locationRelevance = Math.max(0, 1 - distance / 50);
    }

    // 8. Completeness (photos, description, amenities)
    const hasPhotos = (listing.photos?.length || 0) >= 3;
    const hasDescription = (listing.description?.length || 0) > 100;
    const hasAmenities = (listing.amenities?.length || 0) >= 3;
    const completeness = (hasPhotos ? 0.4 : 0) + (hasDescription ? 0.3 : 0) + (hasAmenities ? 0.3 : 0);

    // 9. Booking conversion (bookings / views)
    const views = Math.max(listing.viewCount || listing.views || 1, 1);
    const bookingConversion = Math.min(1, (listing.totalBookings || 0) / views);

    return {
      relevance: Math.round(relevance * 1000) / 1000,
      priceCompetitiveness: Math.round(priceCompetitiveness * 1000) / 1000,
      hostReliability: Math.round(hostReliability * 1000) / 1000,
      availability: Math.round(Math.max(0, availability) * 1000) / 1000,
      recency: Math.round(recency * 1000) / 1000,
      reviewQuality: Math.round(reviewQuality * 1000) / 1000,
      locationRelevance: Math.round(locationRelevance * 1000) / 1000,
      completeness: Math.round(completeness * 1000) / 1000,
      bookingConversion: Math.round(bookingConversion * 1000) / 1000,
    };
  }

  /**
   * Get average prices per category for price competitiveness signal.
   */
  private async getCategoryAveragePrices(listings: any[]): Promise<Map<string, number>> {
    const categoryIds = [...new Set(listings.map((l) => l.categoryId).filter(Boolean))];
    const map = new Map<string, number>();

    for (const catId of categoryIds) {
      const cacheKey = `search:rank:catprice:${catId}`;
      let avg = await this.cache.get<number>(cacheKey);

      if (avg == null) {
        const result = await this.prisma.listing.aggregate({
          where: { categoryId: catId, status: 'AVAILABLE' },
          _avg: { basePrice: true },
        });
        avg = result._avg.basePrice ? toNumber(result._avg.basePrice) : 0;
        await this.cache.set(cacheKey, avg, 6 * 60 * 60);
      }

      map.set(catId, avg);
    }

    return map;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
