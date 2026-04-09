import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  timestamp: Date;
}

export interface RateValidationResult {
  valid: boolean;
  reason?: string;
  deviation?: number;
  recommendedAction?: string;
  alertTriggered?: boolean;
}

/**
 * Repository for managing exchange rate data.
 *
 * Wraps Prisma operations for FxRateSnapshot model.
 */
@Injectable()
export class ExchangeRateRepository {
  private readonly logger = new Logger(ExchangeRateRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCurrentRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | null> {
    try {
      // Try to find the most recent rate snapshot
      const snapshot = await this.prisma.fxRateSnapshot.findFirst({
        where: {
          baseCurrency: fromCurrency,
          targetCurrency: toCurrency,
        },
        orderBy: {
          capturedAt: 'desc',
        },
        take: 1,
      });

      if (!snapshot) {
        return null;
      }

      const rate = typeof snapshot.rate === 'number' ? snapshot.rate : snapshot.rate.toNumber();

      return {
        fromCurrency: snapshot.baseCurrency,
        toCurrency: snapshot.targetCurrency,
        rate,
        source: snapshot.rateSource,
        timestamp: snapshot.capturedAt,
      };
    } catch (error) {
      this.logger.error(`Error fetching current rate for ${fromCurrency} to ${toCurrency}:`, error);
      return null;
    }
  }

  async getHistoricalRates(
    fromCurrency: string,
    toCurrency: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ExchangeRate[]> {
    try {
      const where: any = {
        baseCurrency: fromCurrency,
        targetCurrency: toCurrency,
      };

      if (startDate) {
        where.capturedAt = { ...where.capturedAt, gte: startDate };
      }
      if (endDate) {
        where.capturedAt = { ...where.capturedAt, lte: endDate };
      }

      const snapshots = await this.prisma.fxRateSnapshot.findMany({
        where,
        orderBy: {
          capturedAt: 'desc',
        },
        take: 100, // Limit to last 100 records
      });

      return snapshots.map((snapshot) => {
        const rate = typeof snapshot.rate === 'number' ? snapshot.rate : snapshot.rate.toNumber();

        return {
          fromCurrency: snapshot.baseCurrency,
          toCurrency: snapshot.targetCurrency,
          rate,
          source: snapshot.rateSource,
          timestamp: snapshot.capturedAt,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error fetching historical rates for ${fromCurrency} to ${toCurrency}:`,
        error,
      );
      return [];
    }
  }

  async updateRate(rate: ExchangeRate): Promise<ExchangeRate> {
    try {
      // Create a new rate snapshot
      const snapshot = await this.prisma.fxRateSnapshot.create({
        data: {
          bookingId: 'system-update', // System update, not tied to a specific booking
          baseCurrency: rate.fromCurrency,
          targetCurrency: rate.toCurrency,
          rate: rate.rate as unknown as number,
          rateSource: rate.source,
        },
      });

      return {
        fromCurrency: snapshot.baseCurrency,
        toCurrency: snapshot.targetCurrency,
        rate: typeof snapshot.rate === 'number' ? snapshot.rate : snapshot.rate.toNumber(),
        source: snapshot.rateSource,
        timestamp: snapshot.capturedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error updating rate for ${rate.fromCurrency} to ${rate.toCurrency}:`,
        error,
      );
      throw error;
    }
  }

  async bulkUpdateRates(rates: Record<string, number>): Promise<{
    updated: number;
    failed: number;
    rates: ExchangeRate[];
  }> {
    const results: ExchangeRate[] = [];
    let updated = 0;
    let failed = 0;

    for (const [key, rate] of Object.entries(rates)) {
      const [from, to] = key.split('-');
      try {
        const result = await this.updateRate({
          fromCurrency: from,
          toCurrency: to,
          rate,
          source: 'bulk_update',
          timestamp: new Date(),
        });
        results.push(result);
        updated++;
      } catch (error) {
        this.logger.error(`Failed to update rate ${key}:`, error);
        failed++;
      }
    }

    return { updated, failed, rates: results };
  }

  async getRateHistory(
    fromCurrency: string,
    toCurrency: string,
    limit: number = 50,
  ): Promise<ExchangeRate[]> {
    return this.getHistoricalRates(fromCurrency, toCurrency, undefined, undefined).then((rates) =>
      rates.slice(0, limit),
    );
  }

  async validateRate(validation: {
    fromCurrency: string;
    toCurrency: string;
    proposedRate: number;
    historicalAverage: number;
    tolerance: number;
  }): Promise<RateValidationResult> {
    const { proposedRate, historicalAverage, tolerance } = validation;

    // Calculate percentage deviation
    const deviation = Math.abs((proposedRate - historicalAverage) / historicalAverage) * 100;

    const isValid = deviation <= tolerance;

    return {
      valid: isValid,
      reason: isValid ? undefined : 'Rate deviation exceeds tolerance',
      deviation,
      recommendedAction: isValid ? 'auto_approve' : 'manual_review',
      alertTriggered: !isValid,
    };
  }
}
