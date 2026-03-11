import { TaxController } from './tax.controller';

describe('TaxController', () => {
  let controller: TaxController;
  let taxService: any;

  beforeEach(() => {
    taxService = {
      calculateTax: jest.fn().mockResolvedValue({
        amount: 800,
        total: 10800,
        rate: 0.08,
      }),
      createTaxTransaction: jest.fn().mockResolvedValue({
        id: 'tx_1',
        status: 'completed',
      }),
      getTaxRegistrations: jest.fn().mockResolvedValue([]),
      registerForTax: jest.fn().mockResolvedValue({
        registrationStatus: 'pending',
      }),
      getUserTaxSummary: jest.fn().mockResolvedValue({
        totalIncome: 5000,
        totalTax: 400,
      }),
      generate1099Form: jest.fn().mockResolvedValue({
        formUrl: 'https://example.com/1099.pdf',
      }),
      getSupportedJurisdictions: jest.fn().mockResolvedValue([
        { code: 'CA', name: 'California' },
      ]),
      testTaxCalculation: jest.fn().mockResolvedValue({
        success: true,
      }),
    };

    controller = new TaxController(taxService);
  });

  describe('calculateTax', () => {
    it('should calculate tax for given amount', async () => {
      const data = { amount: 10000, currency: 'USD' };
      const result = await controller.calculateTax(data);

      expect(result).toBeDefined();
      expect(taxService.calculateTax).toHaveBeenCalledWith(data);
    });
  });

  describe('createTaxTransaction', () => {
    it('should create tax transaction', async () => {
      const data = { paymentIntentId: 'pi_test' };
      const result = await controller.createTaxTransaction(data);

      expect(result).toBeDefined();
      expect(taxService.createTaxTransaction).toHaveBeenCalled();
    });
  });

  describe('getTaxRegistrations', () => {
    it('should return registrations', async () => {
      const result = await controller.getTaxRegistrations();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('registerForTax', () => {
    it('should register for tax', async () => {
      const data = { country: 'US', state: 'CA' };
      const result = await controller.registerForTax(data);

      expect(result.registrationStatus).toBe('pending');
    });
  });

  describe('getUserTaxSummary', () => {
    it('should return user tax summary', async () => {
      const result = await controller.getUserTaxSummary('user-1', 'user-1');

      expect(result).toBeDefined();
      expect(taxService.getUserTaxSummary).toHaveBeenCalledWith('user-1', undefined);
    });

    it('should pass year parameter', async () => {
      await controller.getUserTaxSummary('user-1', 'user-1', 2024);

      expect(taxService.getUserTaxSummary).toHaveBeenCalledWith('user-1', 2024);
    });

    it('should throw ForbiddenException when accessing another user tax summary', async () => {
      await expect(controller.getUserTaxSummary('user-1', 'user-2')).rejects.toThrow('Cannot access another user\'s tax summary');
    });
  });

  describe('generate1099Form', () => {
    it('should generate 1099 form', async () => {
      const data = { userId: 'user-1', year: 2024 };
      const result = await controller.generate1099Form('user-1', data);

      expect(result).toBeDefined();
      expect(taxService.generate1099Form).toHaveBeenCalledWith('user-1', 2024);
    });

    it('should throw ForbiddenException when generating form for another user', async () => {
      const data = { userId: 'user-2', year: 2024 };
      await expect(controller.generate1099Form('user-1', data)).rejects.toThrow('Cannot generate tax form for another user');
    });
  });

  describe('getSupportedJurisdictions', () => {
    it('should return jurisdictions', async () => {
      const result = await controller.getSupportedJurisdictions();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('testTaxCalculation', () => {
    it('should run test calculation', async () => {
      const result = await controller.testTaxCalculation();

      expect(result.success).toBe(true);
    });
  });
});
