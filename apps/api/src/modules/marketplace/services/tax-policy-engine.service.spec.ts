import { Test, TestingModule } from '@nestjs/testing';
import { TaxPolicyEngineService } from './tax-policy-engine.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PolicyPackLoaderService } from './policy-pack-loader.service';

describe('TaxPolicyEngineService', () => {
  let service: TaxPolicyEngineService;
  let prisma: any;

  const mockPolicy = {
    id: 'tp-1',
    country: 'NP',
    region: null,
    taxType: 'VAT',
    rate: 0.13,
    name: 'Nepal VAT (13%)',
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
    rules: {},
    version: 1,
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      taxPolicy: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tp-new', ...data })),
        findMany: jest.fn().mockResolvedValue([mockPolicy]),
        findUnique: jest.fn().mockResolvedValue(mockPolicy),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ ...mockPolicy, isActive: false }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxPolicyEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: PolicyPackLoaderService, useValue: { getTaxRules: jest.fn().mockReturnValue(null), getPack: jest.fn().mockReturnValue(null) } },
      ],
    }).compile();

    service = module.get<TaxPolicyEngineService>(TaxPolicyEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsertTaxPolicy', () => {
    it('should create a new tax policy', async () => {
      const result = await service.upsertTaxPolicy({
        country: 'NP',
        taxType: 'VAT',
        rate: 0.13,
        name: 'Nepal VAT',
        effectiveFrom: new Date('2024-01-01'),
      });
      expect(result).toBeDefined();
      expect(prisma.taxPolicy.create).toHaveBeenCalled();
    });
  });

  describe('getApplicablePolicies', () => {
    it('should return active policies for a country', async () => {
      const policies = await service.getApplicablePolicies('NP');
      expect(policies.length).toBeGreaterThan(0);
      expect(policies[0].country).toBe('NP');
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax for Nepal transaction', async () => {
      const result = await service.calculateTax('NP', 10000);
      expect(result.subtotal).toBe(10000);
      expect(result.totalTax).toBe(1300); // 13% of 10000
      expect(result.total).toBe(11300);
      expect(result.taxes).toHaveLength(1);
    });

    it('should handle zero amount', async () => {
      const result = await service.calculateTax('NP', 0);
      expect(result.totalTax).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('updatePolicyVersion', () => {
    it('should deactivate old policy and create new version', async () => {
      const result = await service.updatePolicyVersion('tp-1', 0.15, new Date());
      expect(prisma.taxPolicy.update).toHaveBeenCalled();
      expect(prisma.taxPolicy.create).toHaveBeenCalled();
      expect(result.version).toBe(2);
    });

    it('should throw for non-existent policy', async () => {
      prisma.taxPolicy.findUnique.mockResolvedValue(null);
      await expect(service.updatePolicyVersion('bad-id', 0.15, new Date())).rejects.toThrow();
    });
  });

  describe('getPolicyHistory', () => {
    it('should return policy history for a country', async () => {
      const result = await service.getPolicyHistory('NP');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('seedNepalTaxPolicies', () => {
    it('should seed Nepal tax policies', async () => {
      const result = await service.seedNepalTaxPolicies();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
