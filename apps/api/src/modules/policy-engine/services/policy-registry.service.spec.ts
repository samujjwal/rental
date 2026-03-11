import { Test, TestingModule } from '@nestjs/testing';
import { PolicyRegistryService } from './policy-registry.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('PolicyRegistryService', () => {
  let service: PolicyRegistryService;
  let prisma: {
    policyRule: { findMany: jest.Mock };
  };
  let cache: jest.Mocked<CacheService>;

  const mockDbRule = (overrides: Record<string, unknown> = {}) => ({
    id: 'rule_np_vat_13',
    type: 'TAX',
    name: 'Nepal Standard VAT',
    description: 'Nepal VAT at 13%',
    country: 'NP',
    state: null,
    city: null,
    jurisdictionPriority: 1,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
    supersedesId: null,
    priority: 100,
    conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
    actions: [{ type: 'SET_RATE', params: { rate: 13.0, taxType: 'VAT', name: 'Nepal VAT' } }],
    status: 'ACTIVE',
    tags: ['vat', 'nepal'],
    metadata: {},
    createdById: null,
    approvedById: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      policyRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyRegistryService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<PolicyRegistryService>(PolicyRegistryService);
    cache = module.get(CacheService);
  });

  describe('findActiveRules', () => {
    it('queries DB when cache is empty', async () => {
      prisma.policyRule.findMany.mockResolvedValue([mockDbRule()]);
      const rules = await service.findActiveRules('TAX', 'NP');

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('rule_np_vat_13');
      expect(rules[0].type).toBe('TAX');
      expect(rules[0].country).toBe('NP');
      expect(prisma.policyRule.findMany).toHaveBeenCalledTimes(1);
    });

    it('caches rules after first DB query', async () => {
      prisma.policyRule.findMany.mockResolvedValue([mockDbRule()]);

      // First call — hits DB
      await service.findActiveRules('TAX', 'NP');
      expect(prisma.policyRule.findMany).toHaveBeenCalledTimes(1);

      // Second call — should hit L1 cache, not DB
      const rules = await service.findActiveRules('TAX', 'NP');
      expect(rules).toHaveLength(1);
      expect(prisma.policyRule.findMany).toHaveBeenCalledTimes(1); // Still 1
    });

    it('uses Redis cache when L1 cache misses', async () => {
      // Redis JSON serialization converts Date objects to ISO strings
      const cachedRule = {
        id: 'rule_np_vat_13',
        type: 'TAX',
        name: 'Nepal Standard VAT',
        description: 'Nepal VAT at 13%',
        country: 'NP',
        state: null,
        city: null,
        jurisdictionPriority: 1,
        version: 1,
        effectiveFrom: '2024-01-01T00:00:00.000Z',
        effectiveTo: null,
        supersedesId: null,
        priority: 100,
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [{ type: 'SET_RATE', params: { rate: 13.0 } }],
        status: 'ACTIVE',
        tags: ['vat'],
        metadata: {},
      };

      cache.get.mockResolvedValue([cachedRule]);

      const rules = await service.findActiveRules('TAX', 'NP');

      expect(rules).toHaveLength(1);
      expect(cache.get).toHaveBeenCalled();
      expect(prisma.policyRule.findMany).not.toHaveBeenCalled(); // Didn't hit DB
    });

    it('filters by effective date', async () => {
      const futureRule = mockDbRule({
        id: 'rule_future',
        effectiveFrom: new Date('2030-01-01'),
        effectiveTo: null,
      });
      const currentRule = mockDbRule({
        id: 'rule_current',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
      });
      const expiredRule = mockDbRule({
        id: 'rule_expired',
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: new Date('2023-12-31'),
      });

      prisma.policyRule.findMany.mockResolvedValue([futureRule, currentRule, expiredRule]);
      const rules = await service.findActiveRules('TAX', 'NP');

      // Only currentRule should be returned (futureRule not effective yet, expiredRule expired)
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('rule_current');
    });

    it('includes global (*) rules alongside country-specific', async () => {
      const globalRule = mockDbRule({
        id: 'rule_global',
        country: '*',
        jurisdictionPriority: 0,
      });
      const nepalRule = mockDbRule({
        id: 'rule_np',
        country: 'NP',
        jurisdictionPriority: 1,
      });

      prisma.policyRule.findMany.mockResolvedValue([nepalRule, globalRule]);
      const rules = await service.findActiveRules('TAX', 'NP');

      expect(rules).toHaveLength(2);
    });

    it('queries with state and city scoping', async () => {
      prisma.policyRule.findMany.mockResolvedValue([]);
      await service.findActiveRules('TAX', 'US', 'CA', 'San Francisco');

      // Verify query included state and city conditions
      const queryArg = prisma.policyRule.findMany.mock.calls[0][0];
      expect(queryArg.where.OR).toBeDefined();
      expect(queryArg.where.OR.length).toBe(4); // global, country, state, city
    });
  });

  describe('invalidateCache', () => {
    it('clears L1 cache entries for a given type and country', async () => {
      prisma.policyRule.findMany.mockResolvedValue([mockDbRule()]);

      // Populate cache
      await service.findActiveRules('TAX', 'NP');
      expect(prisma.policyRule.findMany).toHaveBeenCalledTimes(1);

      // Invalidate
      await service.invalidateCache('TAX', 'NP');

      // Next call should hit DB again
      await service.findActiveRules('TAX', 'NP');
      expect(prisma.policyRule.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
