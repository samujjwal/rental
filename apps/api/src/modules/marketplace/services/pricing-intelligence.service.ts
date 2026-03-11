import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Dynamic Pricing Intelligence (V5 Prompt 7)
 *
 * Global pricing intelligence system:
 * - Demand-based pricing
 * - Competitor price signals
 * - Seasonal adjustments
 * - Occupancy optimization
 */
@Injectable()
export class PricingIntelligenceService {
  private readonly logger = new Logger(PricingIntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate pricing recommendations for a listing.
   */
  async generateRecommendation(
    listingId: string,
    targetDate: Date = new Date(),
  ): Promise<{
    currentPrice: number;
    recommendedPrice: number;
    minPrice: number;
    maxPrice: number;
    demandLevel: string;
    factors: {
      seasonalFactor: number;
      demandFactor: number;
      occupancyFactor: number;
      competitorFactor: number;
    };
  }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { category: true },
    });

    if (!listing) throw new Error('Listing not found');

    const currentPrice = Number(listing.basePrice) || 0;
    const country = listing.country || 'NP';

    // Get demand level for the market
    const demandLevel = await this.assessDemandLevel(country, listing.city, targetDate);

    // Seasonal factor
    const seasonalFactor = this.getSeasonalFactor(targetDate.getMonth(), country);

    // Occupancy factor — high occupancy → raise price
    const occupancyRate = await this.getOccupancyRate(listingId, targetDate);
    const occupancyFactor = this.computeOccupancyFactor(occupancyRate);

    // Competitor pricing
    const competitorAvg = await this.getCompetitorAvgPrice(
      country,
      listing.city,
      listing.categoryId,
    );
    const competitorFactor = competitorAvg > 0
      ? Math.min(1.3, Math.max(0.7, competitorAvg / currentPrice))
      : 1.0;

    // Demand factor
    const demandFactor = this.demandLevelToFactor(demandLevel);

    // Compute recommended price
    const baseMultiplier = seasonalFactor * demandFactor * occupancyFactor;
    const recommendedPrice = Math.round(currentPrice * baseMultiplier);

    // Min/max bounds (±30% of current price)
    const minPrice = Math.round(currentPrice * 0.7);
    const maxPrice = Math.round(currentPrice * 1.3);

    // Clamp recommendation
    const clampedPrice = Math.max(minPrice, Math.min(maxPrice, recommendedPrice));

    // Persist
    const dateOnly = new Date(targetDate);
    dateOnly.setHours(0, 0, 0, 0);

    await this.prisma.pricingRecommendation.upsert({
      where: { listingId_date: { listingId, date: dateOnly } },
      update: {
        currentPrice,
        recommendedPrice: clampedPrice,
        minPrice,
        maxPrice,
        demandLevel,
        occupancyRate,
        competitorAvg,
        seasonalFactor,
        modelVersion: 'pricing-v1',
        currency: listing.currency || 'NPR',
      },
      create: {
        listingId,
        date: dateOnly,
        currentPrice,
        recommendedPrice: clampedPrice,
        minPrice,
        maxPrice,
        demandLevel,
        occupancyRate,
        competitorAvg,
        seasonalFactor,
        modelVersion: 'pricing-v1',
        currency: listing.currency || 'NPR',
      },
    });

    return {
      currentPrice,
      recommendedPrice: clampedPrice,
      minPrice,
      maxPrice,
      demandLevel,
      factors: {
        seasonalFactor,
        demandFactor,
        occupancyFactor,
        competitorFactor,
      },
    };
  }

  /**
   * Get pricing recommendation history for a listing.
   */
  async getRecommendationHistory(listingId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.pricingRecommendation.findMany({
      where: { listingId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Auto-accept recommendations within a threshold.
   */
  async autoAcceptRecommendations(listingId: string, maxDeviationPercent: number = 10) {
    const recent = await this.prisma.pricingRecommendation.findMany({
      where: { listingId, accepted: null },
      orderBy: { date: 'desc' },
      take: 7,
    });

    const accepted: string[] = [];
    for (const rec of recent) {
      const deviation = Math.abs(rec.recommendedPrice - rec.currentPrice) / rec.currentPrice;
      if (deviation <= maxDeviationPercent / 100) {
        await this.prisma.pricingRecommendation.update({
          where: { id: rec.id },
          data: { accepted: true },
        });
        accepted.push(rec.id);
      }
    }

    return { accepted: accepted.length, total: recent.length };
  }

  // ── Internal helpers ──────────────────────────────────

  private async assessDemandLevel(
    country: string,
    city?: string | null,
    date?: Date,
  ): Promise<string> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const searchCount = await this.prisma.searchEvent.count({
      where: {
        country,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const listingCount = await this.prisma.listing.count({
      where: { country, status: 'AVAILABLE', deletedAt: null },
    });

    const ratio = listingCount > 0 ? searchCount / listingCount : 0;

    if (ratio > 10) return 'PEAK';
    if (ratio > 5) return 'HIGH';
    if (ratio > 2) return 'MEDIUM';
    return 'LOW';
  }

  private demandLevelToFactor(level: string): number {
    const factors: Record<string, number> = { LOW: 0.85, MEDIUM: 1.0, HIGH: 1.15, PEAK: 1.3 };
    return factors[level] || 1.0;
  }

  private getSeasonalFactor(month: number, country: string): number {
    // Nepal-centric seasonal pricing
    const factors: Record<number, number> = {
      0: 0.95, 1: 0.95, 2: 1.1, 3: 1.15,
      4: 1.0, 5: 0.75, 6: 0.65, 7: 0.7,
      8: 0.9, 9: 1.25, 10: 1.2, 11: 1.0,
    };
    return factors[month] ?? 1.0;
  }

  private async getOccupancyRate(listingId: string, date: Date): Promise<number> {
    const thirtyDaysAgo = new Date(date);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookings = await this.prisma.booking.count({
      where: {
        listingId,
        status: { notIn: ['CANCELLED', 'DRAFT'] },
        startDate: { gte: thirtyDaysAgo },
        endDate: { lte: date },
      },
    });

    // Assume max 30 bookable days
    return Math.min(1.0, bookings / 30);
  }

  private computeOccupancyFactor(rate: number): number {
    // High occupancy → slight price increase
    if (rate > 0.8) return 1.15;
    if (rate > 0.6) return 1.05;
    if (rate < 0.2) return 0.85;
    return 1.0;
  }

  private async getCompetitorAvgPrice(
    country: string | null,
    city: string | null,
    categoryId: string | null,
  ): Promise<number> {
    if (!country) return 0;

    const result = await this.prisma.listing.aggregate({
      _avg: { basePrice: true },
      where: {
        country,
        ...(city ? { city } : {}),
        ...(categoryId ? { categoryId } : {}),
        status: 'AVAILABLE',
        deletedAt: null,
      },
    });

    return Number(result._avg?.basePrice) || 0;
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledPricingRecommendations() {
    this.logger.log('Running scheduled pricing recommendations');
    // Generate recommendations for top-booked listings
    const listings = await this.prisma.listing.findMany({
      where: { status: 'AVAILABLE', deletedAt: null },
      orderBy: { viewCount: 'desc' },
      take: 100,
      select: { id: true },
    });

    for (const listing of listings) {
      try {
        await this.generateRecommendation(listing.id);
      } catch (err) {
        this.logger.error(`Pricing rec failed for ${listing.id}: ${err.message}`);
      }
    }
  }
}
