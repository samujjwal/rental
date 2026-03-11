import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FraudDetectionService, RiskLevel } from './fraud-detection.service';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Event-driven fraud detection listeners.
 * Decouples fraud checks from auth/listing/payment modules
 * by listening to domain events instead of direct injection.
 */
@Injectable()
export class FraudEventListenerService {
  private readonly logger = new Logger(FraudEventListenerService.name);

  constructor(
    private readonly fraudService: FraudDetectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * On user registration, perform a baseline risk check.
   * Flag accounts from suspicious patterns (rapid signups, disposable emails).
   */
  @OnEvent('user.registered', { async: true })
  async onUserRegistered(payload: { userId: string; email: string }) {
    try {
      const result = await this.fraudService.checkUserRisk(payload.userId);

      if (result.riskScore >= 70) {
        this.logger.warn(
          `High-risk registration detected for user ${payload.userId}: score=${result.riskScore}, flags=${result.flags.map((f) => f.type).join(',')}`,
        );

        // Log audit entry for high-risk registrations
        await this.prisma.auditLog.create({
          data: {
            userId: payload.userId,
            action: 'HIGH_RISK_REGISTRATION',
            entityType: 'User',
            entityId: payload.userId,
            metadata: JSON.stringify({
              riskScore: result.riskScore,
              riskLevel: result.riskLevel,
              flags: result.flags,
            }),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Fraud check failed for registration ${payload.userId}`, error);
    }
  }

  /**
   * On listing creation, perform listing fraud check.
   * Catches spam listings, suspiciously low prices, missing photos.
   */
  @OnEvent('listing.created', { async: true })
  async onListingCreated(payload: { listingId: string; ownerId: string }) {
    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: payload.listingId },
        select: {
          id: true,
          title: true,
          description: true,
          basePrice: true,
          photos: true,
          ownerId: true,
          categoryId: true,
        },
      });

      if (!listing) return;

      const result = await this.fraudService.performListingFraudCheck({
        userId: listing.ownerId,
        title: listing.title,
        description: listing.description || '',
        basePrice: Number(listing.basePrice),
        photos: listing.photos || [],
      });

      if (result.riskLevel === RiskLevel.HIGH || result.riskLevel === RiskLevel.CRITICAL) {
        this.logger.warn(
          `High-risk listing detected: ${listing.id}, score=${result.riskScore}`,
        );
      }
    } catch (error) {
      this.logger.error(`Fraud check failed for listing ${payload.listingId}`, error);
    }
  }

  /**
   * On payment processed, perform payment fraud check.
   * Catches suspicious payment patterns, new payment methods, velocity.
   */
  @OnEvent('payment.processed', { async: true })
  async onPaymentProcessed(payload: {
    paymentId: string;
    bookingId: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
  }) {
    try {
      // Only check successful payments
      if (payload.status !== 'COMPLETED' && payload.status !== 'SUCCEEDED') return;

      const result = await this.fraudService.checkPaymentRisk({
        userId: payload.userId,
        paymentMethodId: payload.paymentId,
        amount: payload.amount,
      });

      if (result.riskScore >= 60) {
        this.logger.warn(
          `Suspicious payment detected: booking=${payload.bookingId}, score=${result.riskScore}`,
        );

        await this.prisma.auditLog.create({
          data: {
            userId: payload.userId,
            action: 'SUSPICIOUS_PAYMENT',
            entityType: 'Payment',
            entityId: payload.paymentId,
            metadata: JSON.stringify({
              bookingId: payload.bookingId,
              amount: payload.amount,
              currency: payload.currency,
              riskScore: result.riskScore,
              riskLevel: result.riskLevel,
              flags: result.flags,
            }),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Fraud check failed for payment ${payload.paymentId}`, error);
    }
  }
}
