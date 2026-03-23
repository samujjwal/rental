/**
 * Fraud Scoring Service (rule-based heuristics)
 *
 * Despite the "ML" name, scoring is currently implemented as a weighted
 * rule-based heuristic across deterministic factors (account age, transaction
 * velocity, device trust, IP reputation, etc.). No external ML model is
 * connected.
 *
 * To connect a live model:
 *   1. Set ML_FRAUD_ENDPOINT and ML_FRAUD_API_KEY in your environment.
 *   2. Replace the per-factor scoring methods below with a single call to
 *      the model API, passing the TransactionContext as the feature vector.
 *   3. Map the model's probability output to the 0–100 score scale used here.
 *
 * Until integrated, the rule-based scores provide reasonable fraud signal
 * and should be treated as a heuristic, not an ML prediction.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface FraudScore {
  userId: string;
  score: number; // 0-100, higher is more suspicious
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: FraudFactor[];
  recommendations: string[];
  timestamp: Date;
}

export interface FraudFactor {
  name: string;
  weight: number;
  description: string;
  value: any;
}

export interface TransactionContext {
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  bookingId?: string;
  listingId?: string;
}

@Injectable()
export class MlFraudDetectionService {
  private readonly logger = new Logger(MlFraudDetectionService.name);
  private readonly modelEndpoint: string;
  private readonly apiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.modelEndpoint = this.config.get('ML_FRAUD_ENDPOINT', '');
    this.apiKey = this.config.get('ML_FRAUD_API_KEY', '');
  }

  /**
   * Analyze transaction for fraud risk
   */
  async analyzeTransaction(context: TransactionContext): Promise<FraudScore> {
    const factors: FraudFactor[] = [];
    let totalScore = 0;

    // Factor 1: User behavior analysis
    const userBehaviorScore = await this.analyzeUserBehavior(context.userId);
    factors.push({
      name: 'user_behavior',
      weight: 0.25,
      description: 'User behavioral patterns',
      value: userBehaviorScore,
    });
    totalScore += userBehaviorScore * 0.25;

    // Factor 2: Device fingerprint analysis
    const deviceScore = await this.analyzeDevice(context.deviceFingerprint, context.userId);
    factors.push({
      name: 'device_trust',
      weight: 0.20,
      description: 'Device trust score',
      value: deviceScore,
    });
    totalScore += deviceScore * 0.20;

    // Factor 3: Transaction velocity
    const velocityScore = await this.analyzeVelocity(context);
    factors.push({
      name: 'transaction_velocity',
      weight: 0.20,
      description: 'Transaction frequency patterns',
      value: velocityScore,
    });
    totalScore += velocityScore * 0.20;

    // Factor 4: Amount anomaly detection
    const amountScore = await this.analyzeAmountAnomaly(context);
    factors.push({
      name: 'amount_anomaly',
      weight: 0.15,
      description: 'Unusual transaction amount',
      value: amountScore,
    });
    totalScore += amountScore * 0.15;

    // Factor 5: IP reputation
    const ipScore = await this.analyzeIPReputation(context.ipAddress);
    factors.push({
      name: 'ip_reputation',
      weight: 0.10,
      description: 'IP address reputation',
      value: ipScore,
    });
    totalScore += ipScore * 0.10;

    // Factor 6: Payment method risk
    const paymentScore = await this.analyzePaymentMethod(context);
    factors.push({
      name: 'payment_risk',
      weight: 0.10,
      description: 'Payment method risk score',
      value: paymentScore,
    });
    totalScore += paymentScore * 0.10;

    const finalScore = Math.round(totalScore * 100);
    const riskLevel = this.scoreToRiskLevel(finalScore);

    const score: FraudScore = {
      userId: context.userId,
      score: finalScore,
      riskLevel,
      factors,
      recommendations: this.generateRecommendations(finalScore, factors),
      timestamp: new Date(),
    };

    // Store fraud score
    await this.storeFraudScore(score);

    this.logger.debug(`Fraud analysis for ${context.userId}: ${finalScore}/100 (${riskLevel})`);

    return score;
  }

  /**
   * Check if action should be blocked
   */
  shouldBlock(score: FraudScore): boolean {
    return score.riskLevel === 'CRITICAL' || 
           (score.riskLevel === 'HIGH' && this.hasCriticalFactors(score));
  }

  /**
   * Check if additional verification required
   */
  requiresVerification(score: FraudScore): boolean {
    return score.riskLevel === 'HIGH' || score.riskLevel === 'MEDIUM';
  }

  // ============================================================================
  // ML Model Inference (simplified - would call actual ML service)
  // ============================================================================

  private async analyzeUserBehavior(userId: string): Promise<number> {
    // Get user's recent activity
    const [recentBookings, totalBookings, disputes] = await Promise.all([
      this.prisma.booking.count({
        where: { renterId: userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.booking.count({ where: { renterId: userId } }),
      this.prisma.dispute.count({ where: { initiatorId: userId } }),
    ]);

    let score = 0;

    // New users are slightly riskier
    if (totalBookings === 0) score += 0.3;
    
    // Too many bookings in 24h is suspicious
    if (recentBookings > 5) score += 0.4;

    // Users with disputes are riskier
    if (disputes > 2) score += 0.3;

    // Users with completed bookings without issues are trusted
    const completedBookings = await this.prisma.booking.count({
      where: { renterId: userId, status: 'COMPLETED' },
    });
    if (completedBookings > 5) score -= 0.3;

    return Math.max(0, Math.min(1, score));
  }

  private async analyzeDevice(deviceFingerprint: string, userId: string): Promise<number> {
    // Check if device is known to user
    const knownDevice = await this.prisma.deviceFingerprint.findFirst({
      where: { fingerprint: deviceFingerprint, userId },
    });

    if (knownDevice) {
      // Known device - check trust score
      const sessions = await this.prisma.session.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      });
      
      // More sessions = more trusted
      return Math.max(0, 0.5 - (sessions * 0.05));
    }

    // New device is slightly suspicious
    return 0.6;
  }

  private async analyzeVelocity(context: TransactionContext): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count recent transactions
    const recentPayments = await this.prisma.payment.count({
      where: {
        booking: { renterId: context.userId },
        createdAt: { gte: oneHourAgo },
      },
    });

    let score = 0;
    
    // More than 3 payments in an hour is suspicious
    if (recentPayments > 3) score += 0.5;
    if (recentPayments > 5) score += 0.3;

    // Check for rapid-fire attempts (failed payments)
    const recentFailed = await this.prisma.payment.count({
      where: {
        booking: { renterId: context.userId },
        createdAt: { gte: oneHourAgo },
        status: 'FAILED',
      },
    });

    if (recentFailed > 2) score += 0.4;

    return Math.min(1, score);
  }

  private async analyzeAmountAnomaly(context: TransactionContext): Promise<number> {
    // Get user's average transaction amount
    const avgResult = await this.prisma.payment.aggregate({
      where: { booking: { renterId: context.userId }, status: 'SUCCEEDED' },
      _avg: { amount: true },
    });

    const avgAmount = (avgResult as any)._avg.amount || 0;

    if (avgAmount === 0) {
      // No history - moderate risk for large first transaction
      return context.amount > 5000 ? 0.6 : 0.3;
    }

    // Check if amount is unusual compared to history
    const ratio = context.amount / avgAmount;
    
    if (ratio > 5) return 0.7; // 5x normal amount
    if (ratio > 3) return 0.5; // 3x normal amount
    if (ratio > 2) return 0.3; // 2x normal amount

    return 0.1;
  }

  private async analyzeIPReputation(ipAddress: string): Promise<number> {
    // Check for VPN/proxy/tor
    const suspiciousIPs = await this.prisma.auditLog.count({
      where: {
        ipAddress,
        action: { in: ['SUSPICIOUS_LOGIN', 'RATE_LIMIT_EXCEEDED', 'PAYMENT_FAILED'] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    if (suspiciousIPs > 10) return 0.8;
    if (suspiciousIPs > 5) return 0.5;
    if (suspiciousIPs > 2) return 0.3;

    // Check IP geolocation consistency
    // (Would integrate with IP geolocation service)
    return 0.2;
  }

  private async analyzePaymentMethod(context: TransactionContext): Promise<number> {
    // Check if payment method is new
    const existingPayments = await this.prisma.payment.count({
      where: {
        booking: { renterId: context.userId },
        paymentMethod: context.paymentMethod,
        status: 'SUCCEEDED',
      },
    });

    // New payment method is slightly riskier
    if (existingPayments === 0) return 0.5;
    if (existingPayments < 3) return 0.3;

    return 0.1;
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private scoreToRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  private hasCriticalFactors(score: FraudScore): boolean {
    return score.factors.some(f => 
      (f.name === 'transaction_velocity' && f.value > 0.7) ||
      (f.name === 'ip_reputation' && f.value > 0.7)
    );
  }

  private generateRecommendations(score: number, factors: FraudFactor[]): string[] {
    const recommendations: string[] = [];

    if (score >= 80) {
      recommendations.push('Block transaction and review manually');
      recommendations.push('Contact user via verified phone');
    } else if (score >= 60) {
      recommendations.push('Require additional verification (3DS/SCA)');
      recommendations.push('Send notification to user');
    } else if (score >= 40) {
      recommendations.push('Monitor transaction closely');
    }

    // Factor-specific recommendations
    const velocityFactor = factors.find(f => f.name === 'transaction_velocity');
    if (velocityFactor && velocityFactor.value > 0.6) {
      recommendations.push('Implement rate limiting for this user');
    }

    const deviceFactor = factors.find(f => f.name === 'device_trust');
    if (deviceFactor && deviceFactor.value > 0.5) {
      recommendations.push('Require device verification');
    }

    return recommendations;
  }

  private async storeFraudScore(score: FraudScore): Promise<void> {
    const fraudScoreDelegate = (this.prisma as any).fraudScore;
    if (!fraudScoreDelegate) {
      return;
    }

    await fraudScoreDelegate.create({
      data: {
        userId: score.userId,
        score: score.score,
        riskLevel: score.riskLevel,
        factors: JSON.stringify(score.factors),
        timestamp: score.timestamp,
      },
    });
  }

  /**
   * Get fraud trends for analytics
   */
  async getFraudTrends(days: number = 30): Promise<{
    totalTransactions: number;
    flaggedTransactions: number;
    blockedTransactions: number;
    averageScore: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const fraudScoreDelegate = (this.prisma as any).fraudScore;
    if (!fraudScoreDelegate) {
      return {
        totalTransactions: 0,
        flaggedTransactions: 0,
        blockedTransactions: 0,
        averageScore: 0,
        trend: 'stable',
      };
    }

    const scores = await fraudScoreDelegate.findMany({
      where: { timestamp: { gte: since } },
    }) as Array<{ score: number }>;

    if (scores.length === 0) {
      return {
        totalTransactions: 0,
        flaggedTransactions: 0,
        blockedTransactions: 0,
        averageScore: 0,
        trend: 'stable',
      };
    }

    const totalTransactions = scores.length;
    const flaggedTransactions = scores.filter((scoreRecord) => scoreRecord.score >= 60).length;
    const blockedTransactions = scores.filter((scoreRecord) => scoreRecord.score >= 80).length;
    const averageScore = scores.reduce((sum: number, scoreRecord) => sum + scoreRecord.score, 0) / scores.length;

    // Calculate trend (compare first half vs second half)
    const midPoint = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, midPoint);
    const secondHalf = scores.slice(midPoint);
    
    const firstAvg = firstHalf.reduce((sum: number, scoreRecord) => sum + scoreRecord.score, 0) / firstHalf.length || 0;
    const secondAvg = secondHalf.reduce((sum: number, scoreRecord) => sum + scoreRecord.score, 0) / secondHalf.length || 0;
    
    const diff = secondAvg - firstAvg;
    const trend = diff > 5 ? 'increasing' : diff < -5 ? 'decreasing' : 'stable';

    return {
      totalTransactions,
      flaggedTransactions,
      blockedTransactions,
      averageScore,
      trend,
    };
  }
}
