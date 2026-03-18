import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PushNotificationService } from './push-notification.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: any;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            userPreferences: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SMTP_SECURE') return 'false';
              if (key === 'SMTP_PORT') return 587;
              return 'test-value';
            }),
          },
        },
        {
          provide: PushNotificationService,
          useValue: {
            sendPushNotification: jest.fn().mockResolvedValue(undefined),
            registerDeviceToken: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendNotification', () => {
    it('should create notification in database', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        phone: '+1234567890',
        phoneVerified: true,
        userPreferences: { preferences: '{}' },
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockResolvedValue({
        id: 'notif-1',
        title: 'Test',
        message: 'Message',
        type: 'SYSTEM_ALERT',
        userId: 'user-123',
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        data: JSON.stringify({ bookingId: 'booking-1', priority: 'NORMAL' }),
      });
      prismaService.notification.update.mockResolvedValue({ id: 'notif-1' });

      const result = await service.sendNotification({
        userId: 'user-123',
        type: 'SYSTEM_ALERT' as any,
        title: 'Test',
        message: 'Message',
        channels: ['IN_APP'],
        data: { bookingId: 'booking-1' },
      });

      expect(prismaService.notification.create).toHaveBeenCalled();
      expect(result.data).toEqual(
        expect.objectContaining({ bookingId: 'booking-1', priority: 'NORMAL' }),
      );
    });

    it('should normalize notification data for notification lists', async () => {
      prismaService.notification.findMany.mockResolvedValue([
        {
          id: 'notif-1',
          title: 'Booking confirmed',
          message: 'Your booking is confirmed',
          type: 'BOOKING_CONFIRMED',
          userId: 'user-123',
          read: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          data: JSON.stringify({ bookingId: 'booking-42' }),
        },
      ]);
      prismaService.notification.count.mockResolvedValue(1);

      const result = await service.getUserNotifications('user-123');

      expect(result.notifications[0].data).toEqual({ bookingId: 'booking-42' });
    });
  });
});
