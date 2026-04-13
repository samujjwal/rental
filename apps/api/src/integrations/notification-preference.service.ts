import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { randomBytes } from 'crypto';

export interface PreferenceUpdateResult {
  success: boolean;
  preferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  error?: string;
}

export interface FrequencyLimitResult {
  success: boolean;
  limits?: {
    daily?: number;
    weekly?: number;
  };
  error?: string;
}

export interface FrequencyCheckResult {
  withinLimit: boolean;
  sent: number;
  remaining: number;
  limit?: number;
}

export interface UnsubscribeResult {
  success: boolean;
  preferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  error?: string;
}

export interface UnsubscribeTokenResult {
  success: boolean;
  token?: string;
  unsubscribeUrl?: string;
  error?: string;
}

export interface NotificationCheckResult {
  canSend: boolean;
  bypassReason?: string;
  reason?: string;
}

export interface PreferenceSummary {
  channels: {
    email: { enabled: boolean };
    sms: { enabled: boolean };
    push: { enabled: boolean };
  };
  frequencyLimits: {
    daily?: number;
    weekly?: number;
  };
  summary: {
    enabledChannels: number;
    disabledChannels: number;
    hasFrequencyLimits: boolean;
  };
}

export interface GlobalPreferenceStats {
  totalUsers: number;
  email: { enabled: number; percentage: number };
  sms: { enabled: number; percentage: number };
  push: { enabled: number; percentage: number };
  allChannelsDisabled: number;
  averageDailyLimit: number;
}

