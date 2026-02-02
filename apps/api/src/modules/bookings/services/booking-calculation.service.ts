import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PricingMode, DepositType, toNumber } from '@rental-portal/database';

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
  private readonly PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee
  private readonly SERVICE_FEE_PERCENTAGE = 0.05; // 5% service fee for renters

  constructor(private readonly prisma: PrismaService) {}

  async calculatePrice(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PriceCalculation> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new Error('Listing not found');
    }

    const duration = this.calculateDuration(startDate, endDate);
    const basePrice = this.calculateBasePrice(listing, duration);

    // Apply discounts
    const discounts = this.calculateDiscounts(listing, duration, basePrice);
    const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);

    const subtotal = basePrice - discountTotal;
    const platformFee = subtotal * this.PLATFORM_FEE_PERCENTAGE;
    const serviceFee = subtotal * this.SERVICE_FEE_PERCENTAGE;
    const depositAmount = this.calculateDeposit(listing, subtotal);

    const total = subtotal + serviceFee + depositAmount;
    const ownerEarnings = subtotal - platformFee;

    return {
      subtotal,
      platformFee,
      serviceFee,
      depositAmount,
      total,
      ownerEarnings,
      breakdown: {
        basePrice,
        duration: duration.value,
        durationType: duration.type,
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
      return { value: Math.ceil(hours), type: 'hours' };
    } else if (days < 7) {
      return { value: Math.ceil(days), type: 'days' };
    } else if (days < 30) {
      return { value: Math.ceil(weeks), type: 'weeks' };
    } else {
      return { value: Math.ceil(months), type: 'months' };
    }
  }

  private calculateBasePrice(listing: any, duration: { value: number; type: string }): number {
    switch (listing.pricingMode) {
      case PricingMode.PER_HOUR:
        return (listing.hourlyPrice || listing.basePrice) * duration.value;

      case PricingMode.PER_DAY:
        if (duration.type === 'hours') {
          return listing.dailyPrice || listing.basePrice;
        }
        return (listing.dailyPrice || listing.basePrice) * duration.value;

      case PricingMode.PER_WEEK:
        if (duration.type === 'days' && duration.value < 7) {
          return (listing.dailyPrice || listing.basePrice) * duration.value;
        }
        return (listing.weeklyPrice || listing.basePrice) * duration.value;

      case PricingMode.PER_MONTH:
        if (duration.type === 'days' && duration.value < 30) {
          return (listing.dailyPrice || listing.basePrice) * duration.value;
        }
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
  ): Array<{ type: string; amount: number; reason: string }> {
    const discounts: Array<{ type: string; amount: number; reason: string }> = [];

    // Apply only the highest discount (monthly > weekly)
    // to prevent stacking and excessive discounts
    
    // Monthly discount (20% off for 30+ days) - highest priority
    if (duration.type === 'days' && duration.value >= 30) {
      discounts.push({
        type: 'monthly',
        amount: basePrice * 0.2,
        reason: 'Monthly booking discount (20%)',
      });
    }
    // Weekly discount (10% off for 7+ days) - only if monthly not applied
    else if (duration.type === 'days' && duration.value >= 7) {
      discounts.push({
        type: 'weekly',
        amount: basePrice * 0.1,
        reason: 'Weekly booking discount (10%)',
      });
    }

    // First-time renter discount could be added here
    // Early booking discount could be added here

    return discounts;
  }

  private calculateDeposit(listing: any, subtotal: number): number {
    if (!listing.requiresDeposit) {
      return 0;
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
          },
        },
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    const now = cancellationDate;
    const startDate = booking.startDate;
    const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundPercentage = 0;
    let reason = '';

    // Default cancellation policy if none specified
    if (!booking.listing.cancellationPolicy) {
      if (hoursUntilStart >= 48) {
        refundPercentage = 1.0; // Full refund
        reason = 'Cancelled more than 48 hours before start';
      } else if (hoursUntilStart >= 24) {
        refundPercentage = 0.5; // 50% refund
        reason = 'Cancelled 24-48 hours before start';
      } else {
        refundPercentage = 0; // No refund
        reason = 'Cancelled less than 24 hours before start';
      }
    } else {
      // Use listing's cancellation policy
      // Implementation depends on policy structure
      refundPercentage = 1.0;
      reason = 'Per cancellation policy';
    }

    const subtotalRefund = toNumber(booking.basePrice) * refundPercentage;
    const platformFeeRefund = toNumber(booking.platformFee) * refundPercentage;
    const serviceFeeRefund = toNumber(booking.serviceFee) * refundPercentage;
    const depositRefund = toNumber(booking.securityDeposit || 0);
    const penalty = toNumber(booking.basePrice) - subtotalRefund;

    return {
      refundAmount: subtotalRefund + serviceFeeRefund + depositRefund,
      platformFeeRefund,
      serviceFeeRefund,
      depositRefund,
      penalty,
      reason,
    };
  }
}
