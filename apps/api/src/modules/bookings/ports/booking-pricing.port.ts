/**
 * Anti-corruption boundary between BookingsService and the three pricing
 * infrastructure services (BookingCalculationService, BookingPricingService,
 * FxService).  Swap implementations without touching the booking orchestrator.
 */

import type { PriceCalculation } from '../services/booking-calculation.service';

export const BOOKING_PRICING_PORT = Symbol('BOOKING_PRICING_PORT');

/**
 * Parameters for persisting a price-breakdown ledger record.
 * Fee rates are intentionally absent here — the adapter layer fills them in
 * from BookingCalculationService so BookingsService has no reason to know them.
 */
export interface PersistBreakdownParams {
  basePrice: number;
  nights: number;
  cleaningFee?: number;
  securityDeposit?: number;
  /** Policy-engine-derived tax rate, e.g. 0.13 = 13 %. */
  taxRate?: number;
  currency?: string;
}

export interface RefundResult {
  refundAmount: number;
  platformFeeRefund: number;
  serviceFeeRefund: number;
  depositRefund: number;
  penalty: number;
  reason: string;
}

// Re-export so callers can type-annotate quote() results without importing the service.
export type { PriceCalculation };

export interface BookingPricingPort {
  /** Calculate the total price for a booking period. */
  quote(listingId: string, startDate: Date, endDate: Date): Promise<PriceCalculation>;

  /** Persist a price-breakdown ledger record for the booking.
   *  Platform and service fee rates are resolved internally by the adapter. */
  persistBreakdown(bookingId: string, params: PersistBreakdownParams): Promise<void>;

  /** Snapshot the FX rate when listing and platform currencies differ. */
  captureExchangeRate(
    bookingId: string,
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<void>;

  /** Calculate how much to refund on cancellation at the given date. */
  calculateRefund(bookingId: string, atDate: Date): Promise<RefundResult>;
}
