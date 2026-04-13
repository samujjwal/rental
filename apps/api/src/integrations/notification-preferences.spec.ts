import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferenceService } from './notification-preference.service';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

describe('NotificationPreferenceService', () => {
  let service: NotificationPreferenceService;
  let prismaService: any;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const mockPrismaService: any = {
      userPreferences: {
        findUnique: jest.fn() as jest.Mock,
        upsert: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
      },
      user: {
        count: jest.fn() as jest.Mock,
      },
      deviceToken: {
        upsert: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        deleteMany: jest.fn() as jest.Mock,
      },
      notification: {
        count: jest.fn() as jest.Mock,
      },
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferenceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferenceService>(NotificationPreferenceService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    logger = module.get(Logger) as jest.Mocked<Logger>;
  });

  describe('Email Preference Management', () => {
    it('should enable email notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.updateEmailPreference(userId, true);

      expect(result.success).toBe(true);
      expect(result.preferences?.email).toBe(true);
      expect(prismaService.userPreferences.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
        },
        update: {
          emailNotifications: true,
        },
      });
    });

    it('should disable email notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: false,
        smsNotifications: true,
        pushNotifications: true,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.updateEmailPreference(userId, false);

      expect(result.success).toBe(true);
      expect(result.preferences?.email).toBe(false);
    });

    it('should handle errors when updating email preference', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.upsert.mockRejectedValue(new Error('Database error'));

      const result = await service.updateEmailPreference(userId, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update email preference');
      // Logger.error may or may not be called depending on service implementation
    });
  });

  describe('SMS Preference Management', () => {
    it('should enable SMS notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.updateSMSPreference(userId, true);

      expect(result.success).toBe(true);
      expect(result.preferences?.sms).toBe(true);
    });

    it('should disable SMS notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.updateSMSPreference(userId, false);

      expect(result.success).toBe(true);
      expect(result.preferences?.sms).toBe(false);
    });

    it('should handle errors when updating SMS preference', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.upsert.mockRejectedValue(new Error('Database error'));

      const result = await service.updateSMSPreference(userId, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update SMS preference');
    });
  });

  describe('Push Notification Preferences', () => {
    it('should enable push notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.updatePushPreference(userId, true);

      expect(result.success).toBe(true);
      expect(result.preferences?.push).toBe(true);
    });

    it('should disable push notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: false,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.updatePushPreference(userId, false);

      expect(result.success).toBe(true);
      expect(result.preferences?.push).toBe(false);
    });

    it('should handle errors when updating push preference', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.upsert.mockRejectedValue(new Error('Database error'));

      const result = await service.updatePushPreference(userId, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update push preference');
    });

    it('should add push token', async () => {
      const userId = 'user-123';
      const token = 'new-push-token';
      const mockTokens = [
        { token: 'existing-token' },
        { token: 'new-push-token' },
      ];

      prismaService.deviceToken.upsert.mockResolvedValue({} as any);
      prismaService.deviceToken.findMany.mockResolvedValue(mockTokens as any);

      const result = await service.addPushToken(userId, token);

      expect(result.success).toBe(true);
      expect(result.tokens).toEqual(['existing-token', 'new-push-token']);
      expect(prismaService.deviceToken.upsert).toHaveBeenCalledWith({
        where: { token },
        create: { userId, token, platform: 'web', active: true },
        update: { active: true },
      });
    });

    it('should remove push token', async () => {
      const userId = 'user-123';
      const token = 'token-to-remove';
      const mockTokens = [
        { token: 'token1' },
        { token: 'token2' },
      ];

      prismaService.deviceToken.deleteMany.mockResolvedValue({ count: 1 } as any);
      prismaService.deviceToken.findMany.mockResolvedValue(mockTokens as any);

      const result = await service.removePushToken(userId, token);

      expect(result.success).toBe(true);
      expect(result.tokens).toEqual(['token1', 'token2']);
      expect(prismaService.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { userId, token },
      });
    });
  });

  describe('Notification Frequency Limits', () => {
    it('should set daily notification limit', async () => {
      const userId = 'user-123';
      const dailyLimit = 10;
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        preferences: JSON.stringify({ dailyLimit: 10 }),
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.setFrequencyLimit(userId, 'daily', dailyLimit);

      expect(result.success).toBe(true);
      expect(result.limits?.daily).toBe(dailyLimit);
    });

    it('should set weekly notification limit', async () => {
      const userId = 'user-123';
      const weeklyLimit = 50;
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        preferences: JSON.stringify({ weeklyLimit: 50 }),
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.setFrequencyLimit(userId, 'weekly', weeklyLimit);

      expect(result.success).toBe(true);
      expect(result.limits?.weekly).toBe(weeklyLimit);
    });

    it('should validate daily frequency limits', async () => {
      const userId = 'user-123';
      const result1 = await service.setFrequencyLimit(userId, 'daily', 0);
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Daily limit must be between 1 and 100');

      const result2 = await service.setFrequencyLimit(userId, 'daily', 101);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Daily limit must be between 1 and 100');
    });

    it('should validate weekly frequency limits', async () => {
      const userId = 'user-123';
      const result1 = await service.setFrequencyLimit(userId, 'weekly', 0);
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Weekly limit must be between 1 and 500');

      const result2 = await service.setFrequencyLimit(userId, 'weekly', 501);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Weekly limit must be between 1 and 500');
    });

    it('should check if user is within frequency limits', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        preferences: JSON.stringify({ dailyLimit: 10 }),
      };

      prismaService.userPreferences.findUnique.mockResolvedValue(mockPreferences as any);
      prismaService.notification.count.mockResolvedValue(5);

      const result = await service.checkFrequencyLimit(userId, 'daily');

      expect(result.withinLimit).toBe(true);
      expect(result.sent).toBe(5);
      expect(result.remaining).toBe(5);
      expect(result.limit).toBe(10);
    });

    it('should return withinLimit true when no preferences exist', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.checkFrequencyLimit(userId, 'daily');

      expect(result.withinLimit).toBe(true);
      expect(result.sent).toBe(0);
      expect(result.remaining).toBe(Infinity);
    });

    it('should handle errors when checking frequency limit', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.checkFrequencyLimit(userId, 'daily');

      expect(result.withinLimit).toBe(true);
      expect(result.sent).toBe(0);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe('Unsubscribe Functionality', () => {
    it('should unsubscribe user from all notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: false,
        smsNotifications: false,
        pushNotifications: false,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.unsubscribeAll(userId);

      expect(result.success).toBe(true);
      expect(result.preferences?.email).toBe(false);
      expect(result.preferences?.sms).toBe(false);
      expect(result.preferences?.push).toBe(false);
    });

    it('should handle errors when unsubscribing all', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.upsert.mockRejectedValue(new Error('Database error'));

      const result = await service.unsubscribeAll(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to unsubscribe all notifications');
    });

    it('should handle email unsubscribe via token (stub)', async () => {
      const unsubscribeToken = 'token-123';

      const result = await service.unsubscribeByEmail(unsubscribeToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsubscribe token feature not implemented - model not available');
    });

    it('should resubscribe to all notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
      };

      prismaService.userPreferences.upsert.mockResolvedValue(mockPreferences as any);

      const result = await service.resubscribeAll(userId);

      expect(result.success).toBe(true);
      expect(result.preferences?.email).toBe(true);
      expect(result.preferences?.sms).toBe(true);
      expect(result.preferences?.push).toBe(true);
    });

    it('should handle errors when resubscribing all', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.upsert.mockRejectedValue(new Error('Database error'));

      const result = await service.resubscribeAll(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to resubscribe');
    });

    it('should generate unsubscribe token (stub)', async () => {
      const userId = 'user-123';

      const result = await service.generateUnsubscribeToken(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsubscribe token feature not implemented - model not available');
    });
  });

  describe('Emergency Notifications', () => {
    it('should bypass preferences for emergency notifications', async () => {
      const userId = 'user-123';

      const result = await service.canSendNotification(userId, 'emergency');

      expect(result.canSend).toBe(true);
      expect(result.bypassReason).toBe('Emergency notification');
    });

    it('should respect preferences for non-emergency notifications', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        preferences: JSON.stringify({ dailyLimit: 10 }),
      };

      prismaService.userPreferences.findUnique.mockResolvedValue(mockPreferences as any);
      prismaService.notification.count.mockResolvedValue(5);

      const result = await service.canSendNotification(userId, 'booking');

      expect(result.canSend).toBe(true);
    });

    it('should respect preferences when channel is disabled', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: false,
        smsNotifications: true,
        pushNotifications: true,
        preferences: JSON.stringify({ dailyLimit: 10 }),
      };

      prismaService.userPreferences.findUnique.mockResolvedValue(mockPreferences as any);

      const result = await service.canSendNotification(userId, 'booking', 'email');

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('email notifications disabled by user');
    });

    it('should check channel-specific preferences for SMS', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        preferences: JSON.stringify({ dailyLimit: 10 }),
      };

      prismaService.userPreferences.findUnique.mockResolvedValue(mockPreferences as any);

      const result = await service.canSendNotification(userId, 'booking', 'sms');

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('sms notifications disabled by user');
    });

    it('should check channel-specific preferences for push', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: false,
        preferences: JSON.stringify({ dailyLimit: 10 }),
      };

      prismaService.userPreferences.findUnique.mockResolvedValue(mockPreferences as any);

      const result = await service.canSendNotification(userId, 'booking', 'push');

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('push notifications disabled by user');
    });

    it('should block when daily frequency limit exceeded', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        preferences: JSON.stringify({ dailyLimit: 5 }),
      };

      prismaService.userPreferences.findUnique.mockResolvedValue(mockPreferences as any);
      prismaService.notification.count.mockResolvedValue(5);

      const result = await service.canSendNotification(userId, 'booking');

      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('Daily frequency limit exceeded');
    });

    it('should allow by default when no preferences set', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.canSendNotification(userId, 'booking');

      expect(result.canSend).toBe(true);
      expect(result.reason).toBe('No preferences set, default to enabled');
    });

    it('should handle errors when checking notification permissions', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.canSendNotification(userId, 'booking');

      expect(result.canSend).toBe(true);
      expect(result.reason).toBe('Error checking permissions, allowing by default');
    });
  });

  describe('Preference Analytics', () => {
    it('should get user preference summary', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: false,
        preferences: JSON.stringify({ dailyLimit: 10, weeklyLimit: 50 }),
      };

      prismaService.userPreferences.findUnique.mockResolvedValue(mockPreferences as any);

      const result = await service.getPreferenceSummary(userId);

      expect(result.channels.email.enabled).toBe(true);
      expect(result.channels.sms.enabled).toBe(true);
      expect(result.channels.push.enabled).toBe(false);
      expect(result.frequencyLimits.daily).toBe(10);
      expect(result.frequencyLimits.weekly).toBe(50);
      expect(result.summary.enabledChannels).toBe(2);
      expect(result.summary.disabledChannels).toBe(1);
      expect(result.summary.hasFrequencyLimits).toBe(true);
    });

    it('should return default summary when no preferences exist', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getPreferenceSummary(userId);

      expect(result.channels.email.enabled).toBe(true);
      expect(result.channels.sms.enabled).toBe(true);
      expect(result.channels.push.enabled).toBe(true);
      expect(result.summary.enabledChannels).toBe(3);
      expect(result.summary.disabledChannels).toBe(0);
      expect(result.summary.hasFrequencyLimits).toBe(false);
    });

    it('should handle errors when getting preference summary', async () => {
      const userId = 'user-123';
      prismaService.userPreferences.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.getPreferenceSummary(userId)).rejects.toThrow();
    });

    it('should get global preference statistics', async () => {
      const mockPreferences = [
        { emailNotifications: true, smsNotifications: true, pushNotifications: true, preferences: JSON.stringify({ dailyLimit: 10 }) },
        { emailNotifications: true, smsNotifications: false, pushNotifications: true, preferences: JSON.stringify({ dailyLimit: 20 }) },
        { emailNotifications: false, smsNotifications: false, pushNotifications: false, preferences: null },
        { emailNotifications: true, smsNotifications: true, pushNotifications: true, preferences: JSON.stringify({ dailyLimit: 30 }) },
      ];

      prismaService.user.count.mockResolvedValue(100);
      prismaService.userPreferences.findMany.mockResolvedValue(mockPreferences as any);

      const result = await service.getGlobalPreferenceStatistics();

      expect(result.totalUsers).toBe(100);
      expect(result.email.enabled).toBe(3);
      expect(result.email.percentage).toBe(75);
      expect(result.sms.enabled).toBe(2);
      expect(result.sms.percentage).toBe(50);
      expect(result.push.enabled).toBe(3);
      expect(result.push.percentage).toBe(75);
      expect(result.allChannelsDisabled).toBe(1);
      expect(result.averageDailyLimit).toBe(15);
    });

    it('should handle errors when getting global statistics', async () => {
      prismaService.user.count.mockRejectedValue(new Error('Database error'));

      await expect(service.getGlobalPreferenceStatistics()).rejects.toThrow();
    });
  });
});
