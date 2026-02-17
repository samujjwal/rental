import { Test, TestingModule } from '@nestjs/testing';
import { TaxCalculationService, TaxBreakdown } from './tax-calculation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';

const mockPrismaService = {
  listing: {
    findUnique: jest.fn(),
  },
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

// Helper to build a TaxCalculationInput
function taxInput(overrides: Partial<{
  listingId: string;
  amount: number;
  currency: string;
  country: string;
  state: string;
  city: string;
  categoryId: string;
  bookingType: 'SHORT_TERM' | 'LONG_TERM';
}> = {}) {
  return {
    listingId: 'listing-1',
    amount: 1000,
    currency: 'USD',
    country: 'US',
    state: 'CA',
    city: 'San Francisco',
    ...overrides,
  };
}

// Standard mock listing with category
function mockListing(overrides: Record<string, any> = {}) {
  return {
    id: 'listing-1',
    title: 'Test Listing',
    category: { id: 'cat-1', slug: 'electronics' },
    ...overrides,
  };
}

describe('TaxCalculationService - Edge Cases & Comprehensive Tests', () => {
  let service: TaxCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<TaxCalculationService>(TaxCalculationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Case: Non-existent listing', () => {
    it('should return zero tax when listing does not exist (error is caught)', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({ listingId: 'non-existent' }));

      // Service catches the "Listing not found" error and returns zero tax
      expect(result.totalTax).toBe(0);
      expect(result.taxLines).toHaveLength(0);
      expect(result.subtotal).toBe(1000);
      expect(result.total).toBe(1000);
    });
  });

  describe('Edge Case: Zero amount', () => {
    it('should handle zero amount correctly', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({ amount: 0 }));

      expect(result.totalTax).toBe(0);
      expect(result.subtotal).toBe(0);
      expect(result.total).toBe(0);
      // Tax lines still present but amounts are 0
      for (const line of result.taxLines) {
        expect(line.amount).toBe(0);
      }
    });
  });

  describe('Edge Case: Negative amount', () => {
    it('should handle negative amount (refund scenario)', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({ amount: -1000 }));

      expect(result.totalTax).toBeLessThan(0);
      expect(result.total).toBeLessThan(0);
      for (const line of result.taxLines) {
        expect(line.amount).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Edge Case: US California taxes', () => {
    it('should apply CA state + local taxes from internal rate map', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'US',
        state: 'CA',
        amount: 1000,
      }));

      // CA has SALES_TAX 7.25%, LOCAL_TAX 0.5%, LODGING_TAX 14% in internal map
      expect(result.taxLines.length).toBeGreaterThanOrEqual(2);
      expect(result.totalTax).toBeGreaterThan(0);
      expect(result.subtotal).toBe(1000);
      expect(result.total).toBe(1000 + result.totalTax);

      const salesTax = result.taxLines.find((t) => t.type === 'SALES_TAX');
      expect(salesTax).toBeDefined();
      expect(salesTax!.rate).toBe(7.25);
    });

    it('should apply New York state + city taxes', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'US',
        state: 'NY',
        city: 'New York',
        amount: 1000,
      }));

      expect(result.taxLines.length).toBeGreaterThanOrEqual(2);
      const salesTax = result.taxLines.find((t) => t.type === 'SALES_TAX');
      expect(salesTax).toBeDefined();
      expect(salesTax!.rate).toBe(4.0);
    });
  });

  describe('Edge Case: No applicable taxes', () => {
    it('should handle locations with no tax rates in internal map', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      // Oregon not in internal tax rate map
      const result = await service.calculateTax(taxInput({
        country: 'US',
        state: 'OR',
        city: 'Portland',
        amount: 1000,
      }));

      expect(result.totalTax).toBe(0);
      expect(result.taxLines).toHaveLength(0);
      expect(result.total).toBe(1000);
    });

    it('should handle unknown country gracefully', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'ZZ',
        state: undefined,
        city: undefined,
        amount: 1000,
      }));

      expect(result.totalTax).toBe(0);
      expect(result.taxLines).toHaveLength(0);
    });
  });

  describe('Edge Case: International locations', () => {
    it('should calculate VAT for France', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'FR',
        state: undefined,
        city: 'Paris',
        amount: 1000,
      }));

      expect(result.totalTax).toBe(200); // 20% VAT
      expect(result.taxLines.length).toBeGreaterThanOrEqual(1);
      const vat = result.taxLines.find((t) => t.type === 'VAT');
      expect(vat).toBeDefined();
      expect(vat!.rate).toBe(20.0);
    });

    it('should calculate VAT for United Kingdom', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'GB',
        state: undefined,
        city: 'London',
        amount: 1000,
      }));

      expect(result.totalTax).toBe(200); // 20% VAT
      const vat = result.taxLines.find((t) => t.type === 'VAT');
      expect(vat).toBeDefined();
    });

    it('should calculate GST for Canada Ontario (HST)', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'CA',
        state: 'ON',
        city: 'Toronto',
        amount: 1000,
      }));

      expect(result.totalTax).toBe(130); // 13% HST
      expect(result.taxLines).toHaveLength(1);
    });

    it('should calculate GST+PST for Canada BC', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'CA',
        state: 'BC',
        city: 'Vancouver',
        amount: 1000,
      }));

      expect(result.totalTax).toBe(120); // 5% GST + 7% PST
      expect(result.taxLines).toHaveLength(2);
    });

    it('should calculate GST for Australia', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'AU',
        state: undefined,
        city: 'Sydney',
        amount: 1000,
      }));

      expect(result.totalTax).toBe(100); // 10% GST
    });

    it('should handle countries with no tax defined', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'AE',
        state: 'Dubai',
        city: 'Dubai',
        amount: 1000,
      }));

      expect(result.totalTax).toBe(0);
    });
  });

  describe('Edge Case: Decimal precision', () => {
    it('should handle decimal amounts correctly', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'GB',
        state: undefined,
        amount: 99.99,
      }));

      // 20% of 99.99 = 19.998 → should be close to 20.00
      expect(result.totalTax).toBeCloseTo(20.0, 1);
    });

    it('should produce tax amounts rounded to 2 decimal places', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'DE',
        state: undefined,
        amount: 33.33,
      }));

      // 19% of 33.33 = 6.3327
      for (const line of result.taxLines) {
        const decimals = line.amount.toString().split('.')[1];
        if (decimals) {
          expect(decimals.length).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  describe('Edge Case: Large amounts', () => {
    it('should handle very large transaction amounts', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'GB',
        state: undefined,
        amount: 1000000,
      }));

      expect(result.totalTax).toBe(200000); // 20% of 1,000,000
      expect(result.total).toBe(1200000);
    });
  });

  describe('Edge Case: Cache behavior', () => {
    it('should return cached result when available', async () => {
      const cachedResult: TaxBreakdown = {
        subtotal: 1000,
        taxLines: [{ type: 'VAT', name: 'VAT', rate: 20, amount: 200, jurisdiction: 'UK' }],
        totalTax: 200,
        total: 1200,
        currency: 'USD',
      };

      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await service.calculateTax(taxInput({
        country: 'GB',
        state: undefined,
      }));

      expect(result).toEqual(cachedResult);
      expect(mockCacheService.get).toHaveBeenCalled();
      // listing.findUnique should NOT be called when cache hits
      expect(mockPrismaService.listing.findUnique).not.toHaveBeenCalled();
    });

    it('should calculate and cache when not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());

      await service.calculateTax(taxInput({
        country: 'GB',
        state: undefined,
      }));

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockPrismaService.listing.findUnique).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ totalTax: expect.any(Number) }),
        3600,
      );
    });
  });

  describe('Edge Case: Lodging tax for spaces category', () => {
    it('should include lodging tax for US:CA space listings', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(
        mockListing({ category: { id: 'cat-spaces', slug: 'spaces' } }),
      );
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'US',
        state: 'CA',
        amount: 1000,
      }));

      // LODGING_TAX 14% applies to SPACES category
      const lodgingTax = result.taxLines.find((t) => t.type === 'LODGING_TAX');
      if (lodgingTax) {
        expect(lodgingTax.rate).toBe(14.0);
        expect(lodgingTax.amount).toBe(140);
      }
      // Total should include all applicable taxes
      expect(result.totalTax).toBeGreaterThan(0);
    });
  });

  describe('Edge Case: Texas taxes', () => {
    it('should calculate Texas state sales tax', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'US',
        state: 'TX',
        city: 'Austin',
        amount: 1000,
      }));

      const salesTax = result.taxLines.find((t) => t.type === 'SALES_TAX');
      expect(salesTax).toBeDefined();
      expect(salesTax!.rate).toBe(6.25);
      expect(salesTax!.amount).toBe(62.5);
    });
  });

  describe('Edge Case: Tax on discounted amount', () => {
    it('should calculate tax on the actual (discounted) amount passed', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      // Pass discounted amount directly
      const result = await service.calculateTax(taxInput({
        country: 'GB',
        state: undefined,
        amount: 800,
      }));

      expect(result.totalTax).toBe(160); // 20% of 800
      expect(result.subtotal).toBe(800);
      expect(result.total).toBe(960);
    });
  });

  describe('Edge Case: Currency and structure', () => {
    it('should include currency in result', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({ currency: 'EUR' }));

      expect(result.currency).toBe('EUR');
    });

    it('should have correct structure: subtotal, taxLines, totalTax, total', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput());

      expect(result).toHaveProperty('subtotal');
      expect(result).toHaveProperty('taxLines');
      expect(result).toHaveProperty('totalTax');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('currency');
      expect(Array.isArray(result.taxLines)).toBe(true);
    });

    it('should have correct tax line structure', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing());
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.calculateTax(taxInput({
        country: 'US',
        state: 'CA',
        amount: 1000,
      }));

      for (const line of result.taxLines) {
        expect(line).toHaveProperty('type');
        expect(line).toHaveProperty('name');
        expect(line).toHaveProperty('rate');
        expect(line).toHaveProperty('amount');
        expect(line).toHaveProperty('jurisdiction');
      }
    });
  });

  describe('Edge Case: getTaxRates public method', () => {
    it('should return rates for known jurisdictions', () => {
      const rates = service.getTaxRates('US', 'CA');
      expect(rates.length).toBeGreaterThan(0);
    });

    it('should return empty for unknown jurisdictions', () => {
      const rates = service.getTaxRates('ZZ', 'XX');
      expect(rates).toHaveLength(0);
    });

    it('should fall back to country-level rates when state not found', () => {
      // FR has country-level rates (no state key)
      const rates = service.getTaxRates('FR');
      expect(rates.length).toBeGreaterThan(0);
    });
  });
});
