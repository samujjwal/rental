import { Test, TestingModule } from '@nestjs/testing';
import { TaxCalculationService } from './tax-calculation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';

const mockPrismaService = {
  listing: {
    findUnique: jest.fn(),
  },
  taxRate: {
    findMany: jest.fn(),
  },
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('TaxCalculationService - Edge Cases & Comprehensive Tests', () => {
  let service: TaxCalculationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<TaxCalculationService>(TaxCalculationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Case: Non-existent listing', () => {
    it('should throw error when listing does not exist', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      await expect(service.calculateTax('non-existent', 1000)).rejects.toThrow('Listing not found');
    });
  });

  describe('Edge Case: Zero amount', () => {
    it('should handle zero amount correctly', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      const result = await service.calculateTax('listing-1', 0);

      expect(result.totalTax).toBe(0);
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].amount).toBe(0);
    });
  });

  describe('Edge Case: Negative amount', () => {
    it('should handle negative amount (refund scenario)', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      const result = await service.calculateTax('listing-1', -1000);

      expect(result.totalTax).toBeLessThan(0);
      expect(result.breakdown[0].amount).toBeLessThan(0);
    });
  });

  describe('Edge Case: Multiple tax jurisdictions', () => {
    it('should calculate state + county + city taxes correctly', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
        { jurisdiction: 'San Francisco County', rate: 1.0, type: 'COUNTY' },
        { jurisdiction: 'San Francisco', rate: 0.5, type: 'CITY' },
      ]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.breakdown).toHaveLength(3);
      expect(result.totalTax).toBe(87.5); // 7.25% + 1% + 0.5% = 8.75% of 1000

      const stateTax = result.breakdown.find((b) => b.type === 'STATE');
      expect(stateTax?.amount).toBe(72.5);

      const countyTax = result.breakdown.find((b) => b.type === 'COUNTY');
      expect(countyTax?.amount).toBe(10);

      const cityTax = result.breakdown.find((b) => b.type === 'CITY');
      expect(cityTax?.amount).toBe(5);
    });

    it('should handle overlapping jurisdictions correctly', async () => {
      const listing = {
        id: 'listing-1',
        city: 'New York',
        state: 'NY',
        country: 'US',
        zipCode: '10001',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'NY', rate: 4.0, type: 'STATE' },
        { jurisdiction: 'New York County', rate: 4.5, type: 'COUNTY' },
        { jurisdiction: 'New York City', rate: 0.375, type: 'CITY' },
      ]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.breakdown).toHaveLength(3);
      expect(result.totalTax).toBe(88.75); // 4% + 4.5% + 0.375% = 8.875%
    });
  });

  describe('Edge Case: No applicable taxes', () => {
    it('should handle locations with no tax rates', async () => {
      const listing = {
        id: 'listing-1',
        city: 'Portland',
        state: 'OR',
        country: 'US',
        zipCode: '97201',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.totalTax).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });
  });

  describe('Edge Case: International locations', () => {
    it('should calculate VAT for European countries', async () => {
      const listing = {
        id: 'listing-1',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'FR',
        zipCode: '75001',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'France', rate: 20.0, type: 'VAT' },
      ]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.totalTax).toBe(200); // 20% VAT
      expect(result.breakdown[0].type).toBe('VAT');
    });

    it('should calculate GST for Canada', async () => {
      const listing = {
        id: 'listing-1',
        city: 'Toronto',
        state: 'ON',
        country: 'CA',
        zipCode: 'M5H 2N2',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'Canada', rate: 5.0, type: 'GST' },
        { jurisdiction: 'Ontario', rate: 8.0, type: 'PST' },
      ]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.totalTax).toBe(130); // 5% GST + 8% PST
      expect(result.breakdown).toHaveLength(2);
    });

    it('should handle countries with no tax', async () => {
      const listing = {
        id: 'listing-1',
        city: 'Dubai',
        state: 'Dubai',
        country: 'AE',
        zipCode: '00000',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.totalTax).toBe(0);
    });
  });

  describe('Edge Case: Tax exemptions', () => {
    it('should handle tax-exempt transactions', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
        taxExempt: true,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      const result = await service.calculateTax('listing-1', 1000, { exempt: true });

      expect(result.totalTax).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });
  });

  describe('Edge Case: Very high tax rates', () => {
    it('should handle locations with cumulative high tax rates', async () => {
      const listing = {
        id: 'listing-1',
        city: 'High Tax City',
        state: 'HT',
        country: 'US',
        zipCode: '99999',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'State', rate: 10.0, type: 'STATE' },
        { jurisdiction: 'County', rate: 5.0, type: 'COUNTY' },
        { jurisdiction: 'City', rate: 3.0, type: 'CITY' },
        { jurisdiction: 'Special District', rate: 2.0, type: 'SPECIAL' },
      ]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.totalTax).toBe(200); // 20% total
      expect(result.breakdown).toHaveLength(4);
    });
  });

  describe('Edge Case: Decimal precision', () => {
    it('should handle decimal amounts correctly', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      const result = await service.calculateTax('listing-1', 99.99);

      expect(result.totalTax).toBeCloseTo(7.25, 2);
    });

    it('should round tax amounts appropriately', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.333, type: 'STATE' }, // Odd rate
      ]);

      const result = await service.calculateTax('listing-1', 100);

      // Should round to 2 decimal places
      expect(result.totalTax).toBeCloseTo(7.33, 2);
    });
  });

  describe('Edge Case: Large amounts', () => {
    it('should handle very large transaction amounts', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      const result = await service.calculateTax('listing-1', 1000000);

      expect(result.totalTax).toBe(72500); // 7.25% of 1,000,000
    });
  });

  describe('Edge Case: Cache behavior', () => {
    it('should use cached tax rates when available', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      const cachedRates = [{ jurisdiction: 'CA', rate: 7.25, type: 'STATE' }];

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockCacheService.get.mockResolvedValue(cachedRates);

      await service.calculateTax('listing-1', 1000);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockPrismaService.taxRate.findMany).not.toHaveBeenCalled();
    });

    it('should fetch and cache tax rates when not cached', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      const rates = [{ jurisdiction: 'CA', rate: 7.25, type: 'STATE' }];

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.taxRate.findMany.mockResolvedValue(rates);

      await service.calculateTax('listing-1', 1000);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockPrismaService.taxRate.findMany).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('Edge Case: Special tax types', () => {
    it('should handle hotel occupancy tax', async () => {
      const listing = {
        id: 'listing-1',
        city: 'Las Vegas',
        state: 'NV',
        country: 'US',
        zipCode: '89101',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'Nevada', rate: 6.85, type: 'STATE' },
        { jurisdiction: 'Clark County', rate: 6.0, type: 'HOTEL_OCCUPANCY' },
      ]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.totalTax).toBe(128.5); // 6.85% + 6%
      expect(result.breakdown.some((b) => b.type === 'HOTEL_OCCUPANCY')).toBe(true);
    });

    it('should handle tourism tax', async () => {
      const listing = {
        id: 'listing-1',
        city: 'Miami',
        state: 'FL',
        country: 'US',
        zipCode: '33101',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'Florida', rate: 6.0, type: 'STATE' },
        { jurisdiction: 'Miami-Dade', rate: 2.0, type: 'TOURISM' },
      ]);

      const result = await service.calculateTax('listing-1', 1000);

      expect(result.totalTax).toBe(80); // 6% + 2%
      expect(result.breakdown.some((b) => b.type === 'TOURISM')).toBe(true);
    });
  });

  describe('Edge Case: Tax calculation with discounts', () => {
    it('should calculate tax on discounted amount', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      const originalAmount = 1000;
      const discountedAmount = 800; // 20% discount applied

      const result = await service.calculateTax('listing-1', discountedAmount);

      expect(result.totalTax).toBe(58); // 7.25% of 800
    });
  });

  describe('Edge Case: Nexus determination', () => {
    it('should determine tax nexus correctly for in-state transactions', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      const result = await service.calculateTax('listing-1', 1000, {
        buyerState: 'CA',
      });

      expect(result.totalTax).toBeGreaterThan(0);
    });

    it('should handle out-of-state transactions', async () => {
      const listing = {
        id: 'listing-1',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zipCode: '94102',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);
      mockPrismaService.taxRate.findMany.mockResolvedValue([
        { jurisdiction: 'CA', rate: 7.25, type: 'STATE' },
      ]);

      // Buyer is in different state - still charge tax based on listing location
      const result = await service.calculateTax('listing-1', 1000, {
        buyerState: 'NY',
      });

      expect(result.totalTax).toBeGreaterThan(0);
    });
  });
});
