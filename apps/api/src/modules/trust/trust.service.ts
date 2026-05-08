/**
 * Trust Score Service
 * 
 * Calculates and manages trust scores for users and listings.
 * Trust signals include:
 * - Verified badges (email, phone, identity)
 * - Response rate/time
 * - Superhost status
 * - Insurance-backed
 * - Review counts and ratings
 * - Successful bookings
 * - Dispute-free rate
 * - Community standing
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface TrustScore {
  score: number; // 0-100
  level: 'BEGINNER' | 'TRUSTED' | 'ESTABLISHED' | 'SUPERHOST' | 'LEGENDARY';
  indicators: TrustIndicators;
}

export interface TrustIndicators {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  responseRate: number;
  responseTime: string;
  totalReviews: number;
  averageRating: number;
  successfulBookings: number;
  disputeFreeRate: number;
  accountAge: number; // in days
  completedBookings: number;
  cancelledBookings: number;
  superhostStatus: boolean;
}

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate trust score for a user
   */
  async calculateUserTrustScore(userId: string): Promise<TrustScore> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const indicators = await this.getUserTrustIndicators(user);
    const score = this.calculateScoreFromIndicators(indicators);
    const level = this.getTrustLevel(score);

    return { score, level, indicators };
  }

  /**
   * Calculate trust score for a listing
   */
  async calculateListingTrustScore(listingId: string): Promise<TrustScore> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: true,
        reviews: true,
        bookings: true,
      },
    });

    if (!listing) {
      throw new Error(`Listing not found: ${listingId}`);
    }

    const indicators = await this.getListingTrustIndicators(listing);
    const score = this.calculateScoreFromIndicators(indicators);
    const level = this.getTrustLevel(score);

    return { score, level, indicators };
  }

  /**
   * Get trust indicators for a user
   */
  private async getUserTrustIndicators(user: any): Promise<TrustIndicators> {
    const now = new Date();
    const accountAge = Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Calculate response rate (mock - should be calculated from actual message response times)
    const responseRate = user.responseRate || 0.8; // Default 80%
    const responseTime = user.responseTime || '1 hour';

    // Get review statistics
    const totalReviews = user.totalReviews || 0;
    const averageRating = user.averageRating || 0;

    // Calculate successful bookings (completed without disputes)
    // Query bookings separately to avoid relation issues
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [
          { renterId: user.id },
          { listing: { ownerId: user.id } },
        ],
      },
    });

    const completedBookings = bookings.filter((b: any) => b.status === 'COMPLETED').length;
    const cancelledBookings = bookings.filter((b: any) => b.status === 'CANCELLED').length;
    const successfulBookings = completedBookings - cancelledBookings;

    // Calculate dispute-free rate
    const bookingsWithDisputes = bookings.filter((b: any) => b.disputeId).length;
    const disputeFreeRate = completedBookings > 0 
      ? (completedBookings - bookingsWithDisputes) / completedBookings 
      : 1;

    // Check superhost status (could be based on specific criteria)
    const superhostStatus = await this.isSuperhost(user);

    return {
      emailVerified: user.emailVerified || false,
      phoneVerified: user.phoneVerified || false,
      identityVerified: user.idVerificationStatus === 'VERIFIED',
      responseRate,
      responseTime,
      totalReviews,
      averageRating,
      successfulBookings: Math.max(0, successfulBookings),
      disputeFreeRate,
      accountAge,
      completedBookings,
      cancelledBookings,
      superhostStatus,
    };
  }

  /**
   * Get trust indicators for a listing
   */
  private async getListingTrustIndicators(listing: any): Promise<TrustIndicators> {
    const owner = listing.owner;
    const ownerIndicators = await this.getUserTrustIndicators(owner);

    // Listing-specific indicators
    const listingReviews = listing.reviews || [];
    const totalReviews = listing.totalReviews || 0;
    const averageRating = listing.averageRating || 0;

    // Calculate successful bookings for this listing
    const completedBookings = (listing.bookings || []).filter((b: any) => b.status === 'COMPLETED').length;
    const cancelledBookings = (listing.bookings || []).filter((b: any) => b.status === 'CANCELLED').length;
    const successfulBookings = completedBookings - cancelledBookings;

    // Dispute-free rate for this listing
    const bookingsWithDisputes = (listing.bookings || []).filter((b: any) => b.disputeId).length;
    const disputeFreeRate = completedBookings > 0 
      ? (completedBookings - bookingsWithDisputes) / completedBookings 
      : 1;

    return {
      emailVerified: ownerIndicators.emailVerified,
      phoneVerified: ownerIndicators.phoneVerified,
      identityVerified: ownerIndicators.identityVerified,
      responseRate: ownerIndicators.responseRate,
      responseTime: ownerIndicators.responseTime,
      totalReviews,
      averageRating,
      successfulBookings: Math.max(0, successfulBookings),
      disputeFreeRate,
      accountAge: ownerIndicators.accountAge,
      completedBookings,
      cancelledBookings,
      superhostStatus: ownerIndicators.superhostStatus,
    };
  }

  /**
   * Calculate trust score from indicators
   */
  private calculateScoreFromIndicators(indicators: TrustIndicators): number {
    let score = 50; // Base score

    // Verification badges (up to 20 points)
    if (indicators.emailVerified) score += 5;
    if (indicators.phoneVerified) score += 5;
    if (indicators.identityVerified) score += 10;

    // Response rate (up to 10 points)
    score += indicators.responseRate * 10;

    // Response time (up to 5 points)
    if (indicators.responseTime === 'within 1 hour') score += 5;
    else if (indicators.responseTime === 'within a few hours') score += 3;
    else if (indicators.responseTime === 'within a day') score += 1;

    // Reviews (up to 20 points)
    if (indicators.totalReviews >= 10) score += 10;
    else if (indicators.totalReviews >= 5) score += 5;
    else if (indicators.totalReviews >= 1) score += 2;

    // Rating (up to 10 points)
    score += (indicators.averageRating / 5) * 10;

    // Successful bookings (up to 10 points)
    if (indicators.successfulBookings >= 50) score += 10;
    else if (indicators.successfulBookings >= 20) score += 7;
    else if (indicators.successfulBookings >= 10) score += 5;
    else if (indicators.successfulBookings >= 5) score += 3;
    else if (indicators.successfulBookings >= 1) score += 1;

    // Dispute-free rate (up to 10 points)
    score += indicators.disputeFreeRate * 10;

    // Account age (up to 5 points)
    if (indicators.accountAge >= 365) score += 5;
    else if (indicators.accountAge >= 180) score += 3;
    else if (indicators.accountAge >= 90) score += 1;

    // Superhost bonus (up to 10 points)
    if (indicators.superhostStatus) score += 10;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get trust level from score
   */
  private getTrustLevel(score: number): TrustScore['level'] {
    if (score >= 90) return 'LEGENDARY';
    if (score >= 75) return 'SUPERHOST';
    if (score >= 60) return 'ESTABLISHED';
    if (score >= 40) return 'TRUSTED';
    return 'BEGINNER';
  }

  /**
   * Check if user qualifies for superhost status
   */
  private async isSuperhost(user: any): Promise<boolean> {
    // Superhost criteria (can be customized)
    const hasEnoughReviews = user.totalReviews >= 10;
    const hasHighRating = user.averageRating >= 4.8;
    const hasHighResponseRate = user.responseRate >= 0.9;
    
    // Get bookings for cancellation rate calculation
    const bookings = await this.prisma.booking.findMany({
      where: {
        listing: { ownerId: user.id },
      },
    });
    
    const totalBookings = bookings.length;
    const cancelledBookings = bookings.filter((b: any) => b.status === 'CANCELLED').length;
    const hasLowCancellationRate = totalBookings > 0 ? cancelledBookings / totalBookings <= 0.05 : true;
    const hasCompletedBookings = bookings.filter((b: any) => b.status === 'COMPLETED').length >= 10;

    return hasEnoughReviews && hasHighRating && hasHighResponseRate && hasLowCancellationRate && hasCompletedBookings;
  }

  /**
   * Get trust scores for multiple users in batch
   */
  async getBatchUserTrustScores(userIds: string[]): Promise<Map<string, TrustScore>> {
    const scores = new Map<string, TrustScore>();
    
    for (const userId of userIds) {
      try {
        const score = await this.calculateUserTrustScore(userId);
        scores.set(userId, score);
      } catch (error) {
        this.logger.warn(`Failed to calculate trust score for user ${userId}`, error);
      }
    }

    return scores;
  }

  /**
   * Get trust scores for multiple listings in batch
   */
  async getBatchListingTrustScores(listingIds: string[]): Promise<Map<string, TrustScore>> {
    const scores = new Map<string, TrustScore>();
    
    for (const listingId of listingIds) {
      try {
        const score = await this.calculateListingTrustScore(listingId);
        scores.set(listingId, score);
      } catch (error) {
        this.logger.warn(`Failed to calculate trust score for listing ${listingId}`, error);
      }
    }

    return scores;
  }
}
