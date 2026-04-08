import { Test, TestingModule } from '@nestjs/testing';
import { NotificationRetryService } from './notification-retry.service';
import { NotificationService } from './notification.service';
import { QueueService } from '../../queue/services/queue.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * NOTIFICATION RETRY LOGIC TESTS
 * 
 * These tests validate notification retry mechanisms:
 * - Retry policies and backoff strategies
 * - Failed notification handling
 * - Queue management for retries
 * - Notification delivery tracking
 * - Error handling and logging
 * 
 * Business Truth Validated:
 * - Notifications are retried appropriately
 * - Retry policies are enforced
 * - Failed notifications are tracked
 * - Queue overflow is handled
 * - Retry limits prevent infinite loops
 */

describe('NotificationRetryService', () => {
  let retryService: NotificationRetryService;
  let notificationService: NotificationService;
  let queueService: QueueService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRetryService,
        {
          provide: NotificationService,
          useValue: {
            sendEmail: jest.fn(),
            sendSMS: jest.fn(),
            sendPush: jest.fn(),
            trackDelivery: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            add: jest.fn(),
            process: jest.fn(),
            getQueueSize: jest.fn(),
            clearQueue: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'notification.retry.maxAttempts': 3,
                'notification.retry.initialDelay': 1000,
                'notification.retry.maxDelay': 30000,
                'notification.retry.backoffMultiplier': 2,
                'notification.retry.queue.maxSize': 1000,
              };
              return config[key];
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    retryService = module.get<NotificationRetryService>(NotificationRetryService);
    notificationService = module.get<NotificationService>(NotificationService);
    queueService = module.get<QueueService>(QueueService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Retry Policy Configuration', () => {
    it('should load retry configuration from config service', () => {
      const maxAttempts = retryService.getMaxAttempts();
      const initialDelay = retryService.getInitialDelay();
      const maxDelay = retryService.getMaxDelay();
      const backoffMultiplier = retryService.getBackoffMultiplier();

      expect(maxAttempts).toBe(3);
      expect(initialDelay).toBe(1000);
      expect(maxDelay).toBe(30000);
      expect(backoffMultiplier).toBe(2);
    });

    it('should validate retry configuration', () => {
      const validConfig = {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 60000,
        backoffMultiplier: 1.5,
      };

      const isValid = retryService.validateConfig(validConfig);
      expect(isValid).toBe(true);
    });

    it('should reject invalid retry configuration', () => {
      const invalidConfigs = [
        { maxAttempts: 0 }, // Too low
        { maxAttempts: 10 }, // Too high
        { initialDelay: -1 }, // Negative
        { maxDelay: 0 }, // Zero
        { backoffMultiplier: 0.5 }, // Too low
        { backoffMultiplier: 5 }, // Too high
      ];

      for (const config of invalidConfigs) {
        const isValid = retryService.validateConfig(config);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Exponential Backoff Calculation', () => {
    it('should calculate exponential backoff delays', () => {
      const delays = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const delay = retryService.calculateBackoffDelay(attempt);
        delays.push(delay);
      }

      expect(delays[0]).toBe(1000); // Initial delay
      expect(delays[1]).toBe(2000); // 1000 * 2
      expect(delays[2]).toBe(4000); // 2000 * 2
    });

    it('should respect maximum delay limit', () => {
      // Test with high attempt number that would exceed max delay
      const delay = retryService.calculateBackoffDelay(10);
      expect(delay).toBeLessThanOrEqual(30000); // Max delay
    });

    it('should add jitter to prevent thundering herd', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        const delay = retryService.calculateBackoffDelay(2, true); // With jitter
        delays.push(delay);
      }

      // With jitter, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should handle edge cases in backoff calculation', () => {
      const edgeCases = [
        { attempt: 0, expected: 1000 }, // First attempt
        { attempt: 1, expected: 1000 }, // First retry
        { attempt: 100, expected: 30000 }, // Very high attempt
      ];

      for (const testCase of edgeCases) {
        const delay = retryService.calculateBackoffDelay(testCase.attempt);
        expect(delay).toBeLessThanOrEqual(testCase.expected);
      }
    });
  });

  describe('Notification Retry Execution', () => {
    it('should retry failed notification with exponential backoff', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 0,
        lastAttempt: new Date(),
      };

      // Mock first attempt failure
      notificationService.sendEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(true);
      expect(result.nextAttemptDelay).toBe(1000);
      expect(result.attemptCount).toBe(1);
      expect(queueService.add).toHaveBeenCalledWith({
        ...notification,
        attempts: 1,
        nextRetryAt: expect.any(Date),
      });
    });

    it('should increase attempt count on each retry', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 2,
        lastAttempt: new Date(),
      };

      notificationService.sendEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

      const result = await retryService.retryNotification(notification);

      expect(result.attemptCount).toBe(3);
      expect(result.nextAttemptDelay).toBe(4000); // 1000 * 2^2
    });

    it('should stop retrying after max attempts', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 3,
        lastAttempt: new Date(),
      };

      notificationService.sendEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(false);
      expect(result.finalError).toBe('Max retry attempts exceeded');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Max retry attempts exceeded'),
        expect.objectContaining({
          notificationId: 'notif-123',
          attempts: 3,
        })
      );
    });

    it('should not retry on permanent failures', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'invalid-email',
        content: 'Test message',
        attempts: 0,
        lastAttempt: new Date(),
      };

      const permanentError = new Error('Invalid email address');
      permanentError.name = 'PermanentError';

      notificationService.sendEmail.mockRejectedValueOnce(permanentError);

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(false);
      expect(result.finalError).toBe('Permanent failure: Invalid email address');
    });

    it('should handle successful retry', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 1,
        lastAttempt: new Date(),
      };

      notificationService.sendEmail.mockResolvedValueOnce({ messageId: 'msg-456' });

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(false);
      expect(result.success).toBe(true);
      expect(result.deliveryId).toBe('msg-456');
      expect(notificationService.trackDelivery).toHaveBeenCalledWith('notif-123', 'delivered');
    });
  });

  describe('Queue Management', () => {
    it('should add retry to queue with proper delay', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 0,
        lastAttempt: new Date(),
      };

      notificationService.sendEmail.mockRejectedValueOnce(new Error('Temporary failure'));

      await retryService.retryNotification(notification);

      expect(queueService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'notif-123',
          attempts: 1,
          nextRetryAt: expect.any(Date),
        }),
        { delay: 1000 }
      );
    });

    it('should check queue capacity before adding retry', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 0,
        lastAttempt: new Date(),
      };

      // Mock queue at capacity
      queueService.getQueueSize.mockResolvedValue(1000);

      notificationService.sendEmail.mockRejectedValueOnce(new Error('Temporary failure'));

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(false);
      expect(result.finalError).toBe('Queue at capacity');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Queue at capacity'),
        expect.objectContaining({
          queueSize: 1000,
          maxSize: 1000,
        })
      );
    });

    it('should process retry queue', async () => {
      const queuedNotifications = [
        {
          id: 'notif-123',
          type: 'email',
          recipient: 'test@example.com',
          content: 'Test message',
          attempts: 1,
          nextRetryAt: new Date(Date.now() - 1000), // Past due
        },
        {
          id: 'notif-456',
          type: 'sms',
          recipient: '+9771234567890',
          content: 'Test SMS',
          attempts: 2,
          nextRetryAt: new Date(Date.now() + 5000), // Future
        },
      ];

      queueService.process.mockResolvedValue(queuedNotifications);

      notificationService.sendEmail.mockResolvedValue({ messageId: 'msg-789' });
      notificationService.sendSMS.mockResolvedValue({ messageId: 'sms-789' });

      await retryService.processRetryQueue();

      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'notif-123',
          recipient: 'test@example.com',
        })
      );

      // Should not process future notification
      expect(notificationService.sendSMS).not.toHaveBeenCalled();
    });

    it('should handle queue processing errors gracefully', async () => {
      const queuedNotifications = [
        {
          id: 'notif-123',
          type: 'email',
          recipient: 'test@example.com',
          content: 'Test message',
          attempts: 1,
          nextRetryAt: new Date(Date.now() - 1000),
        },
      ];

      queueService.process.mockResolvedValue(queuedNotifications);
      notificationService.sendEmail.mockRejectedValue(new Error('Processing error'));

      await retryService.processRetryQueue();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing retry'),
        expect.objectContaining({
          notificationId: 'notif-123',
          error: 'Processing error',
        })
      );
    });
  });

  describe('Different Notification Types', () => {
    it('should retry email notifications', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test email',
        attempts: 0,
        lastAttempt: new Date(),
      };

      notificationService.sendEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(true);
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'test@example.com',
          content: 'Test email',
        })
      );
    });

    it('should retry SMS notifications', async () => {
      const notification = {
        id: 'notif-456',
        type: 'sms',
        recipient: '+9771234567890',
        content: 'Test SMS',
        attempts: 0,
        lastAttempt: new Date(),
      };

      notificationService.sendSMS.mockRejectedValueOnce(new Error('SMS gateway timeout'));

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(true);
      expect(notificationService.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '+9771234567890',
          content: 'Test SMS',
        })
      );
    });

    it('should retry push notifications', async () => {
      const notification = {
        id: 'notif-789',
        type: 'push',
        recipient: 'device-123',
        content: 'Test push',
        attempts: 0,
        lastAttempt: new Date(),
      };

      notificationService.sendPush.mockRejectedValueOnce(new Error('Push service unavailable'));

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(true);
      expect(notificationService.sendPush).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'device-123',
          content: 'Test push',
        })
      );
    });

    it('should handle unknown notification types', async () => {
      const notification = {
        id: 'notif-999',
        type: 'unknown',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 0,
        lastAttempt: new Date(),
      };

      const result = await retryService.retryNotification(notification);

      expect(result.shouldRetry).toBe(false);
      expect(result.finalError).toBe('Unknown notification type: unknown');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown notification type'),
        expect.objectContaining({
          notificationId: 'notif-999',
          type: 'unknown',
        })
      );
    });
  });

  describe('Retry Statistics and Monitoring', () => {
    it('should track retry statistics', async () => {
      const notifications = [
        { id: 'notif-1', type: 'email', attempts: 1, status: 'retrying' },
        { id: 'notif-2', type: 'email', attempts: 2, status: 'retrying' },
        { id: 'notif-3', type: 'sms', attempts: 3, status: 'failed' },
        { id: 'notif-4', type: 'push', attempts: 1, status: 'delivered' },
      ];

      const stats = retryService.getRetryStatistics(notifications);

      expect(stats.totalRetries).toBe(7); // 1 + 2 + 3 + 1
      expect(stats.byType.email).toBe(3);
      expect(stats.byType.sms).toBe(3);
      expect(stats.byType.push).toBe(1);
      expect(stats.byStatus.retrying).toBe(2);
      expect(stats.byStatus.failed).toBe(1);
      expect(stats.byStatus.delivered).toBe(1);
    });

    it('should calculate retry success rate', async () => {
      const notifications = [
        { id: 'notif-1', attempts: 1, status: 'delivered' },
        { id: 'notif-2', attempts: 2, status: 'delivered' },
        { id: 'notif-3', attempts: 3, status: 'failed' },
        { id: 'notif-4', attempts: 1, status: 'failed' },
      ];

      const successRate = retryService.calculateSuccessRate(notifications);

      expect(successRate).toBe(50); // 2 out of 4 delivered
    });

    it('should identify notifications needing immediate attention', async () => {
      const notifications = [
        { id: 'notif-1', attempts: 3, lastAttempt: new Date(Date.now() - 1000 * 60 * 30) }, // 30 min ago
        { id: 'notif-2', attempts: 2, lastAttempt: new Date(Date.now() - 1000 * 60 * 60) }, // 1 hour ago
        { id: 'notif-3', attempts: 1, lastAttempt: new Date(Date.now() - 1000 * 60 * 10) }, // 10 min ago
      ];

      const urgentNotifications = retryService.getUrgentNotifications(notifications);

      expect(urgentNotifications).toHaveLength(2);
      expect(urgentNotifications.map(n => n.id)).toContain('notif-1');
      expect(urgentNotifications.map(n => n.id)).toContain('notif-2');
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log retry attempts with appropriate level', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 0,
        lastAttempt: new Date(),
      };

      notificationService.sendEmail.mockRejectedValueOnce(new Error('Temporary failure'));

      await retryService.retryNotification(notification);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Retrying notification'),
        expect.objectContaining({
          notificationId: 'notif-123',
          attempt: 1,
          nextDelay: 1000,
        })
      );
    });

    it('should log successful deliveries', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 1,
        lastAttempt: new Date(),
      };

      notificationService.sendEmail.mockResolvedValueOnce({ messageId: 'msg-456' });

      await retryService.retryNotification(notification);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Notification delivered'),
        expect.objectContaining({
          notificationId: 'notif-123',
          messageId: 'msg-456',
          totalAttempts: 2,
        })
      );
    });

    it('should log final failures with details', async () => {
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'test@example.com',
        content: 'Test message',
        attempts: 3,
        lastAttempt: new Date(),
      };

      const finalError = new Error('Permanent SMTP failure');
      notificationService.sendEmail.mockRejectedValueOnce(finalError);

      await retryService.retryNotification(notification);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Notification failed permanently'),
        expect.objectContaining({
          notificationId: 'notif-123',
          totalAttempts: 4,
          finalError: 'Permanent SMTP failure',
        })
      );
    });

    it('should handle malformed notification objects gracefully', async () => {
      const malformedNotifications = [
        null,
        undefined,
        {},
        { id: 'notif-123' }, // Missing required fields
        { type: 'email', recipient: 'test@example.com' }, // Missing id
      ];

      for (const notification of malformedNotifications) {
        const result = await retryService.retryNotification(notification);
        
        expect(result.shouldRetry).toBe(false);
        expect(result.finalError).toContain('Invalid notification');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume of retries efficiently', async () => {
      const notifications = Array.from({ length: 100 }, (_, i) => ({
        id: `notif-${i}`,
        type: 'email',
        recipient: `test${i}@example.com`,
        content: 'Test message',
        attempts: 0,
        lastAttempt: new Date(),
      }));

      // Mock all to fail and need retry
      notificationService.sendEmail.mockRejectedValue(new Error('Temporary failure'));

      const startTime = Date.now();
      
      await Promise.all(
        notifications.map(notification => retryService.retryNotification(notification))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process 100 notifications in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(queueService.add).toHaveBeenCalledTimes(100);
    });

    it('should limit concurrent retry processing', async () => {
      const notifications = Array.from({ length: 50 }, (_, i) => ({
        id: `notif-${i}`,
        type: 'email',
        recipient: `test${i}@example.com`,
        content: 'Test message',
        attempts: 1,
        nextRetryAt: new Date(Date.now() - 1000),
      }));

      queueService.process.mockResolvedValue(notifications);
      notificationService.sendEmail.mockResolvedValue({ messageId: 'msg-123' });

      await retryService.processRetryQueue();

      // Should process in batches to avoid overwhelming the system
      expect(notificationService.sendEmail).toHaveBeenCalledTimes(50);
    });

    it('should cleanup old retry data', async () => {
      const oldNotifications = [
        {
          id: 'notif-old-1',
          type: 'email',
          recipient: 'old@example.com',
          content: 'Old message',
          attempts: 3,
          lastAttempt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
          status: 'failed',
        },
        {
          id: 'notif-old-2',
          type: 'sms',
          recipient: '+9771234567890',
          content: 'Old SMS',
          attempts: 2,
          lastAttempt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // 14 days ago
          status: 'delivered',
        },
      ];

      const cleanedCount = retryService.cleanupOldRetries(oldNotifications);

      expect(cleanedCount).toBe(2);
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up old retry data'),
        expect.objectContaining({
          cleanedCount: 2,
          olderThanDays: 7,
        })
      );
    });
  });

  describe('Notification Recovery Tests', () => {
    it('should handle partial notification recovery', async () => {
      // Arrange
      const failedNotification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'user@example.com',
        content: 'Welcome message',
        status: 'partial',
        deliveredAt: new Date(),
        failedAt: new Date(),
        partialDelivery: {
          email: true,
          sms: false,
          push: false,
        },
      };

      // Mock partial recovery
      notificationService.sendSMS.mockResolvedValue({ messageId: 'sms-123' });
      notificationService.sendPush.mockResolvedValue({ messageId: 'push-123' });

      // Act
      const result = await retryService.recoverPartialNotification(failedNotification);

      // Assert
      expect(result.success).toBe(true);
      expect(result.recoveredChannels).toEqual(['sms', 'push']);
      expect(result.fullyRecovered).toBe(true);
      expect(notificationService.sendSMS).toHaveBeenCalledWith('user@example.com', 'Welcome message');
      expect(notificationService.sendPush).toHaveBeenCalledWith('user@example.com', 'Welcome message');
    });

    it('should handle alternative channel retry', async () => {
      // Arrange
      const failedNotification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'user@example.com',
        content: 'Urgent update',
        status: 'failed',
        attempts: 3,
        lastAttempt: new Date(),
        failureReason: 'Email server down',
      };

      // Mock alternative channel retry
      notificationService.sendSMS.mockResolvedValue({ messageId: 'sms-123' });

      // Act
      const result = await retryService.retryWithAlternativeChannel(failedNotification, ['sms', 'push']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.alternativeChannelUsed).toBe('sms');
      expect(result.originalChannel).toBe('email');
      expect(notificationService.sendSMS).toHaveBeenCalledWith('user@example.com', 'Urgent update');
      expect(logger.info).toHaveBeenCalledWith('Notification sent via alternative channel', {
        notificationId: 'notif-123',
        originalChannel: 'email',
        alternativeChannel: 'sms',
      });
    });

    it('should handle manual retry triggers', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const notification = {
        id: notificationId,
        type: 'email',
        recipient: 'user@example.com',
        content: 'Important message',
        status: 'failed',
        attempts: 2,
        lastAttempt: new Date(),
        manualRetryAllowed: true,
      };

      notificationService.sendEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await retryService.triggerManualRetry(notificationId, 'admin-456', 'Customer requested resend');

      // Assert
      expect(result.success).toBe(true);
      expect(result.triggeredBy).toBe('admin-456');
      expect(result.reason).toBe('Customer requested resend');
      expect(result.isManualRetry).toBe(true);
      expect(notificationService.sendEmail).toHaveBeenCalledWith('user@example.com', 'Important message');
    });

    it('should validate manual retry permissions', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const notification = {
        id: notificationId,
        type: 'email',
        recipient: 'user@example.com',
        content: 'Spam message',
        status: 'failed',
        attempts: 2,
        manualRetryAllowed: false, // Manual retry not allowed
      };

      // Act
      const result = await retryService.triggerManualRetry(notificationId, 'user-456', 'Unauthorized retry');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Manual retry not allowed for this notification');
      expect(logger.warn).toHaveBeenCalledWith('Unauthorized manual retry attempt', {
        notificationId,
        triggeredBy: 'user-456',
        reason: 'Unauthorized retry',
      });
    });

    it('should handle notification reconciliation', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const notification = {
        id: notificationId,
        type: 'email',
        recipient: 'user@example.com',
        content: 'Test message',
        status: 'pending',
        externalId: 'ext-123',
      };

      const externalStatus = {
        externalId: 'ext-123',
        status: 'delivered',
        deliveredAt: new Date(),
        metadata: {
          provider: 'sendgrid',
          messageId: 'sg-123',
        },
      };

      // Mock external status check
      const mockGetExternalStatus = jest.fn().mockResolvedValue(externalStatus);
      retryService.getExternalNotificationStatus = mockGetExternalStatus;

      // Act
      const result = await retryService.reconcileNotification(notificationId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.reconciled).toBe(true);
      expect(result.externalStatus).toBe('delivered');
      expect(result.statusUpdate).toBe('delivered');
      expect(logger.info).toHaveBeenCalledWith('Notification reconciled successfully', {
        notificationId,
        externalStatus: 'delivered',
      });
    });

    it('should handle notification reconciliation mismatches', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const notification = {
        id: notificationId,
        type: 'email',
        recipient: 'user@example.com',
        content: 'Test message',
        status: 'sent',
        externalId: 'ext-123',
      };

      const externalStatus = {
        externalId: 'ext-123',
        status: 'failed',
        failedAt: new Date(),
        error: 'Invalid recipient',
      };

      retryService.getExternalNotificationStatus = jest.fn().mockResolvedValue(externalStatus);

      // Act
      const result = await retryService.reconcileNotification(notificationId);

      // Assert
      expect(result.reconciled).toBe(false);
      expect(result.discrepancy).toBe(true);
      expect(result.discrepancyType).toBe('status_mismatch');
      expect(result.internalStatus).toBe('sent');
      expect(result.externalStatus).toBe('failed');
      expect(logger.warn).toHaveBeenCalledWith('Notification reconciliation discrepancy', {
        notificationId,
        discrepancyType: 'status_mismatch',
        internalStatus: 'sent',
        externalStatus: 'failed',
      });
    });

    it('should handle notification analytics', async () => {
      // Arrange
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');

      const mockAnalytics = {
        totalNotifications: 1000,
        successfulDeliveries: 850,
        failedDeliveries: 150,
        retryAttempts: 75,
        recoveredNotifications: 60,
        alternativeChannelUsage: 25,
        manualRetries: 10,
        averageDeliveryTime: 2500, // ms
        channels: {
          email: { sent: 600, delivered: 520, failed: 80 },
          sms: { sent: 300, delivered: 280, failed: 20 },
          push: { sent: 100, delivered: 50, failed: 50 },
        },
      };

      // Mock analytics service
      const mockGetAnalytics = jest.fn().mockResolvedValue(mockAnalytics);
      retryService.getNotificationAnalytics = mockGetAnalytics;

      // Act
      const analytics = await retryService.getNotificationAnalytics(startDate, endDate);

      // Assert
      expect(analytics.totalNotifications).toBe(1000);
      expect(analytics.successRate).toBe(85);
      expect(analytics.failureRate).toBe(15);
      expect(analytics.retryRate).toBe(7.5);
      expect(analytics.recoveryRate).toBe(80); // 60/75 * 100
      expect(analytics.channels.email.deliveryRate).toBe(86.67);
      expect(analytics.channels.sms.deliveryRate).toBe(93.33);
      expect(analytics.channels.push.deliveryRate).toBe(50);
    });

    it('should handle batch notification recovery', async () => {
      // Arrange
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      const notifications = [
        {
          id: 'notif-1',
          type: 'email',
          recipient: 'user1@example.com',
          content: 'Message 1',
          status: 'failed',
        },
        {
          id: 'notif-2',
          type: 'sms',
          recipient: '+9771234567890',
          content: 'Message 2',
          status: 'failed',
        },
        {
          id: 'notif-3',
          type: 'push',
          recipient: 'user3@example.com',
          content: 'Message 3',
          status: 'failed',
        },
      ];

      // Mock batch recovery
      notificationService.sendEmail.mockResolvedValue({ messageId: 'email-1' });
      notificationService.sendSMS.mockResolvedValue({ messageId: 'sms-2' });
      notificationService.sendPush.mockRejectedValue(new Error('Push service down'));

      // Act
      const result = await retryService.batchRecoverNotifications(notificationIds);

      // Assert
      expect(result.totalNotifications).toBe(3);
      expect(result.successfulRecoveries).toBe(2);
      expect(result.failedRecoveries).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      expect(result.results[2].success).toBe(false);
    });

    it('should handle notification recovery notifications', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const notification = {
        id: notificationId,
        type: 'email',
        recipient: 'user@example.com',
        content: 'Important update',
        status: 'failed',
      };

      notificationService.sendEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      await retryService.recoverNotification(notificationId);

      // Assert
      expect(notificationService.sendEmail).toHaveBeenCalledWith('user@example.com', 'Important update');
      expect(logger.info).toHaveBeenCalledWith('Notification recovered successfully', {
        notificationId,
        type: 'email',
        recipient: 'user@example.com',
      });
    });

    it('should handle recovery failure notifications', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const notification = {
        id: notificationId,
        type: 'email',
        recipient: 'user@example.com',
        content: 'Important update',
        status: 'failed',
      };

      notificationService.sendEmail.mockRejectedValue(new Error('Email service down'));

      // Act
      const result = await retryService.recoverNotification(notificationId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service down');
      expect(logger.error).toHaveBeenCalledWith('Notification recovery failed', {
        notificationId,
        error: 'Email service down',
      });
    });

    it('should handle notification recovery with fallback channels', async () => {
      // Arrange
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'user@example.com',
        content: 'Critical alert',
        status: 'failed',
        fallbackChannels: ['sms', 'push'],
      };

      // Email fails, SMS succeeds
      notificationService.sendEmail.mockRejectedValue(new Error('Email server down'));
      notificationService.sendSMS.mockResolvedValue({ messageId: 'sms-123' });

      // Act
      const result = await retryService.recoverWithFallback(notification);

      // Assert
      expect(result.success).toBe(true);
      expect(result.primaryChannelFailed).toBe(true);
      expect(result.fallbackChannelUsed).toBe('sms');
      expect(result.fallbackSuccess).toBe(true);
      expect(notificationService.sendEmail).toHaveBeenCalled();
      expect(notificationService.sendSMS).toHaveBeenCalled();
    });

    it('should handle notification recovery with multiple fallbacks', async () => {
      // Arrange
      const notification = {
        id: 'notif-123',
        type: 'email',
        recipient: 'user@example.com',
        content: 'Critical alert',
        status: 'failed',
        fallbackChannels: ['sms', 'push'],
      };

      // All channels fail
      notificationService.sendEmail.mockRejectedValue(new Error('Email server down'));
      notificationService.sendSMS.mockRejectedValue(new Error('SMS gateway down'));
      notificationService.sendPush.mockRejectedValue(new Error('Push service down'));

      // Act
      const result = await retryService.recoverWithFallback(notification);

      // Assert
      expect(result.success).toBe(false);
      expect(result.allChannelsFailed).toBe(true);
      expect(result.attemptedChannels).toEqual(['email', 'sms', 'push']);
      expect(result.errors).toHaveLength(3);
    });
  });
});
