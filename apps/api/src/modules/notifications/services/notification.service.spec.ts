import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { QueueService } from '@/common/queue/queue.service';
import { EmailService } from '@/common/email/email.service';
import { SmsService } from '@/common/sms/sms.service';
import { PushNotificationService } from '@/common/push/push.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: PrismaService;
  let queue: QueueService;
  let email: EmailService;
  let sms: SmsService;
  let push: PushNotificationService;

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockQueueService = {
    addJob: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
    sendTemplateEmail: jest.fn(),
  };

  const mockSmsService = {
    sendSms: jest.fn(),
  };

  const mockPushService = {
    sendPushNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: SmsService, useValue: mockSmsService },
        { provide: PushNotificationService, useValue: mockPushService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
    queue = module.get<QueueService>(QueueService);
    email = module.get<EmailService>(EmailService);
    sms = module.get<SmsService>(SmsService);
    push = module.get<PushNotificationService>(PushService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      phone: '+1234567890',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockPreferences = {
      userId: 'user-1',
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      bookingUpdates: true,
      paymentAlerts: true,
      messages: true,
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(mockPreferences);
      mockPrismaService.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        channels: ['EMAIL', 'PUSH'],
        status: 'SENT',
      });
    });

    it('should send notification via all enabled channels', async () => {
      await service.sendNotification({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        data: { bookingId: 'booking-1' },
      });

      expect(mockEmailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          template: expect.any(String),
        }),
      );

      expect(mockPushService.sendPushNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        title: 'Booking Confirmed',
        body: 'Your booking has been confirmed',
        data: { bookingId: 'booking-1' },
      });

      expect(mockPrismaService.notification.create).toHaveBeenCalled();
    });

    it('should respect user channel preferences', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        emailEnabled: false,
        pushEnabled: true,
      });

      await service.sendNotification({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
      });

      expect(mockEmailService.sendTemplateEmail).not.toHaveBeenCalled();
      expect(mockPushService.sendPushNotification).toHaveBeenCalled();
    });

    it('should respect notification type preferences', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        bookingUpdates: false, // Disabled booking notifications
      });

      await service.sendNotification({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
      });

      expect(mockEmailService.sendTemplateEmail).not.toHaveBeenCalled();
      expect(mockPushService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should send SMS for payment alerts', async () => {
      await service.sendNotification({
        userId: 'user-1',
        type: 'PAYMENT_SUCCESSFUL',
        title: 'Payment Successful',
        message: 'Your payment of $100 has been processed',
      });

      expect(mockSmsService.sendSms).toHaveBeenCalledWith({
        to: '+1234567890',
        message: expect.any(String),
      });
    });

    it('should handle notification failures gracefully', async () => {
      mockEmailService.sendTemplateEmail.mockRejectedValue(new Error('Email service down'));

      await expect(
        service.sendNotification({
          userId: 'user-1',
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: 'Your booking has been confirmed',
        }),
      ).resolves.not.toThrow();

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });

    it('should support scheduled notifications', async () => {
      const scheduledFor = new Date(Date.now() + 3600000); // 1 hour from now

      await service.sendNotification({
        userId: 'user-1',
        type: 'BOOKING_REMINDER',
        title: 'Booking Reminder',
        message: 'Your booking starts tomorrow',
        scheduledFor,
      });

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'notifications',
        expect.objectContaining({
          scheduledFor,
        }),
        expect.objectContaining({
          delay: expect.any(Number),
        }),
      );
    });

    it('should include metadata in notification', async () => {
      await service.sendNotification({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        data: {
          bookingId: 'booking-1',
          listingId: 'listing-1',
          amount: 10000,
        },
      });

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: expect.objectContaining({
              bookingId: 'booking-1',
              listingId: 'listing-1',
              amount: 10000,
            }),
          }),
        }),
      );
    });

    it('should handle missing user preferences', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(null);

      await service.sendNotification({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
      });

      // Should create default preferences and send notification
      expect(mockPrismaService.notificationPreference.create).toHaveBeenCalled();
      expect(mockEmailService.sendTemplateEmail).toHaveBeenCalled();
    });

    it('should handle non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendNotification({
          userId: 'non-existent',
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: 'Your booking has been confirmed',
        }),
      ).rejects.toThrow();
    });
  });

  describe('sendBulkNotifications', () => {
    it('should send notifications to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      await service.sendBulkNotifications({
        userIds,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'New Feature Available',
        message: 'Check out our new feature!',
      });

      expect(mockQueueService.addJob).toHaveBeenCalledTimes(3);
    });

    it('should batch large notification sets', async () => {
      const userIds = Array(1000)
        .fill(null)
        .map((_, i) => `user-${i}`);

      await service.sendBulkNotifications({
        userIds,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'Important Update',
        message: 'Please read',
      });

      // Should batch into reasonable chunks
      expect(mockQueueService.addJob).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        read: false,
        createdAt: new Date(),
      },
      {
        id: 'notif-2',
        userId: 'user-1',
        type: 'PAYMENT_SUCCESSFUL',
        title: 'Payment Successful',
        message: 'Payment received',
        read: true,
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      mockPrismaService.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrismaService.notification.count.mockResolvedValue(2);
    });

    it('should retrieve user notifications with pagination', async () => {
      const result = await service.getUserNotifications('user-1', {
        page: 1,
        limit: 10,
      });

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.total).toBe(2);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should filter by read status', async () => {
      await service.getUserNotifications('user-1', {
        unreadOnly: true,
      });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            read: false,
          }),
        }),
      );
    });

    it('should filter by notification type', async () => {
      await service.getUserNotifications('user-1', {
        type: 'BOOKING_CONFIRMED',
      });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'BOOKING_CONFIRMED',
          }),
        }),
      );
    });

    it('should sort by creation date descending', async () => {
      await service.getUserNotifications('user-1');

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark single notification as read', async () => {
      mockPrismaService.notification.update.mockResolvedValue({
        id: 'notif-1',
        read: true,
        readAt: new Date(),
      });

      await service.markAsRead('user-1', 'notif-1');

      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should mark all notifications as read', async () => {
      await service.markAllAsRead('user-1');

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockPrismaService.notification.count.mockResolvedValue(5);

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(5);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
      });
    });

    it('should return zero for no unread notifications', async () => {
      mockPrismaService.notification.count.mockResolvedValue(0);

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(0);
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      const preferences = {
        emailEnabled: false,
        pushEnabled: true,
        bookingUpdates: true,
        messages: false,
      };

      mockPrismaService.notificationPreference.update.mockResolvedValue({
        userId: 'user-1',
        ...preferences,
      });

      await service.updatePreferences('user-1', preferences);

      expect(mockPrismaService.notificationPreference.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: preferences,
      });
    });

    it('should create preferences if not exists', async () => {
      mockPrismaService.notificationPreference.update.mockRejectedValue(new Error('Not found'));
      mockPrismaService.notificationPreference.create.mockResolvedValue({
        userId: 'user-1',
        emailEnabled: true,
        pushEnabled: true,
      });

      await service.updatePreferences('user-1', {
        emailEnabled: true,
        pushEnabled: true,
      });

      expect(mockPrismaService.notificationPreference.create).toHaveBeenCalled();
    });
  });

  describe('Notification templates', () => {
    it('should use correct template for booking confirmation', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'John',
      });

      await service.sendBookingConfirmation('user-1', {
        bookingId: 'booking-1',
        listingTitle: 'Camera Equipment',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03'),
        totalAmount: 30000,
      });

      expect(mockEmailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'booking-confirmation',
          context: expect.objectContaining({
            bookingId: 'booking-1',
            listingTitle: 'Camera Equipment',
          }),
        }),
      );
    });

    it('should use correct template for payment receipt', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });

      await service.sendPaymentReceipt('user-1', {
        paymentId: 'pay-1',
        amount: 10000,
        currency: 'USD',
        method: 'card',
      });

      expect(mockEmailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'payment-receipt',
        }),
      );
    });
  });

  describe('Error handling and edge cases', () => {
    it('should retry failed notifications', async () => {
      mockEmailService.sendTemplateEmail
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ messageId: 'msg-1' });

      await service.sendNotification({
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
      });

      expect(mockEmailService.sendTemplateEmail).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiting', async () => {
      const notifications = Array(100)
        .fill(null)
        .map((_, i) => ({
          userId: 'user-1',
          type: 'TEST',
          title: `Test ${i}`,
          message: 'Test',
        }));

      for (const notif of notifications) {
        await service.sendNotification(notif);
      }

      // Should throttle requests
      expect(mockEmailService.sendTemplateEmail).toHaveBeenCalled();
    });

    it('should validate notification data', async () => {
      await expect(
        service.sendNotification({
          userId: '',
          type: 'BOOKING_CONFIRMED',
          title: '',
          message: '',
        }),
      ).rejects.toThrow();
    });
  });
});
