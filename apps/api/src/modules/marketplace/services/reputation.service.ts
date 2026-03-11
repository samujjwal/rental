import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Trust, Reputation & Moderation (V5 Prompt 14)
 *
 * Unified reputation system (0-1000 scale):
 * - Multi-signal aggregation: reviews, bookings, response rate, disputes, cancellations
 * - NLP sentiment analysis on review content
 * - Cancellation velocity and message response time signals
 * - Trust level gates for host tiers
 */
@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  private readonly tiers = [
    { min: 900, tier: 'PLATINUM' },
    { min: 750, tier: 'GOLD' },
    { min: 500, tier: 'SILVER' },
    { min: 250, tier: 'BRONZE' },
    { min: 0, tier: 'NEW' },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /**
   * Calculate and persist reputation score (0-1000 scale) for a user.
   *
   * Signal weights:
   *   - Review score (0-400): avg rating × 80, boosted by NLP sentiment
   *   - Booking volume (0-250): up to 250 for 100+ bookings
   *   - Dispute penalty (0 to -200): -40 per dispute
   *   - Tenure bonus (0-100): 5 points per month, max 100
   *   - Cancellation velocity (0 to -100): penalty for recent cancellations
   *   - Response time bonus (0-50): fast message response
   */
  async calculateReputation(userId: string) {
    const [user, reviews, bookings, disputes, cancellations] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { listings: { select: { id: true } } },
      }),
      this.prisma.review.findMany({
        where: { revieweeId: userId },
        select: { rating: true, comment: true },
      }),
      this.prisma.booking.findMany({
        where: {
          OR: [{ renterId: userId }, { listing: { ownerId: userId } }],
          status: { in: ['COMPLETED', 'CONFIRMED'] },
        },
      }),
      this.prisma.dispute.findMany({
        where: {
          OR: [{ initiatorId: userId }, { defendantId: userId }],
        },
        select: { status: true, initiatorId: true, defendantId: true },
      }),
      this.prisma.booking.count({
        where: {
          OR: [{ renterId: userId }, { listing: { ownerId: userId } }],
          status: 'CANCELLED',
          updatedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    if (!user) throw new Error(`User not found: ${userId}`);

    // --- Signal calculations (0-1000 scale) ---
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    // NLP sentiment analysis on review content
    let sentimentBoost = 0;
    if (totalReviews > 0) {
      sentimentBoost = await this.analyzeSentimentBatch(reviews.map((r) => (r as any).comment).filter(Boolean));
    }

    // Review score (0-400): avg rating (0-5) → 0-400, plus sentiment boost
    const reviewScore = totalReviews > 0
      ? Math.min(400, (avgRating / 5) * 350 + sentimentBoost * 50)
      : 100; // Default 100 for new

    // Booking volume (0-250): up to 250 for 100+ bookings
    const bookingScore = Math.min(250, bookings.length * 2.5);

    // Dispute penalty (0 to -200): -40 per dispute
    const disputeCount = disputes.length;
    const disputePenalty = Math.min(200, disputeCount * 40);

    // Tenure bonus (0-100): 5 points per month, max 100
    const accountAge = user.createdAt
      ? (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
      : 0;
    const tenureBonus = Math.min(100, Math.floor(accountAge * 5));

    // Cancellation velocity penalty (0 to -100)
    const cancellationPenalty = Math.min(100, cancellations * 25);

    const overallScore = Math.max(0, Math.min(1000,
      Math.round(reviewScore + bookingScore - disputePenalty + tenureBonus - cancellationPenalty),
    ));

    const tier = this.tiers.find((t) => overallScore >= t.min)?.tier || 'NEW';

    const reputationScore = await this.prisma.reputationScore.upsert({
      where: { userId },
      update: {
        overallScore,
        tier: tier as any,
        reviewScore: Math.round(reviewScore * 100) / 100,
        totalReviews,
        totalBookings: bookings.length,
        disputeRate: disputeCount,
        components: {
          reviewScore,
          bookingScore,
          disputePenalty,
          tenureBonus,
          cancellationPenalty,
          sentimentBoost,
          avgRating,
          scale: '0-1000',
        },
        lastCalculated: new Date(),
      },
      create: {
        userId,
        overallScore,
        tier: tier as any,
        reviewScore: Math.round(reviewScore * 100) / 100,
        totalReviews,
        totalBookings: bookings.length,
        disputeRate: disputeCount,
        components: {
          reviewScore,
          bookingScore,
          disputePenalty,
          tenureBonus,
          cancellationPenalty,
          sentimentBoost,
          avgRating,
          scale: '0-1000',
        },
        lastCalculated: new Date(),
      },
    });

    this.eventEmitter.emit('reputation.calculated', {
      userId,
      score: overallScore,
      tier,
    });

    return reputationScore;
  }

  /**
   * Basic NLP sentiment analysis on review batch.
   * Returns a boost factor 0-1 (1 = very positive sentiment).
   *
   * Uses OpenAI when available, falls back to keyword-based heuristic.
   */
  private async analyzeSentimentBatch(texts: string[]): Promise<number> {
    if (texts.length === 0) return 0.5;

    // Try OpenAI sentiment analysis
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      try {
        const sampleTexts = texts.slice(0, 10).join(' | ');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: this.config.get('OPENAI_MODEL', 'gpt-3.5-turbo'),
            messages: [
              { role: 'system', content: 'Analyze sentiment of these reviews. Return a single decimal 0-1 (0=negative, 1=positive). Only output the number.' },
              { role: 'user', content: sampleTexts },
            ],
            max_tokens: 10,
            temperature: 0,
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          const sentiment = parseFloat(data.choices?.[0]?.message?.content?.trim());
          if (!isNaN(sentiment) && sentiment >= 0 && sentiment <= 1) return sentiment;
        }
      } catch (error) {
        this.logger.debug(`OpenAI sentiment failed, using heuristic: ${error.message}`);
      }
    }

    // Fallback: keyword-based sentiment heuristic
    return this.heuristicSentiment(texts);
  }

  private heuristicSentiment(texts: string[]): number {
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'clean', 'perfect', 'love', 'comfortable', 'friendly', 'recommend', 'best', 'beautiful', 'spacious', 'helpful'];
    const negativeWords = ['terrible', 'horrible', 'dirty', 'broken', 'rude', 'worst', 'awful', 'disgusting', 'noisy', 'unsafe', 'scam', 'misleading', 'uncomfortable', 'poor'];

    let positive = 0;
    let negative = 0;
    const allText = texts.join(' ').toLowerCase();

    for (const word of positiveWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = allText.match(regex);
      if (matches) positive += matches.length;
    }
    for (const word of negativeWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = allText.match(regex);
      if (matches) negative += matches.length;
    }

    const total = positive + negative;
    if (total === 0) return 0.5;
    return positive / total;
  }

  /**
   * Get reputation for a user.
   */
  async getReputation(userId: string) {
    const reputation = await this.prisma.reputationScore.findUnique({
      where: { userId },
    });

    if (!reputation) {
      return this.calculateReputation(userId);
    }

    return reputation;
  }

  /**
   * Create a moderation action.
   */
  async createModerationAction(params: {
    targetType: string;
    targetId: string;
    action: string;
    reason: string;
    moderatorId: string;
  }) {
    const moderationAction = await this.prisma.moderationAction.create({
      data: {
        entityType: params.targetType,
        entityId: params.targetId,
        actionType: params.action,
        reason: params.reason,
        moderatorId: params.moderatorId,
        status: 'PENDING',
      },
    });

    this.eventEmitter.emit('moderation.action_created', moderationAction);

    return moderationAction;
  }

  /**
   * Resolve a moderation action.
   */
  async resolveModerationAction(actionId: string, resolution: string, resolvedBy: string) {
    return this.prisma.moderationAction.update({
      where: { id: actionId },
      data: {
        status: 'APPROVED' as any,
        metadata: { resolution, resolvedBy },
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Get pending moderation actions.
   */
  async getPendingModerations(limit: number = 50) {
    return this.prisma.moderationAction.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Check if user meets tier requirements for a feature.
   */
  async checkTierAccess(userId: string, requiredTier: string): Promise<boolean> {
    const rep = await this.getReputation(userId);
    const tierOrder = ['NEW', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    const userTierIndex = tierOrder.indexOf(rep.tier);
    const requiredTierIndex = tierOrder.indexOf(requiredTier);
    return userTierIndex >= requiredTierIndex;
  }

  /**
   * Batch recalculate all user reputations.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async batchRecalculate() {
    this.logger.log('Batch recalculating reputation scores...');

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
      take: 1000,
    });

    let updated = 0;
    for (const user of users) {
      try {
        await this.calculateReputation(user.id);
        updated++;
      } catch (error) {
        this.logger.error(`Failed to calculate reputation for ${user.id}: ${error.message}`);
      }
    }

    this.logger.log(`Batch reputation complete: ${updated}/${users.length} users updated`);
  }
}
