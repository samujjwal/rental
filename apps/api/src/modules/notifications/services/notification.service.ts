import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CreateNotificationDto {
  userId: string;
  type: 'booking' | 'payment' | 'review' | 'message' | 'system' | 'organization';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
  actionText?: string;
  priority?: 'low' | 'medium' | 'high';
  expiresAt?: Date;
}

export interface NotificationQuery {
  userId?: string;
  type?: string;
  read?: boolean;
  priority?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationCount {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationDto): Promise<any> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type as any,
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl,
          read: false,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Emit event for real-time notifications
      this.eventEmitter.emit('notification.created', {
        notification,
        userId: data.userId,
      });

      this.logger.log(`Notification created for user ${data.userId}: ${data.title}`);

      return notification;
    } catch (error) {
      this.logger.error('Failed to create notification', error);
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(query: NotificationQuery): Promise<any[]> {
    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.read !== undefined) {
      where.read = query.read;
    }
    if (query.priority) {
      where.priority = query.priority;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit || 50,
      skip: query.offset || 0,
    });

    return notifications;
  }

  /**
   * Get notification count for a user
   */
  async getNotificationCount(userId: string): Promise<NotificationCount> {
    const where = {
      userId,
    };

    const [total, unread, byType] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, read: false },
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { ...where, read: false },
        _count: true,
      }),
    ]);

    const typeCounts = byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      unread,
      byType: typeCounts,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
      },
    });

    this.eventEmitter.emit('notification.read', {
      notificationId,
      userId,
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    this.eventEmitter.emit('notification.all_read', { userId });
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });

    this.eventEmitter.emit('notification.deleted', {
      notificationId,
      userId,
    });
  }

  /**
   * Create booking notification
   */
  async createBookingNotification(
    userId: string,
    type: 'created' | 'confirmed' | 'cancelled' | 'completed',
    bookingId: string,
    listingTitle: string,
  ): Promise<void> {
    const messages = {
      created: {
        title: 'New Booking Request',
        message: `You have a new booking request for "${listingTitle}"`,
        actionText: 'View Request',
        priority: 'high' as const,
      },
      confirmed: {
        title: 'Booking Confirmed',
        message: `Your booking for "${listingTitle}" has been confirmed`,
        actionText: 'View Booking',
        priority: 'high' as const,
      },
      cancelled: {
        title: 'Booking Cancelled',
        message: `A booking for "${listingTitle}" has been cancelled`,
        actionText: 'View Details',
        priority: 'medium' as const,
      },
      completed: {
        title: 'Booking Completed',
        message: `Your booking for "${listingTitle}" has been completed`,
        actionText: 'Leave Review',
        priority: 'medium' as const,
      },
    };

    const config = messages[type];

    await this.createNotification({
      userId,
      type: 'booking',
      title: config.title,
      message: config.message,
      actionUrl: `/bookings/${bookingId}`,
      actionText: config.actionText,
      priority: config.priority,
      metadata: {
        bookingId,
        listingTitle,
        type,
      },
    });
  }

  /**
   * Create payment notification
   */
  async createPaymentNotification(
    userId: string,
    type: 'received' | 'sent' | 'failed',
    bookingId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    const messages = {
      received: {
        title: 'Payment Received',
        message: `You received ${currency} ${amount} for a booking`,
        actionText: 'View Details',
        priority: 'high' as const,
      },
      sent: {
        title: 'Payment Sent',
        message: `You sent ${currency} ${amount} for a booking`,
        actionText: 'View Booking',
        priority: 'medium' as const,
      },
      failed: {
        title: 'Payment Failed',
        message: `A payment of ${currency} ${amount} failed`,
        actionText: 'Retry Payment',
        priority: 'high' as const,
      },
    };

    const config = messages[type];

    await this.createNotification({
      userId,
      type: 'payment',
      title: config.title,
      message: config.message,
      actionUrl: `/bookings/${bookingId}`,
      actionText: config.actionText,
      priority: config.priority,
      metadata: {
        bookingId,
        amount,
        currency,
        type,
      },
    });
  }

  /**
   * Create message notification
   */
  async createMessageNotification(
    userId: string,
    senderName: string,
    conversationId: string,
    messagePreview: string,
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'message',
      title: `New message from ${senderName}`,
      message: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
      actionUrl: `/messages/${conversationId}`,
      actionText: 'Reply',
      priority: 'medium',
      metadata: {
        conversationId,
        senderName,
      },
    });
  }

  /**
   * Create system notification
   */
  async createSystemNotification(
    userId: string,
    title: string,
    message: string,
    actionUrl?: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'system',
      title,
      message,
      actionUrl,
      priority,
    });
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<any> {
    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    // Return default preferences if none exist
    if (!preferences) {
      return {
        email: true,
        push: true,
        inApp: true,
        types: {
          booking: true,
          payment: true,
          review: true,
          message: true,
          system: true,
          organization: true,
        },
      };
    }

    // Parse preferences from JSON if needed
    const prefs = (preferences.preferences as any) || {};

    return {
      email: prefs.emailNotifications ?? true,
      push: prefs.pushNotifications ?? true,
      inApp: prefs.inAppNotifications ?? true,
      types: {
        booking: prefs.bookingNotifications ?? true,
        payment: prefs.paymentNotifications ?? true,
        review: prefs.reviewNotifications ?? true,
        message: prefs.messageNotifications ?? true,
        system: prefs.systemNotifications ?? true,
        organization: prefs.organizationNotifications ?? true,
      },
    };
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<{
      email: boolean;
      push: boolean;
      inApp: boolean;
      types: {
        booking: boolean;
        payment: boolean;
        review: boolean;
        message: boolean;
        system: boolean;
        organization: boolean;
      };
    }>,
  ): Promise<void> {
    const prefs = {
      emailNotifications: preferences.email,
      pushNotifications: preferences.push,
      inAppNotifications: preferences.inApp,
      bookingNotifications: preferences.types?.booking,
      paymentNotifications: preferences.types?.payment,
      reviewNotifications: preferences.types?.review,
      messageNotifications: preferences.types?.message,
      systemNotifications: preferences.types?.system,
      organizationNotifications: preferences.types?.organization,
    };

    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        preferences: prefs,
      },
      update: {
        preferences: prefs,
      },
    });
  }
}
