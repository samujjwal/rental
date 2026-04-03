import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { BookingPricingService } from './booking-pricing.service';
import { formatCurrency } from '@rental-portal/shared-types';

/**
 * Pricing Logic - Complete Validation
 *
 * These tests validate all aspects of pricing calculations including
 * dynamic pricing, fee structures, discounts, and currency conversions.
 */
describe('Pricing Logic - Complete Validation', () => {
  let service: BookingPricingService;
  let prisma: PrismaService;
  let cache: CacheService;
  let config: ConfigService;

  const mockListing = {
    id: 'listing-1',
    basePrice: 100,
    currency: 'USD',
    pricingMode: 'PER_NIGHT',
    seasonalPricing: [
      { startDate: '2026-06-01', endDate: '2026-08-31', multiplier: 1.5 },
      { startDate: '2026-12-15', endDate: '2027-01-05', multiplier: 2.0 },
    ],
    demandPricing: {
      enabled: true,
      baseMultiplier: 1.0,
      peakMultiplier: 1.3,
      threshold: 0.8,
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(mockListing),
        findMany: jest.fn().mockResolvedValue([mockListing]),
      },
      bookingPriceBreakdown: {
        create: jest.fn().mockResolvedValue({ id: 'breakdown-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      fxRateSnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'fx-1' }),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback()),
    } as any;

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(null),
    };

    const mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const defaults = {
          'pricing.serviceFeeRate': 0.12,
          'pricing.platformFeeRate': 0.03,
          'pricing.taxRate': 0.08,
          'pricing.cleaningFeeBase': 25,
          'pricing.securityDepositBase': 200,
        };
        return defaults[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPricingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<BookingPricingService>(BookingPricingService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    config = module.get<ConfigService>(ConfigService);
  });

  describe('Dynamic Pricing Calculations', () => {
    it('should calculate seasonal pricing correctly', async () => {
      const summerDate = new Date('2026-07-15'); // Peak summer season
      const winterDate = new Date('2026-12-20'); // Peak winter season
      const normalDate = new Date('2026-04-15'); // Normal season

      // Summer pricing (1.5x multiplier)
      const summerPricing = await service.calculateDynamicPrice(
        mockListing.id,
        summerDate,
        summerDate,
      );
      expect(summerPricing.basePrice).toBe(150); // 100 * 1.5

      // Winter pricing (2.0x multiplier)
      const winterPricing = await service.calculateDynamicPrice(
        mockListing.id,
        winterDate,
        winterDate,
      );
      expect(winterPricing.basePrice).toBe(200); // 100 * 2.0

      // Normal pricing (no multiplier)
      const normalPricing = await service.calculateDynamicPrice(
        mockListing.id,
        normalDate,
        normalDate,
      );
      expect(normalPricing.basePrice).toBe(100); // 100 * 1.0
    });

    it('should apply demand-based pricing', async () => {
      // Mock high demand (80% occupancy)
      (cache.get as jest.fn).mockResolvedValue(0.8);

      const highDemandPricing = await service.calculateDynamicPrice(
        mockListing.id,
        new Date('2026-07-15'),
        new Date('2026-07-16'),
      );

      expect(highDemandPricing.basePrice).toBe(195); // 100 * 1.5 * 1.3

      // Mock low demand (30% occupancy)
      (cache.get as jest.fn).mockResolvedValue(0.3);

      const lowDemandPricing = await service.calculateDynamicPrice(
        mockListing.id,
        new Date('2026-07-15'),
        new Date('2026-07-16'),
      );

      expect(lowDemandPricing.basePrice).toBe(150); // 100 * 1.5 * 1.0
    });

    it('should handle currency conversions accurately', async () => {
      const fxRates = {
        USD: { rate: 1.0, symbol: '$' },
        EUR: { rate: 0.85, symbol: '€' },
        GBP: { rate: 0.73, symbol: '£' },
        JPY: { rate: 110.0, symbol: '¥' },
      };

      (prisma.fxRateSnapshot.findFirst as jest.Mock).mockResolvedValue({
        rates: fxRates,
        timestamp: new Date(),
      });

      // Test conversion to EUR
      const euroPricing = await service.convertCurrency(100, 'USD', 'EUR');
      expect(euroPricing.amount).toBe(85); // 100 * 0.85
      expect(euroPricing.formatted).toBe('€85.00');

      // Test conversion to GBP
      const gbpPricing = await service.convertCurrency(100, 'USD', 'GBP');
      expect(gbpPricing.amount).toBe(73); // 100 * 0.73
      expect(gbpPricing.formatted).toBe('£73.00');

      // Test conversion to JPY
      const jpyPricing = await service.convertCurrency(100, 'USD', 'JPY');
      expect(jpyPricing.amount).toBe(11000); // 100 * 110.0
      expect(jpyPricing.formatted).toBe('¥11,000');
    });

    it('should handle weekend and holiday pricing', async () => {
      const friday = new Date('2026-07-17'); // Friday
      const saturday = new Date('2026-07-18'); // Saturday
      const sunday = new Date('2026-07-19'); // Sunday
      const monday = new Date('2026-07-20'); // Monday

      // Weekend pricing (Friday-Sunday)
      const weekendPricing = await service.calculateDynamicPrice(mockListing.id, friday, sunday);
      expect(weekendPricing.basePrice).toBe(180); // 100 * 1.5 * 1.2 (weekend multiplier)

      // Weekday pricing (Monday)
      const weekdayPricing = await service.calculateDynamicPrice(mockListing.id, monday, monday);
      expect(weekdayPricing.basePrice).toBe(150); // 100 * 1.5 (no weekend multiplier)
    });
  });

  describe('Fee Structure', () => {
    it('should calculate service fees correctly', async () => {
      const pricing = await service.calculateAndPersist(
        'booking-1',
        100, // basePrice
        3, // nights
        25, // cleaningFee
        0.12, // serviceFeeRate
        0.03, // platformFeeRate
        200, // securityDeposit
        0.08, // taxRate
        'USD',
      );

      // Service fee: 12% of subtotal
      expect(prisma.bookingPriceBreakdown.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SERVICE_FEE',
            amount: 36, // 300 * 0.12
            currency: 'USD',
          }),
        }),
      );
    });

    it('should apply tiered commission rates', async () => {
      const tieredRates = [
        { minAmount: 0, maxAmount: 100, rate: 0.15 },
        { minAmount: 100, maxAmount: 500, rate: 0.12 },
        { minAmount: 500, maxAmount: 1000, rate: 0.1 },
        { minAmount: 1000, maxAmount: Infinity, rate: 0.08 },
      ];

      config.get = jest.fn((key: string) => {
        if (key === 'pricing.tieredCommissionRates') return tieredRates;
        return null;
      });

      // Test tier 1 (0-100)
      const tier1Pricing = await service.calculateCommission(50);
      expect(tier1Pricing.commission).toBe(7.5); // 50 * 0.15

      // Test tier 2 (100-500)
      const tier2Pricing = await service.calculateCommission(250);
      expect(tier2Pricing.commission).toBe(30); // 250 * 0.12

      // Test tier 3 (500-1000)
      const tier3Pricing = await service.calculateCommission(750);
      expect(tier3Pricing.commission).toBe(75); // 750 * 0.10

      // Test tier 4 (1000+)
      const tier4Pricing = await service.calculateCommission(1500);
      expect(tier4Pricing.commission).toBe(120); // 1500 * 0.08
    });

    it('should handle tax calculations by jurisdiction', async () => {
      const jurisdictions = [
        {
          country: 'US',
          state: 'CA',
          city: 'San Francisco',
          taxRates: {
            state: 0.0875,
            city: 0.0125,
            county: 0.01,
            total: 0.11,
          },
        },
        {
          country: 'US',
          state: 'NY',
          city: 'New York',
          taxRates: {
            state: 0.08,
            city: 0.045,
            county: 0,
            total: 0.125,
          },
        },
        {
          country: 'EU',
          state: null,
          city: 'Paris',
          taxRates: {
            vat: 0.2,
            total: 0.2,
          },
        },
      ];

      for (const jurisdiction of jurisdictions) {
        const taxCalculation = await service.calculateTax(
          1000,
          jurisdiction.country,
          jurisdiction.state,
          jurisdiction.city,
        );

        expect(taxCalculation.totalTax).toBe(1000 * jurisdiction.taxRates.total);
        expect(taxCalculation.breakdown).toEqual(jurisdiction.taxRates);
      }
    });

    it('should calculate cleaning fees based on property size', async () => {
      const sizeBasedCleaning = [
        { bedrooms: 1, baseFee: 25, perBedroomFee: 10 },
        { bedrooms: 2, baseFee: 35, perBedroomFee: 15 },
        { bedrooms: 3, baseFee: 45, perBedroomFee: 20 },
        { bedrooms: 4, baseFee: 60, perBedroomFee: 25 },
      ];

      config.get = jest.fn((key: string) => {
        if (key === 'pricing.sizeBasedCleaning') return sizeBasedCleaning;
        return 25; // default
      });

      // Test 1 bedroom
      const oneBedroomPricing = await service.calculateCleaningFee(1);
      expect(oneBedroomPricing).toBe(35); // 25 + (1 * 10)

      // Test 2 bedrooms
      const twoBedroomPricing = await service.calculateCleaningFee(2);
      expect(twoBedroomPricing).toBe(65); // 35 + (2 * 15)

      // Test 3 bedrooms
      const threeBedroomPricing = await service.calculateCleaningFee(3);
      expect(threeBedroomPricing).toBe(105); // 45 + (3 * 20)

      // Test 4+ bedrooms (use 4 bedroom rate)
      const fourBedroomPricing = await service.calculateCleaningFee(5);
      expect(fourBedroomPricing).toBe(160); // 60 + (4 * 25)
    });
  });

  describe('Discount & Promotion Logic', () => {
    it('should apply promotional codes correctly', async () => {
      const validPromoCodes = [
        {
          code: 'SUMMER2026',
          type: 'percentage',
          value: 0.15,
          minAmount: 100,
          maxDiscount: 50,
          usageLimit: 100,
          expiresAt: new Date('2026-08-31'),
        },
        {
          code: 'FLAT50',
          type: 'fixed',
          value: 50,
          minAmount: 200,
          maxDiscount: 50,
          usageLimit: 50,
          expiresAt: new Date('2026-06-30'),
        },
        {
          code: 'FREENIGHT',
          type: 'free_night',
          value: 1,
          minNights: 3,
          maxDiscount: 100,
          usageLimit: 25,
          expiresAt: new Date('2026-07-31'),
        },
      ];

      // Test percentage discount
      const percentageResult = await service.applyPromoCode(
        'SUMMER2026',
        500, // total amount
        3, // nights
      );
      expect(percentageResult.discount).toBe(50); // Min(500 * 0.15, 50)
      expect(percentageResult.finalAmount).toBe(450);

      // Test fixed discount
      const fixedResult = await service.applyPromoCode(
        'FLAT50',
        300, // total amount
        2, // nights
      );
      expect(fixedResult.discount).toBe(50);
      expect(fixedResult.finalAmount).toBe(250);

      // Test free night discount
      const freeNightResult = await service.applyPromoCode(
        'FREENIGHT',
        300, // total amount (3 nights @ 100/night)
        3, // nights
      );
      expect(freeNightResult.discount).toBe(100); // 1 free night
      expect(freeNightResult.finalAmount).toBe(200);

      // Test invalid promo code
      const invalidResult = await service.applyPromoCode('INVALID', 100, 1);
      expect(invalidResult.discount).toBe(0);
      expect(invalidResult.error).toBe('Invalid promo code');
    });

    it('should handle stacking rules for discounts', async () => {
      const discountRules = {
        allowStacking: false,
        priorityOrder: ['promo_code', 'loyalty', 'seasonal'],
        maxTotalDiscount: 0.25, // 25% max total discount
      };

      config.get = jest.fn((key: string) => {
        if (key === 'pricing.discountRules') return discountRules;
        return null;
      });

      // Test single discount (should work)
      const singleDiscount = await service.calculateDiscounts(1000, { promoCode: 'SUMMER2026' });
      expect(singleDiscount.totalDiscount).toBeLessThan(250); // Max 25%

      // Test multiple discounts (should not stack)
      const multipleDiscounts = await service.calculateDiscounts(1000, {
        promoCode: 'SUMMER2026',
        loyaltyPoints: 1000,
        seasonalDiscount: true,
      });
      expect(multipleDiscounts.totalDiscount).toBeLessThan(250); // Still max 25%
      expect(multipleDiscounts.appliedDiscounts).toHaveLength(1); // Only one applied
    });

    it('should calculate loyalty program benefits', async () => {
      const loyaltyTiers = [
        { points: 0, tier: 'Bronze', discountRate: 0, freeNights: 0 },
        { points: 1000, tier: 'Silver', discountRate: 0.05, freeNights: 0 },
        { points: 5000, tier: 'Gold', discountRate: 0.1, freeNights: 1 },
        { points: 10000, tier: 'Platinum', discountRate: 0.15, freeNights: 2 },
      ];

      // Test Silver tier
      const silverBenefits = await service.calculateLoyaltyBenefits(1500);
      expect(silverBenefits.tier).toBe('Silver');
      expect(silverBenefits.discountRate).toBe(0.05);
      expect(silverBenefits.freeNights).toBe(0);

      // Test Gold tier
      const goldBenefits = await service.calculateLoyaltyBenefits(7500);
      expect(goldBenefits.tier).toBe('Gold');
      expect(goldBenefits.discountRate).toBe(0.1);
      expect(goldBenefits.freeNights).toBe(1);

      // Test Platinum tier
      const platinumBenefits = await service.calculateLoyaltyBenefits(15000);
      expect(platinumBenefits.tier).toBe('Platinum');
      expect(platinumBenefits.discountRate).toBe(0.15);
      expect(platinumBenefits.freeNights).toBe(2);

      // Apply loyalty discount
      const loyaltyDiscount = await service.applyLoyaltyDiscount(1000, goldBenefits);
      expect(loyaltyDiscount.discount).toBe(100); // 1000 * 0.10
    });

    it('should handle early booking discounts', async () => {
      const earlyBookingRules = {
        enabled: true,
        daysInAdvance: 30,
        discountRate: 0.1,
        maxDiscount: 100,
      };

      config.get = jest.fn((key: string) => {
        if (key === 'pricing.earlyBooking') return earlyBookingRules;
        return null;
      });

      // Test early booking (45 days in advance)
      const earlyBookingDate = new Date();
      earlyBookingDate.setDate(earlyBookingDate.getDate() + 45);

      const earlyDiscount = await service.calculateEarlyBookingDiscount(800, earlyBookingDate);
      expect(earlyDiscount.discount).toBe(80); // 800 * 0.10
      expect(earlyDiscount.isEligible).toBe(true);

      // Test late booking (15 days in advance)
      const lateBookingDate = new Date();
      lateBookingDate.setDate(lateBookingDate.getDate() + 15);

      const lateDiscount = await service.calculateEarlyBookingDiscount(800, lateBookingDate);
      expect(lateDiscount.discount).toBe(0);
      expect(lateDiscount.isEligible).toBe(false);
    });
  });

  describe('Price Validation & Edge Cases', () => {
    it('should validate price ranges and prevent negative values', async () => {
      const invalidPricing = [
        { basePrice: -100, nights: 1 },
        { basePrice: 0, nights: 1 },
        { basePrice: 100, nights: -1 },
        { basePrice: 100, nights: 0 },
      ];

      for (const pricing of invalidPricing) {
        await expect(
          service.calculateAndPersist(
            'booking-1',
            pricing.basePrice,
            pricing.nights,
            25,
            0.12,
            0.03,
            200,
            0.08,
            'USD',
          ),
        ).rejects.toThrow('Invalid pricing parameters');
      }
    });

    it('should handle maximum price limits', async () => {
      const maxPriceLimits = {
        nightly: 10000,
        weekly: 50000,
        monthly: 150000,
      };

      config.get = jest.fn((key: string) => {
        if (key === 'pricing.maxPriceLimits') return maxPriceLimits;
        return null;
      });

      // Test exceeding nightly limit
      const excessiveNightlyPrice = await service.validatePriceLimits(
        15000, // exceeds 10000 limit
        'PER_NIGHT',
      );
      expect(excessiveNightlyPrice.isValid).toBe(false);
      expect(excessiveNightlyPrice.reason).toBe('Exceeds maximum nightly price');

      // Test within limits
      const validNightlyPrice = await service.validatePriceLimits(
        5000, // within 10000 limit
        'PER_NIGHT',
      );
      expect(validNightlyPrice.isValid).toBe(true);
    });

    it('should handle currency conversion failures gracefully', async () => {
      // Mock FX service failure
      (prisma.fxRateSnapshot.findFirst as jest.Mock).mockRejectedValue(
        new Error('FX service unavailable'),
      );

      const conversionResult = await service.convertCurrency(100, 'USD', 'EUR');
      expect(conversionResult.amount).toBe(100); // Fallback to original amount
      expect(conversionResult.currency).toBe('USD'); // Fallback to original currency
      expect(conversionResult.error).toBe('Currency conversion unavailable');
    });

    it('should maintain pricing consistency across multiple calculations', async () => {
      const basePrice = 100;
      const nights = 3;
      const expectedTotal = basePrice * nights;

      // Calculate pricing multiple times
      const calculation1 = await service.calculateAndPersist(
        'booking-1',
        basePrice,
        nights,
        25,
        0.12,
        0.03,
        200,
        0.08,
        'USD',
      );

      const calculation2 = await service.calculateAndPersist(
        'booking-2',
        basePrice,
        nights,
        25,
        0.12,
        0.03,
        200,
        0.08,
        'USD',
      );

      // Both should have the same base calculation
      expect(calculation1.subtotal).toBe(calculation2.subtotal);
      expect(calculation1.serviceFee).toBe(calculation2.serviceFee);
      expect(calculation1.platformFee).toBe(calculation2.platformFee);
      expect(calculation1.tax).toBe(calculation2.tax);
    });
  });

  describe('Performance & Caching', () => {
    it('should cache pricing calculations for repeated requests', async () => {
      const cacheKey = 'pricing:listing-1:2026-07-15:2026-07-18';

      // First call - not cached
      (cache.get as jest.Mock).mockResolvedValue(null);
      const firstCall = await service.calculateAndPersist('test-booking-1', {
        basePrice: 1000,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-18'),
        guestCount: 2,
        currency: 'USD',
      });

      // Second call - cached
      (cache.get as jest.Mock).mockResolvedValue(firstCall);
      const secondCall = await service.calculateAndPersist('test-booking-2', {
        basePrice: 1000,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-18'),
        guestCount: 2,
        currency: 'USD',
      });

      expect(cache.get).toHaveBeenCalledWith(cacheKey);
      expect(cache.set).toHaveBeenCalledWith(cacheKey, expect.any(Object), expect.any(Number));
      expect(secondCall).toEqual(firstCall);
    });

    it('should handle concurrent pricing calculations without race conditions', async () => {
      const concurrentCalculations = Array.from({ length: 10 }, (_, i) =>
        service.calculateAndPersist(`booking-${i}`, {
          basePrice: 100,
          startDate: new Date('2026-07-15'),
          endDate: new Date('2026-07-18'),
          guestCount: 3,
          currency: 'USD',
        }),
      );

      const results = await Promise.all(concurrentCalculations);

      // All calculations should complete successfully
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.lines).toBeDefined();
      });

      // Verify database transactions were used
      expect(prisma.$transaction).toHaveBeenCalledTimes(10);
    });
  });
});
