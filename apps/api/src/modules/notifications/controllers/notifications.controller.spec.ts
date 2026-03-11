import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';
import { PushNotificationService } from '../services/push-notification.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsService>;
  let pushService: jest.Mocked<PushNotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            getUserNotifications: jest.fn(),
            getUnreadCount: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
            deleteNotification: jest.fn(),
            getPreferences: jest.fn(),
            updatePreferences: jest.fn(),
            sendNotification: jest.fn(),
          },
        },
        {
          provide: PushNotificationService,
          useValue: {
            registerDeviceToken: jest.fn(),
            unregisterDeviceToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(NotificationsController);
    service = module.get(NotificationsService) as jest.Mocked<NotificationsService>;
    pushService = module.get(PushNotificationService) as jest.Mocked<PushNotificationService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getNotifications ──

  describe('getNotifications', () => {
    it('delegates to service with filters', async () => {
      service.getUserNotifications.mockResolvedValue({ data: [] as any[], total: 0 } as any);
      await controller.getNotifications('u1', 'true', 'BOOKING' as any, 1 as any, 20 as any);
      expect(service.getUserNotifications).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ unreadOnly: true, type: 'BOOKING' }),
      );
    });
  });

  // ── getUnreadCount ──

  describe('getUnreadCount', () => {
    it('returns { count } object', async () => {
      service.getUnreadCount.mockResolvedValue(5 as any);
      const result = await controller.getUnreadCount('u1');
      expect(service.getUnreadCount).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ count: 5 });
    });
  });

  // ── markAsRead ──

  describe('markAsRead', () => {
    it('delegates to service with notificationId first', async () => {
      await controller.markAsRead('n1', 'u1');
      expect(service.markAsRead).toHaveBeenCalledWith('n1', 'u1');
    });
  });

  // ── markAllAsRead ──

  describe('markAllAsRead', () => {
    it('returns count of marked notifications', async () => {
      service.markAllAsRead.mockResolvedValue(3 as any);
      const result = await controller.markAllAsRead('u1');
      expect(service.markAllAsRead).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ count: 3 });
    });
  });

  // ── deleteNotification ──

  describe('deleteNotification', () => {
    it('returns success message', async () => {
      const result = await controller.deleteNotification('n1', 'u1');
      expect(service.deleteNotification).toHaveBeenCalledWith('n1', 'u1');
      expect(result).toEqual({ message: 'Notification deleted successfully' });
    });
  });

  // ── getPreferences ──

  describe('getPreferences', () => {
    it('delegates to service', async () => {
      service.getPreferences.mockResolvedValue({ email: true } as any);
      const result = await controller.getPreferences('u1');
      expect(service.getPreferences).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ email: true });
    });
  });

  // ── updatePreferences ──

  describe('updatePreferences', () => {
    it('updates then returns refreshed preferences', async () => {
      const prefs = { email: false, push: true };
      service.getPreferences.mockResolvedValue(prefs as any);
      const result = await controller.updatePreferences('u1', prefs as any);
      expect(service.updatePreferences).toHaveBeenCalledWith('u1', prefs);
      expect(service.getPreferences).toHaveBeenCalledWith('u1');
      expect(result).toEqual(prefs);
    });
  });

  // ── registerDevice ──

  describe('registerDevice', () => {
    it('delegates to push service with token and platform', async () => {
      const dto = { token: 'expo-tok', platform: 'ios' };
      const result = await controller.registerDevice('u1', dto as any);
      expect(pushService.registerDeviceToken).toHaveBeenCalledWith('u1', 'expo-tok', 'ios');
      expect(result).toEqual({ success: true });
    });
  });

  // ── unregisterDevice ──

  describe('unregisterDevice', () => {
    it('delegates to push service', async () => {
      const dto = { token: 'expo-tok' };
      const result = await controller.unregisterDevice('u1', dto as any);
      expect(pushService.unregisterDeviceToken).toHaveBeenCalledWith('expo-tok');
      expect(result).toEqual({ success: true });
    });
  });

  // ── createNotification (admin-only) ──

  describe('createNotification', () => {
    it('delegates to sendNotification', async () => {
      const body = { userId: 'u2', type: 'BOOKING', title: 'Test', message: 'Hello' };
      service.sendNotification.mockResolvedValue({ id: 'n1' } as any);
      await controller.createNotification(body as any);
      expect(service.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u2', title: 'Test' }),
      );
    });
  });
});
