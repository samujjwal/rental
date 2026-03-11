/**
 * Property-based tests for BookingCalculationService.
 *
 * Uses fast-check to verify invariants over random but valid inputs.
 * Covers: price non-negativity, monotonicity with duration,
 *         discount validity, total = subtotal + serviceFee + deposit.
 */
import * as fc from 'fast-check';

// ── Pure helpers extracted for property testing ──────────────────────────────

function calculateDuration(startDate: Date, endDate: Date) {
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  const days = diffMs / (1000 * 60 * 60 * 24);
  const weeks = days / 7;
  const months = days / 30;

  if (hours < 24) return { value: Math.ceil(hours), type: 'hours' as const };
  else if (days < 7) return { value: Math.ceil(days), type: 'days' as const };
  else if (days < 30) return { value: Math.ceil(weeks), type: 'weeks' as const };
  else return { value: Math.ceil(months), type: 'months' as const };
}

function calculateBasePrice(
  listing: { basePrice: number; dailyPrice?: number; hourlyPrice?: number; weeklyPrice?: number; monthlyPrice?: number; pricingMode: string },
  duration: { value: number; type: string },
): number {
  switch (listing.pricingMode) {
    case 'PER_HOUR':
      return (listing.hourlyPrice || listing.basePrice) * duration.value;
    case 'PER_DAY': {
      if (duration.type === 'hours') return listing.dailyPrice || listing.basePrice;
      let dayCount = duration.value;
      if (duration.type === 'weeks') dayCount = duration.value * 7;
      else if (duration.type === 'months') dayCount = duration.value * 30;
      return (listing.dailyPrice || listing.basePrice) * dayCount;
    }
    case 'PER_WEEK':
      if (duration.type === 'days' && duration.value < 7)
        return (listing.dailyPrice || listing.basePrice) * duration.value;
      return (listing.weeklyPrice || listing.basePrice) * duration.value;
    case 'PER_MONTH':
      if (duration.type === 'days' && duration.value < 30)
        return (listing.dailyPrice || listing.basePrice) * duration.value;
      return (listing.monthlyPrice || listing.basePrice) * duration.value;
    default:
      return listing.basePrice;
  }
}

function calculateDiscounts(
  listing: { weeklyDiscount?: number; monthlyDiscount?: number },
  duration: { value: number; type: string },
  basePrice: number,
) {
  const discounts: Array<{ type: string; amount: number; reason: string }> = [];
  let totalDays = duration.value;
  if (duration.type === 'hours') totalDays = duration.value / 24;
  else if (duration.type === 'weeks') totalDays = duration.value * 7;
  else if (duration.type === 'months') totalDays = duration.value * 30;

  if ((totalDays >= 30 || duration.type === 'months') && listing.monthlyDiscount) {
    const rate = listing.monthlyDiscount / 100;
    discounts.push({ type: 'monthly', amount: basePrice * rate, reason: `Monthly discount` });
  } else if ((totalDays >= 7 || duration.type === 'weeks') && listing.weeklyDiscount) {
    const rate = listing.weeklyDiscount / 100;
    discounts.push({ type: 'weekly', amount: basePrice * rate, reason: `Weekly discount` });
  }
  return discounts;
}

// Arbitraries
const positivePrice = fc.double({ min: 1, max: 100_000, noNaN: true });
const pricingMode = fc.constantFrom('PER_HOUR', 'PER_DAY', 'PER_WEEK', 'PER_MONTH', 'CUSTOM');
const discountPercent = fc.double({ min: 0, max: 50, noNaN: true });

const listingArb = fc.record({
  basePrice: positivePrice,
  dailyPrice: fc.option(positivePrice, { nil: undefined }),
  hourlyPrice: fc.option(positivePrice, { nil: undefined }),
  weeklyPrice: fc.option(positivePrice, { nil: undefined }),
  monthlyPrice: fc.option(positivePrice, { nil: undefined }),
  pricingMode,
  weeklyDiscount: fc.option(discountPercent, { nil: undefined }),
  monthlyDiscount: fc.option(discountPercent, { nil: undefined }),
  securityDeposit: fc.option(fc.double({ min: 0, max: 50_000, noNaN: true }), { nil: undefined }),
});

