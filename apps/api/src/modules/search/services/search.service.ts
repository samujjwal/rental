import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { PROPERTY_STATUS, VERIFICATION_STATUS, toNumber } from '@rental-portal/database';

export interface SearchQuery {
  query?: string;
  categoryId?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lon?: number;
    radius?: string; // e.g., "10km"
  };
  priceRange?: {
    min?: number;
    max?: number;
  };
  dates?: {
    startDate: Date;
    endDate: Date;
  };
  filters?: {
    bookingMode?: string;
    condition?: string;
    features?: string[];
    amenities?: string[];
  };
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  page?: number;
  size?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  city: string;
  state: string;
  country: string;
  location: {
    lat: number;
    lon: number;
  };
  basePrice: number;
  currency: string;
  photos: any[];
  ownerName: string;
  ownerRating: number;
  averageRating: number;
  totalReviews: number;
  bookingMode: string;
  condition?: string;
  features: string[];
  score?: number;
  distance?: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async search(searchQuery: SearchQuery): Promise<{
    results: SearchResult[];
    total: number;
    page: number;
    size: number;
    aggregations?: any;
  }> {
    const page = searchQuery.page || 1;
    const size = searchQuery.size || 20;
    const skip = (page - 1) * size;

    // Create cache key
    const cacheKey = `search:${JSON.stringify(searchQuery)}`;

    // Try cache first
    const cached = (await this.cache.get(cacheKey)) as any;
    if (cached) {
      this.logger.debug(`Cache hit for search: ${cacheKey}`);
      return cached;
    }

    // Build where clause
    const where: any = {
      status: PROPERTY_STATUS.AVAILABLE,
      verificationStatus: VERIFICATION_STATUS.VERIFIED,
    };

    // Text search
    if (searchQuery.query) {
      where.OR = [
        {
          title: {
            contains: searchQuery.query,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: searchQuery.query,
            mode: 'insensitive',
          },
        },
        {
          city: {
            contains: searchQuery.query,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Category filter
    if (searchQuery.categoryId) {
      where.categoryId = searchQuery.categoryId;
    }

    // Location filtering
    if (searchQuery.location) {
      if (searchQuery.location.city) {
        where.city = {
          contains: searchQuery.location.city,
          mode: 'insensitive',
        };
      }
      if (searchQuery.location.state) {
        where.state = {
          contains: searchQuery.location.state,
          mode: 'insensitive',
        };
      }
      if (searchQuery.location.country) {
        where.country = {
          contains: searchQuery.location.country,
          mode: 'insensitive',
        };
      }
    }

    // Price range
    if (searchQuery.priceRange) {
      where.basePrice = {};
      if (searchQuery.priceRange.min !== undefined) {
        where.basePrice.gte = searchQuery.priceRange.min;
      }
      if (searchQuery.priceRange.max !== undefined) {
        where.basePrice.lte = searchQuery.priceRange.max;
      }
    }

    // Additional filters
    if (searchQuery.filters) {
      if (searchQuery.filters.bookingMode) {
        where.bookingMode = searchQuery.filters.bookingMode;
      }
      if (searchQuery.filters.condition) {
        where.condition = searchQuery.filters.condition;
      }
      if (searchQuery.filters.features && searchQuery.filters.features.length > 0) {
        where.features = {
          hasSome: searchQuery.filters.features,
        };
      }
    }

    try {
      // Get total count
      const total = await this.prisma.property.count({ where });

      // Get listings with relations
      const listings = await this.prisma.property.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              averageRating: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: this.buildSortOrder(searchQuery.sort),
        take: size,
        skip,
      });

      // Format results
      const results: SearchResult[] = listings.map((listing: any) => ({
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
        basePrice: listing.basePrice,
        currency: listing.currency,
        photos: Array.isArray(listing.photos) ? listing.photos : [],
        ownerName: `${listing.owner.firstName} ${listing.owner.lastName}`.trim(),
        ownerRating: listing.owner.averageRating || 0,
        averageRating: listing.averageRating || 0,
        totalReviews: listing.totalReviews || 0,
        bookingMode: listing.bookingMode,
        condition: listing.condition,
        features: Array.isArray(listing.features) ? listing.features : [],
        score: this.calculateRelevanceScore(listing, searchQuery.query),
      }));

      // Get aggregations
      const aggregations = await this.getAggregations(where);

      const result = {
        results,
        total,
        page,
        size,
        aggregations,
      };

      // Cache result for 5 minutes
      await this.cache.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      this.logger.error('PostgreSQL search failed', error);
      throw error;
    }
  }

  async autocomplete(query: string, limit: number = 10): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `autocomplete:${query}:${limit}`;
    const cached = (await this.cache.get(cacheKey)) as string[];
    if (cached) return cached;

    try {
      const listings = await this.prisma.property.findMany({
        where: {
          status: PROPERTY_STATUS.AVAILABLE,
          verificationStatus: VERIFICATION_STATUS.VERIFIED,
          OR: [
            {
              title: {
                startsWith: query,
                mode: 'insensitive',
              },
            },
            {
              city: {
                startsWith: query,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: {
          title: true,
        },
        take: limit,
        distinct: ['title'],
      });

      const results = listings.map((l) => l.title);

      // Cache for 15 minutes
      await this.cache.set(cacheKey, results, 900);

      return results;
    } catch (error) {
      this.logger.error('Autocomplete search failed', error);
      return [];
    }
  }

  async getSuggestions(query: string): Promise<{
    listings: any[];
    categories: any[];
    locations: any[];
  }> {
    const cacheKey = `suggestions:${query}`;
    const cached = (await this.cache.get(cacheKey)) as any;
    if (cached) return cached;

    try {
      const [listings, categories, locations] = await Promise.all([
        this.prisma.listing.findMany({
          where: {
            status: PROPERTY_STATUS.AVAILABLE,
            verificationStatus: VERIFICATION_STATUS.VERIFIED,
            OR: [
              {
                title: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
          select: {
            id: true,
            title: true,
            slug: true,
            photos: true,
            basePrice: true,
            currency: true,
            city: true,
          },
          take: 5,
        }),
        this.prisma.category.findMany({
          where: {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
          take: 5,
        }),
        this.prisma.listing.findMany({
          where: {
            status: PROPERTY_STATUS.AVAILABLE,
            verificationStatus: VERIFICATION_STATUS.VERIFIED,
            OR: [
              {
                city: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                state: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                country: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
          select: {
            city: true,
            state: true,
            country: true,
          },
          distinct: ['city', 'state', 'country'],
          take: 5,
        }),
      ]);

      const result = {
        listings,
        categories,
        locations: locations.map((l) => ({
          city: l.city,
          state: l.state,
          country: l.country,
        })),
      };

      // Cache for 10 minutes
      await this.cache.set(cacheKey, result, 600);

      return result;
    } catch (error) {
      this.logger.error('Get suggestions failed', error);
      return { listings: [], categories: [], locations: [] };
    }
  }

  async findSimilar(listingId: string, limit: number = 10): Promise<SearchResult[]> {
    const cacheKey = `similar:${listingId}:${limit}`;
    const cached = (await this.cache.get(cacheKey)) as SearchResult[];
    if (cached) return cached;

    try {
      // Get the reference listing
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          categoryId: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          basePrice: true,
          features: true,
        },
      });

      if (!listing) return [];

      // Find similar listings
      const similarListings = await this.prisma.listing.findMany({
        where: {
          id: { not: listingId },
          status: PROPERTY_STATUS.AVAILABLE,
          verificationStatus: VERIFICATION_STATUS.VERIFIED,
          categoryId: listing.categoryId,
          OR: [
            {
              city: listing.city,
              state: listing.state,
            },
            {
              basePrice: {
                gte: toNumber(listing.basePrice) * 0.8,
                lte: toNumber(listing.basePrice) * 1.2,
              },
            },
          ],
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              averageRating: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
        take: limit,
      });

      const results: SearchResult[] = similarListings.map((l: any) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        slug: l.slug,
        categoryName: l.category?.name || '',
        categorySlug: l.category?.slug || '',
        city: l.city,
        state: l.state,
        country: l.country,
        location: {
          lat: l.latitude,
          lon: l.longitude,
        },
        basePrice: l.basePrice,
        currency: l.currency,
        photos: Array.isArray(l.photos) ? l.photos : [],
        ownerName: `${l.owner.firstName} ${l.owner.lastName}`.trim(),
        ownerRating: l.owner.averageRating || 0,
        averageRating: l.averageRating || 0,
        totalReviews: l.totalReviews || 0,
        bookingMode: l.bookingMode,
        condition: l.condition,
        features: Array.isArray(l.features) ? l.features : [],
        score: this.calculateSimilarityScore(l, listing),
      }));

      // Cache for 30 minutes
      await this.cache.set(cacheKey, results, 1800);

      return results;
    } catch (error) {
      this.logger.error('Find similar failed', error);
      return [];
    }
  }

  async getPopularSearches(limit: number = 10): Promise<string[]> {
    const cacheKey = `popular_searches:${limit}`;
    const cached = (await this.cache.get(cacheKey)) as string[];
    if (cached) return cached;

    // For now, return hardcoded popular searches
    // In production, this would come from analytics
    const popular = [
      'apartment',
      'car',
      'camera',
      'bike',
      'guitar',
      'wedding venue',
      'tools',
      'camping gear',
      'party supplies',
      'kayak',
      'drone',
      'sound system',
      'laptop',
      'vacation rental',
      'event space',
    ].slice(0, limit);

    // Cache for 1 hour
    await this.cache.set(cacheKey, popular, 3600);

    return popular;
  }

  private buildSortOrder(sort?: string) {
    switch (sort) {
      case 'price_asc':
        return { basePrice: 'asc' as const };
      case 'price_desc':
        return { basePrice: 'desc' as const };
      case 'rating':
        return { averageRating: 'desc' as const };
      case 'newest':
        return { createdAt: 'desc' as const };
      default:
        return { featured: 'desc' as const };
    }
  }

  private calculateRelevanceScore(listing: any, query?: string): number {
    if (!query) return 0;

    let score = 0;
    const queryLower = query.toLowerCase();

    // Title matches get highest score
    if (listing.title.toLowerCase().includes(queryLower)) {
      score += 10;
      if (listing.title.toLowerCase().startsWith(queryLower)) {
        score += 5; // Bonus for prefix match
      }
    }

    // Description matches
    if (listing.description.toLowerCase().includes(queryLower)) {
      score += 3;
    }

    // City matches
    if (listing.city.toLowerCase().includes(queryLower)) {
      score += 2;
    }

    // Feature matches
    const features = Array.isArray(listing.features) ? listing.features : [];
    if (features.some((f: string) => f.toLowerCase().includes(queryLower))) {
      score += 4;
    }

    // Rating bonus
    score += (listing.averageRating || 0) * 0.5;

    return score;
  }

  private calculateSimilarityScore(listing: any, reference: any): number {
    let score = 0;

    // Same category
    if (listing.categoryId === reference.categoryId) {
      score += 5;
    }

    // Same city/state
    if (listing.city === reference.city && listing.state === reference.state) {
      score += 3;
    }

    // Similar price range
    const priceDiff = Math.abs(listing.basePrice - reference.basePrice);
    const priceRatio = priceDiff / reference.basePrice;
    if (priceRatio < 0.2) {
      score += 2;
    }

    // Shared features
    const listingFeatures = Array.isArray(listing.features) ? listing.features : [];
    const referenceFeatures = Array.isArray(reference.features) ? reference.features : [];
    const sharedFeatures = listingFeatures.filter((f: string) => referenceFeatures.includes(f));
    score += sharedFeatures.length * 0.5;

    return score;
  }

  private async getAggregations(baseWhere: any): Promise<any> {
    try {
      const [categories, priceRanges, cities, conditions] = await Promise.all([
        this.prisma.listing.groupBy({
          by: ['categoryId'],
          where: baseWhere,
          _count: true,
        }),
        this.prisma.listing.aggregate({
          where: baseWhere,
          _min: { basePrice: true },
          _max: { basePrice: true },
          _avg: { basePrice: true },
        }),
        this.prisma.listing.groupBy({
          by: ['city'],
          where: baseWhere,
          _count: true,
          orderBy: { city: 'asc' as const },
          take: 20,
        }),
        this.prisma.listing.groupBy({
          by: ['condition'],
          where: {
            ...baseWhere,
            condition: { not: null },
          },
          _count: true,
        }),
      ]);

      return {
        categories: (categories as any[]).map((c) => ({
          key: c.categoryId,
          count: c._count,
        })),
        priceRanges: {
          min: (priceRanges as any)._min.basePrice,
          max: (priceRanges as any)._max.basePrice,
          avg: (priceRanges as any)._avg.basePrice,
        },
        cities: (cities as any[]).map((c) => ({
          key: c.city,
          count: c._count,
        })),
        conditions: (conditions as any[]).map((c) => ({
          key: c.condition,
          count: c._count,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get aggregations', error);
      return {};
    }
  }
}
