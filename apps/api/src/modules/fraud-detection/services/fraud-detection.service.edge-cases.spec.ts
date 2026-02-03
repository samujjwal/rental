import { Test, TestingModule } from '@nestjs/testing';
import { FraudDetectionService } from './fraud-detection.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
  },
  fraudScore: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('FraudDetectionService - Edge Cases & Comprehensive Tests', () => {
  let service: FraudDetectionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<FraudDetectionService>(FraudDetectionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Case: Non-existent user', () => {
    it('should return CRITICAL risk for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.checkUserRisk('non-existent-user');

      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.riskScore).toBe(100);
      expect(result.flags.some((f) => f.type === 'USER_NOT_FOUND')).toBe(true);
    });
  });

  describe('Edge Case: New account (< 7 days)', () => {
    it('should flag very new accounts (1 day old)', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 0,
        totalReviews: 0,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'NEW_ACCOUNT')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it('should flag accounts less than 7 days old', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 0,
        totalReviews: 0,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'NEW_ACCOUNT')).toBe(true);
    });

    it('should not flag accounts 7+ days old', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 0,
        totalReviews: 0,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'NEW_ACCOUNT')).toBe(false);
    });
  });

  describe('Edge Case: Email verification', () => {
    it('should flag unverified email as HIGH severity', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        emailVerified: false,
        idVerificationStatus: 'VERIFIED',
        averageRating: 0,
        totalReviews: 0,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      const emailFlag = result.flags.find((f) => f.type === 'EMAIL_NOT_VERIFIED');
      expect(emailFlag).toBeDefined();
      expect(emailFlag?.severity).toBe('HIGH');
      expect(result.riskScore).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Edge Case: ID verification status', () => {
    it('should flag unverified ID', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'PENDING',
        averageRating: 0,
        totalReviews: 0,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'ID_NOT_VERIFIED')).toBe(true);
    });

    it('should not flag verified ID', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 5.0,
        totalReviews: 10,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'ID_NOT_VERIFIED')).toBe(false);
    });
  });

  describe('Edge Case: Cancellation patterns', () => {
    it('should flag frequent cancellations (3+ in 90 days)', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 3.0,
        totalReviews: 5,
        bookings: [
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      const cancellationFlag = result.flags.find((f) => f.type === 'FREQUENT_CANCELLATIONS');
      expect(cancellationFlag).toBeDefined();
      expect(cancellationFlag?.severity).toBe('HIGH');
    });

    it('should not flag 2 or fewer cancellations', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 4.0,
        totalReviews: 5,
        bookings: [
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
        ],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'FREQUENT_CANCELLATIONS')).toBe(false);
    });
  });

  describe('Edge Case: Dispute history', () => {
    it('should flag users with 2+ disputes in 90 days', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 3.5,
        totalReviews: 5,
        bookings: [],
        disputesInitiated: [
          { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
          { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      const disputeFlag = result.flags.find((f) => f.type === 'DISPUTE_HISTORY');
      expect(disputeFlag).toBeDefined();
      expect(disputeFlag?.severity).toBe('HIGH');
    });

    it('should not flag users with 1 dispute', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 4.0,
        totalReviews: 5,
        bookings: [],
        disputesInitiated: [{ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'DISPUTE_HISTORY')).toBe(false);
    });
  });

  describe('Edge Case: Rating thresholds', () => {
    it('should flag low ratings (< 3.5)', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 3.0,
        totalReviews: 10,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'LOW_RATING')).toBe(true);
    });

    it('should not flag ratings >= 3.5', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 3.5,
        totalReviews: 10,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'LOW_RATING')).toBe(false);
    });

    it('should not flag users with 0 rating (no reviews yet)', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 0,
        totalReviews: 0,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'LOW_RATING')).toBe(false);
    });
  });

  describe('Edge Case: Negative reviews', () => {
    it('should flag users with 4+ negative reviews', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 2.5,
        totalReviews: 10,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [
          { overallRating: 2 },
          { overallRating: 1 },
          { overallRating: 2 },
          { overallRating: 1 },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'NEGATIVE_REVIEWS')).toBe(true);
    });

    it('should not flag users with 3 or fewer negative reviews', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 3.5,
        totalReviews: 10,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [{ overallRating: 2 }, { overallRating: 2 }, { overallRating: 2 }],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.flags.some((f) => f.type === 'NEGATIVE_REVIEWS')).toBe(false);
    });
  });

  describe('Edge Case: Risk level calculation', () => {
    it('should return LOW risk for score 0-24', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 5.0,
        totalReviews: 20,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.riskLevel).toBe('LOW');
      expect(result.riskScore).toBeLessThan(25);
    });

    it('should return MEDIUM risk for score 25-49', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // New account: 20 points
        emailVerified: false, // Unverified email: 15 points
        idVerificationStatus: 'PENDING', // Unverified ID: 10 points
        averageRating: 0,
        totalReviews: 0,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.riskScore).toBeGreaterThanOrEqual(25);
      expect(result.riskScore).toBeLessThan(50);
    });

    it('should return HIGH risk for score 50-74', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 20 points
        emailVerified: false, // 15 points
        idVerificationStatus: 'PENDING', // 10 points
        averageRating: 3.0, // 15 points
        totalReviews: 5,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.riskLevel).toBe('HIGH');
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
      expect(result.riskScore).toBeLessThan(75);
    });

    it('should return CRITICAL risk for score 75+', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 20 points
        emailVerified: false, // 15 points
        idVerificationStatus: 'PENDING', // 10 points
        averageRating: 2.5, // 15 points
        totalReviews: 10,
        bookings: [
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
          { status: 'CANCELLED', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ], // 15 points
        disputesInitiated: [
          { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
          { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ], // 20 points
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.riskScore).toBeGreaterThanOrEqual(75);
    });
  });

  describe('Edge Case: Manual review requirement', () => {
    it('should require manual review for HIGH risk', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        emailVerified: false,
        idVerificationStatus: 'PENDING',
        averageRating: 3.0,
        totalReviews: 5,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.requiresManualReview).toBe(true);
    });

    it('should require manual review for CRITICAL risk', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        emailVerified: false,
        idVerificationStatus: 'PENDING',
        averageRating: 2.0,
        totalReviews: 10,
        bookings: [
          { status: 'CANCELLED', createdAt: new Date() },
          { status: 'CANCELLED', createdAt: new Date() },
          { status: 'CANCELLED', createdAt: new Date() },
        ],
        disputesInitiated: [{ createdAt: new Date() }, { createdAt: new Date() }],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.requiresManualReview).toBe(true);
    });

    it('should not require manual review for LOW risk', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 5.0,
        totalReviews: 20,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.requiresManualReview).toBe(false);
    });
  });

  describe('Edge Case: Booking allowance', () => {
    it('should not allow bookings for CRITICAL risk', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        emailVerified: false,
        idVerificationStatus: 'PENDING',
        averageRating: 2.0,
        totalReviews: 10,
        bookings: [
          { status: 'CANCELLED', createdAt: new Date() },
          { status: 'CANCELLED', createdAt: new Date() },
          { status: 'CANCELLED', createdAt: new Date() },
        ],
        disputesInitiated: [{ createdAt: new Date() }, { createdAt: new Date() }],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.allowBooking).toBe(false);
    });

    it('should allow bookings for LOW and MEDIUM risk', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 4.5,
        totalReviews: 10,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.allowBooking).toBe(true);
    });
  });

  describe('Edge Case: Perfect user (no flags)', () => {
    it('should return zero risk score for perfect user', async () => {
      const user = {
        id: 'user-1',
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 5.0,
        totalReviews: 50,
        bookings: [],
        disputesInitiated: [],
        reviewsReceived: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.checkUserRisk('user-1');

      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.flags).toHaveLength(0);
      expect(result.allowBooking).toBe(true);
      expect(result.requiresManualReview).toBe(false);
    });
  });
});
