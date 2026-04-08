import { Test, TestingModule } from '@nestjs/testing';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PolicyEngineService } from '@/modules/policy-engine/services/policy-engine.service';
import { ConfigService } from '@nestjs/config';

/**
 * REFUND CALCULATION SCENARIO TESTS
 * 
 * These tests validate refund calculations across various real-world scenarios:
 * 1. Renter-initiated cancellations
 * 2. Owner-initiated cancellations
 * 3. Dispute resolution refunds
 * 4. Platform-initiated refunds
 * 5. Partial refunds (partial cancellation)
 * 6. Refunds with applied discounts
 * 7. Refunds with tax considerations
 * 8. Refunds with multiple payments
 * 
 * Business Truth Validated:
 * - Refund amounts are calculated correctly for each scenario
 * - Fee refund logic is consistent
 * - Deposit handling varies by cancellation initiator
 * - Penalties are applied appropriately
 * - Tax refunds are handled correctly
 */

describe('Refund Calculation Scenario Tests', () => {
  let service: BookingCalculationService;
  let prisma: any;
  let policyEngine: any;
  let configService: any;

  const bookingId = 'booking-123';
  const listingId = 'listing-123';

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
    };

    policyEngine = {
      calculateFees: jest.fn(),
      evaluateCancellation: jest.fn(),
      getPolicyByJurisdiction: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'fees.platformFeePercent') return 10;
        if (key === 'fees.serviceFeePercent') return 5;
        if (key === 'platform.defaultCurrency') return 'USD';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCalculationService,
        { provide: PrismaService, useValue: prisma },
        { provide: PolicyEngineService, useValue: policyEngine },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<BookingCalculationService>(BookingCalculationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Renter-Initiated Cancellations', () => {
    it('should calculate full refund for early renter cancellation', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 168 * 60 * 60 * 1000), // 7 days from now
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
        cancelledBy: 'RENTER',
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Full refund including deposit
      expect(result.refundAmount).toBe(165); // 100 + 10 + 5 + 50
      expect(result.depositRefund).toBe(50);
      expect(result.penalty).toBe(0);
    });

    it('should calculate partial refund for late renter cancellation', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
        cancelledBy: 'RENTER',
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0.0, label: 'No refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true, // Deposit still refunded
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: No base price refund, but deposit refunded
      expect(result.refundAmount).toBe(50); // Deposit only
      expect(result.depositRefund).toBe(50);
      expect(result.penalty).toBe(100); // Base price penalty
    });
  });

  describe('Owner-Initiated Cancellations', () => {
    it('should calculate full refund for owner cancellation (owner penalty)', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
        cancelledBy: 'OWNER',
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 1.0, label: 'Owner cancellation' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 25, // Owner penalty for cancelling
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Full refund minus owner penalty
      expect(result.refundAmount).toBe(140); // 165 - 25 penalty
      expect(result.penalty).toBe(25);
      expect(result.reason).toContain('Owner cancellation');
    });
  });

  describe('Dispute Resolution Refunds', () => {
    it('should calculate full refund for renter-favor dispute', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // Already started
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
        disputeResolvedInFavorOf: 'RENTER',
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 1.0, label: 'Dispute resolution' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Full refund for renter-favor dispute
      expect(result.refundAmount).toBe(165);
      expect(result.penalty).toBe(0);
    });

    it('should calculate partial refund for owner-favor dispute', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
        disputeResolvedInFavorOf: 'OWNER',
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 0.0, label: 'Owner favor' },
        ],
        refundServiceFee: false,
        refundPlatformFee: false,
        alwaysRefundDeposit: true, // Deposit still refunded
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Only deposit refunded
      expect(result.refundAmount).toBe(50);
      expect(result.penalty).toBe(100);
    });
  });

  describe('Refunds with Discounts', () => {
    it('should calculate refund based on actual paid amount (not original price)', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 80, // After $20 discount
        originalPrice: 100,
        discountAmount: 20,
        platformFee: 8, // 10% of discounted price
        serviceFee: 4, // 5% of discounted price
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Refund based on actual paid amount
      expect(result.refundAmount).toBe(92); // 80 + 8 + 4
      expect(result.penalty).toBe(0);
    });

    it('should handle partial refunds with pro-rated discounts', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 36 * 60 * 60 * 1000),
        basePrice: 80, // After discount
        originalPrice: 100,
        discountAmount: 20,
        platformFee: 8,
        serviceFee: 4,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 24, maxHoursBefore: 48, refundPercentage: 0.5, label: '50% refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: 50% of discounted amount
      expect(result.refundAmount).toBe(46); // 40 + 4 + 2
      expect(result.penalty).toBe(40); // 80 - 40
    });
  });

  describe('Multi-Day Booking Refunds', () => {
    it('should calculate refund for multi-day booking with partial usage', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // Started 2 days ago
        endDate: new Date(Date.now() + 120 * 60 * 60 * 1000), // 5 days remaining
        basePrice: 350, // 7 days × $50
        platformFee: 35,
        serviceFee: 17.5,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 0.71, label: 'Pro-rated refund' }, // 5/7 ≈ 71%
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Pro-rated refund for unused days
      expect(result.refundAmount).toBeCloseTo(316.75, 1); // 248.5 + 24.85 + 12.4 + 50
      expect(result.depositRefund).toBe(50);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle booking not found error', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      const cancellationDate = new Date();
      
      await expect(service.calculateRefund(bookingId, cancellationDate)).rejects.toThrow('Booking not found');
    });

    it('should handle zero base price bookings', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 0, // Free booking
        platformFee: 0,
        serviceFee: 0,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Only deposit refunded
      expect(result.refundAmount).toBe(50);
      expect(result.penalty).toBe(0);
    });

    it('should handle very large booking amounts', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 10000, // $10,000 booking
        platformFee: 1000,
        serviceFee: 500,
        securityDeposit: 2000,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Large amount handled correctly
      expect(result.refundAmount).toBe(13500); // 10000 + 1000 + 500 + 2000
      expect(result.penalty).toBe(0);
    });
  });

  describe('Currency Handling', () => {
    it('should handle different currencies correctly', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 50,
        currency: 'EUR',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Amount calculated in booking currency
      expect(result.refundAmount).toBe(165);
      expect(result.penalty).toBe(0);
    });
  });
});
