import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { ImageModerationService } from './image-moderation.service';
import { TextModerationService } from './text-moderation.service';
import { ModerationQueueService } from './moderation-queue.service';

export enum ModerationStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}

export interface ModerationResult {
  status: ModerationStatus;
  confidence: number; // 0-1
  flags: ModerationFlag[];
  requiresHumanReview: boolean;
  blockedReasons?: string[];
}

export interface ModerationFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  description: string;
  details?: any;
}

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly imageModerationService: ImageModerationService,
    private readonly textModerationService: TextModerationService,
    private readonly moderationQueueService: ModerationQueueService,
  ) {}

  /**
   * Moderate listing content (text + images)
   */
  async moderateListing(listingData: {
    title: string;
    description: string;
    photos: string[];
    userId: string;
  }): Promise<ModerationResult> {
    const flags: ModerationFlag[] = [];
    let totalConfidence = 0;
    let flagCount = 0;

    try {
      // 1. Moderate text content
      const textResult = await this.textModerationService.moderateText(
        `${listingData.title} ${listingData.description}`,
      );

      if (textResult.flags.length > 0) {
        flags.push(...textResult.flags);
        totalConfidence += textResult.confidence;
        flagCount++;
      }

      // 2. Moderate images
      for (const photoUrl of listingData.photos) {
        const imageResult = await this.imageModerationService.moderateImage(photoUrl);
        if (imageResult.flags.length > 0) {
          flags.push(...imageResult.flags);
          totalConfidence += imageResult.confidence;
          flagCount++;
        }
      }

      // 3. Calculate overall result
      const averageConfidence = flagCount > 0 ? totalConfidence / flagCount : 1;
      const hasCriticalFlags = flags.some((f) => f.severity === 'CRITICAL');
      const hasHighFlags = flags.some((f) => f.severity === 'HIGH');

      let status: ModerationStatus;
      let requiresHumanReview = false;

      if (hasCriticalFlags) {
        status = ModerationStatus.REJECTED;
      } else if (hasHighFlags || flags.length > 3) {
        status = ModerationStatus.FLAGGED;
        requiresHumanReview = true;
      } else if (flags.length > 0) {
        status = ModerationStatus.PENDING;
        requiresHumanReview = true;
      } else {
        status = ModerationStatus.APPROVED;
      }

      // 4. Queue for human review if needed
      if (requiresHumanReview) {
        await this.moderationQueueService.addToQueue({
          entityType: 'LISTING',
          entityId: listingData.userId,
          flags,
          priority: hasCriticalFlags ? 'HIGH' : hasHighFlags ? 'MEDIUM' : 'LOW',
        });
      }

      // 5. Log moderation result
      await this.logModerationResult('LISTING', listingData.userId, {
        status,
        confidence: averageConfidence,
        flags,
        requiresHumanReview,
      });

      return {
        status,
        confidence: averageConfidence,
        flags,
        requiresHumanReview,
        blockedReasons: hasCriticalFlags ? flags.map((f) => f.description) : undefined,
      };
    } catch (error) {
      this.logger.error('Content moderation error', error);
      // Fail open - allow content but flag for review
      return {
        status: ModerationStatus.PENDING,
        confidence: 0,
        flags: [
          {
            type: 'MODERATION_ERROR',
            severity: 'MEDIUM',
            confidence: 1,
            description: 'Moderation service error',
          },
        ],
        requiresHumanReview: true,
      };
    }
  }

  /**
   * Moderate user profile
   */
  async moderateProfile(profileData: {
    bio?: string;
    profilePhotoUrl?: string;
    userId: string;
  }): Promise<ModerationResult> {
    const flags: ModerationFlag[] = [];

    // Check bio for inappropriate content
    if (profileData.bio) {
      const textResult = await this.textModerationService.moderateText(profileData.bio);
      flags.push(...textResult.flags);
    }

    // Check profile photo
    if (profileData.profilePhotoUrl) {
      const imageResult = await this.imageModerationService.moderateImage(
        profileData.profilePhotoUrl,
      );
      flags.push(...imageResult.flags);
    }

    const hasCriticalFlags = flags.some((f) => f.severity === 'CRITICAL');
    const status = hasCriticalFlags
      ? ModerationStatus.REJECTED
      : flags.length > 0
        ? ModerationStatus.FLAGGED
        : ModerationStatus.APPROVED;

    return {
      status,
      confidence: flags.length > 0 ? 0.8 : 1,
      flags,
      requiresHumanReview: flags.length > 0,
    };
  }

  /**
   * Moderate message content
   */
  async moderateMessage(messageText: string): Promise<ModerationResult> {
    // Check for PII (phone numbers, emails)
    const piiResult = await this.textModerationService.detectPII(messageText);

    // Check for inappropriate content
    const textResult = await this.textModerationService.moderateText(messageText);

    const flags = [...piiResult.flags, ...textResult.flags];
    const hasCritical = flags.some((f) => f.severity === 'CRITICAL');

    return {
      status: hasCritical ? ModerationStatus.REJECTED : ModerationStatus.APPROVED,
      confidence: 0.9,
      flags,
      requiresHumanReview: false,
      blockedReasons: hasCritical ? ['Message contains prohibited content'] : undefined,
    };
  }

  /**
   * Moderate review content
   */
  async moderateReview(reviewData: {
    title?: string;
    content: string;
    rating: number;
  }): Promise<ModerationResult> {
    const textResult = await this.textModerationService.moderateText(
      `${reviewData.title || ''} ${reviewData.content}`,
    );

    // Additional check: suspicious if 1-star review with no explanation
    if (reviewData.rating === 1 && reviewData.content.length < 50) {
      textResult.flags.push({
        type: 'SUSPICIOUS_REVIEW',
        severity: 'LOW',
        confidence: 0.6,
        description: 'Very low rating with minimal explanation',
      });
    }

    return {
      status: textResult.flags.length > 0 ? ModerationStatus.FLAGGED : ModerationStatus.APPROVED,
      confidence: textResult.confidence,
      flags: textResult.flags,
      requiresHumanReview: textResult.flags.length > 0,
    };
  }

  /**
   * Get moderation queue for admin review
   */
  async getModerationQueue(filters?: {
    status?: ModerationStatus;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    entityType?: string;
  }): Promise<any[]> {
    return this.moderationQueueService.getQueue(filters);
  }

  /**
   * Approve flagged content (admin action)
   */
  async approveContent(
    entityType: string,
    entityId: string,
    adminId: string,
    notes?: string,
  ): Promise<void> {
    await this.moderationQueueService.resolveItem(entityId, 'APPROVED', adminId, notes);

    await this.prisma.auditLog.create({
      data: {
        action: 'CONTENT_APPROVED',
        entityType,
        entityId,
        userId: adminId,
        metadata: { notes },
      },
    });
  }

  /**
   * Reject flagged content (admin action)
   */
  async rejectContent(
    entityType: string,
    entityId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    await this.moderationQueueService.resolveItem(entityId, 'REJECTED', adminId, reason);

    await this.prisma.auditLog.create({
      data: {
        action: 'CONTENT_REJECTED',
        entityType,
        entityId,
        userId: adminId,
        metadata: { reason },
      },
    });
  }

  /**
   * Log moderation result
   */
  private async logModerationResult(
    entityType: string,
    entityId: string,
    result: ModerationResult,
  ): Promise<void> {
    if (result.flags.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          action: 'CONTENT_MODERATED',
          entityType,
          entityId,
          metadata: {
            status: result.status,
            flags: result.flags,
            confidence: result.confidence,
          } as any,
        },
      });
    }
  }

  /**
   * Get user's moderation history
   */
  async getUserModerationHistory(userId: string): Promise<any> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId,
        action: { in: ['CONTENT_MODERATED', 'CONTENT_REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalViolations = logs.filter((l) => l.action === 'CONTENT_REJECTED').length;
    const recentViolations = logs.filter(
      (l) =>
        l.action === 'CONTENT_REJECTED' &&
        l.createdAt > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    ).length;

    return {
      totalViolations,
      recentViolations,
      logs: logs.slice(0, 10),
      riskLevel: recentViolations > 3 ? 'HIGH' : recentViolations > 1 ? 'MEDIUM' : 'LOW',
    };
  }
}
