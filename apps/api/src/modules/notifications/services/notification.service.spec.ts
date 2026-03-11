 
import { InAppNotificationService } from './notification.service';

/* ── Mocks ── */

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockGroupBy = jest.fn();
const mockUpdateMany = jest.fn();
const mockDeleteMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();

const mockPrisma: any = {
  notification: {
    create: mockCreate,
    findMany: mockFindMany,
    count: mockCount,
    groupBy: mockGroupBy,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
  },
  userPreferences: {
    findUnique: mockFindUnique,
    upsert: mockUpsert,
  },
};

const mockEmit = jest.fn();
const mockEventEmitter: any = { emit: mockEmit };

let service: InAppNotificationService;

beforeEach(() => {
  jest.clearAllMocks();
  service = new InAppNotificationService(mockPrisma, mockEventEmitter);
});

/* ═══════════════════════════════════════════════════════════════════════ */

describe('InAppNotificationService', () => {
  /* ── createNotification ── */
  describe('createNotification', () => {
    it('creates a notification and emits event', async () => {
      const notification = { id: 'n1', userId: 'u1', title: 'Hello' };
      mockCreate.mockResolvedValue(notification);

      const result = await service.createNotification({
        userId: 'u1',
        type: 'booking',
        title: 'Hello',
        message: 'World',
        actionUrl: '/test',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', type: 'booking', title: 'Hello', read: false }),
        }),
      );
      expect(mockEmit).toHaveBeenCalledWith('notification.created', { notification, userId: 'u1' });
      expect(result).toEqual(notification);
    });

    it('re-throws on DB error', async () => {
      mockCreate.mockRejectedValue(new Error('db err'));

      await expect(service.createNotification({
        userId: 'u1', type: 'system', title: 'T', message: 'M',
      })).rejects.toThrow('db err');
    });
  });

  /* ── getUserNotifications ── */
  describe('getUserNotifications', () => {
    it('returns notifications with default limit 50', async () => {
      mockFindMany.mockResolvedValue([{ id: 'n1' }]);

      const result = await service.getUserNotifications({ userId: 'u1' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          take: 50,
          skip: 0,
        }),
      );
      expect(result).toEqual([{ id: 'n1' }]);
    });

    it('filters by type and read status', async () => {
      mockFindMany.mockResolvedValue([]);

      await service.getUserNotifications({ userId: 'u1', type: 'booking', read: false });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', type: 'booking', read: false },
        }),
      );
    });

    it('supports pagination', async () => {
      mockFindMany.mockResolvedValue([]);

      await service.getUserNotifications({ userId: 'u1', limit: 10, offset: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });
  });

  /* ── getNotificationCount ── */
  describe('getNotificationCount', () => {
    it('returns total, unread, and byType counts', async () => {
      mockCount.mockResolvedValueOnce(15).mockResolvedValueOnce(5);
      mockGroupBy.mockResolvedValue([
        { type: 'booking', _count: 3 },
        { type: 'message', _count: 2 },
      ]);

      const result = await service.getNotificationCount('u1');

      expect(result).toEqual({
        total: 15,
        unread: 5,
        byType: { booking: 3, message: 2 },
      });
    });
  });

  /* ── markAsRead ── */
  describe('markAsRead', () => {
    it('updates notification and emits event', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      await service.markAsRead('n1', 'u1');

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1' },
        data: { read: true },
      });
      expect(mockEmit).toHaveBeenCalledWith('notification.read', { notificationId: 'n1', userId: 'u1' });
    });
  });

  /* ── markAllAsRead ── */
  describe('markAllAsRead', () => {
    it('marks all unread notifications as read and emits event', async () => {
      mockUpdateMany.mockResolvedValue({ count: 5 });

      await service.markAllAsRead('u1');

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', read: false },
        data: { read: true },
      });
      expect(mockEmit).toHaveBeenCalledWith('notification.all_read', { userId: 'u1' });
    });
  });

  /* ── deleteNotification ── */
  describe('deleteNotification', () => {
    it('deletes notification and emits event', async () => {
      mockDeleteMany.mockResolvedValue({ count: 1 });

      await service.deleteNotification('n1', 'u1');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1' },
      });
      expect(mockEmit).toHaveBeenCalledWith('notification.deleted', { notificationId: 'n1', userId: 'u1' });
    });
  });

  /* ── createBookingNotification ── */
  describe('createBookingNotification', () => {
    it.each([
      ['created', 'New Booking Request'],
      ['confirmed', 'Booking Confirmed'],
      ['cancelled', 'Booking Cancelled'],
      ['completed', 'Booking Completed'],
    ] as const)('creates correct notification for type %s', async (type, expectedTitle) => {
      mockCreate.mockResolvedValue({ id: 'n1' });

      await service.createBookingNotification('u1', type, 'bk1', 'My Camera');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            type: 'booking',
            title: expectedTitle,
          }),
        }),
      );
    });
  });

  /* ── createPaymentNotification ── */
  describe('createPaymentNotification', () => {
    it.each([
      ['received', 'Payment Received'],
      ['sent', 'Payment Sent'],
      ['failed', 'Payment Failed'],
    ] as const)('creates notification for payment type %s', async (type, expectedTitle) => {
      mockCreate.mockResolvedValue({ id: 'n1' });

      await service.createPaymentNotification('u1', type, 'bk1', 1000, 'NPR');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            type: 'payment',
            title: expectedTitle,
          }),
        }),
      );
    });
  });

  /* ── createMessageNotification ── */
  describe('createMessageNotification', () => {
    it('creates message notification with truncated preview', async () => {
      mockCreate.mockResolvedValue({ id: 'n1' });
      const longMessage = 'A'.repeat(150);

      await service.createMessageNotification('u1', 'John', 'c1', longMessage);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            type: 'message',
            title: 'New message from John',
            message: expect.stringContaining('...'),
          }),
        }),
      );
    });

    it('does not truncate short messages', async () => {
      mockCreate.mockResolvedValue({ id: 'n1' });

      await service.createMessageNotification('u1', 'Jane', 'c1', 'Hi!');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Hi!',
          }),
        }),
      );
    });
  });

  /* ── createSystemNotification ── */
  describe('createSystemNotification', () => {
    it('creates system notification with default medium priority', async () => {
      mockCreate.mockResolvedValue({ id: 'n1' });

      await service.createSystemNotification('u1', 'System Title', 'System Msg');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            type: 'system',
            title: 'System Title',
            message: 'System Msg',
          }),
        }),
      );
    });
  });

  /* ── getNotificationPreferences ── */
  describe('getNotificationPreferences', () => {
    it('returns defaults when no preferences exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await service.getNotificationPreferences('u1');

      expect(result).toEqual(
        expect.objectContaining({
          email: true,
          push: true,
          inApp: true,
          types: expect.objectContaining({ booking: true, payment: true }),
        }),
      );
    });

    it('parses stored preferences', async () => {
      mockFindUnique.mockResolvedValue({
        preferences: { emailNotifications: false, pushNotifications: true },
      });

      const result = await service.getNotificationPreferences('u1');

      expect(result.email).toBe(false);
      expect(result.push).toBe(true);
    });

    it('defaults missing fields to true', async () => {
      mockFindUnique.mockResolvedValue({ preferences: {} });

      const result = await service.getNotificationPreferences('u1');

      expect(result.email).toBe(true);
      expect(result.types.message).toBe(true);
    });
  });

  /* ── updateNotificationPreferences ── */
  describe('updateNotificationPreferences', () => {
    it('upserts preferences', async () => {
      mockUpsert.mockResolvedValue({});

      await service.updateNotificationPreferences('u1', {
        email: false,
        types: { booking: false, payment: true, review: true, message: true, system: true, organization: true },
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          create: expect.objectContaining({ userId: 'u1' }),
          update: expect.any(Object),
        }),
      );
    });
  });
});
