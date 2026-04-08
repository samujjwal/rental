import { Test, TestingModule } from '@nestjs/testing';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PolicyEngineService } from '@/modules/policy-engine/services/policy-engine.service';
import { ConfigService } from '@nestjs/config';

/**
 * CANCELLATION POLICY TIER CALCULATION TESTS
 * 
 * These tests validate the cancellation policy tier calculations:
 * 1. Default policy tiers (48h+, 24-48h, 0-24h)
 * 2. PolicyEngine integration with custom tiers
 * 3. Exact refund calculations with fees and deposits
 * 4. Boundary conditions at tier cutoffs
 * 5. Multi-day booking handling
 * 6. Platform/service fee refund logic
 * 
 * Business Truth Validated:
 * - Refund percentages match policy tier exactly
 * - Time windows are enforced correctly
 * - Platform/service fees are refunded proportionally
 * - Deposits are refunded based on policy
 * - Penalties are calculated correctly
 */

describe('Cancellation Policy Tier Calculation Tests', () => {
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
        if (key === 'defaultCancellationPolicy') return undefined; // Use default tiers
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

  describe('Default Policy Tiers (No PolicyEngine)', () => {
    it('should calculate 100% refund when cancelled 48+ hours before start', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null, // No custom policy
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({ tiers: [] }); // No rules

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: 100% refund of base price + fees
      expect(result.refundAmount).toBe(115); // 100 + 10 + 5
      expect(result.platformFeeRefund).toBe(10);
      expect(result.serviceFeeRefund).toBe(5);
      expect(result.depositRefund).toBe(0);
      expect(result.penalty).toBe(0);
      expect(result.reason).toContain('48 hours');
    });

    it('should calculate 50% refund when cancelled 24-48 hours before start', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 36 * 60 * 60 * 1000), // 36 hours from now
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({ tiers: [] });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: 50% refund of base price + fees
      expect(result.refundAmount).toBe(57.5); // 50 + 5 + 2.5
      expect(result.platformFeeRefund).toBe(5);
      expect(result.serviceFeeRefund).toBe(2.5);
      expect(result.penalty).toBe(50); // 100 - 50
      expect(result.reason).toContain('24–48 hours');
    });

    it('should calculate 0% refund when cancelled less than 24 hours before start', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({ tiers: [] });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: No refund
      expect(result.refundAmount).toBe(0);
      expect(result.platformFeeRefund).toBe(0);
      expect(result.serviceFeeRefund).toBe(0);
      expect(result.penalty).toBe(100);
      expect(result.reason).toContain('less than 24 hours');
    });

    it('should handle exact 48-hour boundary as full refund', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // Exactly 48 hours
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({ tiers: [] });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Boundary is inclusive for full refund
      expect(result.refundAmount).toBe(115);
      expect(result.penalty).toBe(0);
    });
  });

  describe('PolicyEngine Custom Tiers', () => {
    it('should use PolicyEngine tiers when configured', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      
      // PolicyEngine returns custom strict tiers
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 168, maxHoursBefore: null, refundPercentage: 1.0, label: '7+ days' },
          { minHoursBefore: 72, maxHoursBefore: 168, refundPercentage: 0.5, label: '3-7 days' },
          { minHoursBefore: 0, maxHoursBefore: 72, refundPercentage: 0.0, label: '0-3 days' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: 72 hours matches 3-7 day tier (50%)
      expect(result.refundAmount).toBe(57.5);
      expect(result.penalty).toBe(50);
      expect(result.reason).toContain('3-7 days');
    });

    it('should respect PolicyEngine fee refund flags', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
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
        refundServiceFee: false, // Don't refund service fee
        refundPlatformFee: false, // Don't refund platform fee
        alwaysRefundDeposit: false,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Full base price refund, but no fees
      expect(result.refundAmount).toBe(100); // Base price only
      expect(result.platformFeeRefund).toBe(0);
      expect(result.serviceFeeRefund).toBe(0);
    });

    it('should apply PolicyEngine flat penalty', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0.5, label: 'Late cancel' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: false,
        flatPenalty: 25, // $25 flat penalty
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: 50% of base price + fees, minus flat penalty
      expect(result.refundAmount).toBe(57.5); // 50 + 5 + 2.5
      expect(result.penalty).toBe(75); // (100 - 50) + 25 flat penalty
    });
  });

  describe('Deposit Handling', () => {
    it('should refund deposit when alwaysRefundDeposit is true', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
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

      // EXACT VALIDATION: Deposit is refunded in full
      expect(result.refundAmount).toBe(165); // 100 + 10 + 5 + 50
      expect(result.depositRefund).toBe(50);
    });

    it('should not refund deposit when alwaysRefundDeposit is false', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 50,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0.0, label: 'No refund' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: false, // Keep deposit
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Deposit is not refunded
      expect(result.refundAmount).toBe(0);
      expect(result.depositRefund).toBe(0);
      expect(result.penalty).toBe(150); // 100 base + 50 deposit
    });
  });

  describe('Edge Cases', () => {
    it('should handle legacy listing cancellation policy (full refund)', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: 'Flexible - full refund', // Legacy free-text policy
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({ tiers: [] });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Legacy policy grants full refund
      expect(result.refundAmount).toBe(115);
      expect(result.reason).toContain('Per listing cancellation policy');
    });

    it('should handle PolicyEngine errors gracefully with fallback', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockRejectedValue(new Error('PolicyEngine error'));

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Falls back to default tiers
      expect(result.refundAmount).toBe(115);
      expect(result.reason).toContain('48 hours');
    });

    it('should handle multi-day bookings correctly', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 168 * 60 * 60 * 1000), // 7 days total
        basePrice: 350, // 7 days × $50
        platformFee: 35,
        serviceFee: 17.5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      policyEngine.evaluateCancellation.mockResolvedValue({ tiers: [] });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Full refund of multi-day booking
      expect(result.refundAmount).toBe(402.5); // 350 + 35 + 17.5
      expect(result.penalty).toBe(0);
    });
  });

  describe('Tier Matching Logic', () => {
    it('should match most permissive tier when multiple match', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 100 * 60 * 60 * 1000), // 100 hours
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      
      // Overlapping tiers - should match first (most permissive)
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: '48h+' },
          { minHoursBefore: 24, maxHoursBefore: 168, refundPercentage: 0.5, label: '24-168h' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Matches first tier (100%)
      expect(result.refundAmount).toBe(115);
      expect(result.reason).toContain('48h+');
    });

    it('should use most restrictive tier when no tier matches', async () => {
      const booking = {
        id: bookingId,
        listingId,
        startDate: new Date(Date.now() + 10 * 60 * 60 * 1000), // 10 hours
        basePrice: 100,
        platformFee: 10,
        serviceFee: 5,
        securityDeposit: 0,
        currency: 'USD',
        listing: {
          cancellationPolicy: null,
        },
      };

      prisma.booking.findUnique.mockResolvedValue(booking);
      
      // Tiers start at 24h, but booking is at 10h
      policyEngine.evaluateCancellation.mockResolvedValue({
        tiers: [
          { minHoursBefore: 168, maxHoursBefore: null, refundPercentage: 1.0, label: '7+ days' },
          { minHoursBefore: 48, maxHoursBefore: 168, refundPercentage: 0.5, label: '2-7 days' },
          { minHoursBefore: 24, maxHoursBefore: 48, refundPercentage: 0.25, label: '1-2 days' },
        ],
        refundServiceFee: true,
        refundPlatformFee: true,
        alwaysRefundDeposit: true,
        flatPenalty: 0,
      });

      const cancellationDate = new Date();
      const result = await service.calculateRefund(bookingId, cancellationDate);

      // EXACT VALIDATION: Uses last tier (most restrictive)
      expect(result.refundAmount).toBe(25); // 25% of 100
      expect(result.penalty).toBe(75);
    });
  });
});
