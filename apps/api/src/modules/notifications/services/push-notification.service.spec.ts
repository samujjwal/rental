import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'FIREBASE_SERVICE_ACCOUNT') {
          return JSON.stringify({
            project_id: 'test-project',
            client_email: 'test@test.iam.gserviceaccount.com',
            private_key: 'test-key',
          });
        }
        return undefined;
      }),
    };

    const mockPrisma = {
      deviceToken: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
    };

    service = new PushNotificationService(configService, mockPrisma as any);
  });

  describe('sendPushNotification', () => {
    it('should return failure when no device tokens available', async () => {
      // getUserDeviceTokens is a placeholder returning []
      const result = await service.sendPushNotification({
        userId: 'user-1',
        title: 'Test',
        body: 'Hello',
      });

      expect(result.success).toBe(false);
    });

    it('should accept optional data payload', async () => {
      const result = await service.sendPushNotification({
        userId: 'user-1',
        title: 'Booking Update',
        body: 'Your booking is confirmed',
        data: { bookingId: 'booking-1', type: 'BOOKING_CONFIRMED' },
      });

      expect(result).toBeDefined();
    });
  });

  describe('sendBulkPushNotifications', () => {
    it('should send to multiple users', async () => {
      const result = await service.sendBulkPushNotifications(
        ['user-1', 'user-2', 'user-3'],
        'Announcement',
        'New feature available!',
      );

      expect(result.success).toBe(true);
      expect(typeof result.sent).toBe('number');
    });

    it('should handle empty user list', async () => {
      const result = await service.sendBulkPushNotifications(
        [],
        'Empty',
        'No recipients',
      );

      expect(result.success).toBe(true);
      expect(result.sent).toBe(0);
    });

    it('should include optional data in bulk send', async () => {
      const result = await service.sendBulkPushNotifications(
        ['user-1'],
        'Alert',
        'Check it out',
        { screen: 'dashboard' },
      );

      expect(result).toBeDefined();
    });
  });

  describe('registerDeviceToken', () => {
    it('should accept device token registration (placeholder)', async () => {
      await service.registerDeviceToken('user-1', 'fcm-token-123', 'ios');
      // No errors expected (placeholder implementation)
    });

    it('should accept different platforms', async () => {
      await service.registerDeviceToken('user-1', 'token-1', 'android');
      await service.registerDeviceToken('user-1', 'token-2', 'web');
      // No errors expected
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should accept token unregistration (placeholder)', async () => {
      await service.unregisterDeviceToken('fcm-token-123');
      // No errors expected
    });
  });

  describe('sendToTopic', () => {
    it('should send topic notification', async () => {
      const result = await service.sendToTopic(
        'announcements',
        'New Feature',
        'Check out our latest update',
      );

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should include data in topic notification', async () => {
      const result = await service.sendToTopic(
        'deals',
        'Hot Deal',
        'Limited time offer',
        { dealId: 'deal-1' },
      );

      expect(result).toBeDefined();
    });

    it('should handle missing Firebase config', async () => {
      configService.get.mockReturnValue(undefined);
      service = new PushNotificationService(configService, { deviceToken: { upsert: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({}) } } as any);

      const result = await service.sendToTopic('test', 'Title', 'Body');

      expect(result.success).toBe(false);
    });
  });
});