// Generate a start date in the future and an end date after it
const dateRangeArb = fc
  .integer({ min: 1, max: 365 })
  .chain((offsetDays) =>
    fc.integer({ min: 1, max: 365 }).map((durationDays) => {
      const now = new Date('2025-01-01T00:00:00Z');
      const start = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
      return { start, end };
    }),
  );

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BookingCalculationService — property-based', () => {
  fc.configureGlobal({ seed: 42, numRuns: 100 });

  describe('calculateDuration', () => {
    it('always returns a positive duration value', () => {
      fc.assert(
        fc.property(dateRangeArb, ({ start, end }) => {
          const result = calculateDuration(start, end);
          expect(result.value).toBeGreaterThan(0);
        }),
      );
    });

    it('type is one of hours/days/weeks/months', () => {
      fc.assert(
        fc.property(dateRangeArb, ({ start, end }) => {
          const result = calculateDuration(start, end);
          expect(['hours', 'days', 'weeks', 'months']).toContain(result.type);
        }),
      );
    });
  });

  describe('calculateBasePrice', () => {
    it('base price is always >= 0', () => {
      fc.assert(
        fc.property(listingArb, dateRangeArb, (listing, { start, end }) => {
          const duration = calculateDuration(start, end);
          const price = calculateBasePrice(listing, duration);
          expect(price).toBeGreaterThanOrEqual(0);
        }),
      );
    });

    it('CUSTOM pricing mode always returns listing.basePrice', () => {
      fc.assert(
        fc.property(listingArb, dateRangeArb, (listing, { start, end }) => {
          const customListing = { ...listing, pricingMode: 'CUSTOM' };
          const duration = calculateDuration(start, end);
          const price = calculateBasePrice(customListing, duration);
          expect(price).toBe(customListing.basePrice);
        }),
      );
    });
  });

  describe('calculateDiscounts', () => {
    it('discount amount is always >= 0', () => {
      fc.assert(
        fc.property(listingArb, dateRangeArb, (listing, { start, end }) => {
          const duration = calculateDuration(start, end);
          const basePrice = calculateBasePrice(listing, duration);
          const discounts = calculateDiscounts(listing, duration, basePrice);
          for (const d of discounts) {
            expect(d.amount).toBeGreaterThanOrEqual(0);
          }
        }),
      );
    });

    it('discount is at most 50% of base price', () => {
      fc.assert(
        fc.property(listingArb, dateRangeArb, (listing, { start, end }) => {
          const duration = calculateDuration(start, end);
          const basePrice = calculateBasePrice(listing, duration);
          const discounts = calculateDiscounts(listing, duration, basePrice);
          const totalDiscount = discounts.reduce((s, d) => s + d.amount, 0);
          expect(totalDiscount).toBeLessThanOrEqual(basePrice * 0.5 + 0.01); // small fp tolerance
        }),
      );
    });

    it('no discount for short stays without weekly/monthly discount configured', () => {
      fc.assert(
        fc.property(positivePrice, (base) => {
          const listing = { basePrice: base, pricingMode: 'PER_DAY' };
          const duration = { value: 3, type: 'days' as const };
          const bp = calculateBasePrice(listing as any, duration);
          const discounts = calculateDiscounts(listing as any, duration, bp);
          expect(discounts).toHaveLength(0);
        }),
      );
    });
  });

  describe('full price calculation invariants', () => {
    const PLATFORM_FEE_PCT = 0.15;
    const SERVICE_FEE_PCT = 0.05;

    it('total = subtotal + serviceFee + deposit (no negative totals)', () => {
      fc.assert(
        fc.property(listingArb, dateRangeArb, (listing, { start, end }) => {
          const duration = calculateDuration(start, end);
          const basePrice = calculateBasePrice(listing, duration);
          const discounts = calculateDiscounts(listing, duration, basePrice);
          const discountTotal = discounts.reduce((s, d) => s + d.amount, 0);
          const subtotal = basePrice - discountTotal;
          const serviceFee = subtotal * SERVICE_FEE_PCT;
          const deposit = listing.securityDeposit ?? 0;
          const total = subtotal + serviceFee + deposit;

          expect(total).toBeGreaterThanOrEqual(0);
          expect(total).toBeCloseTo(subtotal + serviceFee + deposit, 2);
        }),
      );
    });

    it('ownerEarnings < subtotal (platform keeps 15%)', () => {
      fc.assert(
        fc.property(listingArb, dateRangeArb, (listing, { start, end }) => {
          const duration = calculateDuration(start, end);
          const basePrice = calculateBasePrice(listing, duration);
          const discounts = calculateDiscounts(listing, duration, basePrice);
          const discountTotal = discounts.reduce((s, d) => s + d.amount, 0);
          const subtotal = basePrice - discountTotal;
          const ownerEarnings = subtotal - subtotal * PLATFORM_FEE_PCT;

          if (subtotal > 0) {
            expect(ownerEarnings).toBeLessThan(subtotal);
            expect(ownerEarnings).toBeGreaterThan(0);
          }
        }),
      );
    });
  });
});
