import { Test, TestingModule } from '@nestjs/testing';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PricingMode, DepositType } from '@rental-portal/database';

const mockPrismaService = {
  listing: {
    findUnique: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
  },
};

describe('BookingCalculationService - Edge Cases & Comprehensive Tests', () => {
  let service: BookingCalculationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BookingCalculationService>(BookingCalculationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Case: Non-existent listing', () => {
    it('should throw error when listing does not exist', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      await expect(service.calculatePrice('non-existent', new Date(), new Date())).rejects.toThrow(
        'Listing not found',
      );
    });
  });

  describe('Edge Case: Zero duration', () => {
    it('should handle same start and end date', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const date = new Date('2023-01-01T10:00:00Z');
      const result = await service.calculatePrice('listing-1', date, date);

      // Should charge for minimum 1 unit
      expect(result.subtotal).toBeGreaterThan(0);
    });
  });

  describe('Edge Case: Very short duration (hours)', () => {
    it('should calculate correctly for 1 hour rental', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_HOUR,
        basePrice: 20,
        hourlyPrice: 20,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-01T11:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.duration).toBe(1);
      expect(result.breakdown.durationType).toBe('hours');
      expect(result.subtotal).toBe(20);
    });

    it('should round up partial hours', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_HOUR,
        basePrice: 20,
        hourlyPrice: 20,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-01T10:30:00Z'); // 0.5 hours
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.duration).toBe(1); // Rounded up
      expect(result.subtotal).toBe(20);
    });
  });

  describe('Edge Case: Very long duration (months)', () => {
    it('should calculate correctly for 3 month rental', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_MONTH,
        basePrice: 1000,
        monthlyPrice: 1000,
        requiresDeposit: false,
        monthlyDiscount: 10, // 10% discount for monthly
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-04-01T10:00:00Z'); // 3 months
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.duration).toBe(3);
      expect(result.breakdown.durationType).toBe('months');
      expect(result.breakdown.basePrice).toBe(3000);
      // Should have discount applied
      expect(result.breakdown.discounts).toBeDefined();
      expect(result.subtotal).toBeLessThan(3000);
    });
  });

  describe('Edge Case: Weekly discount application', () => {
    it('should apply weekly discount for 7+ day rentals', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
        weeklyDiscount: 15, // 15% discount
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-08T10:00:00Z'); // 7 days
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.discounts).toBeDefined();
      expect(result.breakdown.discounts?.length).toBeGreaterThan(0);
      expect(result.breakdown.discounts?.[0].type).toContain('weekly');
      expect(result.subtotal).toBeLessThan(result.breakdown.basePrice);
    });

    it('should not apply weekly discount for 6 day rentals', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
        weeklyDiscount: 15,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-07T10:00:00Z'); // 6 days
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.discounts).toBeUndefined();
      expect(result.subtotal).toBe(result.breakdown.basePrice);
    });
  });

  describe('Edge Case: Monthly discount application', () => {
    it('should apply monthly discount for 30+ day rentals', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
        monthlyDiscount: 20, // 20% discount
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-02-01T10:00:00Z'); // 31 days
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.discounts).toBeDefined();
      expect(result.breakdown.discounts?.some((d) => d.type.includes('monthly'))).toBe(true);
      expect(result.subtotal).toBeLessThan(result.breakdown.basePrice);
    });
  });

  describe('Edge Case: Deposit calculations', () => {
    it('should calculate fixed deposit correctly', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: true,
        depositType: DepositType.FIXED,
        depositAmount: 200,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.depositAmount).toBe(200);
    });

    it('should calculate percentage deposit correctly', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: true,
        depositType: DepositType.PERCENTAGE,
        depositPercentage: 50, // 50% of subtotal
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.depositAmount).toBe(result.subtotal * 0.5);
    });

    it('should handle no deposit requirement', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.depositAmount).toBe(0);
    });

    it('should handle NONE deposit type', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: true,
        depositType: DepositType.NONE,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.depositAmount).toBe(0);
    });
  });

  describe('Edge Case: Fee calculations', () => {
    it('should calculate platform fee correctly (15%)', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.platformFee).toBe(result.subtotal * 0.15);
    });

    it('should calculate service fee correctly (5%)', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.serviceFee).toBe(result.subtotal * 0.05);
    });

    it('should calculate owner earnings correctly (subtotal - platform fee)', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.ownerEarnings).toBe(result.subtotal - result.platformFee);
      expect(result.ownerEarnings).toBe(result.subtotal * 0.85); // 100% - 15%
    });
  });

  describe('Edge Case: Total calculation', () => {
    it('should calculate total correctly (subtotal + service fee + deposit)', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: true,
        depositType: DepositType.FIXED,
        depositAmount: 50,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      const expectedTotal = result.subtotal + result.serviceFee + result.depositAmount;
      expect(result.total).toBe(expectedTotal);
    });
  });

  describe('Edge Case: Different pricing modes', () => {
    it('should handle PER_HOUR pricing', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_HOUR,
        basePrice: 25,
        hourlyPrice: 25,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-01T14:00:00Z'); // 4 hours
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.durationType).toBe('hours');
      expect(result.breakdown.duration).toBe(4);
      expect(result.breakdown.basePrice).toBe(100); // 25 * 4
    });

    it('should handle PER_DAY pricing', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 150,
        dailyPrice: 150,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-04T10:00:00Z'); // 3 days
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.durationType).toBe('days');
      expect(result.breakdown.duration).toBe(3);
      expect(result.breakdown.basePrice).toBe(450); // 150 * 3
    });

    it('should handle PER_WEEK pricing', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_WEEK,
        basePrice: 600,
        weeklyPrice: 600,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-15T10:00:00Z'); // 2 weeks
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.durationType).toBe('weeks');
      expect(result.breakdown.duration).toBe(2);
      expect(result.breakdown.basePrice).toBe(1200); // 600 * 2
    });

    it('should handle PER_MONTH pricing', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_MONTH,
        basePrice: 2000,
        monthlyPrice: 2000,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-03-01T10:00:00Z'); // 2 months
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.durationType).toBe('months');
      expect(result.breakdown.duration).toBe(2);
      expect(result.breakdown.basePrice).toBe(4000); // 2000 * 2
    });
  });

  describe('Edge Case: Fallback to basePrice', () => {
    it('should use basePrice when specific price field is missing', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        // dailyPrice is missing
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.breakdown.basePrice).toBe(100);
    });
  });

  describe('Edge Case: Large numbers', () => {
    it('should handle very expensive listings', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 10000,
        dailyPrice: 10000,
        requiresDeposit: true,
        depositType: DepositType.PERCENTAGE,
        depositPercentage: 50,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-08T10:00:00Z'); // 7 days
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.subtotal).toBe(70000);
      expect(result.platformFee).toBe(10500); // 15% of 70000
      expect(result.serviceFee).toBe(3500); // 5% of 70000
      expect(result.depositAmount).toBe(35000); // 50% of 70000
      expect(result.ownerEarnings).toBe(59500); // 70000 - 10500
    });
  });

  describe('Edge Case: Precision and rounding', () => {
    it('should handle decimal prices correctly', async () => {
      const listing = {
        id: 'listing-1',
        pricingMode: PricingMode.PER_DAY,
        basePrice: 99.99,
        dailyPrice: 99.99,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-02T10:00:00Z');
      const result = await service.calculatePrice('listing-1', startDate, endDate);

      expect(result.subtotal).toBe(99.99);
      expect(result.platformFee).toBeCloseTo(14.9985, 2);
      expect(result.serviceFee).toBeCloseTo(4.9995, 2);
    });
  });
});