export interface PushTokenResult {
  success: boolean;
  tokens?: string[];
  error?: string;
}

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async updateEmailPreference(userId: string, enabled: boolean): Promise<PreferenceUpdateResult> {
    try {
      const userPreferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          emailNotifications: enabled,
          smsNotifications: true,
          pushNotifications: true,
        },
        update: {
          emailNotifications: enabled,
        },
      });

      return {
        success: true,
        preferences: {
          email: userPreferences.emailNotifications,
          sms: userPreferences.smsNotifications,
          push: userPreferences.pushNotifications,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update email preference for user ${userId}`, error);
      return { success: false, error: 'Failed to update email preference' };
    }
  }

  async updateSMSPreference(userId: string, enabled: boolean): Promise<PreferenceUpdateResult> {
    try {
      const userPreferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          emailNotifications: true,
          smsNotifications: enabled,
          pushNotifications: true,
        },
        update: {
          smsNotifications: enabled,
        },
      });

      return {
        success: true,
        preferences: {
          email: userPreferences.emailNotifications,
          sms: userPreferences.smsNotifications,
          push: userPreferences.pushNotifications,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update SMS preference for user ${userId}`, error);
      return { success: false, error: 'Failed to update SMS preference' };
    }
  }

  async updatePushPreference(userId: string, enabled: boolean): Promise<PreferenceUpdateResult> {
    try {
      const userPreferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: enabled,
        },
        update: {
          pushNotifications: enabled,
        },
      });

      return {
        success: true,
        preferences: {
          email: userPreferences.emailNotifications,
          sms: userPreferences.smsNotifications,
          push: userPreferences.pushNotifications,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update push preference for user ${userId}`, error);
      return { success: false, error: 'Failed to update push preference' };
    }
  }

  async setFrequencyLimit(userId: string, type: 'daily' | 'weekly', limit: number): Promise<FrequencyLimitResult> {
    if (type === 'daily' && (limit < 1 || limit > 100)) {
      return { success: false, error: 'Daily limit must be between 1 and 100' };
    }
    if (type === 'weekly' && (limit < 1 || limit > 500)) {
      return { success: false, error: 'Weekly limit must be between 1 and 500' };
    }

    try {
      // Store frequency limits in preferences JSON field since schema doesn't have dedicated fields
      const userPreferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
          preferences: JSON.stringify({ [`${type}Limit`]: limit }),
        },
        update: {
          preferences: {
            set: JSON.stringify({ [`${type}Limit`]: limit }),
          },
        },
      });

      return {
        success: true,
        limits: { [type]: limit },
      };
    } catch (error) {
      this.logger.error(`Failed to set frequency limit for user ${userId}`, error);
      return { success: false, error: 'Failed to set frequency limit' };
    }
  }

  async checkFrequencyLimit(userId: string, type: 'daily' | 'weekly'): Promise<FrequencyCheckResult> {
    try {
      const preferences = await this.prisma.userPreferences.findUnique({
        where: { userId },
      });

      if (!preferences) {
        return { withinLimit: true, sent: 0, remaining: Infinity };
      }

      // Parse frequency limits from preferences JSON
      let limit: number | undefined;
      try {
        const prefsJson = preferences.preferences ? JSON.parse(preferences.preferences) : {};
        limit = prefsJson[`${type}Limit`];
      } catch {
        limit = undefined;
      }
      
      if (!limit) {
        return { withinLimit: true, sent: 0, remaining: Infinity };
      }

      const now = new Date();
      const startDate = type === 'daily' 
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

      const sent = await this.prisma.notification.count({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
      });

      const remaining = Math.max(0, limit - sent);

      return {
        withinLimit: sent < limit,
        sent,
        remaining,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to check frequency limit for user ${userId}`, error);
      return { withinLimit: true, sent: 0, remaining: Infinity };
    }
  }

  async unsubscribeAll(userId: string): Promise<UnsubscribeResult> {
    try {
      const userPreferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          emailNotifications: false,
          smsNotifications: false,
          pushNotifications: false,
        },
        update: {
          emailNotifications: false,
          smsNotifications: false,
          pushNotifications: false,
        },
      });

      return {
        success: true,
        preferences: {
          email: userPreferences.emailNotifications,
          sms: userPreferences.smsNotifications,
          push: userPreferences.pushNotifications,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to unsubscribe all for user ${userId}`, error);
      return { success: false, error: 'Failed to unsubscribe all notifications' };
    }
  }

  async unsubscribeByEmail(unsubscribeToken: string): Promise<UnsubscribeResult> {
    // UnsubscribeToken model doesn't exist in schema, return stub implementation
    return { success: false, error: 'Unsubscribe token feature not implemented - model not available' };
  }

  async resubscribeAll(userId: string): Promise<UnsubscribeResult> {
    try {
      const userPreferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
        },
        update: {
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
        },
      });

      return {
        success: true,
        preferences: {
          email: userPreferences.emailNotifications,
          sms: userPreferences.smsNotifications,
          push: userPreferences.pushNotifications,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to resubscribe all for user ${userId}`, error);
      return { success: false, error: 'Failed to resubscribe' };
    }
  }

  async generateUnsubscribeToken(userId: string): Promise<UnsubscribeTokenResult> {
    // UnsubscribeToken model doesn't exist in schema, return stub implementation
    return { success: false, error: 'Unsubscribe token feature not implemented - model not available' };
  }

  async addPushToken(userId: string, token: string): Promise<PushTokenResult> {
    try {
      await this.prisma.deviceToken.upsert({
        where: { token },
        create: { userId, token, platform: 'web', active: true },
        update: { active: true },
      });

      const userTokens = await this.prisma.deviceToken.findMany({
        where: { userId, active: true },
        select: { token: true },
      });

      return { success: true, tokens: userTokens.map(t => t.token) };
    } catch (error) {
      this.logger.error(`Failed to add push token for user ${userId}`, error);
      return { success: false, error: 'Failed to add push token' };
    }
  }

  async removePushToken(userId: string, token: string): Promise<PushTokenResult> {
    try {
      await this.prisma.deviceToken.deleteMany({
        where: { userId, token },
      });

      const userTokens = await this.prisma.deviceToken.findMany({
        where: { userId, active: true },
        select: { token: true },
      });

      return { success: true, tokens: userTokens.map(t => t.token) };
    } catch (error) {
      this.logger.error(`Failed to remove push token for user ${userId}`, error);
      return { success: false, error: 'Failed to remove push token' };
    }
  }

  async canSendNotification(
    userId: string,
    type: string,
    channel?: 'email' | 'sms' | 'push'
  ): Promise<NotificationCheckResult> {
    if (type === 'emergency') {
      return { canSend: true, bypassReason: 'Emergency notification' };
    }

    try {
      const preferences = await this.prisma.userPreferences.findUnique({
        where: { userId },
      });

      if (!preferences) {
        return { canSend: true, reason: 'No preferences set, default to enabled' };
      }

      if (channel) {
        const channelEnabled = channel === 'email' 
          ? preferences.emailNotifications
          : channel === 'sms'
          ? preferences.smsNotifications
          : preferences.pushNotifications;

        if (!channelEnabled) {
          return { canSend: false, reason: `${channel} notifications disabled by user` };
        }
      }

      // Check frequency limits
      const dailyCheck = await this.checkFrequencyLimit(userId, 'daily');
      if (!dailyCheck.withinLimit) {
        return { canSend: false, reason: 'Daily frequency limit exceeded' };
      }

      return { canSend: true };
    } catch (error) {
      this.logger.error(`Failed to check notification permissions for user ${userId}`, error);
      return { canSend: true, reason: 'Error checking permissions, allowing by default' };
    }
  }

  async getPreferenceSummary(userId: string): Promise<PreferenceSummary> {
    try {
      const preferences = await this.prisma.userPreferences.findUnique({
        where: { userId },
      });

      if (!preferences) {
        return {
          channels: {
            email: { enabled: true },
            sms: { enabled: true },
            push: { enabled: true },
          },
          frequencyLimits: {},
          summary: {
            enabledChannels: 3,
            disabledChannels: 0,
            hasFrequencyLimits: false,
          },
        };
      }

      const enabledChannels = [
        preferences.emailNotifications,
        preferences.smsNotifications,
        preferences.pushNotifications,
      ].filter(Boolean).length;

      // Parse frequency limits from preferences JSON
      let dailyLimit: number | undefined;
      let weeklyLimit: number | undefined;
      try {
        const prefsJson = preferences.preferences ? JSON.parse(preferences.preferences) : {};
        dailyLimit = prefsJson.dailyLimit;
        weeklyLimit = prefsJson.weeklyLimit;
      } catch {
        // Ignore parse errors
      }

      return {
        channels: {
          email: { enabled: preferences.emailNotifications },
          sms: { enabled: preferences.smsNotifications },
          push: { enabled: preferences.pushNotifications },
        },
        frequencyLimits: {
          daily: dailyLimit,
          weekly: weeklyLimit,
        },
        summary: {
          enabledChannels,
          disabledChannels: 3 - enabledChannels,
          hasFrequencyLimits: !!(dailyLimit || weeklyLimit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get preference summary for user ${userId}`, error);
      throw error;
    }
  }

  async getGlobalPreferenceStatistics(): Promise<GlobalPreferenceStats> {
    try {
      const totalUsers = await this.prisma.user.count();
      const preferences = await this.prisma.userPreferences.findMany();

      const emailEnabled = preferences.filter(p => p.emailNotifications).length;
      const smsEnabled = preferences.filter(p => p.smsNotifications).length;
      const pushEnabled = preferences.filter(p => p.pushNotifications).length;
      const allChannelsDisabledCount = preferences.filter(p => !p.emailNotifications && !p.smsNotifications && !p.pushNotifications).length;

      let totalDailyLimit = 0;
      preferences.forEach(p => {
        try {
          const prefsJson = p.preferences ? JSON.parse(p.preferences) : {};
          totalDailyLimit += prefsJson.dailyLimit || 0;
        } catch {
          // Ignore parse errors
        }
      });

      const averageDailyLimit = preferences.length > 0 ? totalDailyLimit / preferences.length : 0;

      return {
        totalUsers,
        email: {
          enabled: emailEnabled,
          percentage: preferences.length > 0 ? (emailEnabled / preferences.length) * 100 : 0,
        },
        sms: {
          enabled: smsEnabled,
          percentage: preferences.length > 0 ? (smsEnabled / preferences.length) * 100 : 0,
        },
        push: {
          enabled: pushEnabled,
          percentage: preferences.length > 0 ? (pushEnabled / preferences.length) * 100 : 0,
        },
        allChannelsDisabled: allChannelsDisabledCount,
        averageDailyLimit: Math.round(averageDailyLimit),
      };
    } catch (error) {
      this.logger.error('Failed to get global preference statistics', error);
      throw error;
    }
  }
}
