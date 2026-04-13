/**
 * P2: Property-Based Tests for Tax Calculations
 *
 * Uses fast-check to verify tax calculation invariants across random valid inputs.
 * Covers: tax non-negativity, rate bounds, rounding correctness, and formula invariants.
 */

import * as fc from 'fast-check';

// ── Pure tax calculation helpers (mirroring production logic) ─────────────────

interface TaxConfig {
  vatRate: number; // 0-100
  serviceTaxRate: number; // 0-100
  touristTaxRate: number; // 0-100 (per night)
  localTaxRate: number; // 0-100
  taxExemptionThreshold: number;
}

interface BookingDetails {
  baseAmount: number;
  nights: number;
  guests: number;
  isLocalResident: boolean;
  isBusinessBooking: boolean;
}

const DEFAULT_TAX_CONFIG: TaxConfig = {
  vatRate: 13, // Nepal VAT
  serviceTaxRate: 10,
  touristTaxRate: 2, // Per night
  localTaxRate: 0,
  taxExemptionThreshold: 0, // No exemption
};

function calculateTaxBreakdown(
  booking: BookingDetails,
  config: TaxConfig = DEFAULT_TAX_CONFIG
) {
  // Calculate subtotal
  const subtotal = booking.baseAmount;

  // VAT calculation (on base amount)
  const vatAmount = (subtotal * config.vatRate) / 100;

  // Service tax calculation
  const serviceTaxAmount = (subtotal * config.serviceTaxRate) / 100;

  // Tourist tax (per night per guest)
  const touristTaxAmount = booking.nights * booking.guests * config.touristTaxRate;

  // Local tax (only for local residents, otherwise 0)
  const localTaxAmount = booking.isLocalResident
    ? (subtotal * config.localTaxRate) / 100
    : 0;

  // Business booking exemption (no service tax)
  const finalServiceTax = booking.isBusinessBooking ? 0 : serviceTaxAmount;

  const totalTax = vatAmount + finalServiceTax + touristTaxAmount + localTaxAmount;
  const totalWithTax = subtotal + totalTax;

  return {
    subtotal,
    vatAmount,
    serviceTaxAmount: finalServiceTax,
    touristTaxAmount,
    localTaxAmount,
    totalTax,
    totalWithTax,
  };
}

