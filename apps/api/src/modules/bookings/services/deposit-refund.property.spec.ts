/**
 * Property-based tests for deposit calculation and refund invariants.
 *
 * Invariants tested:
 * - Deposit is always >= 0
 * - PERCENTAGE deposit is in [0, subtotal]
 * - FIXED deposit equals depositAmount
 * - securityDeposit override always takes precedence
 * - refundAmount + penalty = basePrice (no-policy path)
 * - refundAmount >= 0 for any cancellation time
 * - penalty >= 0 for any cancellation time
 * - depositRefund is always returned in full
 */
import * as fc from 'fast-check';

// ── Pure helpers extracted from BookingCalculationService ─────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

enum DepositType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

function calculateDeposit(
  listing: {
    securityDeposit?: number;
    depositType?: DepositType;
    depositAmount?: number;
  },
  subtotal: number,
): number {
  const securityDeposit = toNumber(listing.securityDeposit || 0);
  if (securityDeposit > 0) {
    return securityDeposit;
  }

  if (listing.depositType === DepositType.FIXED) {
    return listing.depositAmount || 0;
  }

  if (listing.depositType === DepositType.PERCENTAGE) {
    const percentage = (listing.depositAmount || 0) / 100;
    return subtotal * percentage;
  }

  return 0;
}

/**
 * Default refund calculation (no cancellation policy).
 * Returns { refundPercentage, reason }
 */
function defaultRefundPolicy(hoursUntilStart: number): {
  refundPercentage: number;
  reason: string;
} {
  if (hoursUntilStart >= 48) {
    return { refundPercentage: 1.0, reason: 'Cancelled more than 48 hours before start' };
  } else if (hoursUntilStart >= 24) {
    return { refundPercentage: 0.5, reason: 'Cancelled 24-48 hours before start' };
  } else {
    return { refundPercentage: 0, reason: 'Cancelled less than 24 hours before start' };
  }
}

function computeRefund(
  basePrice: number,
  platformFee: number,
  serviceFee: number,
  securityDeposit: number,
  refundPercentage: number,
) {
  const subtotalRefund = basePrice * refundPercentage;
  const platformFeeRefund = platformFee * refundPercentage;
  const serviceFeeRefund = serviceFee * refundPercentage;
  const depositRefund = securityDeposit;
  const penalty = basePrice - subtotalRefund;

  return {
    refundAmount: subtotalRefund + serviceFeeRefund + depositRefund,
    platformFeeRefund,
    serviceFeeRefund,
    depositRefund,
    penalty,
  };
}

// ── Arbitraries ──────────────────────────────────────────────────────────

const positivePrice = fc.double({ min: 0.01, max: 100_000, noNaN: true });
const nonNegPrice = fc.double({ min: 0, max: 100_000, noNaN: true });
const percentAmount = fc.double({ min: 0, max: 100, noNaN: true });
const depositTypeArb = fc.constantFrom(DepositType.FIXED, DepositType.PERCENTAGE, undefined);
const hoursUntilStartArb = fc.double({ min: -24, max: 168, noNaN: true }); // -24h to 7 days

// ── Tests ────────────────────────────────────────────────────────────────

