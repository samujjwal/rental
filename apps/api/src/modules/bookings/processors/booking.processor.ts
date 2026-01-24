import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@/core/database/prisma.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { BookingStatus, NotificationType } from '@prisma/client';

interface BookingExpirationJob {
  bookingId: string;
  expiresAt: Date;
}

interface BookingReminderJob {
  bookingId: string;
  type: 'UPCOMING' | 'ONGOING' | 'RETURN_DUE';
}

interface BookingStatusUpdateJob {
  bookingId: string;
  status: BookingStatus;
  reason?: string;
}

@Processor('bookings')
export class BookingProcessor {
  private readonly logger = new Logger(BookingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }

  /**
   * Check and expire pending bookings that haven't been confirmed
   */
  @Process('check-expiration')
  async handleBookingExpiration(job: Job<BookingExpirationJob>) {
    const { bookingId, expiresAt } = job.data;

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          listing: true,
          renter: true,
        },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found`);
        return;
      }

      // Skip if booking is no longer pending
      if (
        ![BookingStatus.PENDING_OWNER_APPROVAL, BookingStatus.PENDING_PAYMENT].includes(
          booking.status,
        )
      ) {
        return;
      }

      // Check if expired
      if (new Date() >= expiresAt) {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.CANCELLED,
            cancelledAt: new Date(),
            cancellationReason: 'Expired - Payment not received within time limit',
          },
        });

        // Notify renter
        await this.notificationsService.sendNotification({
          userId: booking.renterId,
          type: NotificationType.BOOKING_CANCELLED,
          title: 'Booking Expired',
          message: `Your booking for "${booking.listing.title}" has expired due to non-payment.`,
          data: { bookingId },
          channels: ['EMAIL', 'IN_APP'],
        });

        this.logger.log(`Booking ${bookingId} expired and cancelled`);
      }
    } catch (error) {
      this.logger.error(`Error processing booking expiration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send reminders for upcoming bookings
   */
  @Process('send-reminder')
  async handleBookingReminder(job: Job<BookingReminderJob>) {
    const { bookingId, type } = job.data;

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          listing: true,
          renter: true,
        },
      });

      if (!booking) {
        return;
      }

      let message = '';
      let title = '';

      switch (type) {
        case 'UPCOMING':
          title = 'Booking Starting Soon';
          message = `Your booking for "${booking.listing.title}" starts in 24 hours. Please review pickup instructions.`;
          break;
        case 'ONGOING':
          title = 'Active Booking Reminder';
          message = `Your rental of "${booking.listing.title}" is currently active. Enjoy!`;
          break;
        case 'RETURN_DUE':
          title = 'Return Reminder';
          message = `Your rental of "${booking.listing.title}" is due for return soon. Please arrange for return.`;
          break;
      }

      await this.notificationsService.sendNotification({
        userId: booking.renterId,
        type: NotificationType.BOOKING_REMINDER,
        title,
        message,
        data: { bookingId, type },
        channels: ['EMAIL', 'PUSH', 'IN_APP'],
      });

      this.logger.log(`Sent ${type} reminder for booking ${bookingId}`);
    } catch (error) {
      this.logger.error(`Error sending booking reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-complete bookings after return inspection
   */
  @Process('auto-complete')
  async handleAutoComplete(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          conditionReports: true,
          listing: true,
        },
      });

      if (!booking || booking.status !== BookingStatus.AWAITING_RETURN_INSPECTION) {
        return;
      }

      // Check if return report exists
      const returnReport = booking.conditionReports.find((r) => r.type === 'RETURN');

      if (returnReport && returnReport.status === 'COMPLETED') {
        // Auto-complete if no damages reported or minor damages
        const hasSevereDamage = returnReport.damages?.some((d: any) => d.severity === 'SEVERE');

        if (!hasSevereDamage) {
          await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
              status: BookingStatus.COMPLETED,
              completedAt: new Date(),
            },
          });

          // Queue payment release
          await job.queue.add('release-payment', { bookingId }, { delay: 1000 });

          this.logger.log(`Auto-completed booking ${bookingId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error auto-completing booking: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update booking status
   */
  @Process('update-status')
  async handleStatusUpdate(job: Job<BookingStatusUpdateJob>) {
    const { bookingId, status, reason } = job.data;

    try {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status,
          ...(reason && { cancellationReason: reason }),
        },
      });

      this.logger.log(`Updated booking ${bookingId} to status ${status}`);
    } catch (error) {
      this.logger.error(`Error updating booking status: ${error.message}`);
      throw error;
    }
  }
}
