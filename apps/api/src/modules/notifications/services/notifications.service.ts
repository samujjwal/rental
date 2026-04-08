import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Notification, NotificationType } from '@rental-portal/database';
import { formatCurrency } from '@rental-portal/shared-types';
import { escapeHtml } from '@/common/utils/sanitize';
import { PushNotificationService } from './push-notification.service';
import { EmailService } from './resend.service';
import { SmsService } from './twilio.service';
import * as crypto from 'crypto';

type NotificationPayload = Record<string, any>;
type NormalizedNotification = Omit<Notification, 'data'> & {
  data: NotificationPayload | null;
};

export interface SendNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: ('EMAIL' | 'SMS' | 'PUSH' | 'IN_APP')[];
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledFor?: Date;
  idempotencyKey?: string;
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

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private pushService: PushNotificationService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Generate an idempotency key from notification content.
   * Creates a hash of userId + type + title + message + key data fields.
   */
  private generateIdempotencyKey(dto: SendNotificationDto): string {
    const { userId, type, title, message, data } = dto;
    
    // Extract key identifying fields from data that make this notification unique
    const keyFields = {
      userId,
      type,
      title,
      message,
      // Include key entity IDs from data if present
      bookingId: data?.bookingId,
      listingId: data?.listingId,
      reviewId: data?.reviewId,
      disputeId: data?.disputeId,
      paymentId: data?.paymentId,
      messageId: data?.messageId,
    };
    
    const content = JSON.stringify(keyFields);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a notification with the given idempotency key already exists.
   * Returns the existing notification if found, null otherwise.
   */
  private async findExistingNotification(
    idempotencyKey: string,
    windowMs: number = 24 * 60 * 60 * 1000 // 24 hours default
  ): Promise<NormalizedNotification | null> {
    const since = new Date(Date.now() - windowMs);
    
    const existing = await this.prisma.notification.findUnique({
      where: { idempotencyKey },
    });
    
    if (existing && existing.createdAt >= since) {
      this.logger.debug(
        `Duplicate notification detected (key: ${idempotencyKey.substring(0, 16)}...), returning existing ${existing.id}`
      );
      return this.normalizeNotification(existing);
    }
    
    return null;
  }

  private parseNotificationData(raw: unknown): NotificationPayload | null {
    if (!raw) {
      return null;
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }

    return typeof raw === 'object' ? (raw as NotificationPayload) : null;
  }

  private normalizeNotification(notification: Notification): NormalizedNotification {
    return {
      ...notification,
      data: this.parseNotificationData(notification.data),
    };
  }

  /**
   * Send a notification through specified channels with idempotency support.
   * If a notification with the same idempotency key exists (within 24h), returns the existing notification.
   */
  async sendNotification(dto: SendNotificationDto): Promise<NormalizedNotification> {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      channels = ['IN_APP'],
      priority = 'NORMAL',
      scheduledFor,
      idempotencyKey: providedKey,
    } = dto;

    // Generate or use provided idempotency key
    const idempotencyKey = providedKey || this.generateIdempotencyKey(dto);

    // Check for existing notification (idempotency check)
    const existing = await this.findExistingNotification(idempotencyKey);
    if (existing) {
      return existing;
    }

    // Get user preferences
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userPreferences: true },
    });

    if (!user) {
      throw i18nNotFound('notification.userNotFound');
    }

    // Parse preferences
    const preferences = this.parsePreferences(user.userPreferences?.preferences);

    // Create notification record with idempotency key
    const payload = { ...data, priority, scheduledFor };
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: JSON.stringify(payload),
        idempotencyKey,
      },
    });
    const normalizedNotification = this.normalizeNotification(notification);

    // F-08: If scheduled for later, enqueue a delayed job instead of silently
    // dropping the notification.  BullMQ will dispatch it at the right time.
    if (scheduledFor && scheduledFor > new Date()) {
      const delayMs = scheduledFor.getTime() - Date.now();
      await this.notificationsQueue.add(
        'send-scheduled-notification',
        { notificationId: notification.id, dto },
        { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
      return normalizedNotification;
    }

    // Send through enabled channels based on user preferences
    const sendPromises: Promise<any>[] = [];
    const usedChannels: string[] = [];

    if (channels.includes('EMAIL') && preferences.email !== false) {
      if (this.shouldSendByType(type, preferences)) {
        usedChannels.push('EMAIL');
        sendPromises.push(this.sendEmailNotification(user, normalizedNotification));
      }
    }

    if (channels.includes('SMS') && preferences.sms === true && user.phoneVerified) {
      if (this.shouldSendByType(type, preferences)) {
        usedChannels.push('SMS');
        sendPromises.push(this.sendSMSNotification(user, normalizedNotification));
      }
    }

    if (channels.includes('PUSH') && preferences.push !== false) {
      if (this.shouldSendByType(type, preferences)) {
        usedChannels.push('PUSH');
        sendPromises.push(this.sendPushNotification(user, normalizedNotification));
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

    return normalizedNotification;
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
      case NotificationType.NEW_MESSAGE:
        return preferences.messageAlerts !== false;

      default:
        return true;
    }
  }

  /**
   * Send email notification (F-33 fix: uses retry-capable EmailService).
   */
  private async sendEmailNotification(user: any, notification: NormalizedNotification): Promise<void> {
    const template = this.getEmailTemplate(notification);

    await this.emailService.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
    });

    this.logger.log(`Email sent to ${user.email} for notification ${notification.id}`);
  }

  /**
   * Send SMS notification (F-33 fix: uses retry-capable SmsService).
   */
  private async sendSMSNotification(user: any, notification: NormalizedNotification): Promise<void> {
    const smsBody = `${notification.title}\n${notification.message}`;

    const result = await this.smsService.sendSms({
      to: user.phone,
      body: smsBody.substring(0, 160),
    });

    if (result.status !== 'sent' && result.status !== 'queued') {
      this.logger.warn(`SMS delivery uncertain for user ${user.id}: status=${result.status}`);
    }

    this.logger.log(`SMS dispatched to ${user.phone} for notification ${notification.id}`);
  }

  /**
   * Send push notification via PushNotificationService
   */
  private async sendPushNotification(user: any, notification: NormalizedNotification): Promise<void> {
    try {
      await this.pushService.sendPushNotification({
        userId: user.id,
        title: notification.title,
        body: notification.message,
        data: notification.data || {},
      });
      this.logger.log(`Push notification sent to user ${user.id} for notification ${notification.id}`);
    } catch (error) {
      this.logger.warn(`Push notification failed for user ${user.id}: ${error.message}`);
    }
  }

  /**
   * Get email template for notification type
   */
  private getEmailTemplate(notification: NormalizedNotification): {
    subject: string;
    html: string;
  } {
    const baseUrl = this.configService.get('APP_URL');
    const data = notification.data || {};

    switch (notification.type) {
      case NotificationType.BOOKING_REQUEST:
        return {
          subject: 'New Booking Request',
          html: `
            <h2>${escapeHtml(notification.title)}</h2>
            <p>${escapeHtml(notification.message)}</p>
            <p><a href="${baseUrl}/bookings/${data.bookingId ?? ''}">View Booking</a></p>
          `,
        };

      case NotificationType.BOOKING_CONFIRMED:
        return {
          subject: 'Booking Confirmed',
          html: `
            <h2>${escapeHtml(notification.title)}</h2>
            <p>${escapeHtml(notification.message)}</p>
            <p><a href="${baseUrl}/bookings/${data.bookingId ?? ''}">View Booking Details</a></p>
          `,
        };

      case NotificationType.PAYOUT_PROCESSED:
        return {
          subject: 'Payout Processed',
          html: `
            <h2>${escapeHtml(notification.title)}</h2>
            <p>${escapeHtml(notification.message)}</p>
            <p>Amount: ${formatCurrency(data.amount, data.currency)}</p>
          `,
        };

      case NotificationType.REVIEW_RECEIVED:
        return {
          subject: 'New Review Received',
          html: `
            <h2>${escapeHtml(notification.title)}</h2>
            <p>${escapeHtml(notification.message)}</p>
            <p><a href="${baseUrl}/reviews/${data.reviewId ?? ''}">View Review</a></p>
          `,
        };

      default:
        return {
          subject: notification.title,
          html: `
            <h2>${escapeHtml(notification.title)}</h2>
            <p>${escapeHtml(notification.message)}</p>
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
      unreadOnly?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ notifications: NormalizedNotification[]; total: number }> {
    const { type, unreadOnly, page = 1, limit = 20 } = options;

    const where: any = { userId };
    if (type) where.type = type;
    if (unreadOnly) where.read = false;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications.map((notification) => this.normalizeNotification(notification)),
      total,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<NormalizedNotification> {
    // Verify ownership
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw i18nNotFound('notification.notFound');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });

    return this.normalizeNotification(updated);
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
      throw i18nNotFound('notification.notFound');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Create notification (for test compatibility)
   */
  async createNotification(data: any): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type || 'EMAIL',
        title: data.title || 'Notification',
        message: data.message || '',
        status: data.status || 'PENDING',
        data: data.data || {},
      },
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
          preferences: JSON.stringify(preferences || {}),
        },
      });
      return;
    }

    // Merge preferences
    const currentPreferences = this.parsePreferences(existing.preferences);
    const updatedPreferences = { ...currentPreferences, ...preferences };

    await this.prisma.userPreferences.update({
      where: { userId },
      data: {
        preferences: JSON.stringify(updatedPreferences),
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

    const preferences = this.parsePreferences(prefs?.preferences);

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

  private parsePreferences(raw: string | null | undefined): NotificationPreferences {
    const defaults: NotificationPreferences = {
      email: true,
      sms: false,
      push: true,
      inApp: true,
      bookingUpdates: true,
      paymentUpdates: true,
      reviewAlerts: true,
      messageAlerts: true,
      marketingEmails: false,
    };

    if (!raw) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, any>;

      // F-11 fix: Handle nested format written by NotificationPreferencesService
      // ({ notifications: { email: {...}, push: {...}, sms: {...} } }) alongside
      // the flat format expected here.
      if (parsed?.notifications) {
        const n = parsed.notifications;
        return {
          ...defaults,
          email: n.email?.bookingRequests !== false,
          sms: n.sms?.bookingRequests === true,
          push: n.push?.bookingRequests !== false,
          bookingUpdates:
            n.email?.bookingRequests !== false || n.push?.bookingRequests !== false,
          paymentUpdates:
            n.email?.paymentReceived !== false || n.push?.paymentReceived !== false,
          reviewAlerts:
            n.email?.reviews !== false || n.push?.reviews !== false,
          messageAlerts:
            n.email?.messages !== false || n.push?.messages !== false,
          marketingEmails: n.email?.marketing === true,
        };
      }

      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  }
}
