import { Test, TestingModule } from '@nestjs/testing';
import { FraudDetectionService, RiskLevel, FraudCheckResult } from './fraud-detection.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventsService } from '@/common/events/events.service';
import { FxService } from '@/common/fx/fx.service';

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  const mockUserId = 'user-fraud-1';

  const makeTrustedUser = (overrides: any = {}) => ({
    id: mockUserId,
    email: 'trusted@example.com',
    emailVerified: true,
    idVerificationStatus: 'VERIFIED',
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    averageRating: 4.5,
    bookings: [],
    disputesInitiated: [],
    reviewsReceived: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            listing: {
              aggregate: jest.fn(),
            },
            auditLog: {
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            increment: jest.fn().mockResolvedValue(1),
            expire: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EventsService,
          useValue: {
            emitBookingCreated: jest.fn(),
            emitBookingStatusChanged: jest.fn(),
            emitPaymentProcessed: jest.fn(),
          },
        },
        {
          provide: FxService,
          useValue: {
            convert: jest.fn((amount: number) => amount),
            getExchangeRate: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get(FraudDetectionService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
  });

  describe('checkUserRisk', () => {
    it('returns LOW risk for trusted verified user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeTrustedUser());

      const result = await service.checkUserRisk(mockUserId);

      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.riskScore).toBeLessThan(30);
      expect(result.allowBooking).toBe(true);
      expect(result.requiresManualReview).toBe(false);
    });

    it('flags new accounts (< 7 days)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({ createdAt: new Date() }), // today
      );

      const result = await service.checkUserRisk(mockUserId);
      const newAccountFlag = result.flags.find((f) => f.type === 'NEW_ACCOUNT');
      expect(newAccountFlag).toBeDefined();
      expect(newAccountFlag!.severity).toBe('MEDIUM');
    });

    it('flags unverified email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({ emailVerified: false }),
      );

      const result = await service.checkUserRisk(mockUserId);
      const flag = result.flags.find((f) => f.type === 'EMAIL_NOT_VERIFIED');
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('HIGH');
    });

    it('flags unverified ID', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({ idVerificationStatus: 'PENDING' }),
      );

      const result = await service.checkUserRisk(mockUserId);
      const flag = result.flags.find((f) => f.type === 'ID_NOT_VERIFIED');
      expect(flag).toBeDefined();
    });

    it('flags frequent cancellations (>2)', async () => {
      const cancellations = Array.from({ length: 4 }, (_, i) => ({
        id: `b-${i}`,
        status: 'CANCELLED',
      }));
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({ bookings: cancellations }),
      );

      const result = await service.checkUserRisk(mockUserId);
      const flag = result.flags.find((f) => f.type === 'FREQUENT_CANCELLATIONS');
      expect(flag).toBeDefined();
      expect(flag!.metadata!.count).toBe(4);
    });

    it('flags dispute history (>1 dispute)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({
          disputesInitiated: [{ id: 'd-1' }, { id: 'd-2' }],
        }),
      );

      const result = await service.checkUserRisk(mockUserId);
      const flag = result.flags.find((f) => f.type === 'DISPUTE_HISTORY');
      expect(flag).toBeDefined();
    });

    it('flags low rating', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({ averageRating: 2.5 }),
      );

      const result = await service.checkUserRisk(mockUserId);
      const flag = result.flags.find((f) => f.type === 'LOW_RATING');
      expect(flag).toBeDefined();
    });

    it('flags many negative reviews (>3)', async () => {
      const reviews = Array.from({ length: 5 }, (_, i) => ({
        id: `r-${i}`,
        overallRating: 2,
      }));
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({ reviewsReceived: reviews }),
      );

      const result = await service.checkUserRisk(mockUserId);
      const flag = result.flags.find((f) => f.type === 'NEGATIVE_REVIEWS');
      expect(flag).toBeDefined();
    });

    it('returns CRITICAL risk when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.checkUserRisk('nonexistent');
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.riskScore).toBe(100);
      expect(result.allowBooking).toBe(false);
    });

    it('accumulates multiple risk factors to HIGH/CRITICAL', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({
          createdAt: new Date(), // +20
          emailVerified: false, // +15
          idVerificationStatus: 'PENDING', // +10
          disputesInitiated: [{ id: 'd-1' }, { id: 'd-2' }], // +20
        }),
      );

      const result = await service.checkUserRisk(mockUserId);
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
      expect(result.allowBooking).toBe(false);
      expect(result.requiresManualReview).toBe(true);
    });
  });

  describe('checkBookingRisk', () => {
    const bookingData = {
      userId: mockUserId,
      listingId: 'listing-1',
      totalPrice: 200,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // week from now
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };

    it('returns LOW risk for normal booking from trusted user', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(makeTrustedUser()) // checkUserRisk
        .mockResolvedValueOnce({
          ...makeTrustedUser(),
          bookings: [{ id: 'b-1', status: 'COMPLETED' }],
        }); // booking risk check

      const result = await service.checkBookingRisk(bookingData);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.allowBooking).toBe(true);
    });

    it('flags high-value booking from new user', async () => {
      const newUser = makeTrustedUser({
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days
        bookings: [],
      });
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(newUser) // checkUserRisk
        .mockResolvedValueOnce(newUser); // booking risk

      const result = await service.checkBookingRisk({
        ...bookingData,
        totalPrice: 600,
      });

      const flag = result.flags.find((f) => f.type === 'HIGH_VALUE_NEW_USER');
      expect(flag).toBeDefined();
    });

    it('flags unusually long booking (>90 days)', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValue(makeTrustedUser({ bookings: [{ id: 'b-1' }] }));

      const result = await service.checkBookingRisk({
        ...bookingData,
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      });

      const flag = result.flags.find((f) => f.type === 'UNUSUALLY_LONG_BOOKING');
      expect(flag).toBeDefined();
    });

    it('flags high booking velocity', async () => {
      (cache.increment as jest.Mock).mockResolvedValue(5); // 5 bookings in window
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        makeTrustedUser({ bookings: [{ id: 'b-1' }] }),
      );

      const result = await service.checkBookingRisk(bookingData);
      const flag = result.flags.find((f) => f.type === 'HIGH_BOOKING_VELOCITY');
      expect(flag).toBeDefined();
    });
  });

  describe('checkPaymentRisk', () => {
    const paymentData = {
      userId: mockUserId,
      paymentMethodId: 'pm-1',
      amount: 100,
    };

    it('flags new payment method', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null); // method not seen before

      const result = await service.checkPaymentRisk(paymentData);
      const flag = result.flags.find((f) => f.type === 'NEW_PAYMENT_METHOD');
      expect(flag).toBeDefined();
    });

    it('flags multiple payment methods', async () => {
      (cache.get as jest.Mock)
        .mockResolvedValueOnce(Date.now()) // payment method age (not new)
        .mockResolvedValueOnce(['pm-1', 'pm-2', 'pm-3', 'pm-4']); // 4 methods (JSON-serialized array)

      const result = await service.checkPaymentRisk(paymentData);
      const flag = result.flags.find((f) => f.type === 'MULTIPLE_PAYMENT_METHODS');
      expect(flag).toBeDefined();
    });
  });

  describe('checkListingRisk', () => {
    const listingData = {
      userId: mockUserId,
      title: 'Nice apartment in Kathmandu',
      description: 'A cozy 2BHK apartment',
      basePrice: 5000,
      photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'],
    };

    it('returns LOW risk for normal listing', async () => {
      const result = await service.checkListingRisk(listingData);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('flags listing with no photos', async () => {
      const result = await service.checkListingRisk({ ...listingData, photos: [] });
      const flag = result.flags.find((f) => f.type === 'NO_PHOTOS');
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('HIGH');
    });

    it('flags listing with few photos', async () => {
      const result = await service.checkListingRisk({ ...listingData, photos: ['one.jpg'] });
      const flag = result.flags.find((f) => f.type === 'FEW_PHOTOS');
      expect(flag).toBeDefined();
    });

    it('flags spam content in title/description', async () => {
      const result = await service.checkListingRisk({
        ...listingData,
        description: 'Contact me on WhatsApp for best deals!',
      });
      const flag = result.flags.find((f) => f.type === 'SUSPICIOUS_CONTENT');
      expect(flag).toBeDefined();
    });

    it('flags phone numbers in description', async () => {
      const result = await service.checkListingRisk({
        ...listingData,
        description: 'Call me at 9841234567890 for booking',
      });
      const flag = result.flags.find((f) => f.type === 'SUSPICIOUS_CONTENT');
      expect(flag).toBeDefined();
    });
  });

  describe('logFraudCheck', () => {
    it('stores audit log for high risk (score >= 50)', async () => {
      const result: FraudCheckResult = {
        riskLevel: RiskLevel.HIGH,
        riskScore: 60,
        flags: [{ type: 'TEST', severity: 'HIGH', description: 'Test flag' }],
        requiresManualReview: true,
        allowBooking: false,
      };

      await service.logFraudCheck('BOOKING', 'b-1', result);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('does NOT store audit log for low risk (score < 50)', async () => {
      const result: FraudCheckResult = {
        riskLevel: RiskLevel.LOW,
        riskScore: 10,
        flags: [],
        requiresManualReview: false,
        allowBooking: true,
      };

      await service.logFraudCheck('USER', 'u-1', result);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
