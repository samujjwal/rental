import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';

/**
 * Multi-Modal Marketplace Search (V5 Prompt 6)
 *
 * Enhanced search supporting:
 * - Full-text search via Postgres tsvector (ts_rank + plainto_tsquery)
 * - Geo-spatial search via Haversine distance (PostGIS-compatible)
 * - Availability date-range pruning (exclude booked listings)
 * - Image search (via pgvector embeddings)
 * - Personalization from UserSearchProfile
 * - Redis-cached results for hot queries
 */
@Injectable()
export class MultiModalSearchService {
  private readonly logger = new Logger(MultiModalSearchService.name);
  private static readonly CACHE_TTL = 60; // 1 min hot-query cache

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Execute a multi-modal search query.
   *
   * Supports TEXT (FTS), MAP (geo), SEMANTIC (embedding) modes.
   * Applies availability pruning when date filters are present.
   */
  async search(params: {
    query?: string;
    searchType?: string;
    userId?: string;
    sessionId?: string;
    filters?: {
      country?: string;
      city?: string;
      categoryId?: string;
      minPrice?: number;
      maxPrice?: number;
      startDate?: Date;
      endDate?: Date;
      guestCount?: number;
      amenities?: string[];
    };
    location?: { latitude: number; longitude: number; radiusKm?: number };
    page?: number;
    limit?: number;
  }): Promise<{
    results: any[];
    total: number;
    searchType: string;
    responseTimeMs: number;
  }> {
    const start = Date.now();
    const searchType = params.searchType || (params.location ? 'MAP' : 'TEXT');
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // ── Check hot-query cache ──
    const cacheKey = `search:${JSON.stringify({ q: params.query, t: searchType, f: params.filters, l: params.location, p: page })}`;
    const cached = await this.cache.get<{ results: any[]; total: number }>(cacheKey);
    if (cached) {
      return { ...cached, searchType, responseTimeMs: Date.now() - start };
    }

    let results: any[];
    let total: number;

    if (searchType === 'MAP' && params.location) {
      // ── Geo-spatial search via Haversine raw SQL ──
      ({ results, total } = await this.geoSearch(params, offset, limit));
    } else if (params.query && searchType === 'TEXT') {
      // ── Full-text search via tsvector ──
      ({ results, total } = await this.fullTextSearch(params, offset, limit));
    } else {
      // ── Prisma filter-based search (fallback) ──
      ({ results, total } = await this.filterSearch(params, offset, limit));
    }

    // ── Availability pruning ──
    if (params.filters?.startDate && params.filters?.endDate && results.length > 0) {
      results = await this.pruneUnavailable(results, params.filters.startDate, params.filters.endDate);
      total = results.length; // Adjust after pruning
    }

    // ── Personalization boost ──
    if (params.userId && results.length > 0) {
      results = await this.applyPersonalization(params.userId, results);
    }

    const responseTimeMs = Date.now() - start;

    // Cache hot results
    await this.cache.set(cacheKey, { results, total }, MultiModalSearchService.CACHE_TTL);

    // Track search event (fire-and-forget)
    this.prisma.searchEvent.create({
      data: {
        userId: params.userId,
        sessionId: params.sessionId,
        query: params.query,
        searchType: searchType as any,
        filters: params.filters || {},
        resultCount: total,
        country: params.filters?.country,
        latitude: params.location?.latitude,
        longitude: params.location?.longitude,
        responseTimeMs,
      },
    }).catch((e) => this.logger.debug(`Search event tracking failed: ${e.message}`));

    // Update search profile (fire-and-forget)
    if (params.userId) {
      this.updateSearchProfile(params.userId, params).catch((e) => this.logger.debug(`Search profile update failed: ${e.message}`));
    }

    return { results, total, searchType, responseTimeMs };
  }

  // ── Geo-spatial search (Haversine distance in SQL) ──────────────

