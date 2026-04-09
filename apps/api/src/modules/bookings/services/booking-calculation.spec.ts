import { Test, TestingModule } from '@nestjs/testing';
import { BookingCalculationService, PriceCalculation } from './booking-calculation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PolicyEngineService } from '@/modules/policy-engine/services/policy-engine.service';

/**
 * REFUND/FEE/DEPOSIT CALCULATION TESTS
 *
 * These tests validate financial calculations:
 * - Platform fee calculation
 * - Service fee calculation
 * - Deposit amount calculation
 * - Cancellation refund tiers
 * - Owner earnings calculation
 * - PolicyEngine integration for jurisdiction-aware fees
 *
 * Business Truth Validated:
 * - Fees are calculated correctly based on booking value
 * - Deposits are calculated according to listing category
 * - Refunds follow cancellation policy tiers
 * - Owner earnings are accurate after fees
 * - Jurisdiction-specific rules are applied
 */
describe('Booking Calculation Service - Refund/Fee/Deposit Calculations', () => {
  let service: BookingCalculationService;
  let prisma: any;
  let config: any;
  let policyEngine: any;

  beforeEach(async () => {
    const mockPrismaService: any = {
      listing: {
        findUnique: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
    };

    const mockConfigService: any = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'fees.platformFeePercent') return 10;
        if (key === 'fees.serviceFeePercent') return 5;
        if (key === 'defaultCancellationPolicy') return defaultValue;
        return defaultValue;
      }),
    };

    const mockPolicyEngine: any = {
      calculateFees: jest.fn(() =>
        Promise.resolve({
          totalFees: 0,
          baseFees: [],
          currency: 'USD',
        }),
      ),
      evaluateCancellation: jest.fn(() =>
        Promise.resolve({
          matched: true,
          actions: [
            { type: 'SET_RATE', params: { feeType: 'platform', rate: 12 } },
            { type: 'SET_RATE', params: { feeType: 'service', rate: 6 } },
          ],
          policyType: 'FEE',
          appliedRules: [],
          eliminatedRules: [],
          evaluationMs: 0,
          fallbackUsed: false,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PolicyEngineService, useValue: mockPolicyEngine },
      ],
    }).compile();

    service = module.get<BookingCalculationService>(BookingCalculationService);
    prisma = mockPrismaService;
    config = mockConfigService;
    policyEngine = mockPolicyEngine;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Fee Calculations', () => {
    it('should calculate platform fee at 10%', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.platformFee).toBe(80); // 800 * 0.10 = 80
      expect(result.serviceFee).toBe(40); // 800 * 0.05 = 40
    });

    it('should calculate service fee at 5%', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.serviceFee).toBe(40); // 800 * 0.05 = 40
    });

    it('should use PolicyEngine for jurisdiction-aware fees', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: { depositType: 'FIXED_AMOUNT', depositAmount: 50 },
        country: 'NP',
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 120,
        baseFees: [
          { feeType: 'PLATFORM_FEE', amount: 96 },
          { feeType: 'SERVICE_FEE', amount: 48 },
        ],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(policyEngine.calculateFees).toHaveBeenCalled();
      expect(result.platformFee).toBe(96); // 800 * 0.12 = 96
      expect(result.serviceFee).toBe(48); // 800 * 0.06 = 48
    });

    it('should fall back to config rates when PolicyEngine has no rules', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.platformFee).toBe(80); // 800 * 0.10 = 80
      expect(result.serviceFee).toBe(40); // 800 * 0.05 = 40
    });
  });

  describe('Deposit Calculations', () => {
    it('should calculate fixed amount deposit', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.depositAmount).toBe(50);
    });

    it('should calculate percentage-based deposit', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'PERCENTAGE',
        depositAmount: 20,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.depositAmount).toBe(160); // 800 * 0.20 = 160
    });

    it('should calculate no deposit when not required', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'NONE',
        depositAmount: 0,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.depositAmount).toBe(0);
    });
  });

  describe('Cancellation Refund Calculations', () => {
    it('should give full refund when cancelled 48+ hours before start', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      prisma.booking.findUnique = jest.fn().mockResolvedValue({
        id: 'booking-123',
        startDate: new Date('2026-04-15T10:00:00Z'),
        endDate: new Date('2026-04-15T18:00:00Z'),
        basePrice: 800,
        totalPrice: 920,
        platformFee: 80,
        serviceFee: 40,
        depositAmount: 50,
        securityDeposit: 50,
        currency: 'USD',
        listing: { cancellationPolicy: null },
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const cancellationDate = new Date('2026-04-10T10:00:00Z');

      const refund = await service.calculateRefund('booking-123', cancellationDate);

      expect(refund.refundAmount).toBeGreaterThan(800);
      expect(refund.depositRefund).toBe(50);
    });

    it('should give 50% refund when cancelled 24-48 hours before start', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      prisma.booking.findUnique = jest.fn().mockResolvedValue({
        id: 'booking-123',
        startDate: new Date('2026-04-12T10:00:00Z'),
        endDate: new Date('2026-04-12T18:00:00Z'),
        basePrice: 800,
        totalPrice: 920,
        platformFee: 80,
        serviceFee: 40,
        depositAmount: 50,
        securityDeposit: 50,
        currency: 'USD',
        listing: { cancellationPolicy: null },
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const cancellationDate = new Date('2026-04-10T10:00:00Z');

      const refund = await service.calculateRefund('booking-123', cancellationDate);

      // Refund should be between 400-890 (50% of ~890 total after deposit)
      expect(refund.refundAmount).toBeGreaterThan(400);
      expect(refund.refundAmount).toBeLessThan(900);
    });

    it('should give no refund when cancelled less than 24 hours before start', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      prisma.booking.findUnique = jest.fn().mockResolvedValue({
        id: 'booking-123',
        startDate: new Date('2026-04-11T08:00:00Z'),
        endDate: new Date('2026-04-11T16:00:00Z'),
        basePrice: 800,
        totalPrice: 920,
        platformFee: 80,
        serviceFee: 40,
        depositAmount: 50,
        securityDeposit: 50,
        currency: 'USD',
        listing: { cancellationPolicy: null },
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const cancellationDate = new Date('2026-04-10T10:00:00Z');

      const refund = await service.calculateRefund('booking-123', cancellationDate);

      expect(refund.refundAmount).toBeLessThan(100);
      expect(refund.penalty).toBeGreaterThan(700);
    });
  });

  describe('Owner Earnings Calculations', () => {
    it('should calculate owner earnings after fees', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      // Base price: 800
      // Platform fee: 80 (10%)
      // Service fee: 40 (5%)
      // Total fees: 120
      // Owner earnings: 800 - 120 = 680
      expect(result.ownerEarnings).toBe(680);
    });

    it('should calculate total including fees', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      // Base price: 800
      // Platform fee: 80
      // Service fee: 40
      // Deposit: 50
      // Total: 800 + 80 + 40 + 50 = 970
      expect(result.total).toBe(970);
    });
  });

  describe('Fee Rate Accessors', () => {
    it('should return service fee rate', () => {
      const rate = service.getServiceFeeRate();
      expect(rate).toBe(0.05); // 5%
    });

    it('should return platform fee rate', () => {
      const rate = service.getPlatformFeeRate();
      expect(rate).toBe(0.1); // 10%
    });
  });

  describe('Duration Calculations', () => {
    it('should calculate hourly duration', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.breakdown.duration).toBe(8);
      expect(result.breakdown.durationType).toBe('hours');
    });

    it('should calculate daily duration', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_DAY',
        category: { depositType: 'FIXED_AMOUNT', depositAmount: 50 },
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T00:00:00Z');
      const endDate = new Date('2026-04-13T00:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.breakdown.duration).toBe(3);
      expect(result.breakdown.durationType).toBe('days');
    });
  });

  describe('Discount Calculations', () => {
    it('should apply early bird discount', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: { depositType: 'FIXED_AMOUNT', depositAmount: 50 },
        weeklyDiscount: 10, // 10% discount for weekly bookings
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-20T10:00:00Z');
      const endDate = new Date('2026-04-27T18:00:00Z'); // 7+ days for weekly discount

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.breakdown.discounts).toBeDefined();
      expect(result.breakdown.discounts?.length).toBeGreaterThan(0);
    });
  });

  describe('Price Breakdown Validation', () => {
    it('should provide complete price breakdown', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      // Validate all breakdown fields
      expect(result.subtotal).toBeDefined();
      expect(result.platformFee).toBeDefined();
      expect(result.serviceFee).toBeDefined();
      expect(result.depositAmount).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.ownerEarnings).toBeDefined();
      expect(result.breakdown).toBeDefined();
    });

    it('should calculate correct subtotal from base price', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      // Base price: 100 * 8 hours = 800
      expect(result.subtotal).toBe(800);
    });

    it('should calculate total including all fees', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      // Subtotal (800) + Platform Fee (80) + Service Fee (40) + Deposit (50) = 970
      expect(result.total).toBe(970);
    });

    it('should calculate owner earnings after fees', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      // Owner gets subtotal minus fees: 800 - 80 - 40 = 680
      expect(result.ownerEarnings).toBe(680);
    });

    it('should include duration in breakdown', async () => {
      prisma.listing.findUnique = jest.fn().mockResolvedValue({
        id: 'listing-123',
        hourlyPrice: 100,
        pricingMode: 'PER_HOUR',
        category: {},
        depositType: 'FIXED',
        depositAmount: 50,
      } as any);

      policyEngine.calculateFees = jest.fn().mockResolvedValue({
        totalFees: 0,
        baseFees: [],
        currency: 'USD',
      } as any);

      const startDate = new Date('2026-04-10T10:00:00Z');
      const endDate = new Date('2026-04-10T18:00:00Z');

      const result = await service.calculatePrice('listing-123', startDate, endDate);

      expect(result.breakdown.duration).toBe(8);
      expect(result.breakdown.durationType).toBe('hours');
    });
  });
});
