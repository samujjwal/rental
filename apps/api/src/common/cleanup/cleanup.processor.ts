/**
 * Cleanup Queue Processor
 *
 * Handles periodic maintenance tasks:
 * - expire-sessions: Remove expired user sessions
 * - cleanup-audit-logs: Archive old audit logs
 * - expire-deposits: Release expired deposit holds
 * - recalculate-trust-scores: Batch update trust/reputation scores
 * - cleanup-stale-bookings: Cancel stale draft/pending bookings
 */
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@/common/prisma/prisma.service';

import { AuditArchivalService } from '@/common/audit/audit-archival.service';

interface CleanupJob {
  olderThanDays?: number;
  batchSize?: number;
}

@Processor('cleanup')
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditArchival: AuditArchivalService,
  ) {}

  @Process('expire-sessions')
  async handleExpireSessions(job: Job<CleanupJob>): Promise<{ deleted: number }> {
    this.logger.log('Running session cleanup');

    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return { deleted: result.count };
  }

  @Process('cleanup-audit-logs')
  async handleCleanupAuditLogs(job: Job<CleanupJob>): Promise<{ archived: number; batches: number; errors: number }> {
    const olderThanDays = job.data.olderThanDays || 90;
    const batchSize = job.data.batchSize || 10000;

    this.logger.log(`Archiving audit logs older than ${olderThanDays} days to S3`);

    // Use the audit archival service to actually archive to S3
    const result = await this.auditArchival.archiveOldLogs(olderThanDays, batchSize);

    this.logger.log(
      `Audit archival complete: ${result.archived} logs in ${result.batches} batches, ${result.errors} errors`
    );

    return result;
  }

  @Process('expire-deposits')
  async handleExpireDeposits(job: Job<CleanupJob>): Promise<{ released: number }> {
    this.logger.log('Checking for expired deposit holds');

    const expiredHolds = await this.prisma.depositHold.findMany({
      where: {
        status: { in: ['PENDING', 'AUTHORIZED', 'HELD'] },
        expiresAt: { lt: new Date() },
      },
      take: job.data.batchSize || 100,
    });

    let released = 0;
    for (const hold of expiredHolds) {
      try {
        await this.prisma.depositHold.update({
          where: { id: hold.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
        released++;
      } catch (error) {
        this.logger.error(`Failed to release expired hold ${hold.id}:`, error);
      }
    }

    this.logger.log(`Released ${released} expired deposit holds`);
    return { released };
  }

  @Process('cleanup-stale-bookings')
  async handleCleanupStaleBookings(job: Job<CleanupJob>): Promise<{ cancelled: number }> {
    const staleHours = 24; // Cancel drafts/pending after 24 hours
    const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);

    this.logger.log(`Cancelling stale bookings older than ${staleHours} hours`);

    const staleBookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ['DRAFT', 'PENDING'] },
        createdAt: { lt: cutoff },
      },
      take: job.data.batchSize || 50,
    });

    let cancelled = 0;
    for (const booking of staleBookings) {
      try {
        await this.prisma.$transaction([
          this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancellationReason: 'Auto-cancelled: exceeded pending duration',
            },
          }),
          this.prisma.bookingStateHistory.create({
            data: {
              bookingId: booking.id,
              fromStatus: booking.status,
              toStatus: 'CANCELLED',
              reason: 'Auto-cancelled: exceeded pending duration',
              changedBy: 'SYSTEM',
            },
          }),
        ]);
        cancelled++;
      } catch (error) {
        this.logger.error(`Failed to cancel stale booking ${booking.id}:`, error);
      }
    }

    this.logger.log(`Cancelled ${cancelled} stale bookings`);
    return { cancelled };
  }

  @Process('recalculate-metrics')
  async handleRecalculateMetrics(job: Job<CleanupJob>): Promise<{ processed: number }> {
    this.logger.log('Recalculating platform metrics');

    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    // Count bookings created this hour
    const bookingsCount = await this.prisma.booking.count({
      where: { createdAt: { gte: hourStart } },
    });

    // Count payments this hour
    const paymentsCount = await this.prisma.payment.count({
      where: { createdAt: { gte: hourStart }, status: 'SUCCEEDED' },
    });

    // Count new users this hour
    const usersCount = await this.prisma.user.count({
      where: { createdAt: { gte: hourStart } },
    });

    // Upsert metrics
    const metrics = [
      { name: 'bookings.created', value: bookingsCount },
      { name: 'payments.succeeded', value: paymentsCount },
      { name: 'users.registered', value: usersCount },
    ];

    for (const metric of metrics) {
      await this.prisma.platformMetric.create({
        data: {
          name: metric.name,
          value: metric.value,
          period: 'hour',
          periodStart: hourStart,
          dimensions: {},
        },
      });
    }

    this.logger.log(`Recorded ${metrics.length} hourly metrics`);
    return { processed: metrics.length };
  }
}
