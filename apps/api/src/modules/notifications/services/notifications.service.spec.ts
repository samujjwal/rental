import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

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
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            notificationSettings: {
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
        phoneNumber: '+1234567890',
        notificationSettings: {
          email: true,
          push: true,
          sms: true,
          inApp: true,
        },
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockResolvedValue({ id: 'notif-1' });

      await service.sendNotification({
        userId: 'user-123',
        type: 'SYSTEM_ALERT' as any,
        title: 'Test',
        message: 'Message',
        channels: ['IN_APP'],
      });

      expect(prismaService.notification.create).toHaveBeenCalled();
    });
  });
});
