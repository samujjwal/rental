import { Injectable } from '@nestjs/common';
import { BookingCalculationService } from './booking-calculation.service';
import { BookingPricingService } from './booking-pricing.service';
import { FxService } from '@/common/fx/fx.service';
import type {
  BookingPricingPort,
  PersistBreakdownParams,
  RefundResult,
} from '../ports/booking-pricing.port';
import type { PriceCalculation } from './booking-calculation.service';

/**
 * Concrete implementation of BookingPricingPort.
 *
 * Delegates to three lower-level services so that BookingsService never imports
 * them directly and depends only on the port interface.
 */
@Injectable()
export class BookingPricingBridgeService implements BookingPricingPort {
  constructor(
    private readonly calculation: BookingCalculationService,
    private readonly bookingPricing: BookingPricingService,
    private readonly fxService: FxService,
  ) {}

  quote(listingId: string, startDate: Date, endDate: Date): Promise<PriceCalculation> {
    return this.calculation.calculatePrice(listingId, startDate, endDate);
  }

  async persistBreakdown(bookingId: string, params: PersistBreakdownParams): Promise<void> {
    await this.bookingPricing.calculateAndPersist(bookingId, {
      ...params,
      serviceFeeRate: this.calculation.getServiceFeeRate(),
      platformFeeRate: this.calculation.getPlatformFeeRate(),
    });
  }

  async captureExchangeRate(
    bookingId: string,
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<void> {
    const fxRate = await this.fxService.getRate(baseCurrency, targetCurrency);
    await this.bookingPricing.captureFxRate({
      bookingId,
      baseCurrency,
      targetCurrency,
      rate: fxRate.rate,
      rateSource: fxRate.source,
    });
  }

  calculateRefund(bookingId: string, atDate: Date): Promise<RefundResult> {
    return this.calculation.calculateRefund(bookingId, atDate) as Promise<RefundResult>;
  }
}
