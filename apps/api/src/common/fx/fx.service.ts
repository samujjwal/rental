import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/common/cache/cache.service';
import { roundForCurrency } from '@rental-portal/shared-types';

export interface FxRate {
  base: string;
  target: string;
  rate: number;
  source: string;
  fetchedAt: Date;
}

/**
 * Foreign-exchange rate service.
 *
 * - Fetches live rates from free APIs (exchangerate.host fallback to static).
 * - Caches rates in Redis for 1 hour.
 * - Provides `convert()` for runtime price display.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly apiKey: string | undefined;

  // Static fallback rates (NPR-centric for Nepal MVP)
  private static readonly FALLBACK_RATES: Record<string, number> = {
    'NPR:USD': 0.0075,
    'USD:NPR': 133.0,
    'NPR:INR': 0.625,
    'INR:NPR': 1.6,
    'USD:INR': 83.5,
    'INR:USD': 0.012,
  };

  constructor(
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('FX_API_KEY');
  }

  /**
   * Get the exchange rate from `base` to `target`.
   */
  async getRate(base: string, target: string): Promise<FxRate> {
    if (base === target) {
      return { base, target, rate: 1, source: 'identity', fetchedAt: new Date() };
    }

    const cacheKey = `fx:${base}:${target}`;
    const cached = await this.cache.get<FxRate>(cacheKey);
    if (cached) return cached;

    // Try live API
    const live = await this.fetchLiveRate(base, target);
    if (live) {
      await this.cache.set(cacheKey, live, 3600); // 1 hour
      return live;
    }

    // Fallback to static
    const key = `${base}:${target}`;
    const fallbackRate = FxService.FALLBACK_RATES[key];
    if (fallbackRate) {
      this.logger.warn(`FX live rate unavailable for ${base}→${target}; using static fallback rate ${fallbackRate}`);
      const result: FxRate = {
        base,
        target,
        rate: fallbackRate,
        source: 'static-fallback',
        fetchedAt: new Date(),
      };
      await this.cache.set(cacheKey, result, 3600);
      return result;
    }

    // If no direct rate, try via USD pivot
    const baseToUsd = FxService.FALLBACK_RATES[`${base}:USD`];
    const usdToTarget = FxService.FALLBACK_RATES[`USD:${target}`];
    if (baseToUsd && usdToTarget) {
      this.logger.warn(`FX live rate unavailable for ${base}→${target}; using static USD-pivot fallback`);
      const result: FxRate = {
        base,
        target,
        rate: baseToUsd * usdToTarget,
        source: 'static-pivot-USD',
        fetchedAt: new Date(),
      };
      await this.cache.set(cacheKey, result, 3600);
      return result;
    }

    this.logger.warn(`No FX rate available for ${base} → ${target}, returning 1`);
    return { base, target, rate: 1, source: 'unavailable', fetchedAt: new Date() };
  }

  /**
   * Convert an amount from one currency to another.
   */
  async convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: FxRate }> {
    const fxRate = await this.getRate(from, to);
    return {
      amount: roundForCurrency(amount * fxRate.rate, to),
      rate: fxRate,
    };
  }

  /**
   * Try to fetch a live rate from exchangerate.host (free, no key required)
   * or open exchange rates (with key).
   */
  private async fetchLiveRate(base: string, target: string): Promise<FxRate | null> {
    try {
      // Try exchangerate.host (free tier)
      const url = `https://api.exchangerate.host/convert?from=${base}&to=${target}&amount=1`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(url, { signal: controller.signal });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.result) {
            return {
              base,
              target,
              rate: data.result,
              source: 'exchangerate.host',
              fetchedAt: new Date(),
            };
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      this.logger.debug(`exchangerate.host fetch failed: ${err}`);
    }

    // Try open exchange rates if API key is configured
    if (this.apiKey) {
      try {
        const url = `https://openexchangerates.org/api/latest.json?app_id=${this.apiKey}&base=USD`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const res = await fetch(url, { signal: controller.signal });

          if (res.ok) {
            const data = await res.json();
            const rates = data.rates;
            if (rates && rates[base] && rates[target]) {
              const rate = rates[target] / rates[base];
              return {
                base,
                target,
                rate,
                source: 'openexchangerates',
                fetchedAt: new Date(),
              };
            }
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        this.logger.debug(`openexchangerates fetch failed: ${err}`);
      }
    }

    return null;
  }
}
