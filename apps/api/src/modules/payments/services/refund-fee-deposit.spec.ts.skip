import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { FeeCalculationService } from './fee-calculation.service';
import { DepositService } from './deposit.service';
import { PrismaService } from '../../database/prisma.service';
import { PolicyEngineService } from '../policies/policy-engine.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * REFUND/FEE/DEPOSIT CALCULATION TESTS
 * 
 * These tests validate financial calculations and policies:
 * - Refund calculations and policies
 * - Fee calculation accuracy
 * - Deposit handling and release
 * - Policy engine integration
 * - Financial transaction accuracy
 * 
 * Business Truth Validated:
 * - Refunds are calculated according to policies
 * - Fees are accurate and transparent
 * - Deposits are handled securely
 * - Financial rules are consistently applied
 * - Calculations are auditable and traceable
 */

describe('RefundFeeDepositCalculations', () => {
  let refundService: RefundService;
  let feeService: FeeCalculationService;
  let depositService: DepositService;
  let prismaService: PrismaService;
  let policyEngine: PolicyEngineService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        FeeCalculationService,
        DepositService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            payment: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
            refund: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: PolicyEngineService,
          useValue: {
            calculateRefundPolicy: jest.fn(),
            calculateCancellationFee: jest.fn(),
            calculateDepositPolicy: jest.fn(),
            getPolicy: jest.fn(),
            evaluatePolicy: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'payment.refund.processingFee': 0.02, // 2%
                'payment.refund.minProcessingFee': 50, // NPR 50
                'payment.deposit.security': 10000, // NPR 10,000
                'payment.fee.platform': 0.05, // 5%
                'payment.fee.paymentGateway': 0.029, // 2.9%
                'payment.currency': 'NPR',
              };
              return config[key];
            }),
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

    refundService = module.get<RefundService>(RefundService);
    feeService = module.get<FeeCalculationService>(FeeCalculationService);
    depositService = module.get<DepositService>(DepositService);
    prismaService = module.get<PrismaService>(PrismaService);
    policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Refund Calculations', () => {
    it('should calculate refund amount according to cancellation policy', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        paidAmount: 21000,
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-07'),
        cancelledAt: new Date('2024-05-25'), // 7 days before check-in
        status: 'cancelled',
        userId: 'user-123',
        ownerId: 'owner-456',
        propertyId: 'property-789',
      };

      const refundPolicy = {
        refundablePercentage: 100, // Full refund for cancellations > 7 days
        cancellationFee: 0,
        processingFee: 420, // 2% of 21000
        totalRefund: 20580,
      };

      policyEngine.calculateRefundPolicy.mockResolvedValue(refundPolicy);

      const refundCalculation = await refundService.calculateRefund(booking);

      expect(refundCalculation.totalRefund).toBe(20580);
      expect(refundCalculation.refundablePercentage).toBe(100);
      expect(refundCalculation.cancellationFee).toBe(0);
      expect(refundCalculation.processingFee).toBe(420);
      expect(refundCalculation.netRefund).toBe(20580);
    });

    it('should calculate partial refund for late cancellations', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        paidAmount: 21000,
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-07'),
        cancelledAt: new Date('2024-05-30'), // 2 days before check-in
        status: 'cancelled',
        userId: 'user-123',
      };

      const refundPolicy = {
        refundablePercentage: 50, // 50% refund for cancellations 2-3 days before
        cancellationFee: 10500, // 50% of total
        processingFee: 210, // 2% of refundable amount
        totalRefund: 10290,
      };

      policyEngine.calculateRefundPolicy.mockResolvedValue(refundPolicy);

      const refundCalculation = await refundService.calculateRefund(booking);

      expect(refundCalculation.totalRefund).toBe(10290);
      expect(refundCalculation.refundablePercentage).toBe(50);
      expect(refundCalculation.cancellationFee).toBe(10500);
      expect(refundCalculation.processingFee).toBe(210);
      expect(refundCalculation.netRefund).toBe(10290);
    });

    it('should handle no refund for very late cancellations', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        paidAmount: 21000,
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-07'),
        cancelledAt: new Date('2024-06-01'), // Same day as check-in
        status: 'cancelled',
        userId: 'user-123',
      };

      const refundPolicy = {
        refundablePercentage: 0, // No refund for same-day cancellations
        cancellationFee: 21000, // Full amount
        processingFee: 0,
        totalRefund: 0,
      };

      policyEngine.calculateRefundPolicy.mockResolvedValue(refundPolicy);

      const refundCalculation = await refundService.calculateRefund(booking);

      expect(refundCalculation.totalRefund).toBe(0);
      expect(refundCalculation.refundablePercentage).toBe(0);
      expect(refundCalculation.cancellationFee).toBe(21000);
      expect(refundCalculation.processingFee).toBe(0);
      expect(refundCalculation.netRefund).toBe(0);
    });

    it('should apply minimum processing fee', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 1000, // Small amount
        paidAmount: 1000,
        checkIn: new Date('2024-06-01'),
        cancelledAt: new Date('2024-05-25'),
        status: 'cancelled',
        userId: 'user-123',
      };

      const refundPolicy = {
        refundablePercentage: 100,
        cancellationFee: 0,
        processingFee: 50, // Minimum processing fee (2% would be 20, but min is 50)
        totalRefund: 950,
      };

      policyEngine.calculateRefundPolicy.mockResolvedValue(refundPolicy);

      const refundCalculation = await refundService.calculateRefund(booking);

      expect(refundCalculation.processingFee).toBe(50);
      expect(refundCalculation.netRefund).toBe(950);
    });

    it('should process refund with payment method fallback', async () => {
      const refundRequest = {
        paymentId: 'pay-123',
        amount: 20580,
        reason: 'cancellation',
        userId: 'user-123',
        originalPaymentMethod: 'stripe',
      };

      // Mock successful refund
      prismaService.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-123',
        amount: 21000,
        paymentMethod: 'stripe',
        chargeId: 'ch_123',
      });

      const refundResult = await refundService.processRefund(refundRequest);

      expect(refundResult.success).toBe(true);
      expect(refundResult.refundId).toBeDefined();
      expect(refundResult.amount).toBe(20580);
      expect(refundResult.status).toBe('processing');
    });

    it('should handle refund processing failures', async () => {
      const refundRequest = {
        paymentId: 'pay-123',
        amount: 20580,
        reason: 'cancellation',
        userId: 'user-123',
      };

      // Mock payment not found
      prismaService.payment.findUnique.mockResolvedValueOnce(null);

      const refundResult = await refundService.processRefund(refundRequest);

      expect(refundResult.success).toBe(false);
      expect(refundResult.error).toContain('Payment not found');
    });
  });

  describe('Fee Calculations', () => {
    it('should calculate platform fee correctly', async () => {
      const transaction = {
        amount: 21000,
        type: 'booking',
        userId: 'user-123',
        ownerId: 'owner-456',
      };

      const feeCalculation = await feeService.calculatePlatformFee(transaction);

      expect(feeCalculation.platformFee).toBe(1050); // 5% of 21000
      expect(feeCalculation.platformFeePercentage).toBe(0.05);
      expect(feeCalculation.netAmount).toBe(19950); // 21000 - 1050
    });

    it('should calculate payment gateway fees', async () => {
      const transaction = {
        amount: 21000,
        paymentMethod: 'stripe',
        type: 'booking',
      };

      const feeCalculation = await feeService.calculateGatewayFees(transaction);

      expect(feeCalculation.gatewayFee).toBe(609); // 2.9% of 21000
      expect(feeCalculation.gatewayFeePercentage).toBe(0.029);
      expect(feeCalculation.gatewayFeeFixed).toBe(0);
    });

    it('should calculate total fees including all components', async () => {
      const transaction = {
        amount: 21000,
        type: 'booking',
        paymentMethod: 'stripe',
        userId: 'user-123',
        ownerId: 'owner-456',
      };

      const feeCalculation = await feeService.calculateTotalFees(transaction);

      expect(feeCalculation.platformFee).toBe(1050); // 5%
      expect(feeCalculation.gatewayFee).toBe(609); // 2.9%
      expect(feeCalculation.totalFees).toBe(1659); // 1050 + 609
      expect(feeCalculation.netToOwner).toBe(19341); // 21000 - 1050 - 609
      expect(feeCalculation.totalFeePercentage).toBe(0.079); // 7.9% total
    });

    it('should apply fee caps for high-value transactions', async () => {
      const transaction = {
        amount: 100000, // High value
        type: 'booking',
        paymentMethod: 'stripe',
      };

      // Mock fee cap configuration
      const feeCaps = {
        platformFeeCap: 2500, // Max NPR 2,500 platform fee
        gatewayFeeCap: 2000, // Max NPR 2,000 gateway fee
      };

      const feeCalculation = await feeService.calculateFeesWithCaps(transaction, feeCaps);

      expect(feeCalculation.platformFee).toBe(2500); // Capped at 2,500 (would be 5,000)
      expect(feeCalculation.gatewayFee).toBe(2000); // Capped at 2,000 (would be 2,900)
      expect(feeCalculation.totalFees).toBe(4500);
    });

    it('should calculate different fees for different transaction types', async () => {
      const bookingTransaction = {
        amount: 21000,
        type: 'booking',
      };

      const serviceTransaction = {
        amount: 5000,
        type: 'service',
      };

      const bookingFees = await feeService.calculateTotalFees(bookingTransaction);
      const serviceFees = await feeService.calculateTotalFees(serviceTransaction);

      // Service fees might be different
      expect(bookingFees.platformFee).toBe(1050); // 5% of 21000
      expect(serviceFees.platformFee).toBe(250); // 5% of 5000
    });

    it('should handle fee calculation errors gracefully', async () => {
      const invalidTransaction = {
        amount: -1000, // Invalid amount
        type: 'booking',
      };

      const feeCalculation = await feeService.calculateTotalFees(invalidTransaction);

      expect(feeCalculation.error).toBeDefined();
      expect(feeCalculation.error).toContain('Invalid amount');
      expect(feeCalculation.platformFee).toBe(0);
      expect(feeCalculation.gatewayFee).toBe(0);
    });
  });

  describe('Deposit Handling', () => {
    it('should calculate security deposit amount', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        propertyId: 'property-789',
        userId: 'user-123',
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-07'),
      };

      const depositPolicy = {
        depositAmount: 10000, // Fixed security deposit
        depositType: 'security',
        refundable: true,
        conditions: ['no_damage', 'clean_property', 'no_rules_violation'],
      };

      policyEngine.calculateDepositPolicy.mockResolvedValue(depositPolicy);

      const depositCalculation = await depositService.calculateDeposit(booking);

      expect(depositCalculation.depositAmount).toBe(10000);
      expect(depositCalculation.depositType).toBe('security');
      expect(depositCalculation.refundable).toBe(true);
      expect(depositCalculation.conditions).toHaveLength(3);
    });

    it('should calculate percentage-based deposits', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 50000, // High value booking
        propertyId: 'property-789',
        userId: 'user-123',
      };

      const depositPolicy = {
        depositAmount: 5000, // 10% of total price
        depositType: 'percentage',
        depositPercentage: 0.1,
        refundable: true,
      };

      policyEngine.calculateDepositPolicy.mockResolvedValue(depositPolicy);

      const depositCalculation = await depositService.calculateDeposit(booking);

      expect(depositCalculation.depositAmount).toBe(5000);
      expect(depositCalculation.depositType).toBe('percentage');
      expect(depositCalculation.depositPercentage).toBe(0.1);
    });

    it('should handle security deposit collection', async () => {
      const depositRequest = {
        bookingId: 'booking-123',
        amount: 10000,
        paymentMethod: 'stripe',
        userId: 'user-123',
      };

      // Mock successful deposit collection
      prismaService.booking.findUnique.mockResolvedValueOnce({
        id: 'booking-123',
        userId: 'user-123',
        depositStatus: 'pending',
      });

      const depositResult = await depositService.collectDeposit(depositRequest);

      expect(depositResult.success).toBe(true);
      expect(depositResult.depositId).toBeDefined();
      expect(depositResult.amount).toBe(10000);
      expect(depositResult.status).toBe('collected');
    });

    it('should process security deposit refund', async () => {
      const refundRequest = {
        bookingId: 'booking-123',
        amount: 10000,
        reason: 'checkout_complete',
        userId: 'user-123',
        inspectionResult: {
          passed: true,
          issues: [],
          totalDeductions: 0,
        },
      };

      // Mock successful refund
      prismaService.booking.findUnique.mockResolvedValueOnce({
        id: 'booking-123',
        userId: 'user-123',
        depositAmount: 10000,
        depositStatus: 'collected',
        depositCollectedAt: new Date('2024-06-01'),
      });

      const refundResult = await depositService.refundDeposit(refundRequest);

      expect(refundResult.success).toBe(true);
      expect(refundResult.refundId).toBeDefined();
      expect(refundResult.amount).toBe(10000);
      expect(refundResult.deductions).toBe(0);
    });

    it('should calculate deposit deductions for damages', async () => {
      const booking = {
        id: 'booking-123',
        depositAmount: 10000,
        propertyId: 'property-789',
      };

      const inspectionResult = {
        passed: false,
        issues: [
          {
            type: 'damage',
            description: 'Broken window',
            estimatedCost: 2000,
          },
          {
            type: 'cleaning',
            description: 'Extra cleaning required',
            estimatedCost: 500,
          },
        ],
        totalDeductions: 2500,
      };

      const deductionCalculation = await depositService.calculateDeductions(booking, inspectionResult);

      expect(deductionCalculation.totalDeductions).toBe(2500);
      expect(deductionCalculation.refundableAmount).toBe(7500); // 10000 - 2500
      expect(deductionCalculation.deductions).toHaveLength(2);
      expect(deductionCalculation.deductions[0].amount).toBe(2000);
      expect(deductionCalculation.deductions[1].amount).toBe(500);
    });

    it('should handle deposit disputes', async () => {
      const disputeRequest = {
        bookingId: 'booking-123',
        userId: 'user-123',
        reason: 'unfair_deduction',
        description: 'Window was already broken',
        evidence: ['photo1.jpg', 'photo2.jpg'],
      };

      const disputeResult = await depositService.createDispute(disputeRequest);

      expect(disputeResult.success).toBe(true);
      expect(disputeResult.disputeId).toBeDefined();
      expect(disputeResult.status).toBe('under_review');
      expect(disputeResult.depositAmount).toBe(10000);
      expect(disputeResult.disputedAmount).toBe(2500);
    });
  });

  describe('Policy Engine Integration', () => {
    it('should evaluate complex refund policies', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        checkIn: new Date('2024-06-01'),
        cancelledAt: new Date('2024-05-20'),
        userId: 'user-123',
        userTier: 'premium',
        propertyId: 'property-789',
        propertyCategory: 'luxury',
      };

      const complexPolicy = {
        baseRefundPercentage: 100,
        userTierBonus: 5, // Premium users get 5% extra
        propertyCategoryPenalty: -10, // Luxury properties have 10% penalty
        timeBasedAdjustment: 0, // Full refund for >10 days
        finalRefundPercentage: 95, // 100 + 5 - 10 + 0
        processingFee: 420,
        totalRefund: 19530,
      };

      policyEngine.evaluatePolicy.mockResolvedValue(complexPolicy);

      const evaluation = await policyEngine.evaluatePolicy('refund', booking);

      expect(evaluation.finalRefundPercentage).toBe(95);
      expect(evaluation.totalRefund).toBe(19530);
      expect(evaluation.appliedRules).toHaveLength(3);
    });

    it('should handle seasonal policy adjustments', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        checkIn: new Date('2024-12-20'), // Peak season
        cancelledAt: new Date('2024-12-10'),
        userId: 'user-123',
      };

      const seasonalPolicy = {
        baseRefundPercentage: 50,
        seasonalMultiplier: 0.8, // 20% reduction in peak season
        finalRefundPercentage: 40, // 50 * 0.8
        processingFee: 420,
        totalRefund: 7980,
      };

      policyEngine.evaluatePolicy.mockResolvedValue(seasonalPolicy);

      const evaluation = await policyEngine.evaluatePolicy('refund', booking);

      expect(evaluation.finalRefundPercentage).toBe(40);
      expect(evaluation.seasonalAdjustment).toBe(-10); // -20% of 50%
      expect(evaluation.totalRefund).toBe(7980);
    });

    it('should apply loyalty program benefits', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        userId: 'user-123',
        loyaltyPoints: 5000,
        loyaltyTier: 'gold',
      };

      const loyaltyPolicy = {
        baseRefundPercentage: 50,
        loyaltyBonus: 10, // Gold tier gets 10% bonus
        pointsDiscount: 1000, // Use 1000 points
        finalRefundPercentage: 60,
        processingFee: 420,
        totalRefund: 12180,
      };

      policyEngine.evaluatePolicy.mockResolvedValue(loyaltyPolicy);

      const evaluation = await policyEngine.evaluatePolicy('refund', booking);

      expect(evaluation.finalRefundPercentage).toBe(60);
      expect(evaluation.loyaltyBonus).toBe(10);
      expect(evaluation.pointsUsed).toBe(1000);
      expect(evaluation.totalRefund).toBe(12180);
    });
  });

  describe('Financial Accuracy and Auditing', () => {
    it('should maintain financial transaction accuracy', async () => {
      const transaction = {
        id: 'txn-123',
        amount: 21000,
        type: 'booking',
        paymentMethod: 'stripe',
        userId: 'user-123',
        ownerId: 'owner-456',
        timestamp: new Date(),
      };

      const financialBreakdown = await feeService.calculateFinancialBreakdown(transaction);

      expect(financialBreakdown.grossAmount).toBe(21000);
      expect(financialBreakdown.platformFee).toBe(1050);
      expect(financialBreakdown.gatewayFee).toBe(609);
      expect(financialBreakdown.netToOwner).toBe(19341);
      expect(financialBreakdown.totalFees).toBe(1659);
      
      // Verify mathematical accuracy
      expect(financialBreakdown.grossAmount).toBe(
        financialBreakdown.netToOwner + financialBreakdown.totalFees
      );
    });

    it('should track all financial transactions for auditing', async () => {
      const auditRequest = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30'),
        userId: 'user-123',
      };

      const auditTrail = await refundService.getAuditTrail(auditRequest);

      expect(auditTrail.transactions).toBeDefined();
      expect(auditTrail.totalAmount).toBeDefined();
      expect(auditTrail.totalFees).toBeDefined();
      expect(auditTrail.refunds).toBeDefined();
      expect(auditTrail.deposits).toBeDefined();
      
      // Verify audit trail completeness
      expect(auditTrail.transactionCount).toBeGreaterThan(0);
      expect(auditTrail.balance).toBeDefined();
      expect(auditTrail.lastUpdated).toBeInstanceOf(Date);
    });

    it('should detect financial discrepancies', async () => {
      const reconciliationData = {
        expectedRevenue: 100000,
        actualRevenue: 98500,
        discrepancy: 1500,
        period: 'June 2024',
      };

      const discrepancyAnalysis = await feeService.analyzeDiscrepancy(reconciliationData);

      expect(discrepancyAnalysis.hasDiscrepancy).toBe(true);
      expect(discrepancyAnalysis.discrepancyAmount).toBe(1500);
      expect(discrepancyAnalysis.discrepancyPercentage).toBe(1.5); // 1500/100000 * 100
      expect(discrepancyAnalysis.requiresInvestigation).toBe(true);
    });

    it('should generate financial reports', async () => {
      const reportRequest = {
        type: 'monthly',
        period: '2024-06',
        includeBreakdown: true,
        includeTrends: true,
      };

      const financialReport = await feeService.generateFinancialReport(reportRequest);

      expect(financialReport.summary.totalRevenue).toBeDefined();
      expect(financialReport.summary.totalFees).toBeDefined();
      expect(financialReport.summary.netRevenue).toBeDefined();
      expect(financialReport.breakdown.byPaymentMethod).toBeDefined();
      expect(financialReport.breakdown.byTransactionType).toBeDefined();
      expect(financialReport.trends.monthOverMonth).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero amount bookings', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 0,
        paidAmount: 0,
        checkIn: new Date('2024-06-01'),
        status: 'cancelled',
        userId: 'user-123',
      };

      const refundCalculation = await refundService.calculateRefund(booking);

      expect(refundCalculation.totalRefund).toBe(0);
      expect(refundCalculation.processingFee).toBe(0);
      expect(refundCalculation.netRefund).toBe(0);
      expect(refundCalculation.message).toContain('No refund required');
    });

    it('should handle overpayments', async () => {
      const booking = {
        id: 'booking-123',
        totalPrice: 21000,
        paidAmount: 25000, // Overpaid by 4000
        checkIn: new Date('2024-06-01'),
        status: 'cancelled',
        userId: 'user-123',
      };

      const refundPolicy = {
        refundablePercentage: 100,
        cancellationFee: 0,
        processingFee: 500, // 2% of 25000
        totalRefund: 24500,
      };

      policyEngine.calculateRefundPolicy.mockResolvedValue(refundPolicy);

      const refundCalculation = await refundService.calculateRefund(booking);

      expect(refundCalculation.totalRefund).toBe(24500);
      expect(refundCalculation.overpaymentAmount).toBe(4000);
      expect(refundCalculation.processingFee).toBe(500);
    });

    it('should handle currency conversions', async () => {
      const transaction = {
        amount: 100, // USD
        currency: 'USD',
        targetCurrency: 'NPR',
        exchangeRate: 132.5,
      };

      const convertedCalculation = await feeService.calculateWithCurrencyConversion(transaction);

      expect(convertedCalculation.originalAmount).toBe(100);
      expect(convertedCalculation.convertedAmount).toBe(13250); // 100 * 132.5
      expect(convertedCalculation.feesInTargetCurrency).toBeDefined();
      expect(convertedCalculation.exchangeRate).toBe(132.5);
    });

    it('should handle invalid payment methods', async () => {
      const transaction = {
        amount: 21000,
        paymentMethod: 'invalid_method',
        type: 'booking',
      };

      const feeCalculation = await feeService.calculateTotalFees(transaction);

      expect(feeCalculation.error).toBeDefined();
      expect(feeCalculation.error).toContain('Invalid payment method');
      expect(feeCalculation.totalFees).toBe(0);
    });
  });
});
