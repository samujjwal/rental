import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Notification, NotificationType } from '@rental-portal/database';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';

export interface SendNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: ('EMAIL' | 'SMS' | 'PUSH' | 'IN_APP')[];
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledFor?: Date;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  bookingUpdates: boolean;
  paymentUpdates: boolean;
  reviewAlerts: boolean;
  messageAlerts: boolean;
  marketingEmails: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: Twilio;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });

    // Initialize Twilio client for SMS
    const twilioAccountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get('TWILIO_AUTH_TOKEN');
    try {
      if (twilioAccountSid && twilioAuthToken) {
        this.twilioClient = new Twilio(twilioAccountSid, twilioAuthToken);
      }
    } catch (error) {
      this.logger.warn('Failed to initialize Twilio client: ' + error.message);
    }
  }

  /**
   * Send a notification through specified channels
   */
  async sendNotification(dto: SendNotificationDto): Promise<Notification> {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      channels = ['IN_APP'],
      priority = 'NORMAL',
      scheduledFor,
    } = dto;

    // Get user preferences
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userPreferences: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Parse preferences
    const preferences: any = user.userPreferences?.preferences || {};

    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: JSON.stringify({ ...data, priority, scheduledFor }),
      },
    });

    // If scheduled for later, we skip sending for now (MVP: scheduling not fully implemented)
    if (scheduledFor && scheduledFor > new Date()) {
      return notification;
    }

    // Send through enabled channels based on user preferences
    const sendPromises: Promise<any>[] = [];
    const usedChannels: string[] = [];

    if (channels.includes('EMAIL') && preferences.email !== false) {
      if (this.shouldSendByType(type, preferences)) {
        usedChannels.push('EMAIL');
        sendPromises.push(this.sendEmailNotification(user, notification));
      }
    }

    if (channels.includes('SMS') && preferences.sms === true && user.phoneVerified) {
      if (this.shouldSendByType(type, preferences)) {
        usedChannels.push('SMS');
        sendPromises.push(this.sendSMSNotification(user, notification));
      }
    }

    if (channels.includes('PUSH') && preferences.push !== false) {
      if (this.shouldSendByType(type, preferences)) {
        usedChannels.push('PUSH');
        sendPromises.push(this.sendPushNotification(user, notification));
      }
    }

    // Execute all sends in parallel
    try {
      await Promise.allSettled(sendPromises);

      // Update sent status flags
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          sentViaEmail: usedChannels.includes('EMAIL'),
          sentViaPush: usedChannels.includes('PUSH'),
          // sentViaSMS/sentAt not in schema, skipping
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send notification ${notification.id}`, error);
    }

    return notification;
  }

  /**
   * Check if notification should be sent based on type and preferences
   */
  private shouldSendByType(type: NotificationType, preferences: NotificationPreferences): boolean {
    switch (type) {
      case NotificationType.BOOKING_REQUEST:
      case NotificationType.BOOKING_CONFIRMED:
      case NotificationType.BOOKING_CANCELLED:
      case NotificationType.BOOKING_REMINDER:
        return preferences.bookingUpdates !== false;

      case NotificationType.PAYOUT_PROCESSED:
        return preferences.paymentUpdates !== false;

      case NotificationType.REVIEW_RECEIVED:
        return preferences.reviewAlerts !== false;

      case NotificationType.MESSAGE_RECEIVED:
        return preferences.messageAlerts !== false;

      default:
        return true;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(user: any, notification: Notification): Promise<void> {
    const template = this.getEmailTemplate(notification);

    await this.emailTransporter.sendMail({
      from: this.configService.get('SMTP_FROM'),
      to: user.email,
      subject: template.subject,
      html: template.html,
    });

    this.logger.log(`Email sent to ${user.email} for notification ${notification.id}`);
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(user: any, notification: Notification): Promise<void> {
    if (!this.twilioClient) {
      this.logger.warn('Twilio client not configured, skipping SMS');
      return;
    }

    const smsBody = `${notification.title}\n${notification.message}`;

    await this.twilioClient.messages.create({
      body: smsBody.substring(0, 160), // SMS limit
      from: this.configService.get('TWILIO_PHONE_NUMBER'),
      to: user.phone,
    });

    this.logger.log(`SMS sent to ${user.phone} for notification ${notification.id}`);
  }

  /**
   * Send push notification
   * Note: Currently implements a logger-based delivery simulation.
   * Integration with FCM/APNS requires valid credentials and sdk setup.
   */
  private async sendPushNotification(user: any, notification: Notification): Promise<void> {
    const fcmKey = this.configService.get('FCM_SERVER_KEY');

    if (!fcmKey) {
      this.logger.log(
        `Push notification simulation: [User ${user.id}] ${notification.title} - ${notification.message}`,
      );
      return;
    }

    // Placeholder for actual FCM integration
    // const fcm = new FCM(fcmKey);
    // await fcm.send(...)

    this.logger.warn(
      `Push notification provider configured but integration not fully activated for user ${user.id}`,
    );
  }

  /**
   * Get email template for notification type
   */
  private getEmailTemplate(notification: Notification): {
    subject: string;
    html: string;
  } {
    const baseUrl = this.configService.get('APP_URL');

    switch (notification.type) {
      case NotificationType.BOOKING_REQUEST:
        return {
          subject: 'New Booking Request',
          html: `
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/bookings/${(notification.data as any)?.bookingId}">View Booking</a></p>
          `,
        };

      case NotificationType.BOOKING_CONFIRMED:
        return {
          subject: 'Booking Confirmed',
          html: `
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/bookings/${(notification.data as any)?.bookingId}">View Booking Details</a></p>
          `,
        };

      case NotificationType.PAYOUT_PROCESSED:
        return {
          subject: 'Payout Processed',
          html: `
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            <p>Amount: $${(notification.data as any)?.amount}</p>
          `,
        };

      case NotificationType.REVIEW_RECEIVED:
        return {
          subject: 'New Review Received',
          html: `
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/reviews/${(notification.data as any)?.reviewId}">View Review</a></p>
          `,
        };

      default:
        return {
          subject: notification.title,
          html: `
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
          `,
        };
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(
    userId: string,
    options: {
      type?: NotificationType;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { type, page = 1, limit = 20 } = options;

    const where: any = { userId };
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    // Verify ownership
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<void> {
    // Get existing preferences
    const existing = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!existing) {
      // Create if not exists
      await this.prisma.userPreferences.create({
        data: {
          userId,
          preferences: preferences as any,
        },
      });
      return;
    }

    // Merge preferences
    const currentPreferences = (existing.preferences as any) || {};
    const updatedPreferences = { ...currentPreferences, ...preferences };

    await this.prisma.userPreferences.update({
      where: { userId },
      data: {
        preferences: updatedPreferences,
      },
    });
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    const preferences = (prefs?.preferences as any) || {};

    return {
      email: preferences.email !== false,
      sms: preferences.sms === true,
      push: preferences.push !== false,
      inApp: preferences.inApp !== false,
      bookingUpdates: preferences.bookingUpdates !== false,
      paymentUpdates: preferences.paymentUpdates !== false,
      reviewAlerts: preferences.reviewAlerts !== false,
      messageAlerts: preferences.messageAlerts !== false,
      marketingEmails: preferences.marketingEmails === true,
    };
  }
}
