import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { SEMANTIC_RANKING_PORT, type SemanticRankingPort } from '../ports/semantic-ranking.port';
import { PropertyStatus, VerificationStatus, toNumber } from '@rental-portal/database';

export interface SearchQuery {
  query?: string;
  categoryId?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lon?: number;
    radius?: string; // e.g., "10km" or plain number in km
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
    delivery?: boolean;
  };
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'distance';
  // Offset-based pagination (legacy)
  page?: number;
  size?: number;
  // Cursor-based pagination (recommended for large datasets)
  cursor?: string;
  cursorField?: 'id' | 'createdAt' | 'basePrice' | 'averageRating';
  cursorDirection?: 'asc' | 'desc';
}

/**
 * Parse radius string (e.g., "10km", "5mi", "25") into kilometers.
 * Defaults to km if no unit is specified.
 */
function parseRadiusKm(radius?: string): number {
  if (!radius) return 25; // default 25km
  const match = radius.match(/^(\d+(?:\.\d+)?)\s*(km|mi)?$/i);
  if (!match) return 25;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'km').toLowerCase();
  return unit === 'mi' ? value * 1.60934 : value;
}

/**
 * Haversine distance between two points in kilometers.
 */
function haversineDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  // Cursor fields for pagination
  createdAt?: Date;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(SEMANTIC_RANKING_PORT) private readonly semanticRanking: SemanticRankingPort,
  ) {}

  /**
   * Encode cursor for pagination
   */
  private encodeCursor(value: string | number | Date): string {
    const stringValue = value instanceof Date ? value.toISOString() : String(value);
    return Buffer.from(stringValue).toString('base64url');
  }

  /**
   * Decode cursor for pagination
   */
  private decodeCursor(cursor: string): string {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  }

  /**
   * Build cursor-based where clause for Prisma
   */
  private buildCursorWhere(
    cursor: string,
    cursorField: string,
    direction: 'asc' | 'desc',
  ): any {
    const decodedValue = this.decodeCursor(cursor);
    
    // Handle different field types
    let parsedValue: string | number | Date = decodedValue;
    if (cursorField === 'createdAt') {
      parsedValue = new Date(decodedValue);
    } else if (cursorField === 'basePrice' || cursorField === 'averageRating') {
      parsedValue = parseFloat(decodedValue);
    }

    // For ascending sort, we want records > cursor
    // For descending sort, we want records < cursor
    const operator = direction === 'asc' ? 'gt' : 'lt';

    return {
      [cursorField]: {
        [operator]: parsedValue,
      },
    };
  }

  /**
   * Generate next cursor from the last result
   */
  private generateNextCursor(
    lastResult: any,
    cursorField: string,
  ): string | null {
    if (!lastResult || !lastResult[cursorField]) return null;
    return this.encodeCursor(lastResult[cursorField]);
  }

  async search(searchQuery: SearchQuery): Promise<{
    results: SearchResult[];
    total: number;
    page: number;
    size: number;
    aggregations?: any;
    // Cursor-based pagination fields
    nextCursor?: string | null;
    hasMore: boolean;
  }> {
    const page = Math.max(1, Math.floor(Number(searchQuery.page) || 1));
    const size = Math.min(100, Math.max(1, Math.floor(Number(searchQuery.size) || 20)));
    const skip = (page - 1) * size;

    // Create cache key with deterministic JSON key ordering
    const cacheKey = `search:${JSON.stringify(searchQuery, Object.keys(searchQuery).sort())}`;

    // Try cache first
    const cached = (await this.cache.get(cacheKey)) as any;
    if (cached) {
      this.logger.debug(`Cache hit for search: ${cacheKey}`);
      return cached;
    }

    // Build where clause
    const where: any = {
      status: PropertyStatus.AVAILABLE,
      verificationStatus: VerificationStatus.VERIFIED,
    };

    // Full-text search via ILIKE (simplified version to avoid tsvector issues)
    if (searchQuery.query) {
      const ftsIds = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM properties
         WHERE title ILIKE '%' || $1 || '%'
           OR description ILIKE '%' || $1 || '%'
           OR city ILIKE '%' || $1 || '%'`,
        searchQuery.query,
      );
      const ids = ftsIds.map((r) => r.id);
      if (ids.length === 0) {
        // No matches — return empty immediately
        const emptyResult: { 
          results: any[]; 
          total: number; 
          page: number; 
          size: number; 
          hasMore: boolean;
          nextCursor: string | null;
        } = { 
          results: [] as any[], 
          total: 0, 
          page, 
          size, 
          hasMore: false,
          nextCursor: null,
        };
        await this.cache.set(cacheKey, emptyResult, 300);
        return emptyResult;
      }
      where.id = { in: ids };
    }

    // Category filter — DB-driven: resolve parent→children hierarchy instead of hardcoded slugs
    if (searchQuery.categoryId) {
      // Try to find a category matching the given ID, slug, or name (case-insensitive)
      const matchedCategory = await this.prisma.category.findFirst({
        where: {
          OR: [
            { id: searchQuery.categoryId },
            { slug: { equals: searchQuery.categoryId, mode: 'insensitive' } },
            { name: { equals: searchQuery.categoryId, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      if (matchedCategory) {
        // Find all child categories (one level deep) to include in the search
        const childCategories = await this.prisma.category.findMany({
          where: { parentId: matchedCategory.id, isActive: true },
          select: { id: true },
        });

        const categoryIds = [matchedCategory.id, ...childCategories.map((c) => c.id)];
        where.categoryId = { in: categoryIds };
      } else {
        // Fallback: fuzzy name/slug match
        where.OR = [
          { categoryId: searchQuery.categoryId },
          {
            category: {
              name: { contains: searchQuery.categoryId, mode: 'insensitive' },
            },
          },
          {
            category: {
              slug: { contains: searchQuery.categoryId, mode: 'insensitive' },
            },
          },
        ];
      }
    }

    // Location filtering
    const hasGeoSearch =
      searchQuery.location?.lat != null && searchQuery.location?.lon != null;

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

      // Geo bounding-box pre-filter (narrows results before Haversine)
      if (hasGeoSearch) {
        const radiusKm = parseRadiusKm(searchQuery.location.radius);
        const lat = searchQuery.location.lat!;
        const lon = searchQuery.location.lon!;

        // Approximate bounding box (1 degree latitude ≈ 111km)
        const latDelta = radiusKm / 111;
        const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

        where.latitude = {
          not: null,
          gte: lat - latDelta,
          lte: lat + latDelta,
        };
        where.longitude = {
          not: null,
          gte: lon - lonDelta,
          lte: lon + lonDelta,
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
      if (searchQuery.filters.delivery) {
        where.metadata = {
          contains: '"delivery":true',
        };
      }
      if (searchQuery.filters.features && searchQuery.filters.features.length > 0) {
        where.features = {
          hasSome: searchQuery.filters.features,
        };
      }
    }

    // Date availability filter: exclude listings with overlapping confirmed bookings
    // and those with BLOCKED availability periods
    if (searchQuery.dates?.startDate && searchQuery.dates?.endDate) {
      where.bookings = {
        none: {
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT', 'PENDING_OWNER_APPROVAL'] },
          startDate: { lt: searchQuery.dates.endDate },
          endDate: { gt: searchQuery.dates.startDate },
        },
      };
      where.availability = {
        none: {
          status: 'BLOCKED',
          startDate: { lt: searchQuery.dates.endDate },
          endDate: { gt: searchQuery.dates.startDate },
        },
      };
    }

    try {
      // For geo-search, we fetch more results to account for bounding-box
      // items that fall outside the actual radius circle, then filter+paginate
      const isGeoFiltered = hasGeoSearch;
      const fetchLimit = isGeoFiltered ? size * 5 : size;
      const fetchSkip = isGeoFiltered ? 0 : skip;

      // Get listings with relations
      const listings = await this.prisma.listing.findMany({
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
        orderBy: this.buildSortOrder(isGeoFiltered ? undefined : searchQuery.sort),
        take: fetchLimit,
        skip: fetchSkip,
      });

      // Apply precise Haversine distance filter for geo searches
      let filteredListings = listings;
      const distanceMap = new Map<string, number>();

      if (isGeoFiltered) {
        const lat = searchQuery.location!.lat!;
        const lon = searchQuery.location!.lon!;
        const radiusKm = parseRadiusKm(searchQuery.location!.radius);

        filteredListings = listings.filter((listing: any) => {
          if (listing.latitude == null || listing.longitude == null) return false;
          const dist = haversineDistanceKm(lat, lon, listing.latitude, listing.longitude);
          distanceMap.set(listing.id, Math.round(dist * 10) / 10);
          return dist <= radiusKm;
        });

        // Sort by distance if sort is 'distance' or default for geo searches
        if (!searchQuery.sort || searchQuery.sort === 'distance') {
          filteredListings.sort((a: any, b: any) =>
            (distanceMap.get(a.id) || 0) - (distanceMap.get(b.id) || 0)
          );
        }
      }

      // Calculate correct total and paginate for geo searches
      const total = isGeoFiltered
        ? filteredListings.length
        : await this.prisma.listing.count({ where });

      const paginatedListings = isGeoFiltered
        ? filteredListings.slice(skip, skip + size)
        : filteredListings;

      // Format results
      const results: SearchResult[] = paginatedListings.map((listing: any) => ({
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
        distance: distanceMap.get(listing.id),
      }));

      // If text search returned few results, try semantic search for enrichment
      if (searchQuery.query && results.length < size && !isGeoFiltered) {
        // ── Token-based similarity fallback ──────────────────────────────────
        // If exact contains-match returned 0 results, search each meaningful
        // word in the query individually (OR) to handle typos / partial terms.
        if (results.length === 0) {
          const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'of', 'to', 'is', 'and', 'or', 'with', 'by', 'np', 'npr']);
          const tokens = searchQuery.query
            .toLowerCase()
            .split(/\s+/)
            .filter((t) => t.length >= 2 && !stopWords.has(t));

          if (tokens.length > 0) {
            const tokenWhere: any = {
              status: PropertyStatus.AVAILABLE,
              verificationStatus: VerificationStatus.VERIFIED,
            };
            // Copy non-text filters from original where
            if (where.category) tokenWhere.category = where.category;
            if (where.basePrice) tokenWhere.basePrice = where.basePrice;
            if (where.bookingMode) tokenWhere.bookingMode = where.bookingMode;
            if (where.condition) tokenWhere.condition = where.condition;

            // Each token is tried against title, description, city
            tokenWhere.OR = tokens.flatMap((token) => [
              { title: { contains: token, mode: 'insensitive' } },
              { description: { contains: token, mode: 'insensitive' } },
              { city: { contains: token, mode: 'insensitive' } },
              { state: { contains: token, mode: 'insensitive' } },
            ]);

            const similarListings = await this.prisma.listing.findMany({
              where: tokenWhere,
              include: {
                owner: { select: { id: true, firstName: true, lastName: true, averageRating: true } },
                category: { select: { id: true, name: true, slug: true } },
              },
              orderBy: this.buildSortOrder(searchQuery.sort),
              take: size,
              skip,
            });

            results.push(
              ...similarListings.map((listing: any) => ({
                id: listing.id,
                title: listing.title,
                description: listing.description,
                slug: listing.slug,
                categoryName: listing.category?.name || '',
                categorySlug: listing.category?.slug || '',
                city: listing.city,
                state: listing.state,
                country: listing.country,
                location: { lat: listing.latitude, lon: listing.longitude },
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
                isSimilarMatch: true,
              })),
            );
          }
        }
        // ─────────────────────────────────────────────────────────────────────
        try {
          const semanticResults = await this.semanticRanking.semanticSearch(
            searchQuery.query,
            size - results.length,
            0,
          );

          if (semanticResults.length > 0) {
            const existingIds = new Set(results.map((r) => r.id));
            const newIds = semanticResults
              .filter((sr) => !existingIds.has(sr.id))
              .map((sr) => sr.id);

            if (newIds.length > 0) {
              const additionalListings = await this.prisma.listing.findMany({
                where: { id: { in: newIds } },
                include: {
                  owner: {
                    select: { id: true, firstName: true, lastName: true, averageRating: true },
                  },
                  category: { select: { id: true, name: true, slug: true } },
                },
              });

              const semanticDistanceMap = new Map(
                semanticResults.map((sr) => [sr.id, sr.distance]),
              );

              const additionalResults: SearchResult[] = additionalListings.map((listing: any) => ({
                id: listing.id,
                title: listing.title,
                description: listing.description,
                slug: listing.slug,
                categoryName: listing.category?.name || '',
                categorySlug: listing.category?.slug || '',
                city: listing.city,
                state: listing.state,
                country: listing.country,
                location: { lat: listing.latitude, lon: listing.longitude },
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
                score: 1 - (semanticDistanceMap.get(listing.id) || 1), // Convert distance to score
              }));

              results.push(...additionalResults);
            }
          }
        } catch (error) {
          this.logger.debug('Semantic search enrichment failed, using text results only', error);
        }
      }

      // Get aggregations
      const aggregations = await this.getAggregations(where);

      // Determine cursor field for pagination
      const cursorField = searchQuery.cursorField || 'id';
      const cursorDirection = searchQuery.cursorDirection || 'asc';
      
      // Generate next cursor from last result
      const lastResult = results.length > 0 ? results[results.length - 1] : null;
      const nextCursor = this.generateNextCursor(lastResult, cursorField);
      
      // Determine if there are more results
      const hasMore = results.length === size;

      const result = {
        results,
        total,
        page,
        size,
        aggregations,
        nextCursor,
        hasMore,
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
      const listings = await this.prisma.listing.findMany({
        where: {
          status: PropertyStatus.AVAILABLE,
          verificationStatus: VerificationStatus.VERIFIED,
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
            status: PropertyStatus.AVAILABLE,
            verificationStatus: VerificationStatus.VERIFIED,
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
            status: PropertyStatus.AVAILABLE,
            verificationStatus: VerificationStatus.VERIFIED,
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
          status: PropertyStatus.AVAILABLE,
          verificationStatus: VerificationStatus.VERIFIED,
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

    const groups = await this.prisma.listing.groupBy({
      by: ['categoryId'],
      where: {
        status: PropertyStatus.AVAILABLE,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      _count: {
        categoryId: true,
      },
      orderBy: {
        _count: {
          categoryId: 'desc',
        },
      },
      take: limit,
    });

    const categoryIds = groups.map((group) => group.categoryId).filter(Boolean) as string[];

    if (categoryIds.length === 0) {
      await this.cache.set(cacheKey, [], 3600);
      return [];
    }

    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: categoryIds },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const popular = groups
      .map((group) => {
        const category = categoryById.get(group.categoryId);
        return category?.name || category?.slug || null;
      })
      .filter((value): value is string => Boolean(value));

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
        categories: (categories as any[]).map((c: any) => ({
          key: c.categoryId,
          count: c._count,
        })),
        priceRanges: {
          min: (priceRanges as any)._min.basePrice,
          max: (priceRanges as any)._max.basePrice,
          avg: (priceRanges as any)._avg.basePrice,
        },
        cities: (cities as any[]).map((c: any) => ({
          key: c.city,
          count: c._count,
        })),
        conditions: (conditions as any[]).map((c: any) => ({
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
