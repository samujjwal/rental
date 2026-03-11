import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Global Demand Forecasting System (V5 Prompt 4)
 *
 * ML-driven demand prediction using:
 * - Search volume signals
 * - Historical bookings
 * - Seasonal trends
 * - Event signals
 * - Market growth patterns
 */
@Injectable()
export class DemandForecastingService {
  private readonly logger = new Logger(DemandForecastingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a demand signal for aggregation.
   */
  async recordSignal(params: {
    country: string;
    region?: string;
    signalType: string;
    signalValue: number;
    date?: Date;
    metadata?: Record<string, any>;
  }) {
    const date = params.date || new Date();
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    return this.prisma.demandSignal.create({
      data: {
        country: params.country,
        region: params.region,
        signalType: params.signalType,
        signalValue: params.signalValue,
        date: dateOnly,
        metadata: params.metadata || {},
      },
    });
  }

  /**
   * Generate a demand forecast for a market.
   * Uses weighted moving average + seasonal adjustment.
   */
  async generateForecast(
    country: string,
    horizon: string = '30d',
    region?: string,
    category?: string,
  ): Promise<{
    predictedDemand: number;
    confidence: number;
    components: {
      historicalAvg: number;
      seasonalFactor: number;
      trendFactor: number;
      growthRate: number;
    };
  }> {
    const days = parseInt(horizon) || 30;
    const now = new Date();
    const lookback = new Date(now);
    lookback.setDate(lookback.getDate() - 90); // 90-day lookback

    // Get historical booking counts
    const historicalBookings = await this.prisma.booking.count({
      where: {
        listing: {
          country,
          ...(region ? { state: region } : {}),
          ...(category ? { categoryId: category } : {}),
        },
        createdAt: { gte: lookback },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
    });

    const dailyAvg = historicalBookings / 90;

    // Get demand signals for trend analysis
    const signals = await this.prisma.demandSignal.findMany({
      where: {
        country,
        ...(region ? { region } : {}),
        date: { gte: lookback },
      },
      orderBy: { date: 'asc' },
    });

    // Compute seasonal factor based on month
    const seasonalFactor = this.computeSeasonalFactor(now.getMonth());

    // Compute growth trend from signals
    const trendFactor = this.computeTrendFactor(signals);

    // Growth rate from recent vs older signals
    const midpoint = new Date(lookback.getTime() + (now.getTime() - lookback.getTime()) / 2);
    const recentSignals = signals.filter((s) => s.date >= midpoint);
    const olderSignals = signals.filter((s) => s.date < midpoint);

    const recentAvg = recentSignals.length > 0
      ? recentSignals.reduce((sum, s) => sum + s.signalValue, 0) / recentSignals.length
      : 0;
    const olderAvg = olderSignals.length > 0
      ? olderSignals.reduce((sum, s) => sum + s.signalValue, 0) / olderSignals.length
      : 0;

    const growthRate = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

    // Weighted prediction
    const predictedDemand = Math.round(
      dailyAvg * days * seasonalFactor * trendFactor * (1 + growthRate * 0.3),
    );

    // Confidence based on data quality
    const dataPoints = signals.length + historicalBookings;
    const confidence = Math.min(0.95, 0.3 + (dataPoints / 1000) * 0.65);

    // Persist forecast
    const forecastDate = new Date();
    forecastDate.setHours(0, 0, 0, 0);

    await this.prisma.demandForecast.upsert({
      where: {
        country_region_category_forecastDate_horizon: {
          country,
          region: region || '',
          category: category || '',
          forecastDate,
          horizon,
        },
      },
      update: { predictedDemand, confidence, modelVersion: 'wma-v1' },
      create: {
        country,
        region,
        category,
        forecastDate,
        horizon,
        predictedDemand,
        confidence,
        modelVersion: 'wma-v1',
        features: { seasonalFactor, trendFactor, growthRate, dailyAvg },
      },
    });

    return {
      predictedDemand,
      confidence,
      components: {
        historicalAvg: dailyAvg,
        seasonalFactor,
        trendFactor,
        growthRate,
      },
    };
  }

  /**
   * Seasonal factor for Nepal-centric platform.
   * Peak: Oct-Nov (Dashain/Tihar), Mar-Apr (spring). Low: Jun-Aug (monsoon).
   */
  computeSeasonalFactor(month: number): number {
    const factors: Record<number, number> = {
      0: 0.9,  // Jan
      1: 0.95, // Feb
      2: 1.15, // Mar — spring
      3: 1.2,  // Apr — peak spring
      4: 1.0,  // May
      5: 0.7,  // Jun — monsoon
      6: 0.6,  // Jul — monsoon
      7: 0.65, // Aug — monsoon
      8: 0.9,  // Sep
      9: 1.3,  // Oct — Dashain
      10: 1.25, // Nov — Tihar
      11: 1.0,  // Dec
    };
    return factors[month] ?? 1.0;
  }

  /**
   * Compute trend factor from signal time series.
   */
  computeTrendFactor(
    signals: Array<{ date: Date; signalValue: number }>,
  ): number {
    if (signals.length < 5) return 1.0;

    // Simple linear regression slope
    const n = signals.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const baseTime = signals[0].date.getTime();

    for (let i = 0; i < n; i++) {
      const x = (signals[i].date.getTime() - baseTime) / (1000 * 60 * 60 * 24);
      const y = signals[i].signalValue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
    const avgY = sumY / n;

    // Normalize slope to a factor around 1.0
    if (avgY === 0) return 1.0;
    const normalizedSlope = slope / avgY;
    return Math.max(0.5, Math.min(1.5, 1 + normalizedSlope * 30));
  }

  /**
   * Get recent forecasts for a market.
   */
  async getForecasts(country: string, horizon?: string) {
    return this.prisma.demandForecast.findMany({
      where: {
        country,
        ...(horizon ? { horizon } : {}),
      },
      orderBy: { forecastDate: 'desc' },
      take: 30,
    });
  }

  /**
   * Backtest forecast accuracy by comparing predicted vs actual.
   */
  async backtestAccuracy(country: string, days: number = 30): Promise<{
    mape: number;
    forecasts: number;
    accurate: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const forecasts = await this.prisma.demandForecast.findMany({
      where: {
        country,
        forecastDate: { gte: since },
        actualDemand: { not: null },
      },
    });

    if (forecasts.length === 0) return { mape: 0, forecasts: 0, accurate: 0 };

    let totalError = 0;
    let accurate = 0;

    for (const f of forecasts) {
      const actual = f.actualDemand ?? 0;
      if (actual > 0) {
        const error = Math.abs(f.predictedDemand - actual) / actual;
        totalError += error;
        if (error < 0.2) accurate++; // within 20%
      }
    }

    return {
      mape: Math.round((totalError / forecasts.length) * 10000) / 100,
      forecasts: forecasts.length,
      accurate,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledForecasting() {
    this.logger.log('Running scheduled demand forecasting');
    const countries = await this.prisma.listing.findMany({
      where: { deletedAt: null },
      select: { country: true },
      distinct: ['country'],
    });

    for (const { country } of countries) {
      if (country) {
        try {
          await this.generateForecast(country, '30d');
        } catch (err) {
          this.logger.error(`Forecast failed for ${country}: ${err.message}`);
        }
      }
    }
  }
}
