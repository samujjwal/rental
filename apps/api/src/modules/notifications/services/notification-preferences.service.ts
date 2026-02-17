import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface NotificationPreferences {
  email: {
    bookingRequests: boolean;
    bookingConfirmations: boolean;
    bookingCancellations: boolean;
    paymentReceived: boolean;
    messages: boolean;
    reviews: boolean;
    marketing: boolean;
    systemUpdates: boolean;
  };
  push: {
    bookingRequests: boolean;
    bookingConfirmations: boolean;
    bookingCancellations: boolean;
    paymentReceived: boolean;
    messages: boolean;
    reviews: boolean;
    systemUpdates: boolean;
  };
  sms: {
    bookingRequests: boolean;
    bookingConfirmations: boolean;
    bookingCancellations: boolean;
    securityAlerts: boolean;
  };
}

const defaultPreferences: NotificationPreferences = {
  email: {
    bookingRequests: true,
    bookingConfirmations: true,
    bookingCancellations: true,
    paymentReceived: true,
    messages: true,
    reviews: true,
    marketing: false,
    systemUpdates: true,
  },
  push: {
    bookingRequests: true,
    bookingConfirmations: true,
    bookingCancellations: true,
    paymentReceived: true,
    messages: true,
    reviews: true,
    systemUpdates: true,
  },
  sms: {
    bookingRequests: false,
    bookingConfirmations: true,
    bookingCancellations: true,
    securityAlerts: true,
  },
};

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const userPrefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        id: true,
        preferences: true,
      },
    });

    // Parse stored preferences or return defaults
    const stored = userPrefs?.preferences ? JSON.parse(userPrefs.preferences) as Record<string, any> : null;
    if (stored?.notifications) {
      return this.mergeWithDefaults(stored.notifications);
    }

    return defaultPreferences;
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const existing = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    const current = existing?.preferences ? JSON.parse(existing.preferences) as Record<string, any> : null;
    const merged = this.mergeWithDefaults(current?.notifications || {});

    // Deep merge new preferences
    const updated: NotificationPreferences = {
      email: { ...merged.email, ...preferences.email },
      push: { ...merged.push, ...preferences.push },
      sms: { ...merged.sms, ...preferences.sms },
    };

    const data = {
      preferences: JSON.stringify({
        ...(current || {}),
        notifications: updated,
      }),
    };

    if (existing) {
      await this.prisma.userPreferences.update({
        where: { userId },
        data,
      });
    } else {
      await this.prisma.userPreferences.create({
        data: {
          userId,
          preferences: JSON.stringify({ notifications: updated }),
        },
      });
    }

    return updated;
  }

  async shouldSendEmail(
    userId: string,
    type: keyof NotificationPreferences['email'],
  ): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);
    return prefs.email[type] ?? defaultPreferences.email[type];
  }

  async shouldSendPush(
    userId: string,
    type: keyof NotificationPreferences['push'],
  ): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);
    return prefs.push[type] ?? defaultPreferences.push[type];
  }

  async shouldSendSms(
    userId: string,
    type: keyof NotificationPreferences['sms'],
  ): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);
    return prefs.sms[type] ?? defaultPreferences.sms[type];
  }

  private mergeWithDefaults(
    stored: Partial<NotificationPreferences>,
  ): NotificationPreferences {
    return {
      email: { ...defaultPreferences.email, ...stored.email },
      push: { ...defaultPreferences.push, ...stored.push },
      sms: { ...defaultPreferences.sms, ...stored.sms },
    };
  }
}
