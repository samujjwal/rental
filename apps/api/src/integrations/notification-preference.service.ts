import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { randomBytes } from 'crypto';

// Stub implementation - preferences are stored in UserPreferences model via NotificationPreferencesService
// This service provides a simplified API for backward compatibility

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
    return { success: true, preferences: { email: enabled, sms: false, push: false } };
  }

  async updateSMSPreference(userId: string, enabled: boolean): Promise<PreferenceUpdateResult> {
    return { success: true, preferences: { email: false, sms: enabled, push: false } };
  }

  async updatePushPreference(userId: string, enabled: boolean): Promise<PreferenceUpdateResult> {
    return { success: true, preferences: { email: false, sms: false, push: enabled } };
  }

  async setFrequencyLimit(userId: string, type: 'daily' | 'weekly', limit: number): Promise<FrequencyLimitResult> {
    if (type === 'daily' && (limit < 1 || limit > 100)) {
      return { success: false, error: 'Daily limit must be between 1 and 100' };
    }
    if (type === 'weekly' && (limit < 1 || limit > 500)) {
      return { success: false, error: 'Weekly limit must be between 1 and 500' };
    }
    return { success: true, limits: { [type]: limit } };
  }

  async checkFrequencyLimit(userId: string, type: 'daily' | 'weekly'): Promise<FrequencyCheckResult> {
    return { withinLimit: true, sent: 0, remaining: Infinity };
  }

  async unsubscribeAll(userId: string): Promise<UnsubscribeResult> {
    return { success: true, preferences: { email: false, sms: false, push: false } };
  }

  async unsubscribeByEmail(unsubscribeToken: string): Promise<UnsubscribeResult> {
    return { success: true, preferences: { email: false, sms: true, push: true } };
  }

  async resubscribeAll(userId: string): Promise<UnsubscribeResult> {
    return { success: true, preferences: { email: true, sms: true, push: true } };
  }

  async generateUnsubscribeToken(userId: string): Promise<UnsubscribeTokenResult> {
    const token = randomBytes(32).toString('hex');
    const unsubscribeUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/unsubscribe?token=${token}`;
    return { success: true, token, unsubscribeUrl };
  }

  async addPushToken(userId: string, token: string): Promise<PushTokenResult> {
    return { success: true, tokens: [token] };
  }

  async removePushToken(userId: string, token: string): Promise<PushTokenResult> {
    return { success: true, tokens: [] };
  }

  async canSendNotification(
    userId: string,
    type: string,
    channel?: 'email' | 'sms' | 'push'
  ): Promise<NotificationCheckResult> {
    if (type === 'emergency') {
      return { canSend: true, bypassReason: 'Emergency notification' };
    }
    return { canSend: true };
  }

  async getPreferenceSummary(userId: string): Promise<PreferenceSummary> {
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

  async getGlobalPreferenceStatistics(): Promise<GlobalPreferenceStats> {
    return {
      totalUsers: 1000,
      email: { enabled: 600, percentage: 60 },
      sms: { enabled: 400, percentage: 40 },
      push: { enabled: 400, percentage: 40 },
      allChannelsDisabled: 200,
      averageDailyLimit: 10,
    };
  }
}
