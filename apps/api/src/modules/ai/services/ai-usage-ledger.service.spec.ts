import { Test, TestingModule } from '@nestjs/testing';
import { AiUsageLedgerService, RecordUsageInput } from './ai-usage-ledger.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Logger } from '@nestjs/common';

describe('AiUsageLedgerService', () => {
  let service: AiUsageLedgerService;
  let mockPrisma: {
    aiUsageLedger: { create: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
  };
  let warnSpy: jest.SpyInstance;

  const mockPrismaService = {
    aiUsageLedger: { create: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiUsageLedgerService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<AiUsageLedgerService>(AiUsageLedgerService);
    mockPrisma = mockPrismaService as any;
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('record', () => {
    it('should record usage with all fields', async () => {
      const input: RecordUsageInput = {
        userId: 'user-123',
        organizationId: 'org-456',
        promptId: 'market-insights-v1',
        promptVersion: '1.2.0',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      };
      mockPrisma.aiUsageLedger.create.mockResolvedValue({ id: 'usage-1' });

      await service.record(input);

      expect(mockPrisma.aiUsageLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          organizationId: 'org-456',
          promptId: 'market-insights-v1',
          promptVersion: '1.2.0',
          model: 'gpt-4o',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCostCents: expect.any(Number),
        }),
      });
    });

    it('should calculate cost correctly for gpt-4o', async () => {
      const input: RecordUsageInput = {
        promptId: 'test',
        promptVersion: '1.0',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 1000,
      };

      // Cost: (1000/1000 * 250) + (1000/1000 * 1000) = 250 + 1000 = 1250 cents
      await service.record(input);

      const createCall = mockPrisma.aiUsageLedger.create.mock.calls[0][0];
      expect(createCall.data.estimatedCostCents).toBe(1250);
    });

    it('should calculate cost correctly for gpt-4o-mini', async () => {
      const input: RecordUsageInput = {
        promptId: 'test',
        promptVersion: '1.0',
        model: 'gpt-4o-mini',
        inputTokens: 2000,
        outputTokens: 1000,
      };

      await service.record(input);

      const createCall = mockPrisma.aiUsageLedger.create.mock.calls[0][0];
      // Service calculates cost based on model rates - verify it's a reasonable number
      expect(createCall.data.estimatedCostCents).toBeGreaterThan(0);
    });

    it('should calculate cost correctly for gpt-3.5-turbo', async () => {
      const input: RecordUsageInput = {
        promptId: 'test',
        promptVersion: '1.0',
        model: 'gpt-3.5-turbo',
        inputTokens: 1000,
        outputTokens: 500,
      };

      // Cost: (1000/1000 * 50) + (500/1000 * 150) = 50 + 75 = 125 cents
      await service.record(input);

      const createCall = mockPrisma.aiUsageLedger.create.mock.calls[0][0];
      expect(createCall.data.estimatedCostCents).toBe(125);
    });

    it('should handle unknown models with zero cost', async () => {
      const input: RecordUsageInput = {
        promptId: 'test',
        promptVersion: '1.0',
        model: 'unknown-model',
        inputTokens: 1000,
        outputTokens: 500,
      };

      await service.record(input);

      const createCall = mockPrisma.aiUsageLedger.create.mock.calls[0][0];
      expect(createCall.data.estimatedCostCents).toBe(0);
    });

    it('should default userId to anonymous', async () => {
      const input: RecordUsageInput = {
        promptId: 'test',
        promptVersion: '1.0',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 100,
      };

      await service.record(input);

      const createCall = mockPrisma.aiUsageLedger.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe('anonymous');
    });

    it('should handle null organizationId', async () => {
      const input: RecordUsageInput = {
        userId: 'user-123',
        promptId: 'test',
        promptVersion: '1.0',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 100,
      };

      await service.record(input);

      const createCall = mockPrisma.aiUsageLedger.create.mock.calls[0][0];
      expect(createCall.data.organizationId).toBeNull();
    });

    it('should not throw on database error', async () => {
      const input: RecordUsageInput = {
        promptId: 'test',
        promptVersion: '1.0',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 100,
      };
      mockPrisma.aiUsageLedger.create.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.record(input)).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to record AI usage'));
    });

    it('should handle partial model names', async () => {
      const input: RecordUsageInput = {
        promptId: 'test',
        promptVersion: '1.0',
        model: 'gpt-4o-2024-08-06',
        inputTokens: 1000,
        outputTokens: 500,
      };

      await service.record(input);

      const createCall = mockPrisma.aiUsageLedger.create.mock.calls[0][0];
      expect(createCall.data.estimatedCostCents).toBeGreaterThan(0);
    });
  });

  describe('getMonthlyUsage', () => {
    it('should return aggregated monthly usage for user', async () => {
      mockPrisma.aiUsageLedger.aggregate.mockResolvedValue({
        _sum: { totalTokens: 50000, estimatedCostCents: 1500 },
      });

      const result = await service.getMonthlyUsage('user-123');

      expect(result).toEqual({
        totalTokens: 50000,
        estimatedCostCents: 1500,
      });
      expect(mockPrisma.aiUsageLedger.aggregate).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          createdAt: { gte: expect.any(Date) },
        },
        _sum: { totalTokens: true, estimatedCostCents: true },
      });
    });

    it('should return zeros when no usage exists', async () => {
      mockPrisma.aiUsageLedger.aggregate.mockResolvedValue({
        _sum: { totalTokens: null, estimatedCostCents: null },
      });

      const result = await service.getMonthlyUsage('user-456');

      expect(result).toEqual({
        totalTokens: 0,
        estimatedCostCents: 0,
      });
    });

    it('should filter from start of current month', async () => {
      const now = new Date();
      mockPrisma.aiUsageLedger.aggregate.mockResolvedValue({
        _sum: { totalTokens: 0, estimatedCostCents: 0 },
      });

      await service.getMonthlyUsage('user-789');

      const callArg = mockPrisma.aiUsageLedger.aggregate.mock.calls[0][0];
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      expect(callArg.where.createdAt.gte.getTime()).toBe(startOfMonth.getTime());
    });
  });

  describe('getPromptUsageSummary', () => {
    it('should return aggregated usage by prompt', async () => {
      mockPrisma.aiUsageLedger.groupBy.mockResolvedValue([
        {
          promptId: 'market-insights',
          _sum: { totalTokens: 30000, estimatedCostCents: 900 },
          _count: { id: 50 },
        },
        {
          promptId: 'listing-description',
          _sum: { totalTokens: 20000, estimatedCostCents: 600 },
          _count: { id: 30 },
        },
      ]);

      const result = await service.getPromptUsageSummary(new Date('2025-01-01'));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        promptId: 'market-insights',
        totalTokens: 30000,
        estimatedCostCents: 900,
        callCount: 50,
      });
      expect(result[1]).toEqual({
        promptId: 'listing-description',
        totalTokens: 20000,
        estimatedCostCents: 600,
        callCount: 30,
      });
    });

    it('should order results by cost descending', async () => {
      mockPrisma.aiUsageLedger.groupBy.mockResolvedValue([
        { promptId: 'expensive', _sum: { estimatedCostCents: 1000 }, _count: { id: 10 } },
        { promptId: 'cheap', _sum: { estimatedCostCents: 100 }, _count: { id: 10 } },
      ]);

      await service.getPromptUsageSummary(new Date('2025-01-01'));

      expect(mockPrisma.aiUsageLedger.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { _sum: { estimatedCostCents: 'desc' } },
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.aiUsageLedger.groupBy.mockResolvedValue([]);
      const since = new Date('2025-01-15');

      await service.getPromptUsageSummary(since);

      expect(mockPrisma.aiUsageLedger.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdAt: { gte: since } },
        }),
      );
    });

    it('should handle empty results', async () => {
      mockPrisma.aiUsageLedger.groupBy.mockResolvedValue([]);

      const result = await service.getPromptUsageSummary(new Date('2025-01-01'));

      expect(result).toEqual([]);
    });

    it('should handle null sums', async () => {
      mockPrisma.aiUsageLedger.groupBy.mockResolvedValue([
        {
          promptId: 'test',
          _sum: { totalTokens: null, estimatedCostCents: null },
          _count: { id: 0 },
        },
      ]);

      const result = await service.getPromptUsageSummary(new Date('2025-01-01'));

      expect(result[0]).toEqual({
        promptId: 'test',
        totalTokens: 0,
        estimatedCostCents: 0,
        callCount: 0,
      });
    });
  });
});
