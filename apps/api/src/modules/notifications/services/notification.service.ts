import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EmailService } from './email.service';
import { PushNotificationService } from './push-notification.service';
import { SmsService } from './sms.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: ('email' | 'push' | 'sms' | 'in-app')[];
  priority?: 'high' | 'normal' | 'low';
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
    private readonly pushService: PushNotificationService,
    private readonly smsService: SmsService,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  /**
   * Send notification through multiple channels
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.preferencesService.getUserPreferences(payload.userId);

      // Determine channels based on preferences
      const channels = payload.channels || this.getDefaultChannels(payload.type);
      const allowedChannels = channels.filter((channel) =>
        this.isChannelAllowed(channel, payload.type, preferences),
      );

      // Send through each allowed channel
      const promises = allowedChannels.map((channel) =>
        this.sendToChannel(channel, payload),
      );

      await Promise.allSettled(promises);

      // Create in-app notification record
      await this.createInAppNotification(payload);

      this.logger.log(
        `Notification sent to user ${payload.userId} via: ${allowedChannels.join(', ')}`,
      );
    } catch (error) {
      this.logger.error('Notification send error', error);
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(
    channel: 'email' | 'push' | 'sms' | 'in-app',
    payload: NotificationPayload,
  ): Promise<void> {
    try {
      switch (channel) {
        case 'email':
          await this.sendEmailNotification(payload);
          break;
        case 'push':
          await this.sendPushNotificationChannel(payload);
          break;
        case 'sms':
          await this.sendSmsNotification(payload);
          break;
        case 'in-app':
          // Already handled by createInAppNotification
          break;
      }
    } catch (error) {
      this.logger.error(`Error sending ${channel} notification`, error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, firstName: true },
    });

    if (!user?.email) {
      this.logger.warn(`No email found for user: ${payload.userId}`);
      return;
    }

    const template = await this.templateService.getTemplate(payload.type, 'email');
    const html = this.templateService.renderTemplate(template, {
      ...payload.data,
      userName: user.firstName,
      title: payload.title,
      message: payload.message,
    });

    await this.emailService.sendEmail({
      to: user.email,
      subject: payload.title,
      html,
    });
  }

  /**
   * Send push notification
   */
  private async sendPushNotificationChannel(payload: NotificationPayload): Promise<void> {
    await this.pushService.sendPushNotification({
      userId: payload.userId,
      title: payload.title,
      body: payload.message,
      data: payload.data,
      priority: payload.priority,
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(payload: NotificationPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phoneNumber: true },
    });

    if (!user?.phoneNumber) {
      this.logger.warn(`No phone number found for user: ${payload.userId}`);
      return;
    }

    await this.smsService.sendSms({
      to: user.phoneNumber,
      message: `${payload.title}: ${payload.message}`,
    });
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(payload: NotificationPayload): Promise<void> {
    // In production: Store in notifications table
    // await this.prisma.notification.create({
    //   data: {
    //     userId: payload.userId,
    //     type: payload.type,
    //     title: payload.title,
    //     message: payload.message,
    //     data: payload.data,
    //     read: false
    //   }
    // });

    // Emit real-time event for WebSocket delivery
    this.eventEmitter.emit('notification.created', {
      userId: payload.userId,
      notification: {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data,
        createdAt: new Date(),
      },
    });
  }

  /**
   * Check if channel is allowed based on preferences
   */
  private isChannelAllowed(
    channel: string,
    notificationType: string,
    preferences: any,
  ): boolean {
    // Check user preferences
    const pref = preferences[notificationType];
    if (!pref) return true; // Allow by default

    return pref[channel] !== false;
  }

  /**
   * Get default channels for notification type
   */
  private getDefaultChannels(notificationType: string): ('email' | 'push' | 'sms' | 'in-app')[] {
    // High-priority notifications
    if (['booking.confirmed', 'payment.received', 'dispute.opened'].includes(notificationType)) {
      return ['email', 'push', 'in-app'];
    }

    // Medium-priority
    if (['booking.request', 'message.received', 'review.received'].includes(notificationType)) {
      return ['push', 'in-app'];
    }

    // Low-priority
    return ['in-app'];
  }

  /**
   * Event listeners for various domain events
   */

  @OnEvent('booking.created')
  async handleBookingCreated(event: any): Promise<void> {
    const { booking, owner, renter } = event;

    // Notify owner
    await this.sendNotification({
      userId: owner.id,
      type: 'booking.request',
      title: 'New Booking Request',
      message: `${renter.firstName} requested to book your ${booking.listing.title}`,
      data: { bookingId: booking.id },
      channels: ['email', 'push', 'in-app'],
    });
  }

  @OnEvent('booking.confirmed')
  async handleBookingConfirmed(event: any): Promise<void> {
    const { booking, renter } = event;

    await this.sendNotification({
      userId: renter.id,
      type: 'booking.confirmed',
      title: 'Booking Confirmed!',
      message: `Your booking for ${booking.listing.title} has been confirmed`,
      data: { bookingId: booking.id },
      channels: ['email', 'push', 'sms', 'in-app'],
      priority: 'high',
    });
  }

  @OnEvent('payment.succeeded')
  async handlePaymentSucceeded(event: any): Promise<void> {
    const { payment, user } = event;

    await this.sendNotification({
      userId: user.id,
      type: 'payment.received',
      title: 'Payment Successful',
      message: `Your payment of $${payment.amount / 100} has been processed`,
      data: { paymentId: payment.id },
      channels: ['email', 'in-app'],
    });
  }

  @OnEvent('message.received')
  async handleMessageReceived(event: any): Promise<void> {
    const { message, recipient } = event;

    await this.sendNotification({
      userId: recipient.id,
      type: 'message.received',
      title: `New message from ${message.sender.firstName}`,
      message: message.content,
      data: { conversationId: message.conversationId },
      channels: ['push', 'in-app'],
    });
  }

  @OnEvent('review.created')
  async handleReviewCreated(event: any): Promise<void> {
    const { review, owner } = event;

    await this.sendNotification({
      userId: owner.id,
      type: 'review.received',
      title: 'New Review',
      message: `You received a ${review.rating}-star review`,
      data: { reviewId: review.id },
      channels: ['email', 'push', 'in-app'],
    });
  }

  @OnEvent('dispute.opened')
  async handleDisputeOpened(event: any): Promise<void> {
    const { dispute, parties } = event;

    // Notify both parties
    for (const userId of parties) {
      await this.sendNotification({
        userId,
        type: 'dispute.opened',
        title: 'Dispute Opened',
        message: 'A dispute has been opened for your booking',
        data: { disputeId: dispute.id },
        channels: ['email', 'push', 'in-app'],
        priority: 'high',
      });
    }
  }
}
