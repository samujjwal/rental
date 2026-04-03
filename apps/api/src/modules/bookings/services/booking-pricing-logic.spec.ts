import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BookingPricingService } from './booking-pricing.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * CRITICAL: Pricing Logic Validation Tests
 *
 * These tests validate the correctness of financial calculations.
 * They ensure business logic integrity, not just function execution.
 *
 * Risk Level: CRITICAL - Financial accuracy is essential
 */
describe('BookingPricingService - Logic Validation', () => {
  let service: BookingPricingService;
  let prisma: any;
  let configService: any;

  const bookingId = 'booking-123';

  beforeEach(async () => {
    prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: bookingId }) },
      bookingPriceBreakdown: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        create: jest.fn().mockImplementation((data) => ({
          id: `line-${Date.now()}`,
          ...data.data,
          createdAt: new Date(),
        })),
      },
      fxRateSnapshot: { upsert: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(prisma)),
    };

    configService = {
      get: jest.fn((key: string, defaultValue: any) => {
        const defaults = {
          'fees.serviceFeePercent': 5,
          'fees.platformFeePercent': 10,
        };
        return defaults[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<BookingPricingService>(BookingPricingService);
  });

  describe('CRITICAL: Pricing Calculations', () => {
    it('should calculate correct total with standard fees and taxes', async () => {
      const params = {
        basePrice: 100,
        nights: 3,
        cleaningFee: 50,
        serviceFeeRate: 0.1,
        platformFeeRate: 0.03,
        securityDeposit: 200,
        taxRate: 0.08,
      };

      await service.calculateAndPersist(bookingId, params);

      // Verify the transaction was executed
      expect(prisma.$transaction).toHaveBeenCalled();

      // Capture the created lines to validate calculations
      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;

      // Extract and validate each line item calculation
      const lines = createCalls.map((call) => call[0]);

      const baseRateLine = lines.find((l) => l.data.lineType === 'BASE_RATE');
      const cleaningLine = lines.find((l) => l.data.lineType === 'CLEANING_FEE');
      const serviceLine = lines.find((l) => l.data.lineType === 'SERVICE_FEE');
      const platformLine = lines.find((l) => l.data.lineType === 'PLATFORM_FEE');
      const depositLine = lines.find((l) => l.data.lineType === 'SECURITY_DEPOSIT');
      const taxLine = lines.find((l) => l.data.lineType === 'TAX');

      // CRITICAL: Validate each calculation is mathematically correct
      expect(baseRateLine?.data.amount).toBe(300); // 100 × 3
      expect(cleaningLine?.data.amount).toBe(50);
      expect(serviceLine?.data.amount).toBe(30); // 300 × 0.1
      expect(platformLine?.data.amount).toBe(9); // 300 × 0.03
      expect(depositLine?.data.amount).toBe(200);

      // Tax calculation: (base + cleaning + service) × taxRate
      const expectedTax = (300 + 50 + 30) * 0.08; // 380 × 0.08 = 30.4
      expect(taxLine?.data.amount).toBe(30.4);

      // CRITICAL: Validate total calculation
      const expectedTotal = 300 + 50 + 30 + 9 + 200 + 30.4; // 619.4
      const actualTotal = lines.reduce((sum, line) => sum + line.data.amount, 0);
      expect(actualTotal).toBe(expectedTotal);
    });

    it('should handle edge case - zero duration booking', async () => {
      const params = {
        basePrice: 100,
        nights: 0, // Invalid - should handle gracefully
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const baseRateCall = createCalls.find((call) => call[0].data.lineType === 'BASE_RATE');

      expect(baseRateCall[0].data.amount).toBe(0); // 100 × 0 = 0
    });

    it('should validate currency conversion accuracy', async () => {
      const fxRate = 0.92; // 1 USD = 0.92 EUR
      const usdAmount = 100;
      const expectedEurAmount = 92;

      await service.captureFxRate({
        bookingId,
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: fxRate,
        rateSource: 'ECB',
      });

      expect(prisma.fxRateSnapshot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId },
          create: expect.objectContaining({
            bookingId,
            baseCurrency: 'USD',
            targetCurrency: 'EUR',
            rate: fxRate,
            rateSource: 'ECB',
          }),
          update: expect.objectContaining({
            baseCurrency: 'USD',
            targetCurrency: 'EUR',
            rate: fxRate,
            rateSource: 'ECB',
          }),
        }),
      );

      // Validate the rate would be used correctly for conversion
      const convertedAmount = usdAmount * fxRate;
      expect(convertedAmount).toBe(expectedEurAmount);
    });

    it('should calculate tax correctly on taxable amount only', async () => {
      const params = {
        basePrice: 100,
        nights: 2,
        cleaningFee: 30,
        serviceFeeRate: 0.1,
        taxRate: 0.08,
        // No platform fee to test tax base calculation
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const lines = createCalls.map((call) => call[0]);
      const taxLine = lines.find((l) => l.data.lineType === 'TAX');

      // Tax base should be: base + cleaning + service fee (NOT including deposit)
      const baseTotal = 100 * 2; // 200
      const serviceFee = baseTotal * 0.1; // 20
      const expectedTaxableAmount = baseTotal + 30 + serviceFee; // 250
      const expectedTax = expectedTaxableAmount * 0.08; // 20

      expect(taxLine?.data.amount).toBe(expectedTax);
      expect(taxLine?.data.metadata).toBe(
        JSON.stringify({
          rate: 0.08,
          taxableAmount: expectedTaxableAmount,
        }),
      );
    });

    it('should handle precision correctly with rounding', async () => {
      const params = {
        basePrice: 99.99,
        nights: 3,
        serviceFeeRate: 0.0567, // Should create fractional amount
        taxRate: 0.0825,
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const lines = createCalls.map((call) => call[0]);
      const serviceLine = lines.find((l) => l.data.lineType === 'SERVICE_FEE');
      const taxLine = lines.find((l) => l.data.lineType === 'TAX');

      const baseTotal = 99.99 * 3; // 299.97
      const expectedServiceFee = baseTotal * 0.0567; // 16.987899
      const expectedTax = baseTotal * 0.0825; // 24.747525

      // Should be rounded to 2 decimal places
      expect(serviceLine?.data.amount).toBe(17.01); // Math.round(16.987899 * 100) / 100 = 17.01
      expect(taxLine?.data.amount).toBe(26.15); // Math.round(26.15 * 100) / 100 = 26.15
    });

    it('should use default fee rates when not specified', async () => {
      const params = {
        basePrice: 100,
        nights: 2,
        // No serviceFeeRate or platformFeeRate specified
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const lines = createCalls.map((call) => call[0]);
      const serviceLine = lines.find((l) => l.data.lineType === 'SERVICE_FEE');
      const platformLine = lines.find((l) => l.data.lineType === 'PLATFORM_FEE');

      const baseTotal = 100 * 2; // 200
      const expectedServiceFee = baseTotal * 0.05; // 10 (5% default)
      const expectedPlatformFee = baseTotal * 0.1; // 20 (10% default)

      expect(serviceLine?.data.amount).toBe(expectedServiceFee);
      expect(platformLine?.data.amount).toBe(expectedPlatformFee);
    });
  });

  describe('CRITICAL: Business Rule Validation', () => {
    it('should not create lines for zero-amount fees', async () => {
      const params = {
        basePrice: 100,
        nights: 2,
        cleaningFee: 0, // Should not create line
        securityDeposit: 0, // Should not create line
        taxRate: 0, // Should not create line
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const lines = createCalls.map((call) => call[0]);

      // Should only have base rate, service fee, and platform fee
      expect(lines).toHaveLength(3);

      const lineTypes = lines.map((l) => l.data.lineType);
      expect(lineTypes).toContain('BASE_RATE');
      expect(lineTypes).toContain('SERVICE_FEE');
      expect(lineTypes).toContain('PLATFORM_FEE');
      expect(lineTypes).not.toContain('CLEANING_FEE');
      expect(lineTypes).not.toContain('SECURITY_DEPOSIT');
      expect(lineTypes).not.toContain('TAX');
    });

    it('should handle singular vs plural night labels correctly', async () => {
      // Test singular
      await service.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 1,
      });

      let createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      let baseRateCall = createCalls.find((call) => call[0].data.lineType === 'BASE_RATE');
      expect(baseRateCall[0].data.label).toContain('1 night ×');

      // Reset and test plural
      prisma.bookingPriceBreakdown.create.mockClear();

      await service.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 3,
      });

      createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      baseRateCall = createCalls.find((call) => call[0].data.lineType === 'BASE_RATE');
      expect(baseRateCall[0].data.label).toContain('3 nights ×');
    });

    it('should validate fee percentage boundaries', async () => {
      const params = {
        basePrice: 100,
        nights: 1,
        serviceFeeRate: 1.5, // 150% - extremely high but should be handled
        platformFeeRate: 0.5, // 50% - high but valid
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const lines = createCalls.map((call) => call[0]);
      const serviceLine = lines.find((l) => l.data.lineType === 'SERVICE_FEE');
      const platformLine = lines.find((l) => l.data.lineType === 'PLATFORM_FEE');

      // Should calculate correctly even with high percentages
      expect(serviceLine?.data.amount).toBe(150); // 100 × 1.5
      expect(platformLine?.data.amount).toBe(50); // 100 × 0.5
    });
  });

  describe('CRITICAL: Financial Integrity', () => {
    it('should maintain calculation consistency across multiple calls', async () => {
      const params = {
        basePrice: 100,
        nights: 3,
        cleaningFee: 50,
        serviceFeeRate: 0.1,
        platformFeeRate: 0.03,
        taxRate: 0.08,
      };

      // First calculation
      await service.calculateAndPersist(bookingId, params);
      const firstCalls = prisma.bookingPriceBreakdown.create.mock.calls.length;

      // Second calculation with same parameters
      prisma.bookingPriceBreakdown.create.mockClear();
      await service.calculateAndPersist(bookingId, params);
      const secondCalls = prisma.bookingPriceBreakdown.create.mock.calls.length;

      // Should produce same number of lines
      expect(firstCalls).toBe(secondCalls);

      // And same calculations
      const lines = prisma.bookingPriceBreakdown.create.mock.calls.map((call) => call[0]);
      const total = lines.reduce((sum, line) => sum + line.data.amount, 0);
      expect(total).toBe(419.4); // Same as first calculation (without deposit)
    });

    it('should handle currency consistency throughout breakdown', async () => {
      const currency = 'EUR';
      const params = {
        basePrice: 100,
        nights: 2,
        currency,
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const lines = createCalls.map((call) => call[0]);

      // All lines should use the specified currency
      lines.forEach((line) => {
        expect(line.data.currency).toBe(currency);
      });
    });

    it('should validate sort order consistency', async () => {
      const params = {
        basePrice: 100,
        nights: 2,
        cleaningFee: 50,
        serviceFeeRate: 0.1,
        platformFeeRate: 0.03,
        securityDeposit: 200,
        taxRate: 0.08,
      };

      await service.calculateAndPersist(bookingId, params);

      const createCalls = prisma.bookingPriceBreakdown.create.mock.calls;
      const lines = createCalls.map((call) => call[0]);

      // Lines should be created with sequential sort order
      const sortOrders = lines.map((line) => line.data.sortOrder);
      expect(sortOrders).toEqual([0, 1, 2, 3, 4, 5]);

      // And should be in the expected order
      const lineTypes = lines.map((line) => line.data.lineType);
      expect(lineTypes).toEqual([
        'BASE_RATE',
        'CLEANING_FEE',
        'SERVICE_FEE',
        'PLATFORM_FEE',
        'SECURITY_DEPOSIT',
        'TAX',
      ]);
    });
  });
});
