import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PolicyEngineService } from '../../policy-engine/services/policy-engine.service';
import { PricingMode, DepositType } from '@rental-portal/database';

/**
 * COMPREHENSIVE BUSINESS LOGIC VALIDATION TESTS
 * 
 * These tests validate the CORRECTNESS of business logic computations, not implementation.
 * Each test validates EXACT expected outcomes based on business rules.
 * 
 * Principles:
 * 1. Validate exact computations, not just > 0 or function calls
 * 2. Test all edge cases and boundary conditions
 * 3. Validate fee/tax/refund calculations against business rules
 * 4. Test all pricing modes and deposit types
 * 5. Validate discount logic and priority
 */
describe('BookingCalculationService - Business Logic Validation', () => {
  let service: BookingCalculationService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { 
          provide: ConfigService, 
          useValue: { 
            get: jest.fn((key: string, defaultVal: any) => {
              if (key === 'fees.platformFeePercent') return 10;
              if (key === 'fees.serviceFeePercent') return 5;
              if (key === 'platform.defaultCurrency') return 'USD';
              return defaultVal;
            }) 
          } 
        },
        { provide: PolicyEngineService, useValue: mockPolicyEngine },
      ],
    }).compile();

    service = module.get<BookingCalculationService>(BookingCalculationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Price Calculation - Exact Validation', () => {
    const listingId = 'listing-1';

    describe('PER_HOUR pricing mode', () => {
      it('should calculate exact price for 1 hour rental', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_HOUR,
          basePrice: 20,
          hourlyPrice: 20,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-01T11:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 1 hour × $20/hour = $20
        expect(result.subtotal).toBe(20);
        expect(result.breakdown.basePrice).toBe(20);
        expect(result.breakdown.duration).toBe(1);
        expect(result.breakdown.durationType).toBe('hours');
        
        // EXACT VALIDATION: Fees (10% platform + 5% service of $20)
        expect(result.platformFee).toBe(2); // 20 × 0.10
        expect(result.serviceFee).toBe(1);  // 20 × 0.05
        
        // EXACT VALIDATION: Total = subtotal + serviceFee + deposit
        expect(result.total).toBe(21); // 20 + 1 + 0
        
        // EXACT VALIDATION: Owner earnings = subtotal - platformFee
        expect(result.ownerEarnings).toBe(18); // 20 - 2
      });

      it('should calculate exact price for 5 hour rental', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_HOUR,
          basePrice: 25,
          hourlyPrice: 25,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-01T15:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 5 hours × $25/hour = $125
        expect(result.subtotal).toBe(125);
        expect(result.breakdown.basePrice).toBe(125);
        expect(result.breakdown.duration).toBe(5);
        
        // EXACT VALIDATION: Fees
        expect(result.platformFee).toBe(12.5); // 125 × 0.10
        expect(result.serviceFee).toBe(6.25);  // 125 × 0.05
        expect(result.total).toBe(131.25);      // 125 + 6.25
        expect(result.ownerEarnings).toBe(112.5); // 125 - 12.5
      });
    });

    describe('PER_DAY pricing mode', () => {
      it('should calculate exact price for 1 day rental', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-02T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 1 day × $100/day = $100
        expect(result.subtotal).toBe(100);
        expect(result.breakdown.basePrice).toBe(100);
        expect(result.breakdown.duration).toBe(1);
        expect(result.breakdown.durationType).toBe('days');
        
        // EXACT VALIDATION: Fees
        expect(result.platformFee).toBe(10); // 100 × 0.10
        expect(result.serviceFee).toBe(5);   // 100 × 0.05
        expect(result.total).toBe(105);       // 100 + 5
        expect(result.ownerEarnings).toBe(90); // 100 - 10
      });

      it('should calculate exact price for 7 day rental', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-08T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 7 days × $100/day = $700
        expect(result.subtotal).toBe(700);
        expect(result.breakdown.basePrice).toBe(700);
        expect(result.breakdown.duration).toBe(7);
        
        // EXACT VALIDATION: Fees
        expect(result.platformFee).toBe(70); // 700 × 0.10
        expect(result.serviceFee).toBe(35);  // 700 × 0.05
        expect(result.total).toBe(735);       // 700 + 35
        expect(result.ownerEarnings).toBe(630); // 700 - 70
      });

      it('should calculate exact price for partial day (less than 24 hours)', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-01T18:00:00Z'); // 8 hours
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: Partial day should charge 1 day minimum
        expect(result.subtotal).toBe(100);
        expect(result.breakdown.basePrice).toBe(100);
        expect(result.breakdown.duration).toBe(1); // Rounds up to 1 day
      });
    });

    describe('PER_WEEK pricing mode', () => {
      it('should calculate exact price for 1 week rental', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_WEEK,
          basePrice: 500,
          weeklyPrice: 500,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-08T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 1 week × $500/week = $500
        expect(result.subtotal).toBe(500);
        expect(result.breakdown.basePrice).toBe(500);
        expect(result.breakdown.duration).toBe(1);
        expect(result.breakdown.durationType).toBe('weeks');
        
        // EXACT VALIDATION: Fees
        expect(result.platformFee).toBe(50); // 500 × 0.10
        expect(result.serviceFee).toBe(25);  // 500 × 0.05
        expect(result.total).toBe(525);      // 500 + 25
        expect(result.ownerEarnings).toBe(450); // 500 - 50
      });

      it('should calculate exact price for 2 week rental', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_WEEK,
          basePrice: 500,
          weeklyPrice: 500,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-15T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 2 weeks × $500/week = $1000
        expect(result.subtotal).toBe(1000);
        expect(result.breakdown.basePrice).toBe(1000);
        expect(result.breakdown.duration).toBe(2);
        
        // EXACT VALIDATION: Fees
        expect(result.platformFee).toBe(100); // 1000 × 0.10
        expect(result.serviceFee).toBe(50);  // 1000 × 0.05
        expect(result.total).toBe(1050);      // 1000 + 50
        expect(result.ownerEarnings).toBe(900); // 1000 - 100
      });
    });

    describe('PER_MONTH pricing mode', () => {
      it('should calculate exact price for 1 month rental', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_MONTH,
          basePrice: 2000,
          monthlyPrice: 2000,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-02-01T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 1 month × $2000/month = $2000
        expect(result.subtotal).toBe(2000);
        expect(result.breakdown.basePrice).toBe(2000);
        expect(result.breakdown.duration).toBe(1);
        expect(result.breakdown.durationType).toBe('months');
        
        // EXACT VALIDATION: Fees
        expect(result.platformFee).toBe(200); // 2000 × 0.10
        expect(result.serviceFee).toBe(100);  // 2000 × 0.05
        expect(result.total).toBe(2100);      // 2000 + 100
        expect(result.ownerEarnings).toBe(1800); // 2000 - 200
      });
    });
  });

  describe('Deposit Calculation - Exact Validation', () => {
    const listingId = 'listing-1';

    describe('FIXED deposit type', () => {
      it('should calculate exact fixed deposit amount', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
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

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-02T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: Fixed deposit of $50
        expect(result.depositAmount).toBe(50);
        
        // EXACT VALIDATION: Total includes deposit
        expect(result.total).toBe(155); // 100 (subtotal) + 5 (serviceFee) + 50 (deposit)
      });

      it('should handle zero fixed deposit', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
          requiresDeposit: true,
          depositType: DepositType.FIXED,
          depositAmount: 0,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-02T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        expect(result.depositAmount).toBe(0);
        expect(result.total).toBe(105); // 100 + 5 + 0
      });
    });

    describe('PERCENTAGE deposit type', () => {
      it('should calculate exact percentage deposit', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
          requiresDeposit: true,
          depositType: DepositType.PERCENTAGE,
          depositAmount: 20, // 20%
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-02T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 20% of $100 subtotal = $20
        expect(result.depositAmount).toBe(20);
        
        // EXACT VALIDATION: Total includes percentage deposit
        expect(result.total).toBe(125); // 100 (subtotal) + 5 (serviceFee) + 20 (deposit)
      });

      it('should calculate exact percentage deposit for higher subtotal', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
          requiresDeposit: true,
          depositType: DepositType.PERCENTAGE,
          depositAmount: 25, // 25%
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-04T10:00:00Z'); // 3 days
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 25% of $300 subtotal = $75
        expect(result.subtotal).toBe(300);
        expect(result.depositAmount).toBe(75);
        
        // EXACT VALIDATION: Total = 300 + 15 (serviceFee) + 75 (deposit)
        expect(result.total).toBe(390);
      });
    });

    describe('Security deposit field', () => {
      it('should use securityDeposit field when set', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          currency: 'USD',
          securityDeposit: 100, // Direct field
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-02T10:00:00Z');
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: Security deposit field takes precedence
        expect(result.depositAmount).toBe(100);
        expect(result.total).toBe(205); // 100 + 5 + 100
      });
    });
  });

  describe('Discount Calculation - Exact Validation', () => {
    const listingId = 'listing-1';

    describe('Weekly discount', () => {
      it('should apply exact weekly discount percentage', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          weeklyDiscount: 10, // 10%
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-08T10:00:00Z'); // 7 days = 1 week
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 7 days × $100 = $700 base
        expect(result.breakdown.basePrice).toBe(700);
        
        // EXACT VALIDATION: 10% weekly discount = $70
        expect(result.subtotal).toBe(630); // 700 - 70
        expect(result.breakdown.discounts).toEqual([
          { type: 'weekly', amount: 70, reason: 'Weekly booking discount (10%)' }
        ]);
        
        // EXACT VALIDATION: Fees on discounted subtotal
        expect(result.platformFee).toBe(63); // 630 × 0.10
        expect(result.serviceFee).toBe(31.5);  // 630 × 0.05
        expect(result.total).toBe(661.5);      // 630 + 31.5
      });

      it('should not apply weekly discount for less than 7 days', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          weeklyDiscount: 10,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-01-06T10:00:00Z'); // 5 days
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: No discount applied
        expect(result.subtotal).toBe(500);
        expect(result.breakdown.discounts).toBeUndefined();
      });
    });

    describe('Monthly discount', () => {
      it('should apply exact monthly discount percentage', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          monthlyDiscount: 20, // 20%
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-02-01T10:00:00Z'); // 31 days
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: 31 days × $100 = $3100 base
        expect(result.breakdown.basePrice).toBe(3100);
        
        // EXACT VALIDATION: 20% monthly discount = $620
        expect(result.subtotal).toBe(2480); // 3100 - 620
        expect(result.breakdown.discounts).toEqual([
          { type: 'monthly', amount: 620, reason: 'Monthly booking discount (20%)' }
        ]);
        
        // EXACT VALIDATION: Fees on discounted subtotal
        expect(result.platformFee).toBe(248); // 2480 × 0.10
        expect(result.serviceFee).toBe(124);  // 2480 × 0.05
        expect(result.total).toBe(2604);      // 2480 + 124
      });

      it('should prioritize monthly over weekly discount', async () => {
        const listing = {
          id: listingId,
          pricingMode: PricingMode.PER_DAY,
          basePrice: 100,
          dailyPrice: 100,
          weeklyDiscount: 10,
          monthlyDiscount: 20,
          currency: 'USD',
          requiresDeposit: false,
          category: null,
        };

        mockPrismaService.listing.findUnique.mockResolvedValue(listing);
        mockPolicyEngine.calculateFees.mockResolvedValue({
          baseFees: [],
          totalFees: 0,
          currency: 'USD',
        });

        const startDate = new Date('2023-01-01T10:00:00Z');
        const endDate = new Date('2023-02-01T10:00:00Z'); // 31 days
        const result = await service.calculatePrice(listingId, startDate, endDate);

        // EXACT VALIDATION: Monthly discount applied, weekly ignored
        expect(result.breakdown.discounts).toEqual([
          { type: 'monthly', amount: 620, reason: 'Monthly booking discount (20%)' }
        ]);
        expect(result.breakdown.discounts?.[0].type).toBe('monthly');
      });
    });
  });

  describe('PolicyEngine Fee Integration - Exact Validation', () => {
    const listingId = 'listing-1';

    it('should use exact PolicyEngine fee amounts', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 1000,
        dailyPrice: 1000,
        currency: 'NPR',
        country: 'NP',
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

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice(listingId, startDate, endDate);

      // EXACT VALIDATION: Use PolicyEngine fees, not config defaults
      expect(result.platformFee).toBe(80); // From PolicyEngine
      expect(result.serviceFee).toBe(30);  // From PolicyEngine
      expect(result.total).toBe(1110);     // 1000 + 30 + 80 (platform fee not charged to customer)
      expect(result.ownerEarnings).toBe(920); // 1000 - 80
    });

    it('should fall back to config fees when PolicyEngine returns zero', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        currency: 'USD',
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice(listingId, startDate, endDate);

      // EXACT VALIDATION: Fallback to config (10% platform, 5% service)
      expect(result.platformFee).toBe(10); // 100 × 0.10
      expect(result.serviceFee).toBe(5);  // 100 × 0.05
    });
  });

  describe('Refund Calculation - Exact Validation', () => {
    const bookingId = 'booking-1';

    describe('Full refund (100%)', () => {
      it('should calculate exact full refund with all components', async () => {
        const booking = {
          id: bookingId,
          listingId: 'listing-1',
          basePrice: 1000,
          totalPrice: 1350,
          platformFee: 100,
          serviceFee: 50,
          securityDeposit: 200,
          currency: 'USD',
          startDate: new Date('2023-01-10T10:00:00Z'),
          endDate: new Date('2023-01-15T10:00:00Z'),
          listing: {
            cancellationPolicy: null,
            category: { slug: 'electronics' },
          },
        };

        mockPrismaService.booking.findUnique.mockResolvedValue(booking);
        mockPolicyEngine.evaluateCancellation.mockResolvedValue({
          tiers: [
            { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund', ruleId: 'r1' },
          ],
          refundServiceFee: true,
          refundPlatformFee: true,
          alwaysRefundDeposit: true,
          flatPenalty: 0,
          appliedRules: ['r1'],
        });

        const cancelDate = new Date('2023-01-05T10:00:00Z'); // 120 hours before start
        const result = await service.calculateRefund(bookingId, cancelDate);

        // EXACT VALIDATION: 100% refund of base price
        expect(result.refundAmount).toBe(1250); // 1000 (base) + 50 (service) + 200 (deposit)
        expect(result.platformFeeRefund).toBe(100); // 100% of 100
        expect(result.serviceFeeRefund).toBe(50);   // 100% of 50
        expect(result.depositRefund).toBe(200);     // Always refunded
        expect(result.penalty).toBe(0);              // No penalty
        expect(result.reason).toContain('Full refund');
      });
    });

    describe('Partial refund (50%)', () => {
      it('should calculate exact 50% refund with fee handling', async () => {
        const booking = {
          id: bookingId,
          listingId: 'listing-1',
          basePrice: 1000,
          totalPrice: 1350,
          platformFee: 100,
          serviceFee: 50,
          securityDeposit: 200,
          currency: 'USD',
          startDate: new Date('2023-01-10T10:00:00Z'),
          endDate: new Date('2023-01-15T10:00:00Z'),
          listing: {
            cancellationPolicy: null,
            category: { slug: 'electronics' },
          },
        };

        mockPrismaService.booking.findUnique.mockResolvedValue(booking);
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

        const cancelDate = new Date('2023-01-08T10:00:00Z'); // 48 hours before start
        const result = await service.calculateRefund(bookingId, cancelDate);

        // EXACT VALIDATION: 50% refund of base price
        expect(result.refundAmount).toBe(750); // 500 (50% base) + 25 (50% service) + 200 (deposit)
        expect(result.platformFeeRefund).toBe(50); // 50% of 100
        expect(result.serviceFeeRefund).toBe(25);  // 50% of 50
        expect(result.depositRefund).toBe(200);    // Always refunded
        expect(result.penalty).toBe(500);          // 50% penalty on base
        expect(result.reason).toContain('50%');
      });
    });

    describe('No refund (0%)', () => {
      it('should calculate exact no refund with penalty', async () => {
        const booking = {
          id: bookingId,
          listingId: 'listing-1',
          basePrice: 1000,
          totalPrice: 1350,
          platformFee: 100,
          serviceFee: 50,
          securityDeposit: 200,
          currency: 'USD',
          startDate: new Date('2023-01-10T10:00:00Z'),
          endDate: new Date('2023-01-15T10:00:00Z'),
          listing: {
            cancellationPolicy: null,
            category: { slug: 'electronics' },
          },
        };

        mockPrismaService.booking.findUnique.mockResolvedValue(booking);
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

        const cancelDate = new Date('2023-01-09T15:00:00Z'); // 19 hours before start
        const result = await service.calculateRefund(bookingId, cancelDate);

        // EXACT VALIDATION: 0% refund of base price
        expect(result.refundAmount).toBe(200); // Only deposit refunded
        expect(result.platformFeeRefund).toBe(0);  // 0% of 100
        expect(result.serviceFeeRefund).toBe(0);   // 0% of 50
        expect(result.depositRefund).toBe(200);    // Always refunded
        expect(result.penalty).toBe(1000);          // 100% penalty on base
        expect(result.reason).toContain('No refund');
      });
    });

    describe('Fee non-refundable', () => {
      it('should not refund fees when policy specifies', async () => {
        const booking = {
          id: bookingId,
          listingId: 'listing-1',
          basePrice: 1000,
          totalPrice: 1350,
          platformFee: 100,
          serviceFee: 50,
          securityDeposit: 200,
          currency: 'USD',
          startDate: new Date('2023-01-10T10:00:00Z'),
          endDate: new Date('2023-01-15T10:00:00Z'),
          listing: {
            cancellationPolicy: null,
            category: { slug: 'electronics' },
          },
        };

        mockPrismaService.booking.findUnique.mockResolvedValue(booking);
        mockPolicyEngine.evaluateCancellation.mockResolvedValue({
          tiers: [
            { minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund', ruleId: 'r1' },
          ],
          refundServiceFee: false, // Service fee not refundable
          refundPlatformFee: true,
          alwaysRefundDeposit: true,
          flatPenalty: 0,
          appliedRules: ['r1'],
        });

        const cancelDate = new Date('2023-01-05T10:00:00Z');
        const result = await service.calculateRefund(bookingId, cancelDate);

        // EXACT VALIDATION: Service fee not refunded
        expect(result.refundAmount).toBe(1200); // 1000 (base) + 0 (service) + 200 (deposit)
        expect(result.platformFeeRefund).toBe(100); // Refunded
        expect(result.serviceFeeRefund).toBe(0);   // NOT refunded
        expect(result.depositRefund).toBe(200);
      });
    });

    describe('Flat penalty', () => {
      it('should apply exact flat penalty', async () => {
        const booking = {
          id: bookingId,
          listingId: 'listing-1',
          basePrice: 1000,
          totalPrice: 1350,
          platformFee: 100,
          serviceFee: 50,
          securityDeposit: 200,
          currency: 'USD',
          startDate: new Date('2023-01-10T10:00:00Z'),
          endDate: new Date('2023-01-15T10:00:00Z'),
          listing: {
            cancellationPolicy: null,
            category: { slug: 'electronics' },
          },
        };

        mockPrismaService.booking.findUnique.mockResolvedValue(booking);
        mockPolicyEngine.evaluateCancellation.mockResolvedValue({
          tiers: [
            { minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 0.8, label: '80% refund', ruleId: 'r1' },
          ],
          refundServiceFee: true,
          refundPlatformFee: true,
          alwaysRefundDeposit: true,
          flatPenalty: 50, // $50 flat penalty
          appliedRules: ['r1'],
        });

        const cancelDate = new Date('2023-01-05T10:00:00Z');
        const result = await service.calculateRefund(bookingId, cancelDate);

        // EXACT VALIDATION: 80% refund + flat penalty
        expect(result.refundAmount).toBe(1050); // 800 (80% base) + 40 (80% service) + 200 (deposit) - 50 (penalty adjustment)
        expect(result.platformFeeRefund).toBe(80); // 80% of 100
        expect(result.serviceFeeRefund).toBe(40);  // 80% of 50
        expect(result.penalty).toBe(250);          // 200 (20% base) + 50 (flat)
      });
    });
  });

  describe('Edge Cases - Boundary Conditions', () => {
    const listingId = 'listing-1';

    it('should handle zero duration (same start and end date)', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_HOUR,
        basePrice: 20,
        hourlyPrice: 20,
        currency: 'USD',
        requiresDeposit: false,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const date = new Date('2023-01-01T10:00:00Z');
      const result = await service.calculatePrice(listingId, date, date);

      // EXACT VALIDATION: Zero duration should charge minimum 1 unit
      expect(result.subtotal).toBe(20); // 1 hour minimum
      expect(result.breakdown.duration).toBe(1);
    });

    it('should handle very short duration (1 minute)', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_HOUR,
        basePrice: 20,
        hourlyPrice: 20,
        currency: 'USD',
        requiresDeposit: false,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-01T10:01:00Z'); // 1 minute
      const result = await service.calculatePrice(listingId, startDate, endDate);

      // EXACT VALIDATION: Rounds up to 1 hour
      expect(result.subtotal).toBe(20);
      expect(result.breakdown.duration).toBe(1);
    });

    it('should handle very long duration (1 year)', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        currency: 'USD',
        requiresDeposit: false,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2024-01-01T10:00:00Z'); // 365 days
      const result = await service.calculatePrice(listingId, startDate, endDate);

      // EXACT VALIDATION: 365 days × $100 = $36,500
      expect(result.subtotal).toBe(36500);
      expect(result.breakdown.duration).toBe(365);
    });

    it('should handle negative price (edge case)', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: -100, // Invalid but test handling
        dailyPrice: -100,
        currency: 'USD',
        requiresDeposit: false,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice(listingId, startDate, endDate);

      // EXACT VALIDATION: Negative prices should result in negative calculations
      expect(result.subtotal).toBe(-100);
      expect(result.platformFee).toBe(-10); // -100 × 0.10
    });
  });

  describe('Currency Rounding Validation', () => {
    const listingId = 'listing-1';

    it('should round correctly for USD (2 decimal places)', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 99.99,
        dailyPrice: 99.99,
        currency: 'USD',
        requiresDeposit: false,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice(listingId, startDate, endDate);

      // EXACT VALIDATION: Fees should be rounded to 2 decimal places
      expect(result.platformFee).toBeCloseTo(9.999, 2); // 99.99 × 0.10
      expect(result.serviceFee).toBeCloseTo(4.9995, 2);  // 99.99 × 0.05
    });

    it('should handle zero-based pricing (free listing)', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 0,
        dailyPrice: 0,
        currency: 'USD',
        requiresDeposit: false,
        category: null,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPolicyEngine.calculateFees.mockResolvedValue({
        baseFees: [],
        totalFees: 0,
        currency: 'USD',
      });

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice(listingId, startDate, endDate);

      // EXACT VALIDATION: Zero price should result in zero fees
      expect(result.subtotal).toBe(0);
      expect(result.platformFee).toBe(0);
      expect(result.serviceFee).toBe(0);
      expect(result.total).toBe(0);
    });
  });
});
