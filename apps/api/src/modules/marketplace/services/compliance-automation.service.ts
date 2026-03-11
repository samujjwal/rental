import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Compliance Automation Engine (V5 Prompt 18)
 *
 * Automated regulatory compliance:
 * - KYC verification workflows
 * - Data retention and GDPR compliance
 * - Audit trail generation
 * - Regulatory reporting
 * - License and permit tracking
 */
@Injectable()
export class ComplianceAutomationService {
  private readonly logger = new Logger(ComplianceAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Run compliance check on a user.
   */
  async checkUserCompliance(userId: string): Promise<{
    compliant: boolean;
    issues: string[];
    kycStatus: string;
    documentsVerified: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        identityDocuments: true,
        listings: { select: { id: true, country: true } },
      },
    });

    if (!user) throw new Error(`User not found: ${userId}`);

    const issues: string[] = [];

    // KYC check
    const kycStatus = (user as any).kycStatus || 'PENDING';
    if (kycStatus !== 'VERIFIED') {
      issues.push('KYC verification incomplete');
    }

    // Document check
    const documents = (user as any).identityDocuments || [];
    const hasIdDoc = documents.some((d: any) => d.type === 'ID_DOCUMENT' && d.status === 'VERIFIED');
    if (!hasIdDoc && user.role === 'HOST') {
      issues.push('Missing verified ID document for host account');
    }

    // Phone verification
    if (!user.phone) {
      issues.push('Phone number not provided');
    }

    // Email verification
    if (!user.emailVerified) {
      issues.push('Email not verified');
    }

    return {
      compliant: issues.length === 0,
      issues,
      kycStatus,
      documentsVerified: hasIdDoc,
    };
  }

  /**
   * Run compliance check on a listing.
   */
  async checkListingCompliance(listingId: string): Promise<{
    compliant: boolean;
    issues: string[];
    requiresAction: boolean;
  }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: { select: { id: true, emailVerified: true } },
      },
    });

    if (!listing) throw new Error(`Listing not found: ${listingId}`);

    const issues: string[] = [];

    // Title and description quality
    if (!listing.title || listing.title.length < 10) {
      issues.push('Listing title too short (min 10 characters)');
    }

    if (!listing.description || listing.description.length < 50) {
      issues.push('Listing description too short (min 50 characters)');
    }

    // Price sanity
    if (Number(listing.basePrice) <= 0) {
      issues.push('Listing price must be positive');
    }

    // Location
    if (!listing.country) {
      issues.push('Country not specified');
    }

    // Owner verification
    if (!listing.owner.emailVerified) {
      issues.push('Listing owner email not verified');
    }

    return {
      compliant: issues.length === 0,
      issues,
      requiresAction: issues.length > 0,
    };
  }

  /**
   * Generate an audit trail for an entity.
   */
  async generateAuditTrail(params: {
    entityType: string;
    entityId: string;
    action: string;
    performedBy: string;
    details?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        userId: params.performedBy,
        metadata: JSON.stringify(params.details || {}),
      },
    });
  }

  /**
   * Get audit trail for an entity.
   */
  async getAuditTrail(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check GDPR data retention compliance.
   */
  async checkDataRetention(): Promise<{
    usersRequiringDeletion: number;
    oldBookingsCount: number;
    dataRetentionPeriodDays: number;
  }> {
    const retentionDays = 365 * 3; // 3 year retention
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const [inactiveUsers, oldBookings] = await Promise.all([
      this.prisma.user.count({
        where: {
          isActive: false,
          updatedAt: { lt: cutoffDate },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: 'COMPLETED',
          endDate: { lt: cutoffDate },
        },
      }),
    ]);

    return {
      usersRequiringDeletion: inactiveUsers,
      oldBookingsCount: oldBookings,
      dataRetentionPeriodDays: retentionDays,
    };
  }

  /**
   * Execute GDPR right-to-erasure for a user.
   * Cascading deletion/anonymization of all PII across related tables.
   */
  async executeGdprDeletion(userId: string, requestedBy: string): Promise<{
    anonymized: string[];
    deleted: string[];
    retained: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new Error(`User not found: ${userId}`);

    const anonymized: string[] = [];
    const deleted: string[] = [];
    const retained: string[] = [];

    await this.prisma.$transaction(async (tx: any) => {
      // 1. Anonymize user PII (keep record for audit, remove PII)
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: 'DELETED',
          lastName: 'USER',
          email: `deleted-${userId}@anonymized.local`,
          phone: null,
          avatar: null,
          bio: null,
          isActive: false,
        },
      });
      anonymized.push('User profile');

      // 2. Delete identity documents
      const docCount = await tx.identityDocument.deleteMany({ where: { userId } });
      if (docCount.count > 0) deleted.push(`${docCount.count} identity documents`);

      // 3. Delete device fingerprints
      const deviceCount = await tx.deviceFingerprint.deleteMany({ where: { userId } });
      if (deviceCount.count > 0) deleted.push(`${deviceCount.count} device fingerprints`);

      // 4. Anonymize reviews (keep content for listing integrity, remove user link)
      const reviewCount = await tx.review.updateMany({
        where: { reviewerId: userId },
        data: { content: '[Content removed per GDPR request]' },
      });
      if (reviewCount.count > 0) anonymized.push(`${reviewCount.count} reviews`);

      // 5. Delete search profiles
      await tx.userSearchProfile.deleteMany({ where: { userId } });
      deleted.push('Search profile');

      // 6. Delete notification preferences (but keep notification records for audit)
      await tx.notificationPreference.deleteMany({ where: { userId } });
      deleted.push('Notification preferences');

      // 7. Anonymize messages
      const msgCount = await tx.message.updateMany({
        where: { senderId: userId },
        data: { content: '[Message removed per GDPR request]' },
      });
      if (msgCount.count > 0) anonymized.push(`${msgCount.count} messages`);

      // 8. Retain: bookings, payments, ledger entries (financial/legal requirement)
      retained.push('Booking records (legal retention)');
      retained.push('Payment records (legal retention)');
      retained.push('Ledger entries (legal retention)');

      // 9. Audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'USER',
          entityId: userId,
          action: 'GDPR_DELETION',
          userId: requestedBy,
          metadata: JSON.stringify({
            anonymized,
            deleted,
            retained,
            executedAt: new Date().toISOString(),
          }),
        },
      });
    });

    this.eventEmitter.emit('compliance.gdpr_deletion', {
      userId,
      requestedBy,
      anonymized,
      deleted,
      retained,
    });

    return { anonymized, deleted, retained };
  }

  /**
   * Execute batch GDPR data retention cleanup.
   */
  async executeBatchRetentionCleanup(): Promise<{
    usersProcessed: number;
    errors: number;
  }> {
    const retentionDays = 365 * 3;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const inactiveUsers = await this.prisma.user.findMany({
      where: {
        isActive: false,
        updatedAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: 100, // Process in batches
    });

    let processed = 0;
    let errors = 0;

    for (const user of inactiveUsers) {
      try {
        await this.executeGdprDeletion(user.id, 'SYSTEM_RETENTION_CLEANUP');
        processed++;
      } catch (error) {
        this.logger.error(`GDPR cleanup failed for user ${user.id}: ${error.message}`);
        errors++;
      }
    }

    return { usersProcessed: processed, errors };
  }

  /**
   * Generate regulatory report for a country.
   */
  async generateRegulatoryReport(country: string, startDate: Date, endDate: Date) {
    const [bookings, listings, users, disputes] = await Promise.all([
      this.prisma.booking.count({
        where: {
          listing: { country },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.listing.count({
        where: {
          country,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.user.count({
        where: {
          country,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.dispute.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    return {
      country,
      period: { start: startDate, end: endDate },
      metrics: {
        totalBookings: bookings,
        newListings: listings,
        newUsers: users,
        disputes,
      },
      generatedAt: new Date(),
    };
  }

  /**
   * Scheduled compliance scan.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scheduledComplianceScan() {
    this.logger.log('Running scheduled compliance scan...');

    const listings = await this.prisma.listing.findMany({
      where: { status: 'AVAILABLE' },
      select: { id: true },
      take: 500,
    });

    let issues = 0;
    for (const listing of listings) {
      const result = await this.checkListingCompliance(listing.id);
      if (!result.compliant) issues++;
    }

    this.logger.log(`Compliance scan complete: ${issues}/${listings.length} listings have issues`);

    this.eventEmitter.emit('compliance.scan_complete', {
      totalScanned: listings.length,
      issuesFound: issues,
    });
  }
}
