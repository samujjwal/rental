/**
 * Query Builder Component
 * 
 * Builds Prisma where clauses from search query parameters.
 * Handles text search, category filters, and basic query construction.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PropertyStatus, VerificationStatus } from '@rental-portal/database';
import { SearchQuery } from '../services/search.service';

@Injectable()
export class QueryBuilderComponent {
  private readonly logger = new Logger(QueryBuilderComponent.name);

  /**
   * Build base where clause with status and verification filters
   */
  buildBaseWhere(): any {
    return {
      status: PropertyStatus.AVAILABLE,
      verificationStatus: VerificationStatus.VERIFIED,
    };
  }

  /**
   * Build where clause for full-text search using PostgreSQL tsvector
   */
  async buildTextSearchWhere(
    prisma: any,
    query: string,
    baseWhere: any,
  ): Promise<{ where: any; ids: string[] } | null> {
    if (!query) return null;

    let ids: string[] = [];
    try {
      // Use PostgreSQL full-text search with tsquery for better performance
      const ftsIds = await prisma.$queryRaw(
        `SELECT id FROM properties
         WHERE to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(city, '')) 
         @@ plainto_tsquery('english', $1)
         AND status = 'AVAILABLE' 
         AND verificationStatus = 'VERIFIED'
         LIMIT 1000`,
        query,
      ) as { id: string }[];
      ids = ftsIds.map((r: { id: string }) => r.id);
    } catch (sqlError) {
      this.logger.warn('Full-text search failed, falling back to Prisma query', sqlError);
      // Fallback to Prisma-based search
      const fallbackListings = await prisma.listing.findMany({
        where: {
          status: PropertyStatus.AVAILABLE,
          verificationStatus: VerificationStatus.VERIFIED,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 1000,
      });
      ids = fallbackListings.map((l: { id: string }) => l.id);
    }

    if (ids.length === 0) {
      return null; // No matches
    }

    return { where: { id: { in: ids } }, ids };
  }

  /**
   * Build where clause for category filter with parent-child hierarchy
   */
  async buildCategoryWhere(prisma: any, categoryId: string, baseWhere: any): Promise<any> {
    if (!categoryId) return {};

    // Try to find a category matching the given ID, slug, or name
    const matchedCategory = await prisma.category.findFirst({
      where: {
        OR: [
          { id: categoryId },
          { slug: { equals: categoryId, mode: 'insensitive' } },
          { name: { equals: categoryId, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (matchedCategory) {
      // Find all child categories (one level deep)
      const childCategories = await prisma.category.findMany({
        where: { parentId: matchedCategory.id, isActive: true },
        select: { id: true },
      });

      const categoryIds = [matchedCategory.id, ...childCategories.map((c: { id: string }) => c.id)];
      return { categoryId: { in: categoryIds } };
    }

    // Fallback: fuzzy name/slug match
    return {
      OR: [
        { categoryId: categoryId },
        { category: { name: { contains: categoryId, mode: 'insensitive' } } },
        { category: { slug: { contains: categoryId, mode: 'insensitive' } } },
      ],
    };
  }

  /**
   * Build where clause for location filters
   */
  buildLocationWhere(location: SearchQuery['location']): any {
    if (!location) return {};

    const where: any = {};

    if (location.city) {
      where.city = { contains: location.city, mode: 'insensitive' };
    }
    if (location.state) {
      where.state = { contains: location.state, mode: 'insensitive' };
    }
    if (location.country) {
      where.country = { contains: location.country, mode: 'insensitive' };
    }

    return where;
  }

  /**
   * Build where clause for price range filter
   */
  buildPriceRangeWhere(priceRange: SearchQuery['priceRange']): any {
    if (!priceRange) return {};

    const where: any = { basePrice: {} };
    if (priceRange.min !== undefined) {
      where.basePrice.gte = priceRange.min;
    }
    if (priceRange.max !== undefined) {
      where.basePrice.lte = priceRange.max;
    }

    return where;
  }

  /**
   * Build where clause for additional filters (booking mode, condition, features, delivery)
   */
  buildFiltersWhere(filters: SearchQuery['filters']): any {
    if (!filters) return {};

    const where: any = {};

    if (filters.bookingMode) {
      where.bookingMode = filters.bookingMode;
    }
    if (filters.condition) {
      where.condition = filters.condition;
    }
    if (filters.delivery) {
      where.metadata = { contains: '"delivery":true' };
    }
    if (filters.features && filters.features.length > 0) {
      where.features = { hasSome: filters.features };
    }

    return where;
  }

  /**
   * Build where clause for date availability filter
   */
  buildDateAvailabilityWhere(dates: SearchQuery['dates']): any {
    if (!dates?.startDate || !dates?.endDate) return {};

    return {
      bookings: {
        none: {
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT', 'PENDING_OWNER_APPROVAL'] },
          startDate: { lt: dates.endDate },
          endDate: { gt: dates.startDate },
        },
      },
      availability: {
        none: {
          status: 'BLOCKED',
          startDate: { lt: dates.endDate },
          endDate: { gt: dates.startDate },
        },
      },
    };
  }

  /**
   * Merge multiple where clauses into a single where clause
   */
  mergeWhereClauses(...clauses: any[]): any {
    const merged: any = {};
    for (const clause of clauses) {
      if (!clause || Object.keys(clause).length === 0) continue;
      Object.assign(merged, clause);
    }
    return merged;
  }
}
