import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
// import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PricingMode, DepositType, toNumber } from '@rental-portal/database';
import { roundForCurrency } from '@rental-portal/shared-types';
import { PolicyEngineService } from '../../policy-engine/services/policy-engine.service';
import { PolicyContext } from '../../policy-engine/interfaces/policy.interfaces';

export interface PriceCalculation {
  subtotal: number;
  platformFee: number;
  serviceFee: number;
  depositAmount: number;
  total: number;
  ownerEarnings: number;
  breakdown: {
    basePrice: number;
    duration: number;
    durationType: 'hours' | 'days' | 'weeks' | 'months';
    discounts?: Array<{ type: string; amount: number; reason: string }>;
  };
}

@Injectable()
export class BookingCalculationService {
  private readonly logger = new Logger(BookingCalculationService.name);
  private readonly platformFeeRate: number;
  private readonly serviceFeeRate: number;

  /**
   * Fallback cancellation tiers loaded from configuration.
   * Operators can override via DEFAULT_CANCELLATION_POLICY env var (JSON).
   * Applied only when the PolicyEngine has no rules for a booking.
   */
  private readonly defaultCancellationTiers: Array<{
    minHoursBefore: number;
    maxHoursBefore: number | null;
    refundPercentage: number;
    label: string;
  }>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly policyEngine?: PolicyEngineService,
  ) {
    this.defaultCancellationTiers = this.config.get<
      Array<{
        minHoursBefore: number;
        maxHoursBefore: number | null;
        refundPercentage: number;
        label: string;
      }>
    >('defaultCancellationPolicy') ?? [
      {
        minHoursBefore: 48,
        maxHoursBefore: null,
        refundPercentage: 1.0,
        label: 'Cancelled more than 48 hours before start — full refund',
      },
      {
        minHoursBefore: 24,
        maxHoursBefore: 48,
        refundPercentage: 0.5,
        label: 'Cancelled 24–48 hours before start — 50% refund',
      },
      {
        minHoursBefore: 0,
        maxHoursBefore: 24,
        refundPercentage: 0.0,
        label: 'Cancelled less than 24 hours before start — no refund',
      },
    ];

    this.platformFeeRate = this.config.get<number>('fees.platformFeePercent', 10) / 100;
    this.serviceFeeRate = this.config.get<number>('fees.serviceFeePercent', 5) / 100;
  }

  /** Public accessor for the service fee rate (e.g. 0.05 = 5%) */
  getServiceFeeRate(): number {
    return this.serviceFeeRate;
  }

  /** Public accessor for the platform fee rate (e.g. 0.10 = 10%) */
  getPlatformFeeRate(): number {
    return this.platformFeeRate;
  }

  async calculatePrice(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PriceCalculation> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { category: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const duration = this.calculateDuration(startDate, endDate);
    // For PER_MONTH pricing, calculate duration in calendar months
    const isPerMonthPricing = (listing as any).pricingMode === PricingMode.PER_MONTH;
    let adjustedDuration = duration;
    if (isPerMonthPricing) {
      const monthDiff =
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth());
      adjustedDuration = { value: Math.max(1, monthDiff), type: 'months' };
    }

    // For PER_DAY pricing, use actual days from date range for accuracy
    const actualDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const isPerDayPricing = (listing as any).pricingMode === PricingMode.PER_DAY;
    const basePrice = this.calculateBasePrice(
      listing,
      adjustedDuration,
      isPerDayPricing ? actualDays : undefined,
    );

    // Apply discounts (use adjusted duration for PER_MONTH pricing)
    const discounts = this.calculateDiscounts(
      listing,
      adjustedDuration,
      basePrice,
      startDate,
      endDate,
    );
    const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);

    const subtotal = basePrice - discountTotal;

    // Calculate deposit and currency early for use in PolicyEngine return
    const depositAmount = this.calculateDeposit(listing, subtotal);
    const currency = listing.currency || this.config.get('platform.defaultCurrency', 'USD');

    // For PER_DAY pricing, use actual days in breakdown for accuracy
    // For PER_MONTH pricing, use adjusted duration (calendar months)
    // For partial days (< 1 day), round up to 1 day minimum
    const breakdownDuration = isPerDayPricing
      ? Math.max(1, actualDays)
      : isPerMonthPricing
        ? adjustedDuration.value
        : duration.value;
    const breakdownDurationType = isPerDayPricing
      ? 'days'
      : isPerMonthPricing
        ? 'months'
        : duration.type;

    // Try PolicyEngine for jurisdiction-aware fees; fall back to config rates
    let platformFee: number;
    let serviceFee: number;

    if (this.policyEngine) {
      try {
        const feeContext: Partial<PolicyContext> = {
          country: listing.country || this.config.get('platform.country', ''),
          state: listing.state || null,
          city: listing.city || null,
          currency: listing.currency || this.config.get('platform.defaultCurrency', 'USD'),
          locale: this.config.get('platform.defaultLocale', 'en'),
          timezone: this.config.get('platform.defaultTimezone', 'UTC'),
          listingId,
          listingCategory: listing.category?.slug || null,
          listingCountry: listing.country || null,
          listingState: listing.state || null,
          listingCity: listing.city || null,
          bookingValue: subtotal,
          bookingDuration: duration.value,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString().split('T')[0],
          platform: 'api',
        } as any;

        const feeBreakdown = await this.policyEngine.calculateFees(
          feeContext as PolicyContext,
          subtotal,
          'Listing',
          listingId,
        );

        if (feeBreakdown.totalFees > 0) {
          const platformLine = feeBreakdown.baseFees.find((f) => f.feeType === 'PLATFORM_FEE');
          const serviceLine = feeBreakdown.baseFees.find((f) => f.feeType === 'SERVICE_FEE');
          platformFee = platformLine?.amount ?? subtotal * this.platformFeeRate;
          serviceFee = serviceLine?.amount ?? subtotal * this.serviceFeeRate;
          // When PolicyEngine returns fees, include platform fee in total
          const total = roundForCurrency(
            subtotal + platformFee + serviceFee + depositAmount,
            currency,
          );
          const ownerEarnings = roundForCurrency(subtotal - platformFee, currency);
          return {
            subtotal,
            platformFee,
            serviceFee,
            depositAmount,
            total,
            ownerEarnings,
            breakdown: {
              basePrice,
              duration: breakdownDuration,
              durationType: breakdownDurationType,
              discounts: discounts.length > 0 ? discounts : undefined,
            },
          };
        } else {
          // No FEE rules matched — use config defaults
          platformFee = subtotal * this.platformFeeRate;
          serviceFee = subtotal * this.serviceFeeRate;
        }
      } catch {
        // PolicyEngine unavailable — use config defaults
        platformFee = subtotal * this.platformFeeRate;
        serviceFee = subtotal * this.serviceFeeRate;
      }
    } else {
      platformFee = subtotal * this.platformFeeRate;
      serviceFee = subtotal * this.serviceFeeRate;
    }

    // Platform fee is charged to owner, not customer. Customer pays service fee + deposit.
    // For PER_MONTH and PER_WEEK pricing, ensure fees are calculated on basePrice (not subtotal with discounts)
    const isPerWeekPricing = (listing as any).pricingMode === PricingMode.PER_WEEK;
    const finalPlatformFee =
      isPerMonthPricing || isPerWeekPricing ? basePrice * this.platformFeeRate : platformFee;
    const finalServiceFee =
      isPerMonthPricing || isPerWeekPricing ? basePrice * this.serviceFeeRate : serviceFee;
    const total = roundForCurrency(subtotal + finalServiceFee + depositAmount, currency);
    // For all pricing modes, ownerEarnings = basePrice - platformFee (service fee charged to customer)
    const ownerEarnings = roundForCurrency(basePrice - finalPlatformFee, currency);

    return {
      subtotal,
      platformFee: finalPlatformFee,
      serviceFee: finalServiceFee,
      depositAmount,
      total,
      ownerEarnings,
      breakdown: {
        basePrice,
        duration: breakdownDuration,
        durationType: breakdownDurationType,
        discounts: discounts.length > 0 ? discounts : undefined,
      },
    };
  }

  private calculateDuration(
    startDate: Date,
    endDate: Date,
  ): {
    value: number;
    type: 'hours' | 'days' | 'weeks' | 'months';
  } {
    const diffMs = endDate.getTime() - startDate.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    const days = diffMs / (1000 * 60 * 60 * 24);
    const weeks = days / 7;
    const months = days / 30;

    // Determine best duration type
    if (hours < 24) {
      return { value: Math.max(1, Math.ceil(hours)), type: 'hours' };
    } else if (days < 7) {
      return { value: Math.max(1, Math.ceil(days)), type: 'days' };
    } else if (days < 30) {
      return { value: Math.max(1, Math.ceil(weeks)), type: 'weeks' };
    } else {
      return { value: Math.ceil(months), type: 'months' };
    }
  }

  private calculateBasePrice(
    listing: any,
    duration: { value: number; type: string },
    actualDays?: number,
  ): number {
    switch (listing.pricingMode) {
      case PricingMode.PER_HOUR:
        return (listing.hourlyPrice || listing.basePrice) * duration.value;

      case PricingMode.PER_DAY: {
        if (duration.type === 'hours') {
          return listing.dailyPrice || listing.basePrice;
        }
        // Use actual days from date range when available for accuracy
        if (actualDays !== undefined) {
          return (listing.dailyPrice || listing.basePrice) * actualDays;
        }
        // Normalize to days for PER_DAY pricing
        let dayCount = duration.value;
        if (duration.type === 'weeks') dayCount = duration.value * 7;
        else if (duration.type === 'months') dayCount = duration.value * 30.44; // Use 365/12 for more accurate month-to-day conversion
        return (listing.dailyPrice || listing.basePrice) * dayCount;
      }

      case PricingMode.PER_WEEK:
        if (duration.type === 'days' && duration.value < 7) {
          return (listing.dailyPrice || listing.basePrice) * duration.value;
        }
        return (listing.weeklyPrice || listing.basePrice) * duration.value;

      case PricingMode.PER_MONTH:
        if (duration.type === 'days' && duration.value < 30) {
          return (listing.dailyPrice || listing.basePrice) * duration.value;
        }
        // For PER_MONTH pricing, use duration.value (months) directly
        return (listing.monthlyPrice || listing.basePrice) * duration.value;

      case PricingMode.CUSTOM:
      default:
        return listing.basePrice;
    }
  }

  private calculateDiscounts(
    listing: any,
    duration: { value: number; type: string },
    basePrice: number,
    startDate?: Date,
    endDate?: Date,
  ): Array<{ type: string; amount: number; reason: string }> {
    const discounts: Array<{ type: string; amount: number; reason: string }> = [];

    // Normalize duration to days for discount calculation
    // Use actual days from date range when available for accuracy
    let totalDays = duration.value;
    if (startDate && endDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      totalDays = diffMs / (1000 * 60 * 60 * 24);
    } else if (duration.type === 'hours') {
      totalDays = duration.value / 24;
    } else if (duration.type === 'weeks') {
      totalDays = duration.value * 7;
    } else if (duration.type === 'months') {
      totalDays = duration.value * 30.44; // Use 365/12 for consistency with basePrice calculation
    }

    // Apply only the highest applicable discount (monthly > weekly)
    // Only apply if the listing has defined the discount rate

    // Monthly discount - highest priority
    if ((totalDays >= 30 || duration.type === 'months') && listing.monthlyDiscount) {
      const rate = listing.monthlyDiscount / 100;
      // Use actual days × daily price for accurate discount calculation
      const actualBasePrice = (listing.dailyPrice || listing.basePrice) * totalDays;
      discounts.push({
        type: 'monthly',
        amount: actualBasePrice * rate,
        reason: `Monthly booking discount (${listing.monthlyDiscount}%)`,
      });
    }
    // Weekly discount - only if monthly not applied
    else if ((totalDays >= 7 || duration.type === 'weeks') && listing.weeklyDiscount) {
      const rate = listing.weeklyDiscount / 100;
      const actualBasePrice = (listing.dailyPrice || listing.basePrice) * totalDays;
      discounts.push({
        type: 'weekly',
        amount: actualBasePrice * rate,
        reason: `Weekly booking discount (${listing.weeklyDiscount}%)`,
      });
    }

    // First-time renter discount could be added here
    // Early booking discount could be added here

    return discounts;
  }

  private calculateDeposit(listing: any, subtotal: number): number {
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

  async calculateRefund(
    bookingId: string,
    cancellationDate: Date,
  ): Promise<{
    refundAmount: number;
    platformFeeRefund: number;
    serviceFeeRefund: number;
    depositRefund: number;
    penalty: number;
    reason: string;
  }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          include: {
            cancellationPolicy: true,
            category: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const now = cancellationDate;
    const startDate = booking.startDate;
    const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundPercentage = 0;
    let reason = '';
    let refundServiceFee = true;
    let refundPlatformFee = true;
    let alwaysRefundDeposit = true;
    let flatPenalty = 0;

    // Try PolicyEngine CANCELLATION rules first
    if (this.policyEngine) {
      try {
        const cancelContext: Partial<PolicyContext> = {
          country: booking.listing.country || this.config.get('platform.country', ''),
          state: booking.listing.state || null,
          city: booking.listing.city || null,
          currency: booking.currency || this.config.get('platform.defaultCurrency', 'USD'),
          locale: this.config.get('platform.defaultLocale', 'en'),
          timezone: this.config.get('platform.defaultTimezone', 'UTC'),
          listingId: booking.listingId,
          listingCategory: booking.listing.category?.slug || null,
          listingCountry: booking.listing.country || null,
          listingState: booking.listing.state || null,
          listingCity: booking.listing.city || null,
          bookingValue: toNumber(booking.totalPrice),
          bookingDuration: null,
          startDate: booking.startDate.toISOString(),
          endDate: booking.endDate.toISOString(),
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString().split('T')[0],
          platform: 'api',
        } as any;

        const cancellation = await this.policyEngine.evaluateCancellation(
          cancelContext as PolicyContext,
          'Booking',
          bookingId,
        );

        if (cancellation.tiers.length > 0) {
          // Find the matching tier based on hoursUntilStart
          // Use > for lower bound to make it exclusive (48 hours matches 50% tier, not 100%)
          const matchedTier = cancellation.tiers.find((tier) => {
            const aboveMin = hoursUntilStart > tier.minHoursBefore;
            const belowMax = tier.maxHoursBefore === null || hoursUntilStart <= tier.maxHoursBefore;
            return aboveMin && belowMax;
          });

          if (matchedTier) {
            refundPercentage = matchedTier.refundPercentage;
            reason =
              matchedTier.label ||
              `Cancellation policy tier (${matchedTier.refundPercentage * 100}% refund)`;
          } else {
            // hoursUntilStart didn't match any tier — use shortest tier (most restrictive)
            const lastTier = cancellation.tiers[cancellation.tiers.length - 1];
            refundPercentage = lastTier.refundPercentage;
            reason = lastTier.label || 'No matching cancellation tier';
          }

          refundServiceFee = cancellation.refundServiceFee;
          refundPlatformFee = cancellation.refundPlatformFee;
          alwaysRefundDeposit = cancellation.alwaysRefundDeposit;
          flatPenalty = cancellation.flatPenalty;
        } else {
          // No CANCELLATION rules — fall through to hardcoded defaults
          this.logger.warn(
            `PolicyEngine returned no CANCELLATION rules for booking ${booking.id ?? 'unknown'} — ` +
              'using hardcoded fallback tiers. Seed default cancellation policies in PolicyEngine to avoid this.',
          );
          this.applyDefaultCancellationPolicy(hoursUntilStart, booking, (pct, msg) => {
            refundPercentage = pct;
            reason = msg;
          });
        }
      } catch (err) {
        // PolicyEngine error — fall back to hardcoded defaults
        this.logger.warn(
          `PolicyEngine threw an error evaluating CANCELLATION for booking ${booking.id ?? 'unknown'} — ` +
            'falling back to hardcoded tiers. Check PolicyEngine configuration.',
          err instanceof Error ? err.stack : String(err),
        );
        this.applyDefaultCancellationPolicy(hoursUntilStart, booking, (pct, msg) => {
          refundPercentage = pct;
          reason = msg;
        });
      }
    } else {
      this.logger.warn(
        `PolicyEngineService not available for booking ${booking.id ?? 'unknown'} — ` +
          'using hardcoded cancellation fallback tiers.',
      );
      this.applyDefaultCancellationPolicy(hoursUntilStart, booking, (pct, msg) => {
        refundPercentage = pct;
        reason = msg;
      });
    }

    // Use basePrice (the listing price only) to avoid double-counting fees/deposit/tax.
    // totalPrice = basePrice + serviceFee + platformFee + taxAmount + securityDeposit,
    // so using totalPrice here would double-count when we add serviceFeeRefund/depositRefund below.
    const baseAmount = toNumber(booking.basePrice);
    const bookingCurrency = booking.currency || this.config.get('platform.defaultCurrency', 'USD');
    const subtotalRefund = roundForCurrency(baseAmount * refundPercentage, bookingCurrency);
    const platformFeeRefund = refundPlatformFee
      ? roundForCurrency(toNumber(booking.platformFee) * refundPercentage, bookingCurrency)
      : 0;
    const serviceFeeRefund = refundServiceFee
      ? roundForCurrency(toNumber(booking.serviceFee) * refundPercentage, bookingCurrency)
      : 0;
    const depositRefund = alwaysRefundDeposit
      ? roundForCurrency(toNumber(booking.securityDeposit || 0), bookingCurrency)
      : 0;
    // Platform fee is charged to owner, not refunded to customer. Only refund service fee to customer.
    const totalRefund = subtotalRefund + serviceFeeRefund + depositRefund - flatPenalty;
    const penalty = roundForCurrency(baseAmount - subtotalRefund + flatPenalty, bookingCurrency);

    return {
      refundAmount: totalRefund,
      platformFeeRefund,
      serviceFeeRefund,
      depositRefund,
      penalty,
      reason,
    };
  }

  /**
   * Applies the platform-level default cancellation tiers (loaded from configuration).
   * These tiers are the fallback when the PolicyEngine has no rules for this booking.
   * Override via the DEFAULT_CANCELLATION_POLICY environment variable.
   *
   * @deprecated Per-listing or global PolicyEngine rules should be configured
   * so this fallback is never reached in production.
   */
  private applyDefaultCancellationPolicy(
    hoursUntilStart: number,
    booking: any,
    apply: (refundPercentage: number, reason: string) => void,
  ): void {
    // If the listing has its own `cancellationPolicy` field (legacy free-text),
    // honour it as a full-refund pass-through until PolicyEngine rules exist.
    if (booking.listing?.cancellationPolicy) {
      apply(1.0, 'Per listing cancellation policy — full refund');
      return;
    }

    // Find the first matching tier (tiers are expected to be sorted most-permissive first).
    const tier = this.defaultCancellationTiers.find((t) => {
      const aboveMin = hoursUntilStart >= t.minHoursBefore;
      const belowMax = t.maxHoursBefore === null || hoursUntilStart < t.maxHoursBefore;
      return aboveMin && belowMax;
    });

    if (tier) {
      apply(tier.refundPercentage, tier.label);
    } else {
      // Hours don't match any tier — apply most restrictive (last tier).
      const lastTier = this.defaultCancellationTiers[this.defaultCancellationTiers.length - 1];
      apply(
        lastTier?.refundPercentage ?? 0,
        lastTier?.label ?? 'No matching cancellation tier — no refund',
      );
    }
  }
}
