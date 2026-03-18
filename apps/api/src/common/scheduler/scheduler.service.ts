import { Injectable, Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression, Interval, SchedulerRegistry } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import type { PaymentCommandPayload, PaymentCommandType } from '@/common/payments/payment-command.types';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IEmbeddingService, EMBEDDING_SERVICE } from '@/common/interfaces/embedding.interface';
import { BookingStatus } from '@rental-portal/database';
import { addHours, addDays, isBefore } from 'date-fns';
import { DistributedLockService } from '@/common/locking/distributed-lock.service';
import { withTraceCtx } from '@/common/queue/queue-trace.util';

@Injectable()
export class SchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(EMBEDDING_SERVICE) private embeddingService: IEmbeddingService,
    @InjectQueue('bookings') private bookingsQueue: Queue,
    @InjectQueue('payments') private paymentsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('search-indexing') private searchQueue: Queue,
    @InjectQueue('cleanup') private cleanupQueue: Queue,
    private schedulerRegistry: SchedulerRegistry,
    private readonly lockService: DistributedLockService,
  ) {}

  onModuleDestroy() {
    // Clear all intervals and cron jobs to prevent Jest open handles
    this.schedulerRegistry.getIntervals().forEach((name) => {
      this.schedulerRegistry.deleteInterval(name);
    });
    this.schedulerRegistry.getCronJobs().forEach((_job, name) => {
      this.schedulerRegistry.deleteCronJob(name);
    });
  }

  /**
   * Check for expired bookings every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkExpiredBookings() {
    const result = await this.lockService.withLock(
      'cron:checkExpiredBookings',
      async () => {
        this.logger.log('Checking for expired bookings...');
        return true;
      },
      { ttl: 270, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('checkExpiredBookings: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Checking for expired bookings...');

    try {
      const now = new Date();

      // Find bookings pending payment that are older than 30 minutes
      const expiredBookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.PENDING_PAYMENT,
          createdAt: {
            lt: addHours(now, -0.5), // 30 minutes ago
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

      for (const booking of expiredBookings) {
        await this.bookingsQueue.add('check-expiration', {
          bookingId: booking.id,
          expiresAt: addHours(booking.createdAt, 0.5),
        });
      }

      if (expiredBookings.length > 0) {
        this.logger.log(`Queued ${expiredBookings.length} expired bookings for processing`);
      }
    } catch (error) {
      this.logger.error(`Error checking expired bookings: ${error.message}`);
    }
  }

  /**
   * Send upcoming booking reminders (24 hours before)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendUpcomingBookingReminders() {
    const result = await this.lockService.withLock(
      'cron:sendUpcomingBookingReminders',
      async () => true,
      { ttl: 3540, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('sendUpcomingBookingReminders: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Checking for upcoming bookings to send reminders...');

    try {
      const tomorrow = addDays(new Date(), 1);
      const dayAfterTomorrow = addDays(new Date(), 2);

      const upcomingBookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          startDate: {
            gte: tomorrow,
            lt: dayAfterTomorrow,
          },
        },
        select: {
          id: true,
          renterId: true,
          listing: {
            select: {
              title: true,
            },
          },
        },
      });

      for (const booking of upcomingBookings) {
        await this.bookingsQueue.add('send-reminder', {
          bookingId: booking.id,
          type: 'UPCOMING',
        });
      }

      if (upcomingBookings.length > 0) {
        this.logger.log(`Queued ${upcomingBookings.length} upcoming booking reminders`);
      }
    } catch (error) {
      this.logger.error(`Error sending upcoming booking reminders: ${error.message}`);
    }
  }

  /**
   * Check for bookings that need return reminders
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async sendReturnReminders() {
    const result = await this.lockService.withLock(
      'cron:sendReturnReminders',
      async () => true,
      { ttl: 21540, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('sendReturnReminders: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Checking for bookings needing return reminders...');

    try {
      const now = new Date();
      const tomorrow = addDays(now, 1);

      const returnDueBookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.IN_PROGRESS,
          endDate: {
            gte: now,
            lt: tomorrow,
          },
        },
        select: {
          id: true,
        },
      });

      for (const booking of returnDueBookings) {
        await this.bookingsQueue.add('send-reminder', {
          bookingId: booking.id,
          type: 'RETURN_DUE',
        });
      }

      if (returnDueBookings.length > 0) {
        this.logger.log(`Queued ${returnDueBookings.length} return reminders`);
      }
    } catch (error) {
      this.logger.error(`Error sending return reminders: ${error.message}`);
    }
  }

  /**
   * Auto-complete bookings after inspection period
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteBookings() {
    const result = await this.lockService.withLock(
      'cron:autoCompleteBookings',
      async () => true,
      { ttl: 3540, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('autoCompleteBookings: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Checking for bookings to auto-complete...');

    try {
      const now = new Date();

      // Find bookings awaiting return inspection for more than 48 hours
      const bookingsToComplete = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.AWAITING_RETURN_INSPECTION,
          endDate: {
            lt: addHours(now, -48),
          },
        },
        select: {
          id: true,
        },
      });

      for (const booking of bookingsToComplete) {
        await this.bookingsQueue.add('auto-complete', {
          bookingId: booking.id,
        });
      }

      if (bookingsToComplete.length > 0) {
        this.logger.log(`Queued ${bookingsToComplete.length} bookings for auto-completion`);
      }
    } catch (error) {
      this.logger.error(`Error auto-completing bookings: ${error.message}`);
    }
  }

  /**
   * Auto-settle completed bookings after 48-hour dispute window
   * Moves COMPLETED → SETTLED and triggers payout to owner
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoSettleBookings() {
    const result = await this.lockService.withLock(
      'cron:autoSettleBookings',
      async () => true,
      { ttl: 3540, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('autoSettleBookings: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Checking for bookings to auto-settle...');

    try {
      const now = new Date();

      // Find COMPLETED bookings where completedAt is older than 48 hours
      const bookingsToSettle = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          completedAt: {
            lt: addHours(now, -48),
          },
        },
        include: {
          listing: {
            include: { owner: true },
          },
          payments: {
            where: { status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      for (const booking of bookingsToSettle) {
        try {
          const owner = booking.listing.owner;
          const payment = booking.payments[0];

          if (!payment) {
            this.logger.warn(`No completed payment found for booking ${booking.id}, skipping settlement`);
            continue;
          }

          // Calculate owner payout (total minus platform fee)
          const platformFeeRate = 0.10; // 10% platform fee
          const payoutAmount = Math.round(Number(payment.amount) * (1 - platformFeeRate));

          const payout = await this.prisma.payout.create({
            data: {
              ownerId: owner.id,
              amount: payoutAmount,
              currency: payment.currency,
              status: 'PENDING',
              metadata: JSON.stringify({
                bookingId: booking.id,
                bookingIds: [booking.id],
                source: 'auto_settlement_cron',
              }),
            },
          });

          const payoutCommand = await this.createPaymentCommand({
            userId: owner.id,
            entityType: 'PAYOUT',
            entityId: payout.id,
            amount: payoutAmount,
            currency: payment.currency,
            metadata: {
              bookingId: booking.id,
              bookingIds: [booking.id],
              source: 'auto_settlement_cron',
            },
          });

          const cronTraceId = `cron:autoSettle:${booking.id}`;
          await this.paymentsQueue.add('process-payout', withTraceCtx({
            payoutId: payout.id,
            bookingIds: [booking.id],
            ownerId: owner.id,
            ownerStripeConnectId: (owner as any).stripeConnectId || '',
            amount: payoutAmount,
            currency: payment.currency,
            commandId: payoutCommand.id,
            timestamp: new Date().toISOString(),
          }, cronTraceId), {
            jobId: `payout:${payout.id}`,
          });

          await this.updatePaymentCommand(payoutCommand.id, {
            status: 'ENQUEUED',
            jobName: 'process-payout',
            jobId: `payout:${payout.id}`,
          });

          const depositHold = await this.prisma.depositHold.findFirst({
            where: {
              bookingId: booking.id,
              status: { in: ['HELD', 'AUTHORIZED'] },
            },
            select: { id: true, amount: true, currency: true },
          });

          if (depositHold) {
            const depositCommand = await this.createPaymentCommand({
              entityType: 'DEPOSIT_RELEASE',
              entityId: booking.id,
              amount: Number(depositHold.amount),
              currency: depositHold.currency,
              metadata: {
                bookingId: booking.id,
                depositHoldIds: [depositHold.id],
                source: 'auto_settlement_cron',
              },
            });

            await this.paymentsQueue.add('release-deposit', withTraceCtx({
              bookingId: booking.id,
              commandId: depositCommand.id,
              timestamp: new Date().toISOString(),
            }, cronTraceId), {
              jobId: `deposit-release:${booking.id}`,
            });

            await this.updatePaymentCommand(depositCommand.id, {
              status: 'ENQUEUED',
              jobName: 'release-deposit',
              jobId: `deposit-release:${booking.id}`,
            });
          }

          this.logger.log(`Settled booking ${booking.id}, payout ${payoutAmount} ${payment.currency} to owner ${owner.id}`);
        } catch (innerError) {
          this.logger.error(`Failed to settle booking ${booking.id}: ${innerError.message}`);
          // Continue with next booking - don't fail the entire batch
        }
      }

      if (bookingsToSettle.length > 0) {
        this.logger.log(`Processed ${bookingsToSettle.length} bookings for auto-settlement`);
      }
    } catch (error) {
      this.logger.error(`Error in auto-settlement cron: ${error.message}`);
    }
  }

  private async createPaymentCommand(input: {
    userId?: string;
    entityType: PaymentCommandType;
    entityId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }) {
    const payload: PaymentCommandPayload = {
      commandType: input.entityType,
      status: 'PENDING',
      amount: input.amount,
      currency: input.currency,
      queueName: 'payments',
      requestedAt: new Date().toISOString(),
      metadata: input.metadata,
    };

    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: `${input.entityType}_COMMAND_REQUESTED`,
        entityType: input.entityType,
        entityId: input.entityId,
        newValues: JSON.stringify(payload),
      },
    });
  }

  private async updatePaymentCommand(commandId: string, patch: Partial<PaymentCommandPayload>) {
    const existing = await this.prisma.auditLog.findUnique({
      where: { id: commandId },
      select: { newValues: true },
    });

    let current: Partial<PaymentCommandPayload> = {};
    if (existing?.newValues) {
      try {
        current = JSON.parse(existing.newValues) as Partial<PaymentCommandPayload>;
      } catch {
        current = {};
      }
    }

    const mergedMetadata =
      patch.metadata && current.metadata
        ? { ...current.metadata, ...patch.metadata }
        : patch.metadata ?? current.metadata;

    await this.prisma.auditLog.update({
      where: { id: commandId },
      data: {
        newValues: JSON.stringify({
          ...current,
          ...patch,
          metadata: mergedMetadata,
        }),
      },
    });
  }

  /**
   * Process scheduled notifications
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledNotifications() {
    const result = await this.lockService.withLock(
      'cron:processScheduledNotifications',
      async () => true,
      { ttl: 55, maxRetries: 1 },
    );
    if (result === null) {
      return; // Another instance is processing scheduled notifications
    }
    try {
      const now = new Date();

      const scheduledNotifications = await this.prisma.notification.findMany({
        where: {
          createdAt: {
            lte: now,
          },
          status: 'SCHEDULED',
        },
        include: {
          user: true,
        },
        take: 100,
      });

      for (const notification of scheduledNotifications) {
        await this.notificationsQueue.add('scheduled', {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        });

        // Mark as queued
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'PENDING' },
        });
      }

      if (scheduledNotifications.length > 0) {
        this.logger.log(`Processed ${scheduledNotifications.length} scheduled notifications`);
      }
    } catch (error) {
      this.logger.error(`Error processing scheduled notifications: ${error.message}`);
    }
  }

  /**
   * Reindex Elasticsearch (daily at 2 AM)
   */
  @Cron('0 2 * * *')
  async reindexSearchEngine() {
    const result = await this.lockService.withLock(
      'cron:reindexSearchEngine',
      async () => true,
      { ttl: 82800, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('reindexSearchEngine: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Starting daily search index rebuild...');

    try {
      await this.searchQueue.add('reindex-all', {
        batchSize: 500,
      });

      this.logger.log('Search reindex job queued');
    } catch (error) {
      this.logger.error(`Error queuing search reindex: ${error.message}`);
    }
  }

  /**
   * Clean up old data (weekly on Sunday at 3 AM)
   */
  @Cron('0 3 * * 0')
  async cleanupOldData() {
    const result = await this.lockService.withLock(
      'cron:cleanupOldData',
      async () => true,
      { ttl: 604740, maxRetries: 1 }, // ~7 days TTL
    );
    if (result === null) {
      this.logger.debug('cleanupOldData: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Starting weekly data cleanup...');

    try {
      // Clean up old notifications (older than 90 days)
      const ninetyDaysAgo = addDays(new Date(), -90);

      const deletedNotifications = await this.prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
          readAt: {
            not: null,
          },
        },
      });

      this.logger.log(`Deleted ${deletedNotifications.count} old notifications`);

      // Clean up old sessions (older than 30 days)
      const thirtyDaysAgo = addDays(new Date(), -30);

      const deletedSessions = await this.prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(`Deleted ${deletedSessions.count} expired sessions`);

      // Clean up old audit logs (older than 1 year)
      const oneYearAgo = addDays(new Date(), -365);

      const deletedLogs = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: oneYearAgo,
          },
        },
      });

      this.logger.log(`Deleted ${deletedLogs.count} old audit logs`);
    } catch (error) {
      this.logger.error(`Error during data cleanup: ${error.message}`);
    }
  }

  /**
   * Calculate and update aggregated ratings (every 6 hours)
   * Uses distributed locking to prevent race conditions
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async updateAggregatedRatings() {
    // Method-level lock prevents concurrent runs across instances
    const methodLock = await this.lockService.withLock(
      'cron:updateAggregatedRatings',
      async () => true,
      { ttl: 21540, maxRetries: 1 },
    );
    if (methodLock === null) {
      this.logger.debug('updateAggregatedRatings: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Updating aggregated ratings...');

    const lockKey = 'rating-update-aggregated';
    const lockTTL = 300; // 5 minutes

    try {
      const updated = await this.lockService.withLock(lockKey, async () => {
      let userUpdates = 0;
      let listingUpdates = 0;

      // Update user ratings with individual locks
      const users = await this.prisma.user.findMany({
        where: {
          reviewsReceived: {
            some: {},
          },
        },
        select: {
          id: true,
        },
      });

      for (const user of users) {
        const userLockKey = `rating-update:user-${user.id}`;
        const userUpdated = await this.lockService.withLock(userLockKey, async () => {
          const ratings = await this.prisma.review.aggregate({
            where: {
              revieweeId: user.id,
            },
            _avg: {
              overallRating: true,
            },
            _count: true,
          });

          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              averageRating: ratings._avg.overallRating || 0,
            },
          });

          return true;
        }, { ttl: 30 });

        if (userUpdated) userUpdates++;
      }

      // Update listing ratings with individual locks
      const listings = await this.prisma.listing.findMany({
        where: {
          reviews: {
            some: {},
          },
        },
        select: {
          id: true,
        },
      });

      for (const listing of listings) {
        const listingLockKey = `rating-update:listing-${listing.id}`;
        const listingUpdated = await this.lockService.withLock(listingLockKey, async () => {
          const ratings = await this.prisma.review.aggregate({
            where: {
              listingId: listing.id,
            },
            _avg: {
              overallRating: true,
            },
            _count: true,
          });

          await this.prisma.listing.update({
            where: { id: listing.id },
            data: {
              averageRating: ratings._avg.overallRating || 0,
            },
          });

          return true;
        }, { ttl: 30 });

        if (listingUpdated) listingUpdates++;
      }

      this.logger.log(`Updated ${userUpdates} users and ${listingUpdates} listings ratings`);
      return { userUpdates, listingUpdates };
    }, { ttl: lockTTL });

      if (updated) {
        this.logger.log('Aggregated ratings updated successfully with distributed locking');
      } else {
        this.logger.warn('Failed to acquire rating update lock - another instance may be running');
      }
    } catch (error) {
      this.logger.error(`Error updating aggregated ratings: ${error.message}`);
    }
  }

  /**
   * Retry failed settlements (daily at 4 AM)
   * Finds bookings that completed > 24h ago but haven't settled
   */
  @Cron('0 4 * * *')
  async retryFailedSettlements() {
    const result = await this.lockService.withLock(
      'cron:retryFailedSettlements',
      async () => true,
      { ttl: 82800, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('retryFailedSettlements: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Retrying failed settlements...');

    try {
      const twentyFourHoursAgo = addHours(new Date(), -24);

      const staleBookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          completedAt: {
            lt: twentyFourHoursAgo,
          },
        },
        select: { id: true, completedAt: true },
      });

      let successCount = 0;
      let failCount = 0;

      for (const booking of staleBookings) {
        try {
          await this.bookingsQueue.add('settle-booking', {
            bookingId: booking.id,
          });
          successCount++;
        } catch (error) {
          failCount++;
          this.logger.error(`Settlement retry failed for booking ${booking.id}: ${error.message}`);
        }
      }

      if (staleBookings.length > 0) {
        this.logger.log(
          `Settlement retry: ${successCount} queued, ${failCount} failed out of ${staleBookings.length} stale bookings`,
        );
      }
    } catch (error) {
      this.logger.error(`Error retrying settlements: ${error.message}`);
    }
  }

  /**
   * Health check interval (every 30 seconds)
   */
  @Interval(30000)
  async healthCheck() {
    // Perform health checks on critical services
    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;

      // Check queue connections
      const queueHealth = await Promise.all([
        this.bookingsQueue.isReady(),
        this.notificationsQueue.isReady(),
        this.searchQueue.isReady(),
      ]);

      if (queueHealth.every((ready) => ready)) {
        // All systems operational
      }
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Backfill missing embeddings for semantic search every 6 hours
   */
  @Cron('0 */6 * * *')
  async backfillEmbeddings() {
    const result = await this.lockService.withLock(
      'cron:backfillEmbeddings',
      async () => true,
      { ttl: 21540, maxRetries: 1 },
    );
    if (result === null) {
      this.logger.debug('backfillEmbeddings: skipped — another instance holds the lock');
      return;
    }
    this.logger.log('Starting embedding backfill...');
    try {
      const result = await this.embeddingService.backfillEmbeddings(50);
      this.logger.log(`Embedding backfill complete: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`Embedding backfill failed: ${error.message}`);
    }
  }
}
