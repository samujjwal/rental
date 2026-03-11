import { Test, TestingModule } from '@nestjs/testing';
import { TaxPolicyController } from './tax-policy.controller';
import { TaxPolicyEngineService } from '../services/tax-policy-engine.service';

describe('TaxPolicyController', () => {
  let controller: TaxPolicyController;
  let taxEngine: jest.Mocked<TaxPolicyEngineService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxPolicyController],
      providers: [
        {
          provide: TaxPolicyEngineService,
          useValue: {
            upsertTaxPolicy: jest.fn(),
            getApplicablePolicies: jest.fn(),
            calculateTax: jest.fn(),
            updatePolicyVersion: jest.fn(),
            getPolicyHistory: jest.fn(),
            seedNepalTaxPolicies: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TaxPolicyController);
    taxEngine = module.get(TaxPolicyEngineService) as jest.Mocked<TaxPolicyEngineService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── upsertPolicy ──

  describe('upsertPolicy', () => {
    it('converts date strings to Date objects', async () => {
      const dto = {
        country: 'NP',
        taxType: 'VAT',
        rate: 13,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      } as any;
      taxEngine.upsertTaxPolicy.mockResolvedValue({ id: 'tp1' } as any);

      const result = await controller.upsertPolicy(dto);

      expect(taxEngine.upsertTaxPolicy).toHaveBeenCalledWith({
        ...dto,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
      });
      expect(result).toEqual({ id: 'tp1' });
    });

    it('handles missing effectiveTo', async () => {
      const dto = { country: 'NP', taxType: 'VAT', rate: 13, effectiveFrom: '2026-01-01' } as any;
      taxEngine.upsertTaxPolicy.mockResolvedValue({ id: 'tp2' } as any);

      await controller.upsertPolicy(dto);

      expect(taxEngine.upsertTaxPolicy).toHaveBeenCalledWith({
        ...dto,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: undefined,
      });
    });

    it('propagates service error', async () => {
      taxEngine.upsertTaxPolicy.mockRejectedValue(new Error('Invalid policy'));
      await expect(controller.upsertPolicy({ effectiveFrom: 'bad' } as any)).rejects.toThrow('Invalid policy');
    });
  });

  // ── getApplicable ──

  describe('getApplicable', () => {
    it('delegates country and region to service', async () => {
      taxEngine.getApplicablePolicies.mockResolvedValue([{ id: 'tp1' }] as any);

      const result = await controller.getApplicable('NP', 'bagmati');

      expect(taxEngine.getApplicablePolicies).toHaveBeenCalledWith('NP', 'bagmati');
      expect(result).toEqual([{ id: 'tp1' }]);
    });

    it('handles missing region', async () => {
      taxEngine.getApplicablePolicies.mockResolvedValue([] as any);

      await controller.getApplicable('NP');

      expect(taxEngine.getApplicablePolicies).toHaveBeenCalledWith('NP', undefined);
    });
  });

  // ── calculateTax ──

  describe('calculateTax', () => {
    it('delegates dto fields with optional date conversion', async () => {
      const dto = { country: 'NP', amount: 1000, region: 'bagmati', date: '2026-06-15' } as any;
      taxEngine.calculateTax.mockResolvedValue({ tax: 130 } as any);

      const result = await controller.calculateTax(dto);

      expect(taxEngine.calculateTax).toHaveBeenCalledWith('NP', 1000, {
        region: 'bagmati',
        date: new Date('2026-06-15'),
      });
      expect(result).toEqual({ tax: 130 });
    });

    it('handles missing date', async () => {
      const dto = { country: 'NP', amount: 1000 } as any;
      taxEngine.calculateTax.mockResolvedValue({ tax: 130 } as any);

      await controller.calculateTax(dto);

      expect(taxEngine.calculateTax).toHaveBeenCalledWith('NP', 1000, {
        region: undefined,
        date: undefined,
      });
    });
  });

  // ── updateVersion ──

  describe('updateVersion', () => {
    it('converts effectiveFrom to Date', async () => {
      const dto = { newRate: 15, effectiveFrom: '2026-07-01' } as any;
      taxEngine.updatePolicyVersion.mockResolvedValue({ version: 2 } as any);

      const result = await controller.updateVersion('tp1', dto);

      expect(taxEngine.updatePolicyVersion).toHaveBeenCalledWith('tp1', 15, new Date('2026-07-01'));
      expect(result).toEqual({ version: 2 });
    });
  });

  // ── getPolicyHistory ──

  describe('getPolicyHistory', () => {
    it('delegates country and taxType to service', async () => {
      taxEngine.getPolicyHistory.mockResolvedValue([{ version: 1 }] as any);

      const result = await controller.getPolicyHistory('NP', 'VAT');

      expect(taxEngine.getPolicyHistory).toHaveBeenCalledWith('NP', 'VAT');
      expect(result).toEqual([{ version: 1 }]);
    });

    it('handles missing taxType', async () => {
      taxEngine.getPolicyHistory.mockResolvedValue([] as any);

      await controller.getPolicyHistory('NP');

      expect(taxEngine.getPolicyHistory).toHaveBeenCalledWith('NP', undefined);
    });
  });

  // ── seedNepal ──

  describe('seedNepal', () => {
    it('delegates to service', async () => {
      taxEngine.seedNepalTaxPolicies.mockResolvedValue({ seeded: 3 } as any);

      const result = await controller.seedNepal();

      expect(taxEngine.seedNepalTaxPolicies).toHaveBeenCalled();
      expect(result).toEqual({ seeded: 3 });
    });

    it('propagates service error', async () => {
      taxEngine.seedNepalTaxPolicies.mockRejectedValue(new Error('Seed failed'));
      await expect(controller.seedNepal()).rejects.toThrow('Seed failed');
    });
  });
});
