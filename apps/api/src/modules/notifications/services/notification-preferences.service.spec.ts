import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesService } from './notification-preferences.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';

  const defaultPrefs = {
    email: {
      bookingRequests: true,
      bookingConfirmations: true,
      bookingCancellations: true,
      paymentReceived: true,
      messages: true,
      reviews: true,
      marketing: false,
      systemUpdates: true,
    },
    push: {
      bookingRequests: true,
      bookingConfirmations: true,
      bookingCancellations: true,
      paymentReceived: true,
      messages: true,
      reviews: true,
      systemUpdates: true,
    },
    sms: {
      bookingRequests: false,
      bookingConfirmations: true,
      bookingCancellations: true,
      securityAlerts: true,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: PrismaService,
          useValue: {
            userPreferences: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(NotificationPreferencesService);
    prisma = module.get(PrismaService);
  });

  describe('getUserPreferences', () => {
    it('returns defaults when no preferences saved', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getUserPreferences(mockUserId);
      expect(result).toEqual(defaultPrefs);
    });

    it('returns defaults when preferences has no notifications key', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
        id: 'pref-1',
        preferences: JSON.stringify({ theme: 'dark' }),
      });

      const result = await service.getUserPreferences(mockUserId);
      expect(result).toEqual(defaultPrefs);
    });

    it('merges stored prefs with defaults', async () => {
      const stored = {
        notifications: {
          email: { marketing: true },
        },
      };
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
        id: 'pref-1',
        preferences: JSON.stringify(stored),
      });

      const result = await service.getUserPreferences(mockUserId);
      expect(result.email.marketing).toBe(true); // overridden
      expect(result.email.bookingRequests).toBe(true); // default
      expect(result.push).toEqual(defaultPrefs.push); // all defaults
    });
  });

  describe('updatePreferences', () => {
    it('creates new record when none exists', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userPreferences.create as jest.Mock).mockResolvedValue({});

      const result = await service.updatePreferences(mockUserId, {
        email: { ...defaultPrefs.email, marketing: true },
      });

      expect(result.email.marketing).toBe(true);
      expect(prisma.userPreferences.create).toHaveBeenCalled();
    });

    it('updates existing record', async () => {
      const existing = {
        userId: mockUserId,
        preferences: JSON.stringify({ notifications: defaultPrefs }),
      };
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.userPreferences.update as jest.Mock).mockResolvedValue({});

      const result = await service.updatePreferences(mockUserId, {
        sms: { ...defaultPrefs.sms, bookingRequests: true },
      });

      expect(result.sms.bookingRequests).toBe(true);
      expect(prisma.userPreferences.update).toHaveBeenCalled();
    });
  });

  describe('shouldSendEmail', () => {
    it('returns true for enabled preference', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.shouldSendEmail(mockUserId, 'bookingRequests');
      expect(result).toBe(true);
    });

    it('returns false for disabled preference (marketing default)', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.shouldSendEmail(mockUserId, 'marketing');
      expect(result).toBe(false);
    });
  });

  describe('shouldSendPush', () => {
    it('returns true for enabled push preference', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.shouldSendPush(mockUserId, 'messages');
      expect(result).toBe(true);
    });
  });

  describe('shouldSendSms', () => {
    it('returns false for SMS booking requests by default', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.shouldSendSms(mockUserId, 'bookingRequests');
      expect(result).toBe(false);
    });

    it('returns true for security alerts by default', async () => {
      (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.shouldSendSms(mockUserId, 'securityAlerts');
      expect(result).toBe(true);
    });
  });
});