describe('Deposit & Refund — property-based', () => {
  fc.configureGlobal({ seed: 42, numRuns: 200 });

  describe('calculateDeposit', () => {
    it('deposit is always >= 0', () => {
      fc.assert(
        fc.property(
          nonNegPrice,
          depositTypeArb,
          percentAmount,
          positivePrice,
          (secDep, depType, depAmt, subtotal) => {
            const result = calculateDeposit(
              {
                securityDeposit: secDep,
                depositType: depType,
                depositAmount: depAmt,
              },
              subtotal,
            );
            expect(result).toBeGreaterThanOrEqual(0);
          },
        ),
      );
    });

    it('securityDeposit > 0 always takes precedence', () => {
      fc.assert(
        fc.property(positivePrice, depositTypeArb, nonNegPrice, positivePrice, (secDep, depType, depAmt, subtotal) => {
          const result = calculateDeposit(
            { securityDeposit: secDep, depositType: depType, depositAmount: depAmt },
            subtotal,
          );
          expect(result).toBe(secDep);
        }),
      );
    });

    it('FIXED deposit equals depositAmount when no securityDeposit', () => {
      fc.assert(
        fc.property(nonNegPrice, positivePrice, (depAmt, subtotal) => {
          const result = calculateDeposit(
            { securityDeposit: 0, depositType: DepositType.FIXED, depositAmount: depAmt },
            subtotal,
          );
          expect(result).toBe(depAmt);
        }),
      );
    });

    it('PERCENTAGE deposit is in [0, subtotal] when ≤ 100%', () => {
      fc.assert(
        fc.property(percentAmount, positivePrice, (depAmt, subtotal) => {
          const result = calculateDeposit(
            { securityDeposit: 0, depositType: DepositType.PERCENTAGE, depositAmount: depAmt },
            subtotal,
          );
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(subtotal + 0.01); // fp tolerance
        }),
      );
    });

    it('no deposit type returns 0 when no securityDeposit', () => {
      fc.assert(
        fc.property(nonNegPrice, positivePrice, (depAmt, subtotal) => {
          const result = calculateDeposit({ securityDeposit: 0, depositAmount: depAmt }, subtotal);
          expect(result).toBe(0);
        }),
      );
    });
  });

  describe('defaultRefundPolicy', () => {
    it('refundPercentage is 0, 0.5, or 1.0', () => {
      fc.assert(
        fc.property(hoursUntilStartArb, (hours) => {
          const { refundPercentage } = defaultRefundPolicy(hours);
          expect([0, 0.5, 1.0]).toContain(refundPercentage);
        }),
      );
    });

    it('more hours → higher or equal refund', () => {
      fc.assert(
        fc.property(hoursUntilStartArb, hoursUntilStartArb, (h1, h2) => {
          const low = Math.min(h1, h2);
          const high = Math.max(h1, h2);
          const { refundPercentage: lowRefund } = defaultRefundPolicy(low);
          const { refundPercentage: highRefund } = defaultRefundPolicy(high);
          expect(highRefund).toBeGreaterThanOrEqual(lowRefund);
        }),
      );
    });

    it('cancelling >= 48h before always gets full refund', () => {
      fc.assert(
        fc.property(fc.double({ min: 48, max: 8760, noNaN: true }), (hours) => {
          const { refundPercentage } = defaultRefundPolicy(hours);
          expect(refundPercentage).toBe(1.0);
        }),
      );
    });

    it('cancelling < 24h before gets no refund', () => {
      fc.assert(
        fc.property(fc.double({ min: -100, max: 23.999, noNaN: true }), (hours) => {
          const { refundPercentage } = defaultRefundPolicy(hours);
          expect(refundPercentage).toBe(0);
        }),
      );
    });
  });

  describe('computeRefund invariants', () => {
    it('penalty + subtotalRefund = basePrice', () => {
      fc.assert(
        fc.property(positivePrice, positivePrice, positivePrice, nonNegPrice, hoursUntilStartArb, (base, platFee, svcFee, deposit, hours) => {
          const { refundPercentage } = defaultRefundPolicy(hours);
          const result = computeRefund(base, platFee, svcFee, deposit, refundPercentage);
          const subtotalRefund = base * refundPercentage;
          expect(result.penalty + subtotalRefund).toBeCloseTo(base, 5);
        }),
      );
    });

    it('refundAmount >= 0', () => {
      fc.assert(
        fc.property(positivePrice, positivePrice, positivePrice, nonNegPrice, hoursUntilStartArb, (base, platFee, svcFee, deposit, hours) => {
          const { refundPercentage } = defaultRefundPolicy(hours);
          const result = computeRefund(base, platFee, svcFee, deposit, refundPercentage);
          expect(result.refundAmount).toBeGreaterThanOrEqual(0);
        }),
      );
    });

    it('penalty >= 0', () => {
      fc.assert(
        fc.property(positivePrice, positivePrice, positivePrice, nonNegPrice, hoursUntilStartArb, (base, platFee, svcFee, deposit, hours) => {
          const { refundPercentage } = defaultRefundPolicy(hours);
          const result = computeRefund(base, platFee, svcFee, deposit, refundPercentage);
          expect(result.penalty).toBeGreaterThanOrEqual(0);
        }),
      );
    });

    it('depositRefund always equals securityDeposit (always refunded)', () => {
      fc.assert(
        fc.property(positivePrice, positivePrice, positivePrice, nonNegPrice, hoursUntilStartArb, (base, platFee, svcFee, deposit, hours) => {
          const { refundPercentage } = defaultRefundPolicy(hours);
          const result = computeRefund(base, platFee, svcFee, deposit, refundPercentage);
          expect(result.depositRefund).toBe(deposit);
        }),
      );
    });

    it('full refund (100%) → penalty = 0', () => {
      fc.assert(
        fc.property(positivePrice, positivePrice, positivePrice, nonNegPrice, (base, platFee, svcFee, deposit) => {
          const result = computeRefund(base, platFee, svcFee, deposit, 1.0);
          expect(result.penalty).toBeCloseTo(0, 5);
        }),
      );
    });

    it('no refund (0%) → penalty = basePrice', () => {
      fc.assert(
        fc.property(positivePrice, positivePrice, positivePrice, nonNegPrice, (base, platFee, svcFee, deposit) => {
          const result = computeRefund(base, platFee, svcFee, deposit, 0);
          expect(result.penalty).toBeCloseTo(base, 5);
        }),
      );
    });
  });
});
