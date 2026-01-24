import { Test, TestingModule } from '@nestjs/testing';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('BookingCalculationService', () => {
  let service: BookingCalculationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    listing: {
      findUnique: jest.fn(),
    },
    pricingRule: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCalculationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BookingCalculationService>(BookingCalculationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePrice', () => {
    const mockListing = {
      id: 'listing-1',
      basePrice: 10000, // $100/day
      currency: 'USD',
      depositAmount: 5000,
      minRentalDays: 1,
      maxRentalDays: 30,
    };

    beforeEach(() => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);
    });

    it('should calculate price for single day rental', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result).toMatchObject({
        days: 1,
        basePrice: 10000,
        subtotal: 10000,
        currency: 'USD',
      });
      expect(result.totalAmount).toBeGreaterThan(result.subtotal);
      expect(result.platformFee).toBeGreaterThan(0);
      expect(result.serviceFee).toBeGreaterThan(0);
    });

    it('should calculate price for multi-day rental', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-08'); // 7 days

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.days).toBe(7);
      expect(result.subtotal).toBe(70000); // 7 * 10000
      expect(result.totalAmount).toBeGreaterThan(result.subtotal);
    });

    it('should apply weekly discount for 7+ days', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        ...mockListing,
        weeklyDiscount: 10, // 10% discount
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-08'); // 7 days

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.days).toBe(7);
      expect(result.discounts).toHaveProperty('weeklyDiscount');
      expect(result.discounts.weeklyDiscount).toBe(7000); // 10% of 70000
      expect(result.subtotal).toBe(63000); // 70000 - 7000
    });

    it('should apply monthly discount for 30+ days', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        ...mockListing,
        monthlyDiscount: 20, // 20% discount
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31'); // 30 days

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.days).toBe(30);
      expect(result.discounts).toHaveProperty('monthlyDiscount');
      expect(result.discounts.monthlyDiscount).toBe(60000); // 20% of 300000
      expect(result.subtotal).toBe(240000); // 300000 - 60000
    });

    it('should apply seasonal pricing', async () => {
      const peakSeasonRule = {
        id: 'rule-1',
        listingId: 'listing-1',
        type: 'SEASONAL',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-08-31'),
        adjustment: 50, // 50% increase
        adjustmentType: 'PERCENTAGE',
      };

      mockPrismaService.pricingRule.findMany.mockResolvedValue([peakSeasonRule]);

      const startDate = new Date('2024-07-15');
      const endDate = new Date('2024-07-18'); // 3 days in peak season

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.days).toBe(3);
      expect(result.basePrice).toBeGreaterThan(10000); // Should be increased
      expect(result.subtotal).toBeGreaterThan(30000);
    });

    it('should calculate platform fee correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      // Platform fee should be around 10-15% of subtotal
      const expectedFeeRange = result.subtotal * 0.15;
      expect(result.platformFee).toBeLessThanOrEqual(expectedFeeRange);
      expect(result.platformFee).toBeGreaterThan(0);
    });

    it('should calculate service fee correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      // Service fee should be around 3-5% of subtotal
      const expectedFeeRange = result.subtotal * 0.05;
      expect(result.serviceFee).toBeLessThanOrEqual(expectedFeeRange);
      expect(result.serviceFee).toBeGreaterThan(0);
    });

    it('should include all components in total', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      const calculatedTotal = result.subtotal + result.platformFee + result.serviceFee;
      expect(result.totalAmount).toBe(calculatedTotal);
    });

    it('should handle zero-day rentals', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-01');

      await expect(service.calculatePrice('listing-1', startDate, endDate)).rejects.toThrow();
    });

    it('should handle negative date ranges', async () => {
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-01');

      await expect(service.calculatePrice('listing-1', startDate, endDate)).rejects.toThrow();
    });

    it('should handle non-existent listing', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      await expect(service.calculatePrice('non-existent', startDate, endDate)).rejects.toThrow();
    });

    it('should apply promo code discount', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      const promoCode = 'SAVE10';

      mockPrismaService.promoCode = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'promo-1',
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          isActive: true,
        }),
      } as any;

      const result = await service.calculatePrice('listing-1', startDate, endDate, promoCode);

      expect(result.discounts).toHaveProperty('promoCode');
      expect(result.discounts.promoCode).toBe(1000); // 10% of 10000
      expect(result.subtotal).toBe(9000);
    });

    it('should calculate insurance fee when selected', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-08'); // 7 days

      const result = await service.calculatePrice('listing-1', startDate, endDate, null, true);

      expect(result).toHaveProperty('insuranceFee');
      expect(result.insuranceFee).toBeGreaterThan(0);
      expect(result.totalAmount).toBeGreaterThan(
        result.subtotal + result.platformFee + result.serviceFee,
      );
    });

    it('should handle currency conversion', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        ...mockListing,
        currency: 'EUR',
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.currency).toBe('EUR');
    });
  });

  describe('calculateRefund', () => {
    it('should calculate full refund for cancellation 7+ days before', async () => {
      const booking = {
        totalAmount: 10000,
        platformFee: 1000,
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      };

      const result = await service.calculateRefund(booking as any);

      expect(result.refundAmount).toBe(10000);
      expect(result.refundPercentage).toBe(100);
      expect(result.penalty).toBe(0);
    });

    it('should apply 50% penalty for cancellation 3-7 days before', async () => {
      const booking = {
        totalAmount: 10000,
        platformFee: 1000,
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      };

      const result = await service.calculateRefund(booking as any);

      expect(result.refundAmount).toBe(5000);
      expect(result.refundPercentage).toBe(50);
      expect(result.penalty).toBe(5000);
    });

    it('should give no refund for cancellation within 3 days', async () => {
      const booking = {
        totalAmount: 10000,
        platformFee: 1000,
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      };

      const result = await service.calculateRefund(booking as any);

      expect(result.refundAmount).toBe(0);
      expect(result.refundPercentage).toBe(0);
      expect(result.penalty).toBe(10000);
    });

    it('should subtract platform fee from refund', async () => {
      const booking = {
        totalAmount: 10000,
        platformFee: 1000,
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      const result = await service.calculateRefund(booking as any);

      expect(result.refundAmount).toBe(10000);
      expect(result.platformFeeRetained).toBe(1000);
    });

    it('should handle cancellation after start date', async () => {
      const booking = {
        totalAmount: 10000,
        platformFee: 1000,
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };

      const result = await service.calculateRefund(booking as any);

      expect(result.refundAmount).toBe(0);
      expect(result.refundPercentage).toBe(0);
    });
  });

  describe('calculateEarnings', () => {
    it('should calculate owner earnings after platform fee', async () => {
      const booking = {
        subtotal: 10000,
        platformFee: 1500,
        serviceFee: 500,
        totalAmount: 12000,
      };

      const result = await service.calculateEarnings(booking as any);

      expect(result.ownerEarnings).toBe(8500); // 10000 - 1500
      expect(result.platformRevenue).toBe(1500);
      expect(result.serviceRevenue).toBe(500);
    });

    it('should handle deposit calculation', async () => {
      const booking = {
        subtotal: 10000,
        platformFee: 1500,
        depositAmount: 5000,
      };

      const result = await service.calculateEarnings(booking as any);

      expect(result).toHaveProperty('depositAmount');
      expect(result.depositAmount).toBe(5000);
    });

    it('should calculate net earnings after all fees', async () => {
      const booking = {
        subtotal: 100000,
        platformFee: 15000,
        serviceFee: 5000,
        totalAmount: 120000,
      };

      const result = await service.calculateEarnings(booking as any);

      expect(result.ownerEarnings).toBe(85000); // 100000 - 15000
      expect(result.platformRevenue).toBe(15000);
      expect(result.netRevenue).toBe(20000); // 15000 + 5000
    });
  });

  describe('Edge cases and validation', () => {
    beforeEach(() => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        basePrice: 10000,
        currency: 'USD',
      });
      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);
    });

    it('should handle very long rental periods', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31'); // 365 days

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.days).toBe(365);
      expect(result.subtotal).toBeGreaterThan(0);
    });

    it('should handle leap year dates', async () => {
      const startDate = new Date('2024-02-28');
      const endDate = new Date('2024-03-01'); // Crosses leap day

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.days).toBe(2);
    });

    it('should handle daylight saving time transitions', async () => {
      const startDate = new Date('2024-03-09'); // DST starts
      const endDate = new Date('2024-03-11');

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.days).toBe(2);
    });

    it('should handle very large prices', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        basePrice: 1000000000, // $10M/day
        currency: 'USD',
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.subtotal).toBe(1000000000);
      expect(result.totalAmount).toBeGreaterThan(result.subtotal);
    });

    it('should handle zero base price', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        basePrice: 0,
        currency: 'USD',
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      await expect(service.calculatePrice('listing-1', startDate, endDate)).rejects.toThrow();
    });

    it('should handle concurrent calculation requests', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const promises = Array(10)
        .fill(null)
        .map(() => service.calculatePrice('listing-1', startDate, endDate));

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        if (index > 0) {
          expect(result).toEqual(results[0]);
        }
      });
    });
  });
});
