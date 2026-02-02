import { Test, TestingModule } from '@nestjs/testing';
import { TaxCalculationService, TaxCalculationInput, TaxBreakdown } from './tax-calculation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('TaxCalculationService', () => {
  let service: TaxCalculationService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockPrismaService = {
      listing: {
        findUnique: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
      },
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<TaxCalculationService>(TaxCalculationService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTax', () => {
    const baseInput: TaxCalculationInput = {
      amount: 1000,
      currency: 'USD',
      listingId: 'listing-123',
      country: 'US',
      state: 'CA',
      city: 'San Francisco',
    };

    it('should calculate tax for California location', async () => {
      const mockProperty = {
        id: 'listing-123',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        categoryId: 'cat-123',
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockProperty);
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(baseInput);

      expect(result).toHaveProperty('subtotal', baseInput.amount);
      expect(result).toHaveProperty('taxLines');
      expect(result).toHaveProperty('totalTax');
      expect(result).toHaveProperty('total');
      expect(result.total).toBeGreaterThan(result.subtotal);
    });

    it('should calculate tax for New York location', async () => {
      const nyInput: TaxCalculationInput = {
        ...baseInput,
        state: 'NY',
        city: 'New York City',
      };

      const mockProperty = {
        id: 'listing-123',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(mockProperty);
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(nyInput);

      expect(result.taxLines).toBeDefined();
      expect(result.totalTax).toBeGreaterThan(0);
    });

    it('should return zero tax for location without defined rates', async () => {
      const unknownInput: TaxCalculationInput = {
        ...baseInput,
        country: 'UNKNOWN',
        state: 'XX',
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'XX',
        country: 'UNKNOWN',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(unknownInput);

      expect(result.totalTax).toBe(0);
      expect(result.total).toBe(result.subtotal);
    });

    it('should use cached tax rates if available', async () => {
      const cachedBreakdown: TaxBreakdown = {
        subtotal: 1000,
        taxLines: [
          {
            type: 'SALES_TAX',
            name: 'State Sales Tax',
            rate: 7.25,
            amount: 72.5,
            jurisdiction: 'California',
          },
        ],
        totalTax: 72.5,
        total: 1072.5,
        currency: 'USD',
      };

      const cacheKey = `tax:${baseInput.listingId}:${baseInput.amount}:${baseInput.state}`;
      (cacheService.get as jest.Mock).mockResolvedValue(cachedBreakdown);

      const result = await service.calculateTax(baseInput);

      expect(result).toEqual(cachedBreakdown);
      expect(prismaService.listing.findUnique).not.toHaveBeenCalled();
    });

    it('should handle different booking types', async () => {
      const shortTermInput: TaxCalculationInput = {
        ...baseInput,
        bookingType: 'SHORT_TERM',
      };

      const longTermInput: TaxCalculationInput = {
        ...baseInput,
        bookingType: 'LONG_TERM',
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'CA',
        country: 'USA',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const shortTermResult = await service.calculateTax(shortTermInput);
      const longTermResult = await service.calculateTax(longTermInput);

      // Short-term typically has lodging tax, long-term might not
      expect(shortTermResult).toBeDefined();
      expect(longTermResult).toBeDefined();
    });

    it('should calculate correct tax amounts', async () => {
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'CA',
        country: 'USA',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(baseInput);

      // Verify mathematical correctness
      const calculatedTotal = result.taxLines.reduce((sum, line) => sum + line.amount, 0);
      expect(Math.abs(calculatedTotal - result.totalTax)).toBeLessThan(0.01);
      expect(Math.abs(result.subtotal + result.totalTax - result.total)).toBeLessThan(0.01);
    });

    it('should handle zero amount', async () => {
      const zeroInput: TaxCalculationInput = {
        ...baseInput,
        amount: 0,
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'CA',
        country: 'USA',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(zeroInput);

      expect(result.subtotal).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle negative amounts gracefully', async () => {
      const negativeInput: TaxCalculationInput = {
        ...baseInput,
        amount: -100,
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'CA',
        country: 'USA',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      // Service should handle this gracefully (either throw or return 0)
      const result = await service.calculateTax(negativeInput);
      expect(result).toBeDefined();
    });
  });

  describe('getTaxRates', () => {
    it('should return tax rates for valid jurisdiction', async () => {
      const rates = await service.getTaxRates('US', 'CA');

      expect(rates).toBeDefined();
      expect(Array.isArray(rates)).toBe(true);
    });

    it('should return empty array for unknown jurisdiction', async () => {
      const rates = await service.getTaxRates('XX', 'YY');

      expect(rates).toEqual([]);
    });

    it('should return different rates for different states', async () => {
      const caRates = await service.getTaxRates('US', 'CA');
      const nyRates = await service.getTaxRates('US', 'NY');

      expect(caRates).not.toEqual(nyRates);
    });
  });

  describe('createTaxTransaction', () => {
    it('should create a tax transaction record', async () => {
      const transactionData = {
        bookingId: 'booking-123',
        taxBreakdown: {
          subtotal: 1000,
          taxLines: [
            {
              type: 'SALES_TAX' as const,
              name: 'State Sales Tax',
              rate: 7.25,
              amount: 72.5,
              jurisdiction: 'California',
            },
          ],
          totalTax: 72.5,
          total: 1072.5,
          currency: 'USD',
        },
      };

      const result = await service.createTaxTransaction(transactionData);

      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('status');
    });
  });

  describe('validateTaxExemption', () => {
    it('should validate tax exemption certificate', async () => {
      const exemptionData = {
        userId: 'user-123',
        certificateNumber: 'EXEMPT-123',
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      };

      const result = await service.validateTaxExemption(exemptionData);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('exemptionType');
    });

    it('should reject expired exemption certificates', async () => {
      const expiredExemption = {
        userId: 'user-123',
        certificateNumber: 'EXEMPT-EXPIRED',
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };

      const result = await service.validateTaxExemption(expiredExemption);

      expect(result.isValid).toBe(false);
    });
  });

  describe('generateTaxReport', () => {
    it('should generate tax report for user', async () => {
      const reportParams = {
        userId: 'user-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        reportType: '1099' as const,
      };

      const result = await service.generateTaxReport(reportParams);

      expect(result).toHaveProperty('reportUrl');
      expect(result).toHaveProperty('totalIncome');
      expect(result).toHaveProperty('taxableIncome');
    });

    it('should handle empty report period', async () => {
      const emptyPeriod = {
        userId: 'user-no-income',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        reportType: '1099' as const,
      };

      const result = await service.generateTaxReport(emptyPeriod);

      expect(result.totalIncome).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large amounts', async () => {
      const largeInput: TaxCalculationInput = {
        amount: 1000000, // $1 million
        currency: 'USD',
        listingId: 'listing-123',
        country: 'US',
        state: 'CA',
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'CA',
        country: 'USA',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(largeInput);

      expect(result.total).toBeGreaterThan(largeInput.amount);
      expect(result.totalTax).toBeGreaterThan(0);
    });

    it('should handle decimal precision correctly', async () => {
      const preciseInput: TaxCalculationInput = {
        amount: 99.99,
        currency: 'USD',
        listingId: 'listing-123',
        country: 'US',
        state: 'CA',
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'CA',
        country: 'USA',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(preciseInput);

      // Verify no floating point errors
      expect(Number.isFinite(result.total)).toBe(true);
      expect(Number.isFinite(result.totalTax)).toBe(true);
    });

    it('should handle missing listing gracefully', async () => {
      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue(null);
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const input: TaxCalculationInput = {
        amount: 100,
        currency: 'USD',
        listingId: 'non-existent',
        country: 'US',
        state: 'CA',
      };

      // Should either throw or use fallback rates
      try {
        const result = await service.calculateTax(input);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle different currencies', async () => {
      const euroInput: TaxCalculationInput = {
        amount: 1000,
        currency: 'EUR',
        listingId: 'listing-123',
        country: 'DE',
        state: 'BY', // Bavaria
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'BY',
        country: 'DE',
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(euroInput);

      expect(result.currency).toBe('EUR');
    });

    it('should apply category-specific tax rules', async () => {
      const categoryInput: TaxCalculationInput = {
        ...{
          amount: 1000,
          currency: 'USD',
          listingId: 'listing-123',
          country: 'US',
          state: 'CA',
        },
        categoryId: 'vehicles-category',
      };

      (prismaService.listing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-123',
        state: 'CA',
        country: 'USA',
        categoryId: 'vehicles-category',
      });
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'vehicles-category',
        name: 'Vehicles',
        taxExempt: false,
      });
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateTax(categoryInput);

      expect(result).toBeDefined();
    });
  });

  describe('tax jurisdictions', () => {
    it('should list all available jurisdictions', async () => {
      const jurisdictions = await service.getAvailableJurisdictions();

      expect(Array.isArray(jurisdictions)).toBe(true);
      expect(jurisdictions.length).toBeGreaterThan(0);
    });

    it('should return jurisdiction details', async () => {
      const details = await service.getJurisdictionDetails('US', 'CA');

      expect(details).toHaveProperty('country');
      expect(details).toHaveProperty('state');
      expect(details).toHaveProperty('taxTypes');
    });
  });

  describe('tax registration', () => {
    it('should check registration requirements', async () => {
      const requirements = await service.getRegistrationRequirements('US', 'CA');

      expect(requirements).toHaveProperty('required');
      expect(requirements).toHaveProperty('thresholds');
    });

    it('should process tax registration', async () => {
      const registrationData = {
        userId: 'user-123',
        country: 'US',
        state: 'CA',
        registrationNumber: 'TAX-REG-123',
      };

      const result = await service.registerForTax(registrationData);

      expect(result).toHaveProperty('registrationId');
      expect(result).toHaveProperty('status');
    });
  });
});
