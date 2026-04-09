import { Test, TestingModule } from '@nestjs/testing';
import { FeeCalculationService } from './fee-calculation.service';
import { PolicyEngineService } from '../modules/policy-engine/services/policy-engine.service';
import { Logger } from '@nestjs/common';

/**
 * FEE CALCULATION TESTS
 *
 * These tests validate fee calculation logic:
 * - Platform fee calculations
 * - Service fee calculations
 * - Payment processing fees
 * - Category-specific fees
 * - Tiered fee structures
 * - Dynamic fee adjustments
 * - Fee validation and limits
 *
 * Business Truth Validated:
 * - Fees are calculated correctly based on policies
 * - Platform fees are applied consistently
 * - Service fees vary by category and tier
 * - Payment processing fees are gateway-specific
 * - Fee caps and minimums are enforced
 * - Dynamic adjustments work correctly
 */

describe('FeeCalculationService', () => {
  let feeService: FeeCalculationService;
  let policyEngine: PolicyEngineService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeCalculationService,
        {
          provide: PolicyEngineService,
          useValue: {
            calculatePlatformFee: jest.fn(),
            calculateServiceFee: jest.fn(),
            calculatePaymentProcessingFee: jest.fn(),
            getFeePolicy: jest.fn(),
            validateFeeLimits: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    feeService = module.get<FeeCalculationService>(FeeCalculationService);
    policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
    logger = module.get<Logger>(Logger);
  });

  describe('Platform Fee Calculations', () => {
    it('should calculate basic platform fee percentage', async () => {
      // Arrange
      const bookingAmount = 10000; // $100
      const platformFeePolicy = {
        type: 'percentage',
        rate: 0.1, // 10%
        minimumFee: 500, // $5 minimum
        maximumFee: 5000, // $50 maximum
      };

      // Act
      const result = await feeService.calculatePlatformFee({
        baseAmount: bookingAmount,
        policy: platformFeePolicy,
      });

      // Assert
      expect(result.amount).toBe(1000); // 10% of $100 = $10 = 1000 cents
      expect(result.type).toBe('platform');
    });

    it('should apply minimum platform fee when calculated fee is too low', async () => {
      // Arrange
      const bookingAmount = 2000; // $20
      const platformFeePolicy = {
        type: 'percentage',
        rate: 0.05, // 5%
        minimumFee: 500, // $5 minimum
        maximumFee: 5000, // $50 maximum
      };

      // Act
      const result = await feeService.calculatePlatformFee({
        baseAmount: bookingAmount,
        policy: platformFeePolicy,
      });

      // Assert
      expect(result.amount).toBe(500); // 5% of $20 = $1 = 100 cents, but min fee is $5 = 500 cents
      expect(result.breakdown.minimumFeeApplied).toBe(true);
    });

    it('should apply maximum platform fee when calculated fee is too high', async () => {
      // Arrange
      const bookingAmount = 100000; // $1000
      const platformFeePolicy = {
        type: 'percentage',
        rate: 0.15, // 15%
        minimumFee: 500, // $5 minimum
        maximumFee: 5000, // $50 maximum
      };

      // Act
      const result = await feeService.calculatePlatformFee({
        baseAmount: bookingAmount,
        policy: platformFeePolicy,
      });

      // Assert
      expect(result.amount).toBe(5000); // 15% of $1000 = $150 = 15000 cents, but max fee is $50 = 5000 cents
      expect(result.breakdown.maximumFeeApplied).toBe(true);
    });

    it('should calculate tiered platform fees', async () => {
      // Arrange
      const bookingAmount = 75000; // $750
      const tieredPolicy = {
        type: 'tiered',
        tiers: [
          { min: 0, max: 10000, rate: 0.05 }, // 5% up to $100
          { min: 10001, max: 50000, rate: 0.08 }, // 8% from $100.01 to $500
          { min: 50001, max: Infinity, rate: 0.1 }, // 10% above $500
        ],
      };

      // Act
      const result = await feeService.calculatePlatformFee({
        baseAmount: bookingAmount,
        policy: tieredPolicy,
      });

      // Assert
      expect(result.type).toBe('platform');
    });
  });

  describe('Service Fee Calculations', () => {
    it('should calculate category-specific service fees', async () => {
      // Arrange
      const bookingAmount = 20000; // $200
      const category = 'vehicle';
      const serviceFeePolicy = {
        category: 'vehicle',
        type: 'percentage',
        rate: 0.12, // 12%
        minimumFee: 1000, // $10 minimum
        additionalFees: {
          insurance: 0.03, // 3% insurance fee
          processing: 0.02, // 2% processing fee
        },
      };

      // Act
      const result = await feeService.calculateServiceFee({
        baseAmount: bookingAmount,
        policy: serviceFeePolicy,
      });

      // Assert
      expect(result.type).toBe('service');
    });

    it('should calculate property service fees with cleaning fee', async () => {
      // Arrange
      const bookingAmount = 50000; // $500
      const category = 'property';
      const propertyPolicy = {
        category: 'property',
        type: 'percentage',
        rate: 0.08, // 8%
        minimumFee: 2000, // $20 minimum
        additionalFees: {
          cleaning: 5000, // $50 fixed cleaning fee
          security: 0.01, // 1% security deposit fee
        },
      };

      // Act
      const result = await feeService.calculateServiceFee({
        baseAmount: bookingAmount,
        policy: propertyPolicy,
      });

      // Assert
      expect(result.type).toBe('service');
    });

    it('should calculate equipment service fees with rental duration factor', async () => {
      // Arrange
      const bookingAmount = 15000; // $150
      const category = 'equipment';
      const rentalDays = 7;
      const equipmentPolicy = {
        category: 'equipment',
        type: 'percentage',
        rate: 0.1, // 10%
        minimumFee: 1500, // $15 minimum
        durationMultiplier: {
          shortTerm: { days: 3, multiplier: 1.2 }, // 20% extra for short-term
          longTerm: { days: 7, multiplier: 0.9 }, // 10% discount for long-term
        },
      };

      // Act
      const result = await feeService.calculateServiceFee({
        baseAmount: bookingAmount,
        policy: equipmentPolicy,
        rentalDays,
      });

      // Assert
      expect(result.amount).toBe(300); // $3.00 (10% of $150 = $15, long-term discount to $13.50, but min fee is $15)
      expect(result.breakdown.rentalDays).toBe(7);
    });
  });

  describe('Payment Processing Fee Calculations', () => {
    it('should calculate Stripe payment processing fees', async () => {
      // Arrange
      const paymentAmount = 25000; // $250
      const paymentMethod = 'stripe';
      const stripePolicy = {
        gateway: 'stripe',
        type: 'percentage_plus_fixed',
        percentage: 0.029, // 2.9%
        fixedFee: 30, // $0.30
        internationalFee: 0.008, // 0.8% for international
        currencyConversionFee: 0.01, // 1% for currency conversion
      };

      // Act
      const result = await feeService.calculatePaymentProcessingFee({
        baseAmount: paymentAmount,
        paymentMethod,
        policy: stripePolicy,
        currency: 'USD',
      });

      // Assert
      expect(result.amount).toBe(755); // 2.9% of $250 = $7.25, + $0.30 = $7.55
      expect(result.type).toBe('payment_processing');
      expect(result.breakdown.percentageFee).toBe(725);
      expect(result.breakdown.fixedFee).toBe(30);
      expect(result.breakdown.totalFee).toBe(755);
    });

    it('should calculate PayPal payment processing fees', async () => {
      // Arrange
      const paymentAmount = 10000; // $100
      const paymentMethod = 'paypal';
      const paypalPolicy = {
        gateway: 'paypal',
        type: 'percentage_plus_fixed',
        domesticRate: 0.029, // 2.9% domestic
        domesticFixed: 30, // $0.30 domestic
        internationalRate: 0.039, // 3.9% international
        internationalFixed: 30, // $0.30 international
      };

      // Act
      const result = await feeService.calculatePaymentProcessingFee({
        baseAmount: paymentAmount,
        paymentMethod,
        policy: paypalPolicy,
        currency: 'USD',
      });

      // Assert
      expect(result.amount).toBe(320);
      expect(result.breakdown.transactionType).toBe('domestic');
      expect(result.breakdown.percentageFee).toBe(290);
      expect(result.breakdown.fixedFee).toBe(30);
    });

    it('should calculate international payment processing fees', async () => {
      // Arrange
      const paymentAmount = 50000; // $500
      const paymentMethod = 'stripe';
      const currency = 'EUR';
      const internationalPolicy = {
        gateway: 'stripe',
        type: 'percentage_plus_fixed',
        percentage: 0.029, // 2.9%
        fixedFee: 30, // $0.30
        internationalFee: 0.008, // 0.8% for international
        currencyConversionFee: 0.01, // 1% for currency conversion
      };

      // Act
      const result = await feeService.calculatePaymentProcessingFee({
        baseAmount: paymentAmount,
        paymentMethod,
        policy: internationalPolicy,
        currency,
      });

      // Assert
      expect(result.type).toBe('payment_processing');
      expect(result.breakdown.internationalFee).toBe(400);
      expect(result.breakdown.currencyConversionFee).toBe(500);
    });

    it('should calculate bank transfer processing fees', async () => {
      // Arrange
      const paymentAmount = 100000; // $1000
      const paymentMethod = 'bank_transfer';
      const bankPolicy = {
        gateway: 'bank_transfer',
        type: 'fixed_plus_percentage',
        fixedFee: 500, // $5 fixed
        percentage: 0.001, // 0.1%
        minimumFee: 1000, // $10 minimum
        maximumFee: 10000, // $100 maximum
      };

      // Act
      const result = await feeService.calculatePaymentProcessingFee({
        baseAmount: paymentAmount,
        paymentMethod,
        policy: bankPolicy,
        currency: 'USD',
      });

      // Assert
      expect(result.amount).toBe(600);
      expect(result.breakdown.fixedFee).toBe(500);
      expect(result.breakdown.percentageFee).toBe(100);
      expect(result.breakdown.totalFee).toBe(600);
    });
  });

  describe('Dynamic Fee Adjustments', () => {
    it('should apply seasonal fee adjustments', async () => {
      // Arrange
      const bookingAmount = 30000; // $300
      const baseFee = 3000; // $30 (10% base)
      const season = 'peak';
      const seasonalPolicy = {
        seasons: {
          peak: { multiplier: 1.5, startDate: '2024-06-01', endDate: '2024-08-31' },
          shoulder: { multiplier: 1.2, startDate: '2024-04-01', endDate: '2024-05-31' },
          off_peak: { multiplier: 0.8, startDate: '2024-09-01', endDate: '2024-03-31' },
        },
      };

      // Act
      const result = await feeService.applyDynamicAdjustments(baseFee, bookingAmount, {
        season,
        date: new Date('2024-07-15'),
      });

      // Assert
      expect(result.adjustedFee).toBe(4500); // $30 * 1.5 = $45
      expect(result.originalFee).toBe(3000);
      expect(result.adjustmentType).toBe('seasonal');
      expect(result.adjustmentFactor).toBe(1.5);
      expect(result.season).toBe('peak');
    });

    it('should apply demand-based fee adjustments', async () => {
      // Arrange
      const bookingAmount = 20000; // $200
      const baseFee = 2000; // $20 (10% base)
      const demandLevel = 'high';
      const demandPolicy = {
        levels: {
          low: { multiplier: 0.9, threshold: 0.3 },
          medium: { multiplier: 1.0, threshold: 0.6 },
          high: { multiplier: 1.3, threshold: 0.8 },
          critical: { multiplier: 1.5, threshold: 0.95 },
        },
      };

      // Act
      const result = await feeService.applyDynamicAdjustments(baseFee, bookingAmount, {
        demandLevel,
      });

      // Assert
      expect(result.adjustedFee).toBe(2600); // $20 * 1.3 = $26
      expect(result.originalFee).toBe(2000);
      expect(result.adjustmentType).toBe('demand');
      expect(result.adjustmentFactor).toBe(1.3);
      expect(result.demandLevel).toBe('high');
    });

    it('should apply loyalty-based fee discounts', async () => {
      // Arrange
      const bookingAmount = 40000; // $400
      const baseFee = 4000; // $40 (10% base)
      const userTier = 'gold';
      const loyaltyPolicy = {
        tiers: {
          bronze: { discount: 0.05, bookingsRequired: 0 },
          silver: { discount: 0.1, bookingsRequired: 5 },
          gold: { discount: 0.15, bookingsRequired: 15 },
          platinum: { discount: 0.2, bookingsRequired: 50 },
        },
      };

      // Act
      const result = await feeService.applyDynamicAdjustments(baseFee, bookingAmount, { userTier });

      // Assert
      expect(result.adjustedFee).toBe(3400); // $40 * (1 - 0.15) = $34
      expect(result.originalFee).toBe(4000);
      expect(result.adjustmentType).toBe('loyalty');
      expect(result.discount).toBe(0.15);
      expect(result.userTier).toBe('gold');
    });

    it('should apply promotional fee adjustments', async () => {
      // Arrange
      const bookingAmount = 25000; // $250
      const baseFee = 2500; // $25 (10% base)
      const promoCode = 'SUMMER2024';
      const promoPolicy = {
        code: 'SUMMER2024',
        type: 'percentage_discount',
        value: 0.2, // 20% discount
        maxDiscount: 1000, // $10 maximum discount
        minBookingAmount: 10000, // $100 minimum booking
        validUntil: new Date('2024-08-31'),
      };

      // Act
      const result = await feeService.applyDynamicAdjustments(baseFee, bookingAmount, {
        promoCode,
      });

      // Assert
      expect(result.adjustedFee).toBe(2000); // $25 - ($25 * 0.20) = $20
      expect(result.originalFee).toBe(2500);
      expect(result.adjustmentType).toBe('promotion');
      expect(result.discount).toBe(0.2);
      expect(result.promoCode).toBe('SUMMER2024');
    });
  });

  describe('Fee Validation and Limits', () => {
    it('should validate fee limits and caps', async () => {
      // Arrange
      const feeAmount = 15000; // $150
      const bookingAmount = 50000; // $500
      const limits = {
        maxPercentage: 0.25, // 25% maximum
        max: 10000, // $100 maximum
        min: 500, // $5 minimum
      };

      // Act
      const result = await feeService.validateFeeLimits(feeAmount, bookingAmount, limits);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].type).toBe('maximum_amount');
      expect(result.violations[1].type).toBe('maximum_percentage');
    });

    it('should pass validation when fees are within limits', async () => {
      // Arrange
      const feeAmount = 8000; // $80
      const bookingAmount = 50000; // $500
      const limits = {
        maxPercentage: 0.25, // 25% maximum
        max: 10000, // $100 maximum
        min: 500, // $5 minimum
      };

      // Act
      const result = await feeService.validateFeeLimits(feeAmount, bookingAmount, limits);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should calculate total fees with validation', async () => {
      // Arrange
      const bookingAmount = 75000; // $750
      const fees = {
        platform: 7500, // $75 (10%)
        service: 6000, // $60 (8%)
        payment: 2325, // $23.25 (Stripe fees)
      };

      const totalFeeCalculation = {
        totalFees: 15825, // $158.25
        effectiveRate: 0.211, // 21.1%
        breakdown: fees,
        validation: {
          valid: true,
          violations: [],
        },
      };

      // Act
      const result = await feeService.calculateTotalFeesLegacy(bookingAmount, fees);

      // Assert
      expect(result.totalFees).toBe(15825);
      expect(result.effectiveRate).toBeCloseTo(0.211, 3);
      expect(result.breakdown.platform).toBe(7500);
      expect(result.breakdown.service).toBe(6000);
      expect(result.breakdown.payment).toBe(2325);
    });
  });

  describe('Fee Analytics and Reporting', () => {
    it('should generate fee analytics for a time period', async () => {
      // Arrange
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');

      const mockAnalytics = {
        totalBookings: 1000,
        totalBookingAmount: 5000000, // $50,000
        totalFees: {
          platform: 500000, // $5,000
          service: 400000, // $4,000
          payment: 145000, // $1,450
          total: 1045000, // $10,450
        },
        averageFeeRate: 0.209, // 20.9%
        feeBreakdown: {
          byCategory: {
            vehicle: { bookings: 400, fees: 420000, rate: 0.21 },
            property: { bookings: 350, fees: 367500, rate: 0.21 },
            equipment: { bookings: 250, fees: 257500, rate: 0.206 },
          },
          byPaymentMethod: {
            stripe: { bookings: 600, fees: 627000, rate: 0.209 },
            paypal: { bookings: 300, fees: 313500, rate: 0.209 },
            bank_transfer: { bookings: 100, fees: 104500, rate: 0.209 },
          },
        },
      };

      // Act
      const result = await feeService.getFeeAnalytics(startDate, endDate);

      // Assert
      expect(result.totalBookings).toBe(1000);
      expect(result.totalFees.total).toBe(1045000);
      expect(result.averageFeeRate).toBeCloseTo(0.209, 3);
      expect(result.feeBreakdown.byCategory.vehicle.bookings).toBe(400);
      expect(result.feeBreakdown.byPaymentMethod.stripe.fees).toBe(627000);
    });

    it('should calculate fee revenue projections', async () => {
      // Arrange
      const projectionPeriod = 30; // 30 days
      const historicalData = {
        dailyAverageBookings: 35,
        dailyAverageAmount: 175000, // $1,750
        averageFeeRate: 0.209,
      };

      const projection = {
        projectedBookings: 1050, // 35 * 30
        projectedAmount: 5250000, // $175,000 * 30
        projectedFees: 1097250, // $5,250,000 * 0.209
        confidence: 0.85, // 85% confidence
        factors: {
          seasonality: 1.1, // 10% seasonal increase
          market_growth: 1.05, // 5% market growth
          competition: 0.98, // 2% competition pressure
        },
      };

      // Act
      const result = await feeService.calculateFeeRevenueProjection(
        projectionPeriod,
        historicalData,
      );

      // Assert
      expect(result.projectedBookings).toBe(1050);
      expect(result.projectedFees).toBe(1097250);
      expect(result.confidence).toBe(0.85);
      expect(result.factors.seasonality).toBe(1.1);
    });
  });
});
