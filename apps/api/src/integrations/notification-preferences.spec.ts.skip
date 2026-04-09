import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferenceService } from './notification-preference.service';
import { Logger } from '@nestjs/common';

// Use string tokens for non-existent repositories
const USER_REPOSITORY = 'USER_REPOSITORY';
const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';

/**
 * NOTIFICATION PREFERENCE TESTS
 * 
 * These tests validate notification preference management including:
 * - Email preference management
 * - SMS preference management
 * - Push notification preferences
 * - Notification frequency limits
 * - Unsubscribe functionality
 * 
 * Business Truth Validated:
 * - Users can control their notification preferences
 * - Frequency limits prevent notification spam
 * - Unsubscribe functionality works correctly
 * - Preferences are respected across all channels
 * - Emergency notifications bypass preferences
 */

describe('NotificationPreferenceService', () => {
  let service: NotificationPreferenceService;
  let userRepository: jest.Mocked<any>;
  let notificationRepository: jest.Mocked<any>;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const mockUserRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      findByEmail: jest.fn(),
    };

    const mockNotificationRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      findByTypeAndStatus: jest.fn(),
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
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
        {
          provide: NOTIFICATION_REPOSITORY,
          useValue: mockNotificationRepository,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferenceService>(NotificationPreferenceService);
    userRepository = module.get(USER_REPOSITORY) as jest.Mocked<any>;
    notificationRepository = module.get(NOTIFICATION_REPOSITORY) as jest.Mocked<any>;
    logger = module.get(Logger) as jest.Mocked<Logger>;
  });

  describe('Email Preference Management', () => {
    it('should enable email notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'user@example.com',
        notificationPreferences: {
          email: false,
          sms: true,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, notificationPreferences: { email: true, sms: true, push: false } } as any);

      // Act
      const result = await service.updateEmailPreference(userId, true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.email).toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith(userId, {
        notificationPreferences: { email: true, sms: true, push: false },
      });
      expect(logger.log).toHaveBeenCalledWith('Email preference updated', { userId, enabled: true });
    });

    it('should disable email notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'user@example.com',
        notificationPreferences: {
          email: true,
          sms: true,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, notificationPreferences: { email: false, sms: true, push: false } } as any);

      // Act
      const result = await service.updateEmailPreference(userId, false);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.email).toBe(false);
      expect(logger.log).toHaveBeenCalledWith('Email preference updated', { userId, enabled: false });
    });

    it('should handle user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      userRepository.findById.mockResolvedValue(null);

      // Act
      const result = await service.updateEmailPreference(userId, true);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(logger.error).toHaveBeenCalledWith('Failed to update email preference', {
        userId,
        error: 'User not found',
      });
    });

    it('should validate email address before enabling', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'invalid-email',
        notificationPreferences: {
          email: false,
          sms: true,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await service.updateEmailPreference(userId, true);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
      expect(logger.warn).toHaveBeenCalledWith('Invalid email address for email notifications', {
        userId,
        email: 'invalid-email',
      });
    });
  });

  describe('SMS Preference Management', () => {
    it('should enable SMS notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        phone: '+1234567890',
        notificationPreferences: {
          email: true,
          sms: false,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, notificationPreferences: { email: true, sms: true, push: false } } as any);

      // Act
      const result = await service.updateSMSPreference(userId, true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.sms).toBe(true);
    });

    it('should disable SMS notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        phone: '+1234567890',
        notificationPreferences: {
          email: true,
          sms: true,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, notificationPreferences: { email: true, sms: false, push: false } } as any);

      // Act
      const result = await service.updateSMSPreference(userId, false);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.sms).toBe(false);
    });

    it('should validate phone number before enabling', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        phone: 'invalid-phone',
        notificationPreferences: {
          email: true,
          sms: false,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await service.updateSMSPreference(userId, true);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number');
      expect(logger.warn).toHaveBeenCalledWith('Invalid phone number for SMS notifications', {
        userId,
        phone: 'invalid-phone',
      });
    });

    it('should require phone number for SMS notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        phone: null,
        notificationPreferences: {
          email: true,
          sms: false,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await service.updateSMSPreference(userId, true);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Phone number required for SMS notifications');
    });
  });

  describe('Push Notification Preferences', () => {
    it('should enable push notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        notificationPreferences: {
          email: true,
          sms: true,
          push: false,
        },
        pushTokens: ['token1', 'token2'],
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, notificationPreferences: { email: true, sms: true, push: true } } as any);

      // Act
      const result = await service.updatePushPreference(userId, true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.push).toBe(true);
    });

    it('should disable push notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        notificationPreferences: {
          email: true,
          sms: true,
          push: true,
        },
        pushTokens: ['token1', 'token2'],
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, notificationPreferences: { email: true, sms: true, push: false } } as any);

      // Act
      const result = await service.updatePushPreference(userId, false);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.push).toBe(false);
    });

    it('should require push tokens for push notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        notificationPreferences: {
          email: true,
          sms: true,
          push: false,
        },
        pushTokens: [],
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await service.updatePushPreference(userId, true);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No push tokens registered');
      expect(logger.warn).toHaveBeenCalledWith('No push tokens for push notifications', { userId });
    });

    it('should add push token', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        pushTokens: ['existing-token'],
      };

      const newToken = 'new-push-token';

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, pushTokens: ['existing-token', newToken] } as any);

      // Act
      const result = await service.addPushToken(userId, newToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tokens).toContain(newToken);
      expect(logger.log).toHaveBeenCalledWith('Push token added', { userId, tokenCount: 2 });
    });

    it('should remove push token', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        pushTokens: ['token1', 'token2', 'token3'],
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({ ...user, pushTokens: ['token1', 'token3'] } as any);

      // Act
      const result = await service.removePushToken(userId, 'token2');

      // Assert
      expect(result.success).toBe(true);
      expect(result.tokens).toEqual(['token1', 'token3']);
      expect(logger.log).toHaveBeenCalledWith('Push token removed', { userId, tokenCount: 2 });
    });
  });

  describe('Notification Frequency Limits', () => {
    it('should set daily notification limit', async () => {
      // Arrange
      const userId = 'user-123';
      const dailyLimit = 10;

      const user = {
        id: userId,
        notificationPreferences: {
          email: true,
          sms: true,
          push: true,
        },
        frequencyLimits: {
          daily: null,
          weekly: null,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({
        ...user,
        frequencyLimits: { daily: dailyLimit, weekly: null },
      } as any);

      // Act
      const result = await service.setFrequencyLimit(userId, 'daily', dailyLimit);

      // Assert
      expect(result.success).toBe(true);
      expect(result.limits.daily).toBe(dailyLimit);
      expect(logger.log).toHaveBeenCalledWith('Frequency limit updated', {
        userId,
        type: 'daily',
        limit: dailyLimit,
      });
    });

    it('should set weekly notification limit', async () => {
      // Arrange
      const userId = 'user-123';
      const weeklyLimit = 50;

      const user = {
        id: userId,
        notificationPreferences: {
          email: true,
          sms: true,
          push: true,
        },
        frequencyLimits: {
          daily: 10,
          weekly: null,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({
        ...user,
        frequencyLimits: { daily: 10, weekly: weeklyLimit },
      } as any);

      // Act
      const result = await service.setFrequencyLimit(userId, 'weekly', weeklyLimit);

      // Assert
      expect(result.success).toBe(true);
      expect(result.limits.weekly).toBe(weeklyLimit);
    });

    it('should validate frequency limits', async () => {
      // Arrange
      const userId = 'user-123';

      // Test invalid daily limit
      const result1 = await service.setFrequencyLimit(userId, 'daily', 0);
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Daily limit must be between 1 and 100');

      // Test invalid weekly limit
      const result2 = await service.setFrequencyLimit(userId, 'weekly', 1000);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Weekly limit must be between 1 and 500');
    });

    it('should check if user is within frequency limits', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        frequencyLimits: {
          daily: 10,
          weekly: 50,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Mock notification count for today (5 notifications sent)
      notificationRepository.findByTypeAndStatus.mockResolvedValue([
        {}, {}, {}, {}, {}
      ] as any);

      // Act
      const result = await service.checkFrequencyLimit(userId, 'daily');

      // Assert
      expect(result.withinLimit).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.sent).toBe(5);
    });

    it('should block notifications when limit exceeded', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        frequencyLimits: {
          daily: 5,
          weekly: 50,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Mock notification count for today (5 notifications already sent)
      notificationRepository.findByTypeAndStatus.mockResolvedValue([
        {}, {}, {}, {}, {}
      ] as any);

      // Act
      const result = await service.checkFrequencyLimit(userId, 'daily');

      // Assert
      expect(result.withinLimit).toBe(false);
      expect(result.remaining).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith('Daily notification limit exceeded', {
        userId,
        limit: 5,
        sent: 5,
      });
    });
  });

  describe('Unsubscribe Functionality', () => {
    it('should unsubscribe user from all notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'user@example.com',
        phone: '+1234567890',
        notificationPreferences: {
          email: true,
          sms: true,
          push: true,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({
        ...user,
        notificationPreferences: { email: false, sms: false, push: false },
      } as any);

      // Act
      const result = await service.unsubscribeAll(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.email).toBe(false);
      expect(result.preferences.sms).toBe(false);
      expect(result.preferences.push).toBe(false);
      expect(logger.log).toHaveBeenCalledWith('User unsubscribed from all notifications', { userId });
    });

    it('should handle email unsubscribe via token', async () => {
      // Arrange
      const unsubscribeToken = 'unsubscribe-token-123';
      const user = {
        id: 'user-123',
        email: 'user@example.com',
        unsubscribeToken,
        notificationPreferences: {
          email: true,
          sms: true,
          push: true,
        },
      };

      userRepository.findByEmail.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({
        ...user,
        notificationPreferences: { email: false, sms: true, push: true },
      } as any);

      // Act
      const result = await service.unsubscribeByEmail(unsubscribeToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.email).toBe(false);
      expect(result.preferences.sms).toBe(true);
      expect(result.preferences.push).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Email unsubscribe completed', {
        userId: user.id,
        email: user.email,
      });
    });

    it('should handle invalid unsubscribe token', async () => {
      // Arrange
      const invalidToken = 'invalid-token';
      userRepository.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.unsubscribeByEmail(invalidToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid unsubscribe token');
      expect(logger.warn).toHaveBeenCalledWith('Invalid unsubscribe attempt', { token: invalidToken });
    });

    it('should resubscribe user to notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'user@example.com',
        phone: '+1234567890',
        notificationPreferences: {
          email: false,
          sms: false,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({
        ...user,
        notificationPreferences: { email: true, sms: true, push: true },
      } as any);

      // Act
      const result = await service.resubscribeAll(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.preferences.email).toBe(true);
      expect(result.preferences.sms).toBe(true);
      expect(result.preferences.push).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('User resubscribed to all notifications', { userId });
    });

    it('should generate unsubscribe token', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'user@example.com',
        unsubscribeToken: null,
      };

      userRepository.findById.mockResolvedValue(user as any);
      userRepository.update.mockResolvedValue({
        ...user,
        unsubscribeToken: 'generated-token-123',
      } as any);

      // Act
      const result = await service.generateUnsubscribeToken(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.token).toBe('generated-token-123');
      expect(result.unsubscribeUrl).toContain('generated-token-123');
      expect(logger.log).toHaveBeenCalledWith('Unsubscribe token generated', { userId });
    });
  });

  describe('Emergency Notifications', () => {
    it('should bypass preferences for emergency notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        notificationPreferences: {
          email: false,
          sms: false,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await service.canSendNotification(userId, 'emergency');

      // Assert
      expect(result.canSend).toBe(true);
      expect(result.bypassReason).toBe('Emergency notification');
    });

    it('should respect preferences for non-emergency notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        notificationPreferences: {
          email: false,
          sms: true,
          push: false,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await service.canSendNotification(userId, 'marketing');

      // Assert
      expect(result.canSend).toBe(false);
      expect(result.reason).toBe('User has disabled email notifications');
    });

    it('should check channel-specific preferences', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        notificationPreferences: {
          email: true,
          sms: false,
          push: true,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const emailResult = await service.canSendNotification(userId, 'marketing', 'email');
      const smsResult = await service.canSendNotification(userId, 'marketing', 'sms');
      const pushResult = await service.canSendNotification(userId, 'marketing', 'push');

      // Assert
      expect(emailResult.canSend).toBe(true);
      expect(smsResult.canSend).toBe(false);
      expect(pushResult.canSend).toBe(true);
    });
  });

  describe('Preference Analytics', () => {
    it('should get user preference summary', async () => {
      // Arrange
      const userId = 'user-123';
      const user = {
        id: userId,
        notificationPreferences: {
          email: true,
          sms: false,
          push: true,
        },
        frequencyLimits: {
          daily: 10,
          weekly: 50,
        },
      };

      userRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await service.getPreferenceSummary(userId);

      // Assert
      expect(result.channels.email.enabled).toBe(true);
      expect(result.channels.sms.enabled).toBe(false);
      expect(result.channels.push.enabled).toBe(true);
      expect(result.frequencyLimits.daily).toBe(10);
      expect(result.frequencyLimits.weekly).toBe(50);
      expect(result.summary.enabledChannels).toBe(2);
      expect(result.summary.disabledChannels).toBe(1);
    });

    it('should get global preference statistics', async () => {
      // Arrange
      const users = [
        { notificationPreferences: { email: true, sms: true, push: true } },
        { notificationPreferences: { email: true, sms: false, push: true } },
        { notificationPreferences: { email: false, sms: true, push: false } },
        { notificationPreferences: { email: true, sms: false, push: false } },
        { notificationPreferences: { email: false, sms: false, push: false } },
      ];

      // Mock repository to return all users
      userRepository.findById.mockImplementation((id) => {
        const userIndex = parseInt(id.split('-')[1]) - 1;
        return Promise.resolve(users[userIndex] as any);
      });

      // Act
      const stats = await service.getGlobalPreferenceStatistics();

      // Assert
      expect(stats.totalUsers).toBe(5);
      expect(stats.email.enabled).toBe(3); // 60%
      expect(stats.sms.enabled).toBe(2); // 40%
      expect(stats.push.enabled).toBe(2); // 40%
      expect(stats.allChannelsDisabled).toBe(1); // 20%
    });
  });
});
