import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Marketplace Liquidity Engine (V5 Prompt 2)
 *
 * Ensures healthy marketplace balance through:
 * - Supply-demand balancing algorithms
 * - Host activation strategies
 * - Demand shaping mechanisms
 * - Inventory utilization optimization
 */
@Injectable()
export class LiquidityEngineService {
  private readonly logger = new Logger(LiquidityEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Calculate marketplace health metrics for a given country/region.
   */
  async calculateHealthMetrics(
    country: string,
    region?: string,
    date: Date = new Date(),
  ): Promise<{
    supplyCount: number;
    demandCount: number;
    bookingCount: number;
    avgOccupancyRate: number;
    liquidityScore: number;
    supplyGrowthRate: number;
    demandGrowthRate: number;
  }> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const thirtyDaysAgo = new Date(dateStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count active listings (supply)
    const supplyCount = await this.prisma.listing.count({
      where: {
        country,
        ...(region ? { state: region } : {}),
        status: 'AVAILABLE',
        deletedAt: null,
      },
    });

    // Count searches + bookings (demand proxy)
    const demandCount = await this.prisma.searchEvent.count({
      where: {
        country,
        createdAt: { gte: thirtyDaysAgo, lt: dateEnd },
      },
    });

    // Bookings in period
    const bookingCount = await this.prisma.booking.count({
      where: {
        listing: { country, ...(region ? { state: region } : {}) },
        createdAt: { gte: thirtyDaysAgo, lt: dateEnd },
        status: { notIn: ['CANCELLED', 'REFUNDED', 'DRAFT'] },
      },
    });

    // Occupancy = bookings / supply (capped at 1.0)
    const avgOccupancyRate = supplyCount > 0
      ? Math.min(bookingCount / supplyCount, 1.0)
      : 0;

    // Liquidity score: balanced supply/demand ratio
    const ratio = supplyCount > 0 ? demandCount / supplyCount : 0;
    const liquidityScore = this.computeLiquidityScore(ratio, avgOccupancyRate);

    // Growth rates (compare to previous 30-day window)
    const sixtyDaysAgo = new Date(thirtyDaysAgo);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);

    const prevSupply = await this.prisma.listing.count({
      where: {
        country,
        ...(region ? { state: region } : {}),
        createdAt: { lt: thirtyDaysAgo },
        status: 'AVAILABLE',
        deletedAt: null,
      },
    });

    const prevDemand = await this.prisma.searchEvent.count({
      where: {
        country,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    });

    const supplyGrowthRate = prevSupply > 0
      ? (supplyCount - prevSupply) / prevSupply
      : 0;

    const demandGrowthRate = prevDemand > 0
      ? (demandCount - prevDemand) / prevDemand
      : 0;

    // Persist metric
    await this.prisma.marketplaceHealthMetric.upsert({
      where: {
        country_region_date: {
          country,
          region: region || '',
          date: dateStart,
        },
      },
      update: {
        supplyCount,
        demandCount,
        bookingCount,
        avgOccupancyRate,
        liquidityScore,
        supplyGrowthRate,
        demandGrowthRate,
      },
      create: {
        country,
        region: region || '',
        date: dateStart,
        supplyCount,
        demandCount,
        bookingCount,
        avgOccupancyRate,
        liquidityScore,
        supplyGrowthRate,
        demandGrowthRate,
      },
    });

    return {
      supplyCount,
      demandCount,
      bookingCount,
      avgOccupancyRate,
      liquidityScore,
      supplyGrowthRate,
      demandGrowthRate,
    };
  }

  /**
   * Compute a 0-100 liquidity score based on supply/demand ratio and occupancy.
   * Ideal ratio is around 3-5:1 (demand:supply). Occupancy sweet spot ~60-80%.
   */
  computeLiquidityScore(demandSupplyRatio: number, occupancyRate: number): number {
    // Ratio component: penalize too-low (<1) or too-high (>10) ratios
    const idealRatio = 4;
    const ratioDiff = Math.abs(demandSupplyRatio - idealRatio) / idealRatio;
    const ratioScore = Math.max(0, 100 - ratioDiff * 50);

    // Occupancy component: sweet spot at 0.7
    const idealOccupancy = 0.7;
    const occDiff = Math.abs(occupancyRate - idealOccupancy) / idealOccupancy;
    const occupancyScore = Math.max(0, 100 - occDiff * 60);

    return Math.round((ratioScore * 0.5 + occupancyScore * 0.5) * 100) / 100;
  }

  /**
   * Get health metrics history for a market.
   */
  async getHealthHistory(
    country: string,
    days: number = 30,
    region?: string,
  ) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.marketplaceHealthMetric.findMany({
      where: {
        country,
        ...(region ? { region } : {}),
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Identify markets needing host activation (low supply, high demand).
   */
  async identifySupplyGaps(threshold: number = 30): Promise<
    Array<{ country: string; region: string; liquidityScore: number; gap: string }>
  > {
    const recentMetrics = await this.prisma.marketplaceHealthMetric.findMany({
      where: {
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        liquidityScore: { lt: threshold },
      },
      orderBy: { liquidityScore: 'asc' },
      take: 20,
    });

    return recentMetrics.map((m) => ({
      country: m.country,
      region: m.region || '',
      liquidityScore: m.liquidityScore,
      gap: m.supplyCount < m.demandCount / 3 ? 'SUPPLY_SHORTAGE' : 'LOW_ENGAGEMENT',
    }));
  }

  /**
   * Create a host activation campaign for an underserved market.
   */
  async createActivationCampaign(params: {
    name: string;
    country: string;
    targetSegment: string;
    strategy: string;
    startDate: Date;
    endDate: Date;
    budget: number;
    currency?: string;
  }) {
    const campaign = await this.prisma.hostActivationCampaign.create({
      data: {
        name: params.name,
        country: params.country,
        targetSegment: params.targetSegment,
        strategy: params.strategy,
        startDate: params.startDate,
        endDate: params.endDate,
        budget: params.budget,
        currency: params.currency || 'NPR',
        status: 'DRAFT',
      },
    });

    this.eventEmitter.emit('marketplace.campaign.created', {
      campaignId: campaign.id,
      country: campaign.country,
      strategy: campaign.strategy,
    });

    return campaign;
  }

  /**
   * Scheduled daily recalculation of marketplace health.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledHealthCalculation() {
    this.logger.log('Starting daily marketplace health calculation');
    const countries = await this.prisma.listing.findMany({
      where: { deletedAt: null, status: 'AVAILABLE' },
      select: { country: true },
      distinct: ['country'],
    });

    for (const { country } of countries) {
      if (country) {
        try {
          await this.calculateHealthMetrics(country);
        } catch (err) {
          this.logger.error(`Health calc failed for ${country}: ${err.message}`);
        }
      }
    }
  }
}
