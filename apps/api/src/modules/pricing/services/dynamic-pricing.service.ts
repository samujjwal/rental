/**
 * Dynamic Pricing Intelligence Service
 *
 * AI-driven pricing engine that supports:
 * - Demand forecasting based on historical booking patterns
 * - Seasonal price adjustments via configurable calendars
 * - Occupancy-based optimization (increase price when high, decrease when low)
 * - Last-minute / early-bird pricing strategies
 * - Competitor-aware pricing (category averages)
 * - Surge pricing during high-demand periods
 * - Loyalty discounts for repeat customers
 *
 * All pricing rules are stored in DB (PricingRule model) and evaluated at runtime.
 * The service integrates with PolicyEngine for country-specific pricing constraints.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventsService } from '@/common/events/events.service';
import { toNumber } from '@rental-portal/database';

// ─── Interfaces ───────────────────────────────────

export interface PricingContext {
  listingId: string;
  basePrice: number;
  currency: string;
  country: string;
  categoryId?: string;
  startDate: Date;
  endDate: Date;
  guestCount?: number;
  userId?: string;           // For loyalty pricing
  bookingLeadDays?: number;  // Days until start
}

export interface PricingRecommendation {
  recommendedPrice: number;
  basePrice: number;
  adjustments: PricingAdjustment[];
  totalMultiplier: number;
  confidence: number;       // 0.0 to 1.0
  strategy: string;
  reasoning: string[];
}

export interface PricingAdjustment {
  type: string;
  name: string;
  factor: number;           // Multiplier (1.0 = no change)
  amount: number;           // Absolute price change
  reason: string;
  ruleId?: string;
}

export interface DemandForecast {
  date: string;
  demandLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'PEAK';
  predictedOccupancy: number;  // 0.0 to 1.0
  suggestedMultiplier: number;
  confidence: number;
}

export interface SeasonalPattern {
  month: number;
  weekday: number;
  avgOccupancy: number;
  avgPrice: number;
  bookingCount: number;
}

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly events: EventsService,
  ) {}

  // ──────────────────────────────────────────────────
  // Main Pricing Calculation
  // ──────────────────────────────────────────────────

  /**
   * Calculate the recommended price for a listing on given dates.
   * Applies all matching pricing rules in priority order.
   */
  async calculateDynamicPrice(context: PricingContext): Promise<PricingRecommendation> {
    const adjustments: PricingAdjustment[] = [];
    const reasoning: string[] = [];
    let totalMultiplier = 1.0;
    let confidence = 0.5;

    // 1. Load active pricing rules for this listing/category/country
    const rules = await this.loadPricingRules(context);

    for (const rule of rules) {
      const params = rule.parameters as Record<string, any>;
      const conditions = rule.conditions as Array<Record<string, any>>;

      // Check if rule conditions are met
      if (!this.evaluateRuleConditions(conditions, context)) {
        continue;
      }

      const adjustment = this.applyPricingStrategy(rule, params, context);
      if (adjustment) {
        adjustments.push({ ...adjustment, ruleId: rule.id });
        totalMultiplier *= adjustment.factor;
        reasoning.push(adjustment.reason);
      }
    }

    // 2. Apply demand-based adjustments
    const demandAdjustment = await this.calculateDemandAdjustment(context);
    if (demandAdjustment) {
      adjustments.push(demandAdjustment);
      totalMultiplier *= demandAdjustment.factor;
      reasoning.push(demandAdjustment.reason);
      confidence = Math.max(confidence, 0.6);
    }

    // 3. Apply occupancy-based adjustments
    const occupancyAdjustment = await this.calculateOccupancyAdjustment(context);
    if (occupancyAdjustment) {
      adjustments.push(occupancyAdjustment);
      totalMultiplier *= occupancyAdjustment.factor;
      reasoning.push(occupancyAdjustment.reason);
    }

    // 4. Apply competitor pricing bounds
    const competitorBounds = await this.getCompetitorPriceBounds(context);
    if (competitorBounds) {
      reasoning.push(`Category avg: ${competitorBounds.avg.toFixed(2)} ${context.currency}`);
      confidence += 0.1;
    }

    // 5. Apply loyalty discount if applicable
    if (context.userId) {
      const loyaltyAdjustment = await this.calculateLoyaltyDiscount(context);
      if (loyaltyAdjustment) {
        adjustments.push(loyaltyAdjustment);
        totalMultiplier *= loyaltyAdjustment.factor;
        reasoning.push(loyaltyAdjustment.reason);
      }
    }

    // 6. Enforce floor/ceiling
    let recommendedPrice = Math.round(context.basePrice * totalMultiplier * 100) / 100;
    const minPrice = context.basePrice * 0.5;  // Never go below 50% of base
    const maxPrice = context.basePrice * 3.0;  // Never exceed 300% of base
    recommendedPrice = Math.max(minPrice, Math.min(maxPrice, recommendedPrice));

    // Clamp confidence
    confidence = Math.min(confidence, 1.0);

    return {
      recommendedPrice,
      basePrice: context.basePrice,
      adjustments,
      totalMultiplier: Math.round(totalMultiplier * 1000) / 1000,
      confidence: Math.round(confidence * 100) / 100,
      strategy: adjustments.length > 0 ? adjustments[0].type : 'BASE',
      reasoning,
    };
  }

  // ──────────────────────────────────────────────────
  // Demand Forecasting
  // ──────────────────────────────────────────────────

  /**
   * Forecast demand for a listing/area over upcoming dates.
   * Uses historical booking data to predict occupancy and suggest pricing.
   */
  async forecastDemand(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DemandForecast[]> {
    const cacheKey = `demand:forecast:${listingId}:${startDate.toISOString().slice(0, 10)}`;
    const cached = await this.cache.get<DemandForecast[]>(cacheKey);
    if (cached) return cached;

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { city: true, country: true, categoryId: true, basePrice: true },
    });

    if (!listing) return [];

    // Get historical booking patterns for this area/category
    const patterns = await this.getSeasonalPatterns(
      listing.city,
      listing.country,
      listing.categoryId,
    );

    const forecasts: DemandForecast[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const month = current.getMonth() + 1;
      const weekday = current.getDay();

      // Find matching pattern
      const pattern = patterns.find(
        (p) => p.month === month && p.weekday === weekday,
      );

      let demandLevel: DemandForecast['demandLevel'] = 'MEDIUM';
      let predictedOccupancy = 0.5;
      let suggestedMultiplier = 1.0;

      if (pattern && pattern.bookingCount >= 3) {
        predictedOccupancy = pattern.avgOccupancy;

        if (predictedOccupancy >= 0.85) {
          demandLevel = 'PEAK';
          suggestedMultiplier = 1.3;
        } else if (predictedOccupancy >= 0.65) {
          demandLevel = 'HIGH';
          suggestedMultiplier = 1.15;
        } else if (predictedOccupancy >= 0.4) {
          demandLevel = 'MEDIUM';
          suggestedMultiplier = 1.0;
        } else {
          demandLevel = 'LOW';
          suggestedMultiplier = 0.85;
        }
      }

      forecasts.push({
        date: current.toISOString().slice(0, 10),
        demandLevel,
        predictedOccupancy: Math.round(predictedOccupancy * 100) / 100,
        suggestedMultiplier,
        confidence: pattern && pattern.bookingCount >= 10 ? 0.8 : 0.4,
      });

      current.setDate(current.getDate() + 1);
    }

    await this.cache.set(cacheKey, forecasts, 6 * 60 * 60); // Cache 6h
    return forecasts;
  }

  // ──────────────────────────────────────────────────
  // Competitor Analysis
  // ──────────────────────────────────────────────────

  /**
   * Get competitor pricing statistics for the category/area.
   */
  async getCompetitorAnalysis(
    listingId: string,
  ): Promise<{
    avgPrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    percentile: number;
    listingCount: number;
  }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { categoryId: true, city: true, country: true, basePrice: true },
    });

    if (!listing) {
      return { avgPrice: 0, medianPrice: 0, minPrice: 0, maxPrice: 0, percentile: 50, listingCount: 0 };
    }

    const cacheKey = `competitor:${listing.city}:${listing.categoryId}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return { ...cached, percentile: this.calcPercentile(toNumber(listing.basePrice), cached) };

    const competitors = await this.prisma.listing.findMany({
      where: {
        categoryId: listing.categoryId,
        city: listing.city,
        country: listing.country,
        status: 'AVAILABLE',
        id: { not: listingId },
      },
      select: { basePrice: true },
      orderBy: { basePrice: 'asc' },
    });

    const prices = competitors.map((c) => toNumber(c.basePrice));
    if (prices.length === 0) {
      return { avgPrice: 0, medianPrice: 0, minPrice: 0, maxPrice: 0, percentile: 50, listingCount: 0 };
    }

    const result = {
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      medianPrice: prices[Math.floor(prices.length / 2)],
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      listingCount: prices.length,
    };

    await this.cache.set(cacheKey, result, 24 * 60 * 60);
    const myPrice = toNumber(listing.basePrice);
    return { ...result, percentile: this.calcPercentile(myPrice, result) };
  }

  // ──────────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────────

  private async loadPricingRules(context: PricingContext): Promise<any[]> {
    const cacheKey = `pricing:rules:${context.listingId}:${context.categoryId}:${context.country}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const rules = await this.prisma.pricingRule.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { listingId: context.listingId },
              { categoryId: context.categoryId },
              { country: context.country },
              { listingId: null, categoryId: null, country: null }, // Global rules
            ],
          },
        ],
      },
      orderBy: { priority: 'asc' },
    });

    await this.cache.set(cacheKey, rules, 5 * 60); // Cache 5min
    return rules;
  }

  private evaluateRuleConditions(
    conditions: Array<Record<string, any>>,
    context: PricingContext,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
      if (cond.type === 'dayOfWeek') {
        const day = context.startDate.getDay();
        if (!(cond.values as number[])?.includes(day)) return false;
      }
      if (cond.type === 'season') {
        const month = context.startDate.getMonth() + 1;
        if (!(cond.months as number[])?.includes(month)) return false;
      }
      if (cond.type === 'leadDays') {
        const leadDays = context.bookingLeadDays ?? 0;
        if (cond.min != null && leadDays < cond.min) return false;
        if (cond.max != null && leadDays > cond.max) return false;
      }
      if (cond.type === 'guestCount') {
        const guests = context.guestCount ?? 1;
        if (cond.min != null && guests < cond.min) return false;
        if (cond.max != null && guests > cond.max) return false;
      }
    }
    return true;
  }

  private applyPricingStrategy(
    rule: any,
    params: Record<string, any>,
    context: PricingContext,
  ): PricingAdjustment | null {
    const strategy = rule.strategy as string;
    const ruleType = rule.type as string;

    switch (strategy) {
      case 'MULTIPLIER': {
        const multiplier = Number(params.baseMultiplier) || 1.0;
        return {
          type: ruleType,
          name: rule.name,
          factor: multiplier,
          amount: context.basePrice * (multiplier - 1),
          reason: `${rule.name}: ×${multiplier.toFixed(2)}`,
        };
      }

      case 'FIXED_OFFSET': {
        const offset = Number(params.offset) || 0;
        const factor = (context.basePrice + offset) / context.basePrice;
        return {
          type: ruleType,
          name: rule.name,
          factor,
          amount: offset,
          reason: `${rule.name}: ${offset > 0 ? '+' : ''}${offset} ${context.currency}`,
        };
      }

      case 'PERCENTAGE': {
        const percentage = Number(params.percentage) || 0;
        const factor = 1 + percentage / 100;
        return {
          type: ruleType,
          name: rule.name,
          factor,
          amount: context.basePrice * (percentage / 100),
          reason: `${rule.name}: ${percentage > 0 ? '+' : ''}${percentage}%`,
        };
      }

      case 'TIERED': {
        const durationDays = Math.ceil(
          (context.endDate.getTime() - context.startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const tiers = (params.tiers as Array<{ minDays: number; multiplier: number }>) || [];
        const matchingTier = tiers
          .sort((a, b) => b.minDays - a.minDays)
          .find((t) => durationDays >= t.minDays);

        if (matchingTier) {
          return {
            type: ruleType,
            name: rule.name,
            factor: matchingTier.multiplier,
            amount: context.basePrice * (matchingTier.multiplier - 1),
            reason: `${rule.name}: ${durationDays}d stay → ×${matchingTier.multiplier}`,
          };
        }
        return null;
      }

      default:
        return null;
    }
  }

  private async calculateDemandAdjustment(
    context: PricingContext,
  ): Promise<PricingAdjustment | null> {
    const dayOfWeek = context.startDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

    // Check booking density for the dates
    const existingBookings = await this.prisma.booking.count({
      where: {
        listing: { city: (await this.getListingCity(context.listingId)) || '' },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        startDate: { lte: context.endDate },
        endDate: { gte: context.startDate },
      },
    });

    // More than 10 concurrent bookings in the area = high demand
    if (existingBookings > 10) {
      return {
        type: 'SURGE',
        name: 'High Demand Surge',
        factor: 1.15,
        amount: context.basePrice * 0.15,
        reason: `High demand: ${existingBookings} active bookings in area`,
      };
    }

    if (isWeekend) {
      return {
        type: 'SEASONAL',
        name: 'Weekend Premium',
        factor: 1.08,
        amount: context.basePrice * 0.08,
        reason: 'Weekend demand premium',
      };
    }

    return null;
  }

  private async calculateOccupancyAdjustment(
    context: PricingContext,
  ): Promise<PricingAdjustment | null> {
    // Check listing's occupancy rate over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bookingDays = await this.prisma.booking.count({
      where: {
        listingId: context.listingId,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
        startDate: { gte: thirtyDaysAgo },
      },
    });

    const occupancyRate = bookingDays / 30;

    if (occupancyRate >= 0.8) {
      return {
        type: 'OCCUPANCY',
        name: 'High Occupancy',
        factor: 1.1,
        amount: context.basePrice * 0.1,
        reason: `High occupancy (${(occupancyRate * 100).toFixed(0)}%) → price increase`,
      };
    }

    if (occupancyRate < 0.3) {
      return {
        type: 'OCCUPANCY',
        name: 'Low Occupancy Discount',
        factor: 0.92,
        amount: context.basePrice * -0.08,
        reason: `Low occupancy (${(occupancyRate * 100).toFixed(0)}%) → price reduction`,
      };
    }

    return null;
  }

  private async calculateLoyaltyDiscount(
    context: PricingContext,
  ): Promise<PricingAdjustment | null> {
    if (!context.userId) return null;

    // Count past successful bookings with this host's listings
    const pastBookings = await this.prisma.booking.count({
      where: {
        renterId: context.userId,
        listing: { id: context.listingId },
        status: { in: ['COMPLETED', 'SETTLED'] },
      },
    });

    if (pastBookings >= 5) {
      return {
        type: 'LOYALTY',
        name: 'Loyal Customer Discount',
        factor: 0.9,
        amount: context.basePrice * -0.1,
        reason: `Repeat customer (${pastBookings} bookings) → 10% discount`,
      };
    } else if (pastBookings >= 2) {
      return {
        type: 'LOYALTY',
        name: 'Returning Customer Discount',
        factor: 0.95,
        amount: context.basePrice * -0.05,
        reason: `Returning customer (${pastBookings} bookings) → 5% discount`,
      };
    }

    return null;
  }

  private async getSeasonalPatterns(
    city: string,
    country: string,
    categoryId: string | null,
  ): Promise<SeasonalPattern[]> {
    const cacheKey = `seasonal:${city}:${country}:${categoryId}`;
    const cached = await this.cache.get<SeasonalPattern[]>(cacheKey);
    if (cached) return cached;

    // Query historical bookings grouped by month and weekday
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        listing: { city, country, ...(categoryId ? { categoryId } : {}) },
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED'] },
        createdAt: { gte: oneYearAgo },
      },
      select: { startDate: true, totalPrice: true },
    });

    // Build pattern map
    const patternMap = new Map<string, { total: number; count: number; priceSum: number }>();

    for (const booking of bookings) {
      const month = booking.startDate.getMonth() + 1;
      const weekday = booking.startDate.getDay();
      const key = `${month}-${weekday}`;

      const existing = patternMap.get(key) || { total: 0, count: 0, priceSum: 0 };
      existing.count += 1;
      existing.priceSum += toNumber(booking.totalPrice);
      patternMap.set(key, existing);
    }

    const patterns: SeasonalPattern[] = [];
    for (const [key, data] of patternMap) {
      const [month, weekday] = key.split('-').map(Number);
      patterns.push({
        month,
        weekday,
        avgOccupancy: Math.min(data.count / 4, 1.0), // Normalize to quarterly
        avgPrice: data.priceSum / data.count,
        bookingCount: data.count,
      });
    }

    await this.cache.set(cacheKey, patterns, 24 * 60 * 60); // Cache 24h
    return patterns;
  }

  private async getCompetitorPriceBounds(
    context: PricingContext,
  ): Promise<{ avg: number; min: number; max: number } | null> {
    const city = await this.getListingCity(context.listingId);
    if (!city) return null;

    const cacheKey = `competitor:bounds:${city}:${context.categoryId}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.prisma.listing.aggregate({
      where: {
        city,
        categoryId: context.categoryId,
        status: 'AVAILABLE',
        id: { not: context.listingId },
      },
      _avg: { basePrice: true },
      _min: { basePrice: true },
      _max: { basePrice: true },
    });

    if (!result._avg.basePrice) return null;

    const bounds = {
      avg: toNumber(result._avg.basePrice!),
      min: toNumber(result._min.basePrice!),
      max: toNumber(result._max.basePrice!),
    };

    await this.cache.set(cacheKey, bounds, 12 * 60 * 60);
    return bounds;
  }

  private async getListingCity(listingId: string): Promise<string | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { city: true },
    });
    return listing?.city || null;
  }

  private calcPercentile(price: number, stats: { minPrice: number; maxPrice: number }): number {
    if (stats.maxPrice === stats.minPrice) return 50;
    return Math.round(((price - stats.minPrice) / (stats.maxPrice - stats.minPrice)) * 100);
  }
}
