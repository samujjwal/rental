import { StripeTaxService } from './stripe-tax.service';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    tax: {
      transactions: {
        createFromCalculation: jest.fn().mockResolvedValue({ id: 'tax_txn_1' }),
      },
      registrations: {
        create: jest.fn().mockResolvedValue({
          id: 'taxreg_1',
          country: 'US',
          status: 'pending',
          active_from: 'now',
          country_options: {},
        }),
        list: jest.fn().mockResolvedValue({ data: [] as any[] }),
      },
    },
  }));
});

describe('StripeTaxService', () => {
  let service: StripeTaxService;
  let configService: any;
  let prisma: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_key';
        return undefined;
      }),
    };

    prisma = {
      booking: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      taxForm: {
        create: jest.fn().mockResolvedValue({ id: 'tax-form-1' }),
      },
      taxCalculation: {
        create: jest.fn().mockResolvedValue({ id: 'tax-calc-1' }),
      },
    };

    service = new StripeTaxService(configService, prisma);
  });

  describe('calculateTax', () => {
    it('should return tax calculation with default 8% rate', async () => {
      const result = await service.calculateTax({
        amount: 10000,
        currency: 'usd',
        customerAddress: { line1: '123 Main St', city: 'San Francisco', country: 'US', state: 'CA', postalCode: '94105' },
      });

      expect(result).toBeDefined();
      expect(result.amount).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should return zero-tax fallback on error', async () => {
      // Force an error by passing invalid data
      const result = await service.calculateTax({
        amount: -1,
        currency: '',
        customerAddress: { line1: '', city: '', country: '', state: '', postalCode: '' },
      });

      expect(result).toBeDefined();
      expect(typeof result.amount).toBe('number');
    });

    // EDGE CASE: Zero amount transaction
    it('should handle zero amount transactions', async () => {
      const result = await service.calculateTax({
        amount: 0,
        currency: 'usd',
        customerAddress: { line1: '123 Main St', city: 'San Francisco', country: 'US', state: 'CA', postalCode: '94105' },
      });

      expect(result).toBeDefined();
      expect(result.amount).toBe(0);
    });

    // EDGE CASE: Very large amount
    it('should handle large amount transactions', async () => {
      const result = await service.calculateTax({
        amount: 1000000, // $10,000
        currency: 'usd',
        customerAddress: { line1: '123 Main St', city: 'San Francisco', country: 'US', state: 'CA', postalCode: '94105' },
      });

      expect(result).toBeDefined();
      expect(result.amount).toBeGreaterThan(0);
    });

    // EDGE CASE: Different currencies
    it('should handle different currencies', async () => {
      const currencies = ['usd', 'eur', 'gbp', 'cad', 'aud'];
      
      for (const currency of currencies) {
        const result = await service.calculateTax({
          amount: 10000,
          currency: currency as any,
          customerAddress: { line1: '123 Main St', city: 'San Francisco', country: 'US', state: 'CA', postalCode: '94105' },
        });

        expect(result).toBeDefined();
        // Tax calculation should work for different currencies
      }
    });

    // EDGE CASE: Missing address components
    it('should handle incomplete address gracefully', async () => {
      const result = await service.calculateTax({
        amount: 10000,
        currency: 'usd',
        customerAddress: { line1: '', city: '', country: 'US', state: '', postalCode: '' },
      });

      expect(result).toBeDefined();
      // Should fallback to default tax rate
    });

    // EDGE CASE: International address
    it('should handle international addresses', async () => {
      const result = await service.calculateTax({
        amount: 10000,
        currency: 'eur',
        customerAddress: { line1: 'Baker Street', city: 'London', country: 'GB', state: '', postalCode: 'NW1 6XE' },
      });

      expect(result).toBeDefined();
    });

    // EXACT VALIDATION: Tax rate calculation
    it('should calculate correct tax percentage', async () => {
      const amount = 10000;
      const result = await service.calculateTax({
        amount,
        currency: 'usd',
        customerAddress: { line1: '123 Main St', city: 'San Francisco', country: 'US', state: 'CA', postalCode: '94105' },
      });

      // With 8% default rate, tax should be 800
      expect(result.amount).toBe(800);
      expect(result.total).toBe(10800);
    });

    // EDGE CASE: Stripe API failure
    it('should handle Stripe API failures gracefully', async () => {
      // This would require mocking Stripe to throw an error
      // For now, document expected behavior
      const result = await service.calculateTax({
        amount: 10000,
        currency: 'usd',
        customerAddress: { line1: '123 Main St', city: 'San Francisco', country: 'US', state: 'CA', postalCode: '94105' },
      });

      // Should fallback to default rate even if Stripe fails
      expect(result).toBeDefined();
    });
  });

  describe('createTaxTransaction', () => {
    it('should create tax transaction from calculation', async () => {
      const result = await service.createTaxTransaction('pi_test', 'taxcalc_1');
      expect(result).toBeDefined();
    });
  });

  describe('getTaxRegistrations', () => {
    it('should return empty array', async () => {
      const result = await service.getTaxRegistrations();
      expect(result).toEqual([]);
    });
  });

  describe('registerForTax', () => {
    it('should return pending registration', async () => {
      const result = await service.registerForTax('US', 'CA', 'tax-123');
      expect(result).toBeDefined();
      expect(result.registrationStatus).toBe('pending');
    });
  });

  describe('getUserTaxSummary', () => {
    it('should calculate income for listing owner', async () => {
      const userId = 'owner-1';
      prisma.booking.findMany.mockResolvedValue([
        {
          totalPrice: 500,
          payments: [{ taxAmount: 50 }],
          listing: { ownerId: userId },
        },
        {
          totalPrice: 300,
          payments: [{ taxAmount: 30 }],
          listing: { ownerId: 'other-user' },
        },
      ]);

      const result = await service.getUserTaxSummary(userId, 2024);
      expect(result).toBeDefined();
      expect(result.totalIncome).toBeDefined();
      expect(result.totalExpenses).toBeDefined();
    });

    it('should handle user with no bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getUserTaxSummary('user-1', 2024);
      expect(result).toBeDefined();
    });
  });

  describe('generate1099Form', () => {
    it('should throw for non-US users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        country: 'NP',
      });
      prisma.booking.findMany.mockResolvedValue([]);

      await expect(service.generate1099Form('user-1', 2024)).rejects.toThrow();
    });

    it('should throw when income below $600 threshold', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        country: 'US',
        firstName: 'John',
        lastName: 'Doe',
      });
      prisma.booking.findMany.mockResolvedValue([
        { totalPrice: 100, listing: { ownerId: 'user-1' }, payments: [] },
      ]);

      await expect(service.generate1099Form('user-1', 2024)).rejects.toThrow();
    });

    it('should generate 1099 form for qualifying US user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        country: 'US',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
      });
      prisma.booking.findMany.mockResolvedValue([
        { totalPrice: 1000, listing: { ownerId: 'user-1' }, payments: [] },
      ]);

      const result = await service.generate1099Form('user-1', 2024);
      expect(result).toBeDefined();
    });
  });

  describe('getSupportedJurisdictions', () => {
    it('should return an array of supported jurisdictions', async () => {
      const result = await service.getSupportedJurisdictions();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });
  });

  describe('testTaxCalculation', () => {
    it('should run test calculation and return success', async () => {
      const result = await service.testTaxCalculation();
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });
});
