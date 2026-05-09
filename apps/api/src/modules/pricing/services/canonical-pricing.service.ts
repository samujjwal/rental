import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PricingMode, toNumber } from '@rental-portal/database';
import { roundForCurrency, formatCurrency } from '@rental-portal/shared-types';
import { PolicyEngineService } from '../../policy-engine/services/policy-engine.service';
import { PolicyContext } from '../../policy-engine/interfaces/policy.interfaces';

/**
 * Canonical Pricing/Tax Quote Service
 * 
 * This is the single source of truth for all pricing and tax calculations across:
 * - Search results
 * - Booking quotes
 * - Booking creation
 * - Checkout
 * - Invoices
 * - Refunds
 * - Payouts
 * 
 * All other pricing services should delegate to this service.
 */
export interface PricingQuoteRequest {
  listingId: string;
  startDate: Date;
  endDate: Date;
  currency?: string;
  includeTax?: boolean;
  context?: 'search' | 'quote' | 'booking' | 'checkout' | 'invoice' | 'refund' | 'payout';
}

export interface PricingQuoteResponse {
  subtotal: number;
  basePrice: number;
  platformFee: number;
  serviceFee: number;
  tax: number;
  taxRate: number;
  depositAmount: number;
  total: number;
  ownerEarnings: number;
  currency: string;
  breakdown: {
    duration: number;
    durationType: 'hours' | 'days' | 'weeks' | 'months';
    basePrice: number;
    discounts?: Array<{ type: string; amount: number; reason: string }>;
    lineItems: Array<{
      type: string;
      label: string;
      amount: number;
    }>;
  };
  metadata: {
    listingId: string;
    pricingMode: string;
    calculatedAt: string;
    context: string;
  };
}

