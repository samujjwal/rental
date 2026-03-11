import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';

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
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_DELAY_MS = 500;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Send push notification with exponential-backoff retry (max 3 attempts).
   * Transient errors (network, FCM 5xx) are retried; permanent errors are not.
   */
  async sendPushNotification(options: PushNotificationOptions): Promise<{ success: boolean }> {
    const deviceTokens = await this.getUserDeviceTokens(options.userId);

    if (deviceTokens.length === 0) {
      this.logger.warn(`No device tokens found for user: ${options.userId}`);
      return { success: false };
    }

    return this.sendWithRetry(deviceTokens, options);
  }

  /**
   * Internal retry wrapper with exponential backoff.
   */
  private async sendWithRetry(
    tokens: string[],
    options: PushNotificationOptions,
    attempt = 0,
  ): Promise<{ success: boolean }> {
    try {
      const success = await this.sendToFCM(tokens, options);
      return { success };
    } catch (error) {
      const isTransient = this.isTransientFcmError(error);
      if (!isTransient || attempt >= PushNotificationService.MAX_RETRIES - 1) {
        this.logger.error(
          `Push notification failed after ${attempt + 1} attempt(s) — giving up.`,
          error,
        );
        return { success: false };
      }
      const delay = Math.min(PushNotificationService.BASE_DELAY_MS * 2 ** attempt, 8000);
      this.logger.warn(
        `FCM attempt ${attempt + 1} failed (transient), retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.sendWithRetry(tokens, options, attempt + 1);
    }
  }

  /**
   * Classify FCM errors as transient (network/server) or permanent (bad token, auth).
   */
  private isTransientFcmError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const code: string = ((error as any).errorInfo?.code) ?? '';
      const permanent = [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
        'messaging/invalid-argument',
        'messaging/invalid-apns-credentials',
        'messaging/sender-id-mismatch',
      ];
      if (permanent.some((p) => code.startsWith(p))) return false;
    }
    return true; // Treat unknown/network errors as transient
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
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId, active: true },
      select: { token: true },
    });
    return devices.map((d) => d.token);
  }

  /**
   * Send notification via Firebase Cloud Messaging.
   * Throws on transient errors (caught by sendWithRetry); returns false on permanent failures.
   */
  private async sendToFCM(tokens: string[], options: PushNotificationOptions): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');

    // Initialize Firebase Admin SDK once
    if (!admin.apps.length) {
      const serviceAccount = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
      if (!serviceAccount) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT not configured — skipping push');
        return false;
      }
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount) as object),
      });
    }

    const message = {
      notification: {
        title: options.title,
        body: options.body,
        imageUrl: options.imageUrl,
      },
      data: options.data ?? {},
      tokens,
      android: {
        priority: options.priority ?? 'high',
        notification: { clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
      },
      apns: {
        payload: { aps: { 'content-available': 1, sound: 'default' } },
      },
    };

    // Throws on network/server errors → caught by sendWithRetry
    const response = await admin.messaging().sendEachForMulticast(message);
    this.logger.log(`Push notifications sent: ${response.successCount}/${tokens.length}`);

    if (response.failureCount > 0) {
      await this.handleFailedTokens(tokens, response.responses);
    }

    return response.successCount > 0;
  }

  /**
   * Remove invalid/unregistered tokens from the database.
   */
  private async handleFailedTokens(
    tokens: string[],
    responses: Array<{ success: boolean; error?: { code?: string } }>,
  ): Promise<void> {
    const permanentErrorCodes = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ]);
    const invalidTokens = responses
      .map((r, i) => ({ r, token: tokens[i] }))
      .filter(({ r }) => !r.success && permanentErrorCodes.has(r.error?.code ?? ''))
      .map(({ token }) => token);

    if (invalidTokens.length > 0) {
      this.logger.log(`Removing ${invalidTokens.length} invalid device tokens`);
      await this.prisma.deviceToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
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
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform, active: true },
      update: { userId, active: true, updatedAt: new Date() },
    });

    this.logger.log(`Device token registered for user: ${userId} (${platform})`);
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    await this.prisma.deviceToken.update({
      where: { token },
      data: { active: false },
    });

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
