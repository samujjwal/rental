import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BookingStatus } from '@rental-portal/database';
import { addHours, addDays, isBefore } from 'date-fns';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('bookings') private bookingsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('search-indexing') private searchQueue: Queue,
    @InjectQueue('cleanup') private cleanupQueue: Queue,
  ) {}

  /**
   * Check for expired bookings every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkExpiredBookings() {
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
   * Process scheduled notifications
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledNotifications() {
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
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async updateAggregatedRatings() {
    this.logger.log('Updating aggregated ratings...');

    try {
      // Update user ratings
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
      }

      // Update listing ratings
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
      }

      this.logger.log('Aggregated ratings updated successfully');
    } catch (error) {
      this.logger.error(`Error updating aggregated ratings: ${error.message}`);
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
}