@Injectable()
export class CanonicalPricingService {
  private readonly logger = new Logger(CanonicalPricingService.name);
  private readonly platformFeeRate: number;
  private readonly serviceFeeRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly policyEngine?: PolicyEngineService,
  ) {
    this.platformFeeRate = this.config.get<number>('fees.platformFeePercent', 10) / 100;
    this.serviceFeeRate = this.config.get<number>('fees.serviceFeePercent', 5) / 100;
  }

  /**
   * Get a canonical pricing/tax quote
   * This is the single entry point for all pricing calculations
   */
  async getQuote(request: PricingQuoteRequest): Promise<PricingQuoteResponse> {
    const { listingId, startDate, endDate, currency, includeTax = true, context = 'quote' } = request;

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { category: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const listingCurrency = currency || listing.currency || this.config.get('platform.defaultCurrency', 'USD');

    // Calculate duration and base price
    const duration = this.calculateDuration(startDate, endDate);
    const isPerMonthPricing = (listing as any).pricingMode === PricingMode.PER_MONTH;
    const isPerDayPricing = (listing as any).pricingMode === PricingMode.PER_DAY;
    
    let adjustedDuration = duration;
    if (isPerMonthPricing) {
      const monthDiff =
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth());
      adjustedDuration = { value: Math.max(1, monthDiff), type: 'months' };
    }

    const actualDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const basePrice = this.calculateBasePrice(
      listing,
      adjustedDuration,
      isPerDayPricing ? actualDays : undefined,
    );

    // Apply discounts
    const discounts = this.calculateDiscounts(
      listing,
      adjustedDuration,
      basePrice,
      startDate,
      endDate,
    );
    const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);

    const subtotal = basePrice - discountTotal;

    // Calculate deposit
    const depositAmount = this.calculateDeposit(listing, subtotal);

    // Calculate fees using PolicyEngine or config defaults
    let platformFee: number;
    let serviceFee: number;
    let tax: number = 0;
    let taxRate: number = 0;

    if (this.policyEngine) {
      try {
        const feeContext: Partial<PolicyContext> = {
          country: listing.country || this.config.get('platform.country', ''),
          state: listing.state || null,
          city: listing.city || null,
          currency: listingCurrency,
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
          const taxLine = feeBreakdown.baseFees.find((f) => f.feeType === 'TAX');
          
          platformFee = platformLine?.amount ?? subtotal * this.platformFeeRate;
          serviceFee = serviceLine?.amount ?? subtotal * this.serviceFeeRate;
          tax = taxLine?.amount ?? 0;
          taxRate = taxLine?.rate ?? 0;
        } else {
          platformFee = subtotal * this.platformFeeRate;
          serviceFee = subtotal * this.serviceFeeRate;
        }
      } catch {
        platformFee = subtotal * this.platformFeeRate;
        serviceFee = subtotal * this.serviceFeeRate;
      }
    } else {
      platformFee = subtotal * this.platformFeeRate;
      serviceFee = subtotal * this.serviceFeeRate;
    }

    // Adjust fees for PER_MONTH and PER_WEEK pricing
    const isPerWeekPricing = (listing as any).pricingMode === PricingMode.PER_WEEK;
    const finalPlatformFee =
      isPerMonthPricing || isPerWeekPricing ? basePrice * this.platformFeeRate : platformFee;
    const finalServiceFee =
      isPerMonthPricing || isPerWeekPricing ? basePrice * this.serviceFeeRate : serviceFee;

    // Calculate total
    const total = roundForCurrency(
      subtotal + finalServiceFee + (includeTax ? tax : 0) + depositAmount,
      listingCurrency,
    );
    const ownerEarnings = roundForCurrency(basePrice - finalPlatformFee, listingCurrency);

    // Build breakdown duration
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

    // Build line items
    const lineItems: Array<{ type: string; label: string; amount: number }> = [
      {
        type: 'BASE_RATE',
        label: `${breakdownDuration} ${breakdownDurationType} × ${formatCurrency(toNumber(listing.basePrice) || 0, listingCurrency)}`,
        amount: basePrice,
      },
    ];

    if (discountTotal > 0) {
      lineItems.push({
        type: 'DISCOUNT',
        label: 'Discount',
        amount: -discountTotal,
      });
    }

    if (finalServiceFee > 0) {
      lineItems.push({
        type: 'SERVICE_FEE',
        label: `Service fee (${(this.serviceFeeRate * 100).toFixed(0)}%)`,
        amount: finalServiceFee,
      });
    }

    if (finalPlatformFee > 0) {
      lineItems.push({
        type: 'PLATFORM_FEE',
        label: `Platform fee (${(this.platformFeeRate * 100).toFixed(0)}%)`,
        amount: finalPlatformFee,
      });
    }

    if (includeTax && tax > 0) {
      lineItems.push({
        type: 'TAX',
        label: `Tax (${(taxRate * 100).toFixed(1)}%)`,
        amount: tax,
      });
    }

    if (depositAmount > 0) {
      lineItems.push({
        type: 'SECURITY_DEPOSIT',
        label: 'Security deposit (refundable)',
        amount: depositAmount,
      });
    }

    return {
      subtotal,
      basePrice,
      platformFee: finalPlatformFee,
      serviceFee: finalServiceFee,
      tax,
      taxRate,
      depositAmount,
      total,
      ownerEarnings,
      currency: listingCurrency,
      breakdown: {
        duration: breakdownDuration,
        durationType: breakdownDurationType,
        basePrice,
        discounts: discounts.length > 0 ? discounts : undefined,
        lineItems,
      },
      metadata: {
        listingId,
        pricingMode: (listing as any).pricingMode || 'PER_DAY',
        calculatedAt: new Date().toISOString(),
        context,
      },
    };
  }

  private calculateDuration(
    startDate: Date,
    endDate: Date,
  ): { value: number; type: 'hours' | 'days' | 'weeks' | 'months' } {
    const diffMs = endDate.getTime() - startDate.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    const days = diffMs / (1000 * 60 * 60 * 24);
    const weeks = days / 7;
    const months = days / 30;

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

      case PricingMode.PER_DAY:
        return (listing.basePrice) * (actualDays || duration.value);

      case PricingMode.PER_WEEK:
        return (listing.pricePerWeek || listing.basePrice * 7) * duration.value;

      case PricingMode.PER_MONTH:
        return (listing.pricePerMonth || listing.basePrice * 30) * duration.value;

      default:
        return listing.basePrice * duration.value;
    }
  }

  private calculateDiscounts(
    listing: any,
    duration: { value: number; type: string },
    basePrice: number,
    startDate: Date,
    endDate: Date,
  ): Array<{ type: string; amount: number; reason: string }> {
    const discounts: Array<{ type: string; amount: number; reason: string }> = [];

    // Long-term discount
    if (duration.value >= 7 && duration.value < 30) {
      const weeklyDiscountRate = 0.05; // 5% for weekly
      discounts.push({
        type: 'WEEKLY_DISCOUNT',
        amount: basePrice * weeklyDiscountRate,
        reason: 'Weekly stay discount',
      });
    } else if (duration.value >= 30) {
      const monthlyDiscountRate = 0.10; // 10% for monthly
      discounts.push({
        type: 'MONTHLY_DISCOUNT',
        amount: basePrice * monthlyDiscountRate,
        reason: 'Monthly stay discount',
      });
    }

    return discounts;
  }

  private calculateDeposit(listing: any, subtotal: number): number {
    const depositType = listing.depositType || 'FIXED';
    const depositAmount = listing.depositAmount || 0;

    if (depositType === 'PERCENTAGE') {
      return subtotal * (depositAmount / 100);
    }

    return depositAmount;
  }
}