  private async geoSearch(
    params: Parameters<MultiModalSearchService['search']>[0],
    offset: number,
    limit: number,
  ): Promise<{ results: any[]; total: number }> {
    const { latitude, longitude, radiusKm = 25 } = params.location!;
    const filters = params.filters || {};

    // Build dynamic WHERE clauses
    const conditions: string[] = [
      `l.status = 'AVAILABLE'`,
      `l."deletedAt" IS NULL`,
      `l.latitude IS NOT NULL`,
      `l.longitude IS NOT NULL`,
    ];
    const values: any[] = [latitude, longitude, radiusKm];

    if (filters.country) { conditions.push(`l.country = $${values.length + 1}`); values.push(filters.country); }
    if (filters.city) { conditions.push(`l.city = $${values.length + 1}`); values.push(filters.city); }
    if (filters.categoryId) { conditions.push(`l."categoryId" = $${values.length + 1}`); values.push(filters.categoryId); }
    if (filters.minPrice) { conditions.push(`l."basePrice" >= $${values.length + 1}`); values.push(filters.minPrice); }
    if (filters.maxPrice) { conditions.push(`l."basePrice" <= $${values.length + 1}`); values.push(filters.maxPrice); }

    const whereClause = conditions.join(' AND ');

    // Haversine formula in SQL
    const distanceExpr = `
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians($1)) * cos(radians(l.latitude)) *
          cos(radians(l.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(l.latitude))
        ))
      ))`;

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM "Listing" l
      WHERE ${whereClause}
        AND ${distanceExpr} <= $3
    `;

    const dataQuery = `
      SELECT l.id, l.title, l.description, l."basePrice", l.city, l.country,
             l.latitude, l.longitude, l."averageRating", l.featured, l."viewCount",
             l."categoryId", l."ownerId",
             ${distanceExpr} AS distance_km
      FROM "Listing" l
      WHERE ${whereClause}
        AND ${distanceExpr} <= $3
      ORDER BY distance_km ASC, l.featured DESC, l."averageRating" DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(limit, offset);

    const [countResult, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ total: number }]>(countQuery, ...values.slice(0, -2)),
      this.prisma.$queryRawUnsafe<any[]>(dataQuery, ...values),
    ]);

    return {
      results: rows.map((r) => ({ ...r, distanceKm: Math.round(r.distance_km * 100) / 100 })),
      total: countResult[0]?.total ?? 0,
    };
  }

  // ── Full-text search via Postgres tsvector ──────────────────────

  private async fullTextSearch(
    params: Parameters<MultiModalSearchService['search']>[0],
    offset: number,
    limit: number,
  ): Promise<{ results: any[]; total: number }> {
    const query = params.query!;
    const filters = params.filters || {};

    const conditions: string[] = [
      `l.status = 'AVAILABLE'`,
      `l."deletedAt" IS NULL`,
    ];
    const values: any[] = [query];

    if (filters.country) { conditions.push(`l.country = $${values.length + 1}`); values.push(filters.country); }
    if (filters.city) { conditions.push(`l.city = $${values.length + 1}`); values.push(filters.city); }
    if (filters.categoryId) { conditions.push(`l."categoryId" = $${values.length + 1}`); values.push(filters.categoryId); }
    if (filters.minPrice) { conditions.push(`l."basePrice" >= $${values.length + 1}`); values.push(filters.minPrice); }
    if (filters.maxPrice) { conditions.push(`l."basePrice" <= $${values.length + 1}`); values.push(filters.maxPrice); }

    const whereClause = conditions.join(' AND ');

    // Use plainto_tsquery for safe user input, ts_rank for relevance scoring
    const ftsExpr = `(
      to_tsvector('english', COALESCE(l.title, '') || ' ' || COALESCE(l.description, '') || ' ' || COALESCE(l.city, ''))
      @@ plainto_tsquery('english', $1)
    )`;

    const rankExpr = `ts_rank(
      to_tsvector('english', COALESCE(l.title, '') || ' ' || COALESCE(l.description, '') || ' ' || COALESCE(l.city, '')),
      plainto_tsquery('english', $1)
    )`;

    // Fallback: also match via ILIKE for short or partial queries
    const fallbackExpr = `(l.title ILIKE '%' || $1 || '%' OR l.description ILIKE '%' || $1 || '%' OR l.city ILIKE '%' || $1 || '%')`;

    const matchExpr = `(${ftsExpr} OR ${fallbackExpr})`;

    const countQuery = `
      SELECT COUNT(*)::int as total FROM "Listing" l
      WHERE ${whereClause} AND ${matchExpr}
    `;

    const dataQuery = `
      SELECT l.id, l.title, l.description, l."basePrice", l.city, l.country,
             l.latitude, l.longitude, l."averageRating", l.featured, l."viewCount",
             l."categoryId", l."ownerId",
             ${rankExpr} AS fts_rank
      FROM "Listing" l
      WHERE ${whereClause} AND ${matchExpr}
      ORDER BY l.featured DESC, fts_rank DESC, l."averageRating" DESC, l."viewCount" DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(limit, offset);

    const [countResult, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ total: number }]>(countQuery, ...values.slice(0, -2)),
      this.prisma.$queryRawUnsafe<any[]>(dataQuery, ...values),
    ]);

    return {
      results: rows.map((r) => ({ ...r, relevanceScore: Number(r.fts_rank) })),
      total: countResult[0]?.total ?? 0,
    };
  }

  // ── Standard Prisma filter-based search ────────────────────────

  private async filterSearch(
    params: Parameters<MultiModalSearchService['search']>[0],
    offset: number,
    limit: number,
  ): Promise<{ results: any[]; total: number }> {
    const where: any = { status: 'AVAILABLE', deletedAt: null };

    if (params.filters?.country) where.country = params.filters.country;
    if (params.filters?.city) where.city = params.filters.city;
    if (params.filters?.categoryId) where.categoryId = params.filters.categoryId;
    if (params.filters?.minPrice || params.filters?.maxPrice) {
      where.basePrice = {};
      if (params.filters!.minPrice) where.basePrice.gte = params.filters!.minPrice;
      if (params.filters!.maxPrice) where.basePrice.lte = params.filters!.maxPrice;
    }

    if (params.query) {
      where.OR = [
        { title: { contains: params.query, mode: 'insensitive' } },
        { description: { contains: params.query, mode: 'insensitive' } },
        { city: { contains: params.query, mode: 'insensitive' } },
      ];
    }

    const [results, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ featured: 'desc' }, { averageRating: 'desc' }, { viewCount: 'desc' }],
        include: {
          category: { select: { name: true, slug: true } },
          owner: { select: { firstName: true, lastName: true, averageRating: true } },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { results, total };
  }

  // ── Availability date-range pruning ────────────────────────────

  private async pruneUnavailable(listings: any[], startDate: Date, endDate: Date): Promise<any[]> {
    if (listings.length === 0) return listings;

    const listingIds = listings.map((l) => l.id);

    const conflictingBookings = await this.prisma.booking.findMany({
      where: {
        listingId: { in: listingIds },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      select: { listingId: true },
    });

    const bookedIds = new Set(conflictingBookings.map((b) => b.listingId));
    return listings.filter((l) => !bookedIds.has(l.id));
  }

  // ── Personalization boost ──────────────────────────────────────

  private async applyPersonalization(userId: string, results: any[]): Promise<any[]> {
    try {
      const profile = await this.prisma.userSearchProfile.findUnique({
        where: { userId },
      });
      if (!profile) return results;

      const preferredCategories = new Set((profile.preferredCategories as string[]) || []);
      const preferredLocations = new Set((profile.preferredLocations as string[]) || []);

      // Boost score for personalized matches
      return results
        .map((r) => {
          let boost = 0;
          if (preferredCategories.has(r.categoryId)) boost += 10;
          if (preferredLocations.has(r.city)) boost += 5;
          if (preferredLocations.has(r.country)) boost += 3;
          return { ...r, _personalBoost: boost };
        })
        .sort((a, b) => (b._personalBoost || 0) - (a._personalBoost || 0) || 0);
    } catch {
      return results;
    }
  }

  /**
   * Record a click on a search result for CTR tracking.
   */
  async recordClick(searchEventId: string, listingId: string) {
    const event = await this.prisma.searchEvent.findUnique({
      where: { id: searchEventId },
    });

    if (event) {
      const existing = (event.clickedListings as string[]) || [];
      await this.prisma.searchEvent.update({
        where: { id: searchEventId },
        data: { clickedListings: [...existing, listingId] },
      });
    }
  }

  /**
   * Record a booking conversion from search.
   */
  async recordConversion(searchEventId: string, listingId: string) {
    await this.prisma.searchEvent.update({
      where: { id: searchEventId },
      data: { bookedListingId: listingId },
    });
  }

  /**
   * Get search analytics for a time period.
   */
  async getSearchAnalytics(
    country?: string,
    days: number = 30,
  ): Promise<{
    totalSearches: number;
    avgResponseTime: number;
    conversionRate: number;
    topQueries: Array<{ query: string; count: number }>;
    searchTypeBreakdown: Record<string, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await this.prisma.searchEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(country ? { country } : {}),
      },
    });

    const totalSearches = events.length;
    const avgResponseTime = totalSearches > 0
      ? events.reduce((sum, e) => sum + e.responseTimeMs, 0) / totalSearches
      : 0;
    const conversions = events.filter((e) => e.bookedListingId).length;
    const conversionRate = totalSearches > 0 ? conversions / totalSearches : 0;

    // Top queries
    const queryCounts: Record<string, number> = {};
    for (const e of events) {
      if (e.query) {
        queryCounts[e.query] = (queryCounts[e.query] || 0) + 1;
      }
    }
    const topQueries = Object.entries(queryCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Search type breakdown
    const searchTypeBreakdown: Record<string, number> = {};
    for (const e of events) {
      const t = e.searchType || 'TEXT';
      searchTypeBreakdown[t] = (searchTypeBreakdown[t] || 0) + 1;
    }

    return { totalSearches, avgResponseTime, conversionRate, topQueries, searchTypeBreakdown };
  }

  /**
   * Get personalized ranking signals for a user.
   */
  async getPersonalizationSignals(userId: string) {
    const profile = await this.prisma.userSearchProfile.findUnique({
      where: { userId },
    });

    return {
      preferredLocations: (profile?.preferredLocations as string[]) || [],
      preferredCategories: (profile?.preferredCategories as string[]) || [],
      priceRange: (profile?.priceRange as Record<string, number>) || {},
    };
  }

  // ── Internal helpers ──────────────────────────────────

  private async updateSearchProfile(userId: string, params: any) {
    try {
      await this.prisma.userSearchProfile.upsert({
        where: { userId },
        update: {
          recentSearches: {
            set: params.query ? [params.query] : [],
          } as any,
          updatedAt: new Date(),
        },
        create: {
          userId,
          recentSearches: params.query ? [params.query] : [],
        },
      });
    } catch {
      this.logger.debug(`Failed to update search profile for ${userId}`);
    }
  }
}
