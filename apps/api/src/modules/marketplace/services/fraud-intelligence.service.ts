import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Fraud Intelligence Platform (V5 Prompt 8)
 *
 * Enterprise fraud detection:
 * - Abnormal booking patterns
 * - Payment risk signals
 * - Device fingerprinting
 * - Geographic anomalies
 */
@Injectable()
export class FraudIntelligenceService {
  private readonly logger = new Logger(FraudIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Analyze an entity for fraud risk and create signals.
   * Also supports checkout orchestrator format via overload.
   */
  async analyzeRisk(
    entityTypeOrParams: string | { userId: string; action: string; amount?: number; metadata?: Record<string, any> },
    entityId?: string,
    context: {
      userId?: string;
      ipAddress?: string;
      deviceFingerprint?: string;
      amount?: number;
      country?: string;
    } = {},
  ): Promise<{
    overallRisk: number;
    riskScore: number;
    signals: Array<{ type: string; score: number; description: string }>;
    recommendation: string;
    decision: string;
  }> {
    // Support checkout orchestrator call format
    let entityType: string;
    let eId: string;
    let ctx = context;

    if (typeof entityTypeOrParams === 'object') {
      entityType = entityTypeOrParams.action || 'BOOKING';
      eId = entityTypeOrParams.userId;
      ctx = {
        userId: entityTypeOrParams.userId,
        amount: entityTypeOrParams.amount,
        ...entityTypeOrParams.metadata,
      };
    } else {
      entityType = entityTypeOrParams;
      eId = entityId || 'unknown';
    }
    const signals: Array<{ type: string; score: number; description: string }> = [];

    // Check velocity (too many actions in short time)
    if (ctx.userId) {
      const velocitySignal = await this.checkVelocity(ctx.userId, entityType);
      if (velocitySignal) signals.push(velocitySignal);
    }

    // Check device fingerprint
    if (ctx.deviceFingerprint && ctx.userId) {
      const deviceSignal = await this.checkDeviceFingerprint(
        ctx.userId,
        ctx.deviceFingerprint,
        ctx.ipAddress,
      );
      if (deviceSignal) signals.push(deviceSignal);
    }

    // Check geographic anomaly
    if (ctx.ipAddress && ctx.userId) {
      const geoSignal = await this.checkGeoAnomaly(ctx.userId, ctx.country);
      if (geoSignal) signals.push(geoSignal);
    }

    // Check payment risk
    if (ctx.amount) {
      const paymentSignal = this.checkPaymentRisk(ctx.amount);
      if (paymentSignal) signals.push(paymentSignal);
    }

    // Compute overall risk
    const overallRisk = signals.length > 0
      ? Math.min(100, signals.reduce((sum, s) => sum + s.score, 0) / signals.length * 1.2)
      : 0;

    // Save fraud signals
    for (const signal of signals) {
      await this.prisma.fraudSignal.create({
        data: {
          entityType,
          entityId: eId,
          signalType: signal.type,
          riskScore: signal.score,
          description: signal.description,
          evidence: { context: ctx },
          deviceFingerprint: ctx.deviceFingerprint,
          ipAddress: ctx.ipAddress,
        },
      });
    }

    // Determine recommendation and decision
    let recommendation = 'ALLOW';
    let decision = 'ALLOW';
    if (overallRisk > 80) { recommendation = 'BLOCK'; decision = 'BLOCK'; }
    else if (overallRisk > 50) { recommendation = 'REVIEW'; decision = 'REVIEW'; }
    else if (overallRisk > 30) { recommendation = 'FLAG'; decision = 'ALLOW'; }

    if (overallRisk > 50) {
      this.eventEmitter.emit('fraud.high_risk', {
        entityType,
        entityId: eId,
        overallRisk,
        signals,
      });
    }

    return { overallRisk, riskScore: overallRisk, signals, recommendation, decision };
  }

  /**
   * Register a device fingerprint for a user.
   */
  async registerDevice(
    userId: string,
    fingerprint: string,
    metadata: {
      userAgent?: string;
      platform?: string;
      screenRes?: string;
      timezone?: string;
      language?: string;
      ipAddress?: string;
    } = {},
  ) {
    return this.prisma.deviceFingerprint.upsert({
      where: { userId_fingerprint: { userId, fingerprint } },
      update: {
        lastSeen: new Date(),
        userAgent: metadata.userAgent,
        ipAddresses: metadata.ipAddress
          ? { push: metadata.ipAddress } as any
          : undefined,
      },
      create: {
        userId,
        fingerprint,
        userAgent: metadata.userAgent,
        platform: metadata.platform,
        screenRes: metadata.screenRes,
        timezone: metadata.timezone,
        language: metadata.language,
        ipAddresses: metadata.ipAddress ? [metadata.ipAddress] : [],
        trustLevel: 'UNKNOWN',
      },
    });
  }

  /**
   * Get fraud signals for an entity.
   */
  async getSignals(entityType: string, entityId: string) {
    return this.prisma.fraudSignal.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resolve a fraud signal.
   */
  async resolveSignal(signalId: string, resolvedBy: string) {
    return this.prisma.fraudSignal.update({
      where: { id: signalId },
      data: { resolved: true, resolvedBy, resolvedAt: new Date() },
    });
  }

  /**
   * Get aggregated risk score for a user.
   */
  async getUserRiskScore(userId: string): Promise<{
    riskScore: number;
    signalCount: number;
    unresolvedCount: number;
    deviceCount: number;
  }> {
    const [signals, unresolvedSignals, devices] = await Promise.all([
      this.prisma.fraudSignal.findMany({
        where: { entityType: 'USER', entityId: userId },
      }),
      this.prisma.fraudSignal.count({
        where: { entityType: 'USER', entityId: userId, resolved: false },
      }),
      this.prisma.deviceFingerprint.count({
        where: { userId },
      }),
    ]);

    const avgRisk = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.riskScore, 0) / signals.length
      : 0;

    return {
      riskScore: Math.round(avgRisk * 100) / 100,
      signalCount: signals.length,
      unresolvedCount: unresolvedSignals,
      deviceCount: devices,
    };
  }

  // ── Internal checks ───────────────────────────────────

  private async checkVelocity(
    userId: string,
    entityType: string,
  ): Promise<{ type: string; score: number; description: string } | null> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentActions = await this.prisma.fraudSignal.count({
      where: {
        entityType,
        evidence: { path: ['context', 'userId'], equals: userId },
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentActions > 10) {
      return {
        type: 'VELOCITY',
        score: Math.min(90, recentActions * 5),
        description: `${recentActions} signals in the last hour for ${entityType}`,
      };
    }
    return null;
  }

  private async checkDeviceFingerprint(
    userId: string,
    fingerprint: string,
    ipAddress?: string,
  ): Promise<{ type: string; score: number; description: string } | null> {
    const devices = await this.prisma.deviceFingerprint.findMany({
      where: { userId },
    });

    // Multiple devices is suspicious if > 5
    if (devices.length > 5) {
      return {
        type: 'DEVICE_FINGERPRINT',
        score: 40 + (devices.length - 5) * 10,
        description: `User has ${devices.length} registered devices`,
      };
    }

    // Unknown device
    const known = devices.find((d) => d.fingerprint === fingerprint);
    if (!known && devices.length > 0) {
      return {
        type: 'DEVICE_FINGERPRINT',
        score: 25,
        description: 'Transaction from unrecognized device',
      };
    }

    return null;
  }

  private async checkGeoAnomaly(
    userId: string,
    country?: string,
  ): Promise<{ type: string; score: number; description: string } | null> {
    if (!country) return null;

    // Check user's usual country
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });

    if (user?.country && user.country !== country) {
      return {
        type: 'GEO_ANOMALY',
        score: 35,
        description: `Action from ${country}, user registered in ${user.country}`,
      };
    }

    return null;
  }

  private checkPaymentRisk(
    amount: number,
  ): { type: string; score: number; description: string } | null {
    // Unusual amounts
    if (amount > 500000) {
      return {
        type: 'PAYMENT_RISK',
        score: 50,
        description: `High-value transaction: ${amount}`,
      };
    }
    if (amount <= 0) {
      return {
        type: 'PAYMENT_RISK',
        score: 70,
        description: `Invalid or zero-amount transaction: ${amount}`,
      };
    }
    return null;
  }
}
