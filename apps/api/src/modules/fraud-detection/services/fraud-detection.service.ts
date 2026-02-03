import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { PropertyStatus, toNumber } from '@rental-portal/database';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface FraudCheckResult {
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  flags: FraudFlag[];
  requiresManualReview: boolean;
  allowBooking: boolean;
}

export interface FraudFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getHighRiskUsers(limit = 20): Promise<any[]> {
    // Find users with potential risk factors
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { disputesDefended: { some: {} } },
          { averageRating: { lt: 3.5, not: 0 } },
          { emailVerified: false },
        ],
      },
      take: limit * 2, // Fetch more to filter down
      include: {
        _count: {
          select: { disputesDefended: true, bookings: true },
        },
      },
    });

    const results = [];
    for (const user of users) {
      const check = await this.checkUserRisk(user.id);
      if (check.riskScore >= 50) {
        results.push({ user, check });
      }
    }
    return results.slice(0, limit);
  }

  /**
   * Check user for fraud indicators
   */
  async checkUserRisk(userId: string): Promise<FraudCheckResult> {
    const flags: FraudFlag[] = [];
    let riskScore = 0;

    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        bookings: {
          where: {
            status: { in: ['CANCELLED', 'DISPUTED'] },
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
          },
          orderBy: { createdAt: 'desc' },
        },
        disputesInitiated: {
          where: {
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
        },
        reviewsReceived: {
          where: {
            overallRating: { lt: 3 },
          },
          take: 10,
        },
      },
    })) as any;

    if (!user) {
      flags.push({
        type: 'USER_NOT_FOUND',
        severity: 'CRITICAL',
        description: 'User does not exist',
      });
      return this.calculateRiskLevel(100, flags);
    }

    // Check account age (new accounts are riskier)
    const accountAgeDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (accountAgeDays < 7) {
      riskScore += 20;
      flags.push({
        type: 'NEW_ACCOUNT',
        severity: 'MEDIUM',
        description: `Account created ${accountAgeDays} days ago`,
        metadata: { accountAgeDays },
      });
    }

    // Check verification status
    if (!user.emailVerified) {
      riskScore += 15;
      flags.push({
        type: 'EMAIL_NOT_VERIFIED',
        severity: 'HIGH',
        description: 'Email address not verified',
      });
    }

    if (user.idVerificationStatus !== 'VERIFIED') {
      riskScore += 10;
      flags.push({
        type: 'ID_NOT_VERIFIED',
        severity: 'MEDIUM',
        description: 'Government ID not verified',
      });
    }

    // Check recent cancellations
    const recentCancellations = user.bookings.filter((b) => b.status === 'CANCELLED').length;
    if (recentCancellations > 2) {
      riskScore += 15;
      flags.push({
        type: 'FREQUENT_CANCELLATIONS',
        severity: 'HIGH',
        description: `${recentCancellations} cancellations in last 90 days`,
        metadata: { count: recentCancellations },
      });
    }

    // Check dispute history
    if (user.disputesInitiated.length > 1) {
      riskScore += 20;
      flags.push({
        type: 'DISPUTE_HISTORY',
        severity: 'HIGH',
        description: `${user.disputesInitiated.length} disputes initiated in last 90 days`,
        metadata: { count: user.disputesInitiated.length },
      });
    }

    // Check ratings
    if (user.averageRating > 0 && user.averageRating < 3.5) {
      riskScore += 15;
      flags.push({
        type: 'LOW_RATING',
        severity: 'MEDIUM',
        description: `Average rating of ${user.averageRating}`,
        metadata: { rating: user.averageRating },
      });
    }

    // Check for negative reviews
    if (user.reviewsReceived.length > 3) {
      riskScore += 10;
      flags.push({
        type: 'NEGATIVE_REVIEWS',
        severity: 'MEDIUM',
        description: `${user.reviewsReceived.length} reviews below 3 stars`,
        metadata: { count: user.reviewsReceived.length },
      });
    }

    return this.calculateRiskLevel(riskScore, flags);
  }

  /**
   * Check booking for fraud indicators
   */
  async checkBookingRisk(bookingData: {
    userId: string;
    listingId: string;
    totalPrice: number;
    startDate: Date;
    endDate: Date;
  }): Promise<FraudCheckResult> {
    const flags: FraudFlag[] = [];
    let riskScore = 0;

    // Check user risk first
    const userRisk = await this.checkUserRisk(bookingData.userId);
    riskScore += userRisk.riskScore * 0.4; // Weight user risk at 40%
    flags.push(...userRisk.flags);

    // Check booking velocity (rapid bookings from same user)
    const velocity = await this.checkBookingVelocity(bookingData.userId);
    if (velocity.count > 3) {
      riskScore += 15;
      flags.push({
        type: 'HIGH_BOOKING_VELOCITY',
        severity: 'MEDIUM',
        description: `${velocity.count} booking attempts in ${velocity.windowMinutes} minutes`,
        metadata: velocity,
      });
    }

    // Check high-value booking for new users
    const user = (await this.prisma.user.findUnique({
      where: { id: bookingData.userId },
      include: {
        bookings: {
          where: { status: { in: ['COMPLETED', 'SETTLED'] } },
        },
      },
    })) as any;

    if (user) {
      const accountAgeDays = Math.floor(
        (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (accountAgeDays < 30 && bookingData.totalPrice > 500) {
        riskScore += 20;
        flags.push({
          type: 'HIGH_VALUE_NEW_USER',
          severity: 'HIGH',
          description: `High-value booking ($${bookingData.totalPrice}) from account < 30 days old`,
          metadata: { accountAgeDays, totalPrice: bookingData.totalPrice },
        });
      }

      // Check first booking protection
      if (user.bookings.length === 0 && bookingData.totalPrice > 300) {
        riskScore += 15;
        flags.push({
          type: 'FIRST_HIGH_VALUE_BOOKING',
          severity: 'MEDIUM',
          description: 'First booking exceeds $300',
          metadata: { totalPrice: bookingData.totalPrice },
        });
      }
    }

    // Check booking duration (unusual patterns)
    const durationDays =
      (bookingData.endDate.getTime() - bookingData.startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (durationDays > 90) {
      riskScore += 10;
      flags.push({
        type: 'UNUSUALLY_LONG_BOOKING',
        severity: 'MEDIUM',
        description: `Booking duration of ${durationDays} days`,
        metadata: { durationDays },
      });
    }

    // Check same-day booking (potential rush)
    const hoursUntilStart = (bookingData.startDate.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilStart < 2) {
      riskScore += 10;
      flags.push({
        type: 'LAST_MINUTE_BOOKING',
        severity: 'LOW',
        description: `Booking starts in ${Math.round(hoursUntilStart)} hours`,
        metadata: { hoursUntilStart },
      });
    }

    return this.calculateRiskLevel(riskScore, flags);
  }

  /**
   * Check payment method for fraud indicators
   */
  async checkPaymentRisk(paymentData: {
    userId: string;
    paymentMethodId: string;
    amount: number;
  }): Promise<FraudCheckResult> {
    const flags: FraudFlag[] = [];
    let riskScore = 0;

    // Check if payment method is new
    const cacheKey = `payment:method:${paymentData.paymentMethodId}:age`;
    const methodAge = await this.cache.get<number>(cacheKey);

    if (!methodAge) {
      // First time using this payment method
      riskScore += 10;
      flags.push({
        type: 'NEW_PAYMENT_METHOD',
        severity: 'LOW',
        description: 'First transaction with this payment method',
      });
      await this.cache.set(cacheKey, Date.now(), 30 * 24 * 60 * 60); // 30 days
    }

    // Check for multiple payment methods in short time
    const paymentMethodCount = await this.getRecentPaymentMethodCount(paymentData.userId);
    if (paymentMethodCount > 3) {
      riskScore += 15;
      flags.push({
        type: 'MULTIPLE_PAYMENT_METHODS',
        severity: 'HIGH',
        description: `${paymentMethodCount} different payment methods used recently`,
        metadata: { count: paymentMethodCount },
      });
    }

    return this.calculateRiskLevel(riskScore, flags);
  }

  /**
   * Check listing for fraud indicators (for owners)
   */
  async checkListingRisk(listingData: {
    userId: string;
    title: string;
    description: string;
    basePrice: number;
    photos: string[];
  }): Promise<FraudCheckResult> {
    const flags: FraudFlag[] = [];
    let riskScore = 0;

    // Check for missing photos
    if (listingData.photos.length === 0) {
      riskScore += 15;
      flags.push({
        type: 'NO_PHOTOS',
        severity: 'HIGH',
        description: 'Listing has no photos',
      });
    } else if (listingData.photos.length < 3) {
      riskScore += 5;
      flags.push({
        type: 'FEW_PHOTOS',
        severity: 'LOW',
        description: 'Listing has fewer than 3 photos',
      });
    }

    // Check for suspicious pricing (too good to be true)
    const category = await this.getListingCategory(listingData);
    if (category) {
      const avgPrice = await this.getAveragePriceForCategory(category);
      if (avgPrice && listingData.basePrice < avgPrice * 0.3) {
        riskScore += 20;
        flags.push({
          type: 'SUSPICIOUSLY_LOW_PRICE',
          severity: 'HIGH',
          description: `Price 70% below category average`,
          metadata: { listingPrice: listingData.basePrice, averagePrice: avgPrice },
        });
      }
    }

    // Check title/description for spam patterns
    const spamPatterns = [
      /\b(click here|buy now|limited time)\b/i,
      /\b(whatsapp|telegram|wechat)\b/i,
      /\b\d{10,}\b/, // Phone numbers
      /@[\w.]+/, // Email addresses
    ];

    const textToCheck = `${listingData.title} ${listingData.description}`;
    for (const pattern of spamPatterns) {
      if (pattern.test(textToCheck)) {
        riskScore += 15;
        flags.push({
          type: 'SUSPICIOUS_CONTENT',
          severity: 'HIGH',
          description: 'Listing contains suspicious patterns',
        });
        break;
      }
    }

    return this.calculateRiskLevel(riskScore, flags);
  }

  /**
   * Helper: Calculate risk level from score
   */
  private calculateRiskLevel(riskScore: number, flags: FraudFlag[]): FraudCheckResult {
    let riskLevel: RiskLevel;
    let requiresManualReview = false;
    let allowBooking = true;

    if (riskScore >= 70) {
      riskLevel = RiskLevel.CRITICAL;
      requiresManualReview = true;
      allowBooking = false;
    } else if (riskScore >= 50) {
      riskLevel = RiskLevel.HIGH;
      requiresManualReview = true;
      allowBooking = false;
    } else if (riskScore >= 30) {
      riskLevel = RiskLevel.MEDIUM;
      requiresManualReview = true;
      allowBooking = true; // Allow but flag
    } else {
      riskLevel = RiskLevel.LOW;
      requiresManualReview = false;
      allowBooking = true;
    }

    return {
      riskLevel,
      riskScore,
      flags,
      requiresManualReview,
      allowBooking,
    };
  }

  /**
   * Helper: Check booking velocity
   */
  private async checkBookingVelocity(
    userId: string,
  ): Promise<{ count: number; windowMinutes: number }> {
    const windowMinutes = 5; // 5 minute window for velocity check
    const now = Date.now();
    const windowKey = Math.floor(now / (windowMinutes * 60 * 1000));
    const cacheKey = `booking:velocity:${userId}:${windowKey}`;

    // Use atomic increment with error handling
    let count = 1;
    try {
      count = await this.cache.increment(cacheKey);
      if (count === 1) {
        // Set expiry only on first increment to prevent race condition
        await this.cache.expire(cacheKey, windowMinutes * 60);
      }
    } catch (error) {
      this.logger.error(`Failed to check booking velocity for user ${userId}:`, error);
      // On cache error, allow the operation but log it
      // Better to allow legitimate bookings than block on cache issues
    }

    return { count, windowMinutes };
  }

  /**
   * Helper: Get recent payment method count
   */
  private async getRecentPaymentMethodCount(userId: string): Promise<number> {
    const cacheKey = `user:${userId}:payment:methods`;
    const methods = await this.cache.get<Set<string>>(cacheKey);
    return methods ? methods.size : 0;
  }

  /**
   * Helper: Get listing category
   */
  private async getListingCategory(listingData: any): Promise<string | null> {
    // Simplified - in real implementation, determine from listingData
    return null;
  }

  /**
   * Helper: Get average price for category
   */
  private async getAveragePriceForCategory(category: string): Promise<number | null> {
    const cacheKey = `category:${category}:avg:price`;
    const cached = await this.cache.get<number>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.prisma.listing.aggregate({
      where: {
        category: { slug: category },
        status: PropertyStatus.AVAILABLE,
      },
      _avg: {
        basePrice: true,
      },
    });

    if (result._avg.basePrice) {
      const price = toNumber(result._avg.basePrice);
      await this.cache.set(cacheKey, price, 24 * 60 * 60); // 24 hours
      return price;
    }

    return null;
  }

  /**
   * Log fraud check for audit
   */
  async logFraudCheck(
    entityType: 'USER' | 'BOOKING' | 'PAYMENT' | 'LISTING',
    entityId: string,
    result: FraudCheckResult,
  ): Promise<void> {
    this.logger.log(`Fraud check: ${entityType} ${entityId} - Risk: ${result.riskLevel}`, {
      entityType,
      entityId,
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      flagCount: result.flags.length,
    });

    // Store in audit log if high risk
    if (result.riskScore >= 50) {
      await this.prisma.auditLog.create({
        data: {
          action: 'FRAUD_CHECK',
          entityType,
          entityId,
          newValues: JSON.stringify({
            riskLevel: result.riskLevel,
            riskScore: result.riskScore,
            flags: result.flags,
          }),
        },
      });
    }
  }
}
