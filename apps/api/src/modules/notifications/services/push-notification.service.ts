import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushNotificationOptions {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  priority?: 'high' | 'normal';
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Send push notification
   * In production: Use Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNS)
   */
  async sendPushNotification(
    options: PushNotificationOptions,
  ): Promise<{ success: boolean }> {
    try {
      // Get user's device tokens from database
      const deviceTokens = await this.getUserDeviceTokens(options.userId);

      if (deviceTokens.length === 0) {
        this.logger.warn(`No device tokens found for user: ${options.userId}`);
        return { success: false };
      }

      // Send to FCM
      const fcmResult = await this.sendToFCM(deviceTokens, options);

      return { success: fcmResult };
    } catch (error) {
      this.logger.error('Push notification error', error);
      return { success: false };
    }
  }

  /**
   * Send to multiple users
   */
  async sendBulkPushNotifications(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<{ success: boolean; sent: number }> {
    let sent = 0;

    for (const userId of userIds) {
      const result = await this.sendPushNotification({
        userId,
        title,
        body,
        data,
      });

      if (result.success) {
        sent++;
      }
    }

    return { success: true, sent };
  }

  /**
   * Get user device tokens from database
   */
  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    // In production: Query database for user's registered device tokens
    // Example:
    // const devices = await this.prisma.deviceToken.findMany({
    //   where: { userId, active: true },
    //   select: { token: true }
    // });
    // return devices.map(d => d.token);

    return []; // Placeholder
  }

  /**
   * Send notification via Firebase Cloud Messaging
   */
  private async sendToFCM(
    tokens: string[],
    options: PushNotificationOptions,
  ): Promise<boolean> {
    try {
      const admin = require('firebase-admin');

      // Initialize Firebase Admin SDK (do this once at startup)
      if (!admin.apps.length) {
        const serviceAccount = this.config.get('FIREBASE_SERVICE_ACCOUNT');
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(serviceAccount)),
        });
      }

      const message = {
        notification: {
          title: options.title,
          body: options.body,
          imageUrl: options.imageUrl,
        },
        data: options.data || {},
        tokens,
        android: {
          priority: options.priority || 'high',
          notification: {
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              'content-available': 1,
              sound: 'default',
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      this.logger.log(
        `Push notifications sent: ${response.successCount}/${tokens.length}`,
      );

      // Handle failed tokens (clean up invalid tokens)
      if (response.failureCount > 0) {
        await this.handleFailedTokens(tokens, response.responses);
      }

      return response.successCount > 0;
    } catch (error) {
      this.logger.error('FCM send error', error);
      return false;
    }
  }

  /**
   * Handle failed tokens (remove invalid tokens from database)
   */
  private async handleFailedTokens(
    tokens: string[],
    responses: any[],
  ): Promise<void> {
    const invalidTokens: string[] = [];

    responses.forEach((response, index) => {
      if (!response.success) {
        const errorCode = response.error?.code;
        // Remove tokens that are invalid or unregistered
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      this.logger.log(`Removing ${invalidTokens.length} invalid device tokens`);
      // In production: Delete from database
      // await this.prisma.deviceToken.deleteMany({
      //   where: { token: { in: invalidTokens } }
      // });
    }
  }

  /**
   * Register device token for user
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    // In production: Save to database
    // await this.prisma.deviceToken.upsert({
    //   where: { token },
    //   create: { userId, token, platform, active: true },
    //   update: { userId, active: true, updatedAt: new Date() }
    // });

    this.logger.log(`Device token registered for user: ${userId} (${platform})`);
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    // In production: Mark as inactive or delete
    // await this.prisma.deviceToken.update({
    //   where: { token },
    //   data: { active: false }
    // });

    this.logger.log(`Device token unregistered: ${token}`);
  }

  /**
   * Send topic-based notification (for broadcasts)
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<{ success: boolean }> {
    try {
      const admin = require('firebase-admin');

      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        topic,
      };

      await admin.messaging().send(message);
      this.logger.log(`Topic notification sent: ${topic}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Topic notification error', error);
      return { success: false };
    }
  }
}