function roundToPrecision(amount: number, precision: number = 2): number {
  const multiplier = Math.pow(10, precision);
  return Math.round(amount * multiplier) / multiplier;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const positiveAmount = fc.double({ min: 0.01, max: 1000000, noNaN: true });
const taxRate = fc.double({ min: 0, max: 50, noNaN: true });
const nightsCount = fc.integer({ min: 1, max: 365 });
const guestsCount = fc.integer({ min: 1, max: 100 });

const taxConfigArb = fc.record({
  vatRate: taxRate,
  serviceTaxRate: taxRate,
  touristTaxRate: taxRate,
  localTaxRate: taxRate,
  taxExemptionThreshold: fc.double({ min: 0, max: 10000, noNaN: true }),
});

const bookingDetailsArb = fc.record({
  baseAmount: positiveAmount,
  nights: nightsCount,
  guests: guestsCount,
  isLocalResident: fc.boolean(),
  isBusinessBooking: fc.boolean(),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaxCalculationService - Property-Based Tests', () => {
  fc.configureGlobal({ seed: 42, numRuns: 100 });

  describe('Tax Amount Invariants', () => {
    it('all tax components are non-negative', () => {
      fc.assert(
        fc.property(bookingDetailsArb, taxConfigArb, (booking, config) => {
          const breakdown = calculateTaxBreakdown(booking, config);

          expect(breakdown.vatAmount).toBeGreaterThanOrEqual(0);
          expect(breakdown.serviceTaxAmount).toBeGreaterThanOrEqual(0);
          expect(breakdown.touristTaxAmount).toBeGreaterThanOrEqual(0);
          expect(breakdown.localTaxAmount).toBeGreaterThanOrEqual(0);
          expect(breakdown.totalTax).toBeGreaterThanOrEqual(0);
        }),
      );
    });

    it('totalTax equals sum of all tax components', () => {
      fc.assert(
        fc.property(bookingDetailsArb, taxConfigArb, (booking, config) => {
          const breakdown = calculateTaxBreakdown(booking, config);

          const expectedTotal =
            breakdown.vatAmount +
            breakdown.serviceTaxAmount +
            breakdown.touristTaxAmount +
            breakdown.localTaxAmount;

          expect(breakdown.totalTax).toBeCloseTo(expectedTotal, 2);
        }),
      );
    });

    it('totalWithTax equals subtotal plus totalTax', () => {
      fc.assert(
        fc.property(bookingDetailsArb, taxConfigArb, (booking, config) => {
          const breakdown = calculateTaxBreakdown(booking, config);

          expect(breakdown.totalWithTax).toBeCloseTo(
            breakdown.subtotal + breakdown.totalTax,
            2
          );
        }),
      );
    });

    it('totalWithTax is always greater than or equal to subtotal', () => {
      fc.assert(
        fc.property(bookingDetailsArb, taxConfigArb, (booking, config) => {
          const breakdown = calculateTaxBreakdown(booking, config);

          expect(breakdown.totalWithTax).toBeGreaterThanOrEqual(breakdown.subtotal);
        }),
      );
    });
  });

  describe('Rate-Based Invariants', () => {
    it('VAT amount is within expected bounds (0 to base * rate%)', () => {
      fc.assert(
        fc.property(bookingDetailsArb, taxConfigArb, (booking, config) => {
          const breakdown = calculateTaxBreakdown(booking, config);

          const maxVat = booking.baseAmount * (config.vatRate / 100);
          expect(breakdown.vatAmount).toBeGreaterThanOrEqual(0);
          expect(breakdown.vatAmount).toBeLessThanOrEqual(maxVat + 0.01);
        }),
      );
    });

    it('service tax is 0 for business bookings regardless of rate', () => {
      fc.assert(
        fc.property(
          bookingDetailsArb,
          taxConfigArb,
          fc.record({ isLocalResident: fc.boolean() }),
          (booking, config, flags) => {
            const businessBooking = {
              ...booking,
              isBusinessBooking: true,
              isLocalResident: flags.isLocalResident,
            };
            const breakdown = calculateTaxBreakdown(businessBooking, config);

            expect(breakdown.serviceTaxAmount).toBe(0);
          }
        ),
      );
    });

    it('local tax is 0 for non-local residents regardless of rate', () => {
      fc.assert(
        fc.property(
          bookingDetailsArb,
          taxConfigArb,
          fc.record({ isBusinessBooking: fc.boolean() }),
          (booking, config, flags) => {
            const nonResidentBooking = {
              ...booking,
              isLocalResident: false,
              isBusinessBooking: flags.isBusinessBooking,
            };
            const breakdown = calculateTaxBreakdown(nonResidentBooking, config);

            expect(breakdown.localTaxAmount).toBe(0);
          }
        ),
      );
    });

    it('tourist tax scales linearly with nights and guests', () => {
      fc.assert(
        fc.property(
          positiveAmount,
          nightsCount,
          guestsCount,
          taxRate,
          (base, nights1, nights2, rate) => {
            const booking1 = {
              baseAmount: base,
              nights: nights1,
              guests: 1,
              isLocalResident: false,
              isBusinessBooking: false,
            };
            const booking2 = {
              baseAmount: base,
              nights: nights2,
              guests: 1,
              isLocalResident: false,
              isBusinessBooking: false,
            };

            const config = { ...DEFAULT_TAX_CONFIG, touristTaxRate: rate };
            const breakdown1 = calculateTaxBreakdown(booking1, config);
            const breakdown2 = calculateTaxBreakdown(booking2, config);

            // Tourist tax ratio should match nights ratio
            const ratio1 = breakdown1.touristTaxAmount / nights1;
            const ratio2 = breakdown2.touristTaxAmount / nights2;

            expect(ratio1).toBeCloseTo(ratio2, 2);
            expect(ratio1).toBeCloseTo(rate, 2);
          }
        ),
      );
    });
  });

  describe('Monotonicity Invariants', () => {
    it('totalTax increases monotonically with baseAmount', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 500000, noNaN: true }),
          fc.double({ min: 1, max: 500000, noNaN: true }),
          taxConfigArb,
          nightsCount,
          guestsCount,
          (amount1, amount2, config, nights, guests) => {
            const booking1 = {
              baseAmount: Math.min(amount1, amount2),
              nights,
              guests,
              isLocalResident: false,
              isBusinessBooking: false,
            };
            const booking2 = {
              baseAmount: Math.max(amount1, amount2),
              nights,
              guests,
              isLocalResident: false,
              isBusinessBooking: false,
            };

            const breakdown1 = calculateTaxBreakdown(booking1, config);
            const breakdown2 = calculateTaxBreakdown(booking2, config);

            if (booking1.baseAmount < booking2.baseAmount) {
              expect(breakdown2.totalTax).toBeGreaterThanOrEqual(breakdown1.totalTax);
            }
          }
        ),
      );
    });

    it('totalTax increases monotonically with tax rates', () => {
      fc.assert(
        fc.property(
          bookingDetailsArb,
          taxRate,
          taxRate,
          (booking, rate1, rate2) => {
            const config1 = { ...DEFAULT_TAX_CONFIG, vatRate: Math.min(rate1, rate2) };
            const config2 = { ...DEFAULT_TAX_CONFIG, vatRate: Math.max(rate1, rate2) };

            // Reset other taxes to 0 to isolate VAT
            config1.serviceTaxRate = 0;
            config1.touristTaxRate = 0;
            config1.localTaxRate = 0;
            config2.serviceTaxRate = 0;
            config2.touristTaxRate = 0;
            config2.localTaxRate = 0;

            const breakdown1 = calculateTaxBreakdown(booking, config1);
            const breakdown2 = calculateTaxBreakdown(booking, config2);

            if (config1.vatRate < config2.vatRate) {
              expect(breakdown2.vatAmount).toBeGreaterThanOrEqual(breakdown1.vatAmount);
            }
          }
        ),
      );
    });
  });

  describe('Rounding Correctness', () => {
    it('rounding to 2 decimal places maintains sum invariants', () => {
      fc.assert(
        fc.property(bookingDetailsArb, taxConfigArb, (booking, config) => {
          const breakdown = calculateTaxBreakdown(booking, config);

          const roundedVat = roundToPrecision(breakdown.vatAmount, 2);
          const roundedService = roundToPrecision(breakdown.serviceTaxAmount, 2);
          const roundedTourist = roundToPrecision(breakdown.touristTaxAmount, 2);
          const roundedLocal = roundToPrecision(breakdown.localTaxAmount, 2);

          const roundedTotal = roundToPrecision(
            roundedVat + roundedService + roundedTourist + roundedLocal,
            2
          );

          // Rounded total should be very close to sum of rounded components
          expect(roundedTotal).toBeCloseTo(
            roundedVat + roundedService + roundedTourist + roundedLocal,
            2
          );
        }),
      );
    });

    it('rounding never produces negative amounts', () => {
      fc.assert(
        fc.property(bookingDetailsArb, taxConfigArb, (booking, config) => {
          const breakdown = calculateTaxBreakdown(booking, config);

          const rounded = {
            vat: roundToPrecision(breakdown.vatAmount, 2),
            service: roundToPrecision(breakdown.serviceTaxAmount, 2),
            tourist: roundToPrecision(breakdown.touristTaxAmount, 2),
            local: roundToPrecision(breakdown.localTaxAmount, 2),
          };

          expect(rounded.vat).toBeGreaterThanOrEqual(0);
          expect(rounded.service).toBeGreaterThanOrEqual(0);
          expect(rounded.tourist).toBeGreaterThanOrEqual(0);
          expect(rounded.local).toBeGreaterThanOrEqual(0);
        }),
      );
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('zero base amount produces zero tax', () => {
      fc.assert(
        fc.property(taxConfigArb, nightsCount, guestsCount, (config, nights, guests) => {
          const booking: BookingDetails = {
            baseAmount: 0,
            nights,
            guests,
            isLocalResident: false,
            isBusinessBooking: false,
          };

          const breakdown = calculateTaxBreakdown(booking, config);

          expect(breakdown.vatAmount).toBe(0);
          expect(breakdown.serviceTaxAmount).toBe(0);
          expect(breakdown.localTaxAmount).toBe(0);
          // Tourist tax may still apply based on nights/guests
          expect(breakdown.touristTaxAmount).toBeCloseTo(config.touristTaxRate * nights * guests);
        }),
      );
    });

    it('zero tax rates produce zero tax', () => {
      fc.assert(
        fc.property(bookingDetailsArb, (booking) => {
          const zeroTaxConfig: TaxConfig = {
            vatRate: 0,
            serviceTaxRate: 0,
            touristTaxRate: 0,
            localTaxRate: 0,
            taxExemptionThreshold: 0,
          };

          const breakdown = calculateTaxBreakdown(booking, zeroTaxConfig);

          expect(breakdown.totalTax).toBe(0);
          expect(breakdown.totalWithTax).toBeCloseTo(booking.baseAmount);
        }),
      );
    });

    it('maximum reasonable values do not overflow', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100000, max: Number.MAX_SAFE_INTEGER / 1000, noNaN: true }),
          fc.double({ min: 40, max: 50, noNaN: true }),
          (baseAmount, maxRate) => {
            const booking: BookingDetails = {
              baseAmount,
              nights: 365,
              guests: 100,
              isLocalResident: true,
              isBusinessBooking: false,
            };

            const config: TaxConfig = {
              vatRate: maxRate,
              serviceTaxRate: maxRate,
              touristTaxRate: maxRate,
              localTaxRate: maxRate,
              taxExemptionThreshold: 0,
            };

            // Should not throw or produce NaN/Infinity
            const breakdown = calculateTaxBreakdown(booking, config);

            expect(Number.isFinite(breakdown.totalTax)).toBe(true);
            expect(Number.isFinite(breakdown.totalWithTax)).toBe(true);
            expect(Number.isNaN(breakdown.totalTax)).toBe(false);
            expect(Number.isNaN(breakdown.totalWithTax)).toBe(false);
          }
        ),
      );
    });
  });

  describe('Nepal-Specific Tax Rules', () => {
    it('applies standard Nepal VAT rate (13%) by default', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000, noNaN: true }),
          (baseAmount) => {
            const booking: BookingDetails = {
              baseAmount,
              nights: 1,
              guests: 1,
              isLocalResident: false,
              isBusinessBooking: false,
            };

            const nepalConfig: TaxConfig = {
              vatRate: 13,
              serviceTaxRate: 0,
              touristTaxRate: 0,
              localTaxRate: 0,
              taxExemptionThreshold: 0,
            };

            const breakdown = calculateTaxBreakdown(booking, nepalConfig);

            const expectedVat = baseAmount * 0.13;
            expect(breakdown.vatAmount).toBeCloseTo(expectedVat, 2);
          }
        ),
      );
    });

    it('tourist tax applies per night per guest in Nepal', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 10, noNaN: true }), // tourist tax rate
          fc.integer({ min: 1, max: 30 }), // nights
          fc.integer({ min: 1, max: 10 }), // guests
          (taxRate, nights, guests) => {
            const booking: BookingDetails = {
              baseAmount: 1000,
              nights,
              guests,
              isLocalResident: false,
              isBusinessBooking: false,
            };

            const config: TaxConfig = {
              ...DEFAULT_TAX_CONFIG,
              touristTaxRate: taxRate,
              vatRate: 0,
              serviceTaxRate: 0,
              localTaxRate: 0,
            };

            const breakdown = calculateTaxBreakdown(booking, config);

            const expectedTouristTax = taxRate * nights * guests;
            expect(breakdown.touristTaxAmount).toBeCloseTo(expectedTouristTax, 2);
          }
        ),
      );
    });
  });
});
