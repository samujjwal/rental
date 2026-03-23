import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PolicyEngineService } from '../../policy-engine/services/policy-engine.service';
import { PricingMode, DepositType } from '@rental-portal/database';

const mockPrismaService = {
  listing: {
    findUnique: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
  },
};

const mockPolicyEngine = {
  calculateFees: jest.fn(),
  evaluateCancellation: jest.fn(),
};

describe('BookingCalculationService', () => {
  let service: BookingCalculationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: { get: jest.fn((key: string, defaultVal: any) => defaultVal) } },
        { provide: PolicyEngineService, useValue: mockPolicyEngine },
      ],
    }).compile();

    service = module.get<BookingCalculationService>(BookingCalculationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePrice', () => {
    const listingId = 'listing-1';
    const startDate = new Date('2023-01-01T10:00:00Z');
    const endDate = new Date('2023-01-02T10:00:00Z'); // 24 hours

    it('should calculate price for DAILY pricing', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
        category: { slug: 'electronics' },
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const result = await service.calculatePrice(listingId, startDate, endDate);

      expect(result.subtotal).toBe(100);
      expect(result.total).toBeGreaterThan(100); // Includes fees
    });

    it('should calculate deposit if required', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        requiresDeposit: true,
        depositType: DepositType.FIXED,
        depositAmount: 50,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const result = await service.calculatePrice(listingId, startDate, endDate);

      expect(result.depositAmount).toBe(50);
    });

    it('should use PolicyEngine fees when available', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 1000,
        dailyPrice: 1000,
        country: 'NP',
        currency: 'NPR',
        category: { slug: 'spaces' },
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [
          { feeType: 'PLATFORM_FEE', name: 'Platform Fee', rate: 8, amount: 80, ruleId: 'r1' },
          { feeType: 'SERVICE_FEE', name: 'Service Fee', rate: 3, amount: 30, ruleId: 'r2' },
        ],
        totalFees: 110,
        currency: 'NPR',
      });

      const result = await service.calculatePrice(listingId, startDate, endDate);

      expect(mockPolicyEngine.calculateFees).toHaveBeenCalled();
      expect(result.platformFee).toBe(80);
      expect(result.serviceFee).toBe(30);
    });

    it('should fall back to config rates when PolicyEngine returns no fees', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const result = await service.calculatePrice(listingId, startDate, endDate);

      // Default config rates: 10% platform, 5% service
      expect(result.platformFee).toBe(10);
      expect(result.serviceFee).toBe(5);
    });

    it('should fall back to config rates when PolicyEngine throws', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockRejectedValue(new Error('Engine down'));

      const result = await service.calculatePrice(listingId, startDate, endDate);

      expect(result.platformFee).toBe(10);
      expect(result.serviceFee).toBe(5);
    });
  });

  describe('calculateRefund', () => {
    const bookingBase = {
      id: 'booking-1',
      listingId: 'listing-1',
      basePrice: 1000,
      totalPrice: 1350,
      platformFee: 100,
      serviceFee: 50,
      securityDeposit: 200,
      startDate: new Date('2023-01-10T10:00:00Z'),
      endDate: new Date('2023-01-15T10:00:00Z'),
      currency: 'NPR',
      listing: {
        cancellationPolicy: null,
        country: 'NP',
        state: null,
        city: null,
        category: { slug: 'electronics' },
      },
    };

    it('should use PolicyEngine cancellation tiers when available', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(bookingBase);
      mockPolicyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 72, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund >72h', ruleId: 'r1' },
          { minHoursBefore: 24, maxHoursBefore: 72, refundPercentage: 0.75, label: '75% 24-72h', ruleId: 'r1' },
          { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0.25, label: '25% <24h', ruleId: 'r1' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
        appliedRules: ['r1'],
      });

      // Cancel 100 hours before start = should match >72h tier
      const cancelDate = new Date(bookingBase.startDate.getTime() - 100 * 60 * 60 * 1000);
      const result = await service.calculateRefund('booking-1', cancelDate);

      expect(result.refundAmount).toBeGreaterThan(0);
      expect(result.reason).toContain('Full refund');
      expect(result.penalty).toBe(0);
    });

    it('should match middle cancellation tier', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(bookingBase);
      mockPolicyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund', ruleId: 'r1' },
          { minHoursBefore: 24, maxHoursBefore: 48, refundPercentage: 0.5, label: '50% refund', ruleId: 'r1' },
          { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0, label: 'No refund', ruleId: 'r1' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
        appliedRules: ['r1'],
      });

      // Cancel 36 hours before start = should match 24-48h tier
      const cancelDate = new Date(bookingBase.startDate.getTime() - 36 * 60 * 60 * 1000);
      const result = await service.calculateRefund('booking-1', cancelDate);

      expect(result.refundAmount).toBe(500 + 25 + 200); // 50% subtotal + 50% service fee + full deposit
      expect(result.reason).toContain('50%');
    });

    it('should not refund service fee when policy says so', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(bookingBase);
      mockPolicyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund', ruleId: 'r1' },
        ],
        refundServiceFee: false,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
        appliedRules: ['r1'],
      });

      const cancelDate = new Date(bookingBase.startDate.getTime() - 100 * 60 * 60 * 1000);
      const result = await service.calculateRefund('booking-1', cancelDate);

      expect(result.serviceFeeRefund).toBe(0);
      expect(result.depositRefund).toBe(200);
    });

    it('should fall back to default policy when PolicyEngine throws', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(bookingBase);
      mockPolicyEngine.evaluateCancellation.mockRejectedValue(new Error('Down'));

      // Cancel 100 hours before = default gives full refund
      const cancelDate = new Date(bookingBase.startDate.getTime() - 100 * 60 * 60 * 1000);
      const result = await service.calculateRefund('booking-1', cancelDate);

      expect(result.reason).toBe('Cancelled more than 48 hours before start — full refund');
      expect(result.refundAmount).toBeGreaterThan(0);
    });

    it('should fall back to default policy when PolicyEngine returns empty tiers', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(bookingBase);
      mockPolicyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
        appliedRules: [],
      });

      // Cancel 12 hours before = default gives 0%
      const cancelDate = new Date(bookingBase.startDate.getTime() - 12 * 60 * 60 * 1000);
      const result = await service.calculateRefund('booking-1', cancelDate);

      expect(result.reason).toBe('Cancelled less than 24 hours before start — no refund');
      expect(result.penalty).toBeGreaterThan(0);
    });
  });

  describe('calculatePrice without PolicyEngine', () => {
    it('should work when PolicyEngine is not injected', async () => {
      // Create service without PolicyEngine
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BookingCalculationService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: { get: jest.fn((_k: string, d: any) => d) } },
          // No PolicyEngineService provided — @Optional() should make it undefined
        ],
      }).compile();

      const svcNoPE = module.get<BookingCalculationService>(BookingCalculationService);

      const listing = {
        id: 'l1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        category: null,
      };
      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const result = await svcNoPE.calculatePrice(
        'l1',
        new Date('2023-01-01'),
        new Date('2023-01-02'),
      );

      expect(result.platformFee).toBe(10);
      expect(result.serviceFee).toBe(5);
    });
  });
});
