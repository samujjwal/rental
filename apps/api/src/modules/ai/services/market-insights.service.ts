import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface MarketInsights {
  category: string;
  /** ISO 4217 currency code for all price fields. Defaults to 'USD'. */
  currency: string;
  averagePrice: number;
  priceRange: { min: number; max: number };
  demand: 'high' | 'medium' | 'low';
  popularFeatures: string[];
  seasonalTrends: string[];
  competitorCount: number;
}

/**
 * MarketInsightsService
 *
 * Derives market intelligence from real platform data.
 * This service uses the database directly — it does NOT call AI providers.
 * All numbers are aggregated from live listing and booking records,
 * so the data is observable, auditable, and reproducible.
 */
@Injectable()
export class MarketInsightsService {
  private readonly logger = new Logger(MarketInsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build market insights for a given category slug.
   * Throws NotFoundException if the category does not exist.
   */
  async getForCategory(categorySlug: string): Promise<MarketInsights> {
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
      include: {
        listings: {
          where: { status: 'AVAILABLE', deletedAt: null },
          select: {
            basePrice: true,
            features: true,
            totalBookings: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category '${categorySlug}' not found`);
    }

    const listings = category.listings;

    if (listings.length === 0) {
      return this.emptyInsights(category.name ?? categorySlug);
    }

    // ── Price aggregation ──────────────────────────────────────────────────
    const prices = listings.map((l) => Number(l.basePrice));
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // ── Demand tier ───────────────────────────────────────────────────────
    // Use average totalBookings per listing as a proxy for demand.
    const totalBookings = listings.reduce((sum, l) => sum + (l.totalBookings ?? 0), 0);
    const avgBookings = totalBookings / listings.length;
    const demand = this.classifyDemand(avgBookings, listings.length);

    // ── Popular features ──────────────────────────────────────────────────
    const featureCounts = new Map<string, number>();
    for (const l of listings) {
      for (const feature of l.features ?? []) {
        if (feature) {
          featureCounts.set(feature, (featureCounts.get(feature) ?? 0) + 1);
        }
      }
    }
    const popularFeatures = [...featureCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([feature]) => feature);

    this.logger.debug(
      `Market insights computed for '${categorySlug}': ` +
        `listings=${listings.length} avgPrice=${avgPrice.toFixed(2)} demand=${demand}`,
    );

    return {
      category: category.name ?? categorySlug,
      currency: 'USD',
      averagePrice: Math.round(avgPrice * 100) / 100,
      priceRange: { min: minPrice, max: maxPrice },
      demand,
      popularFeatures,
      // Seasonal trend analysis requires time-series booking data — not yet implemented.
      // Set to an empty array rather than fabricating trends.
      seasonalTrends: [],
      competitorCount: listings.length,
    };
  }

  private classifyDemand(
    avgBookings: number,
    listingCount: number,
  ): 'high' | 'medium' | 'low' {
    // Simple heuristic: scale thresholds by listing count to avoid skewing
    // a new marketplace with very few listings.
    if (listingCount < 3) return 'low';
    if (avgBookings >= 5) return 'high';
    if (avgBookings >= 2) return 'medium';
    return 'low';
  }

  private emptyInsights(categoryName: string): MarketInsights {
    return {
      category: categoryName,
      currency: 'USD',
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
      demand: 'low',
      popularFeatures: [],
      seasonalTrends: [],
      competitorCount: 0,
    };
  }
}
