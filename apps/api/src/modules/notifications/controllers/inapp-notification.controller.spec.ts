import { InAppNotificationController } from './inapp-notification.controller';

describe('InAppNotificationController', () => {
  let controller: InAppNotificationController;
  let notifService: any;

  beforeEach(() => {
    notifService = {
      getUserNotifications: jest.fn().mockResolvedValue({
        data: [{ id: 'n-1', title: 'Test', type: 'system' }],
        total: 1,
      }),
      getNotificationCount: jest.fn().mockResolvedValue({ total: 5, unread: 2 }),
      createNotification: jest.fn().mockResolvedValue({ id: 'n-new' }),
      markAsRead: jest.fn().mockResolvedValue({ status: 'ok' }),
      markAllAsRead: jest.fn().mockResolvedValue({ status: 'ok' }),
      deleteNotification: jest.fn().mockResolvedValue({ status: 'ok' }),
      getNotificationPreferences: jest.fn().mockResolvedValue({ email: true, inApp: true }),
      updateNotificationPreferences: jest.fn().mockResolvedValue({ status: 'ok' }),
    };

    controller = new InAppNotificationController(notifService);
  });

  describe('getNotifications', () => {
    it('should return user notifications', async () => {
      const result = await controller.getNotifications('user-1', {});

      expect(result).toBeDefined();
      expect(notifService.getUserNotifications).toHaveBeenCalled();
    });

    it('should pass query filters', async () => {
      await controller.getNotifications('user-1', {
        type: 'booking',
        read: false,
        limit: 10,
      });

      expect(notifService.getUserNotifications).toHaveBeenCalled();
    });
  });

  describe('getNotificationCount', () => {
    it('should return notification counts', async () => {
      const result = await controller.getNotificationCount('user-1');

      expect(result).toBeDefined();
      expect(notifService.getNotificationCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('createNotification', () => {
    it('should create admin notification', async () => {
      const data = {
        userId: 'user-2',
        type: 'system',
        title: 'Important Update',
        message: 'System maintenance scheduled',
      };

      const result = await controller.createNotification(data);

      expect(result).toBeDefined();
      expect(notifService.createNotification).toHaveBeenCalledWith(data);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const result = await controller.markAsRead('n-1', 'user-1');

      expect(result).toEqual({ status: 'marked_as_read' });
      expect(notifService.markAsRead).toHaveBeenCalledWith('n-1', 'user-1');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const result = await controller.markAllAsRead('user-1');

      expect(result).toEqual({ status: 'all_marked_as_read' });
      expect(notifService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const result = await controller.deleteNotification('n-1', 'user-1');

      expect(result).toEqual({ status: 'deleted' });
      expect(notifService.deleteNotification).toHaveBeenCalledWith('n-1', 'user-1');
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return preferences', async () => {
      const result = await controller.getNotificationPreferences('user-1');

      expect(result).toBeDefined();
      expect(notifService.getNotificationPreferences).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update preferences', async () => {
      const data = { preferences: { email: false, inApp: true } };
      const result = await controller.updateNotificationPreferences('user-1', data);

      expect(result).toEqual({ status: 'updated' });
    });
  });
});
