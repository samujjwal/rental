import { Test, TestingModule } from '@nestjs/testing';
import { FxRateService } from './fx-rate.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';

describe('FxRateService - Currency Conversion Tests', () => {
  let service: FxRateService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockFxRate = {
    id: 'rate-1',
    baseCurrency: 'USD',
    targetCurrency: 'EUR',
    rate: 0.85,
    source: 'ECB',
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      fxRateSnapshot: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('https://api.exchangerate.host'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxRateService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FxRateService>(FxRateService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('FX Rate Snapshot Creation', () => {
    it('should create snapshot at quote time', async () => {
      (prismaService.fxRateSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        quoteId: 'quote-1',
      });

      const result = await service.createSnapshot({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        quoteId: 'quote-1',
      });

      expect(result).toBeDefined();
      expect(result.rate).toBe(0.85);
    });

    it('should capture rate at exact moment of transaction', async () => {
      const before = Date.now();

      (prismaService.fxRateSnapshot.create as jest.Mock).mockImplementation((args) => ({
        id: 'snapshot-1',
        ...args.data,
        createdAt: new Date(),
      }));

      const result = await service.createSnapshot({
        baseCurrency: 'USD',
        targetCurrency: 'GBP',
        rate: 0.73,
        quoteId: 'quote-2',
      });

      const after = Date.now();

      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('Currency Conversion Precision', () => {
    it('should convert USD to EUR correctly', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(0.85);

      const result = await service.convert(100, 'USD', 'EUR');

      expect(result.amount).toBe(85);
      expect(result.from).toBe('USD');
      expect(result.to).toBe('EUR');
      expect(result.rate).toBe(0.85);
    });

    it('should handle same currency conversion', async () => {
      const result = await service.convert(100, 'USD', 'USD');

      expect(result.amount).toBe(100);
      expect(result.rate).toBe(1);
    });

    it('should handle floating point precision', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(0.853421);

      const result = await service.convert(99.99, 'USD', 'EUR');

      expect(result.amount).toBeCloseTo(85.33, 2);
    });

    it('should handle very small amounts', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(0.85);

      const result = await service.convert(0.01, 'USD', 'EUR');

      expect(result.amount).toBeGreaterThan(0);
    });

    it('should handle very large amounts', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(0.85);

      const result = await service.convert(1000000, 'USD', 'EUR');

      expect(result.amount).toBe(850000);
    });

    it('should round to 2 decimal places for display', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(0.853421);

      const result = await service.convert(100, 'USD', 'EUR', { precision: 2 });

      expect(result.amount).toBe(85.34);
    });

    it('should handle JPY (zero decimal currency)', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(110.5);

      const result = await service.convert(100, 'USD', 'JPY', { precision: 0 });

      expect(result.amount).toBe(11050);
    });
  });

  describe('Multiple Currency Contexts (ADR-003)', () => {
    it('should handle listing currency context', async () => {
      (prismaService.fxRateSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-listing',
        context: 'LISTING',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
      });

      const result = await service.createSnapshot({
        context: 'LISTING',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
      });

      expect(result.context).toBe('LISTING');
    });

    it('should handle transaction currency context', async () => {
      (prismaService.fxRateSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-transaction',
        context: 'TRANSACTION',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        paymentIntentId: 'pi_123',
      });

      const result = await service.createSnapshot({
        context: 'TRANSACTION',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        paymentIntentId: 'pi_123',
      });

      expect(result.context).toBe('TRANSACTION');
    });

    it('should handle display currency context', async () => {
      (prismaService.fxRateSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-display',
        context: 'DISPLAY',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        userId: 'user-1',
      });

      const result = await service.createSnapshot({
        context: 'DISPLAY',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        userId: 'user-1',
      });

      expect(result.context).toBe('DISPLAY');
    });

    it('should handle settlement currency context', async () => {
      (prismaService.fxRateSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-settlement',
        context: 'SETTLEMENT',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        payoutId: 'po_123',
      });

      const result = await service.createSnapshot({
        context: 'SETTLEMENT',
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.85,
        payoutId: 'po_123',
      });

      expect(result.context).toBe('SETTLEMENT');
    });
  });

  describe('Rate Expiration and Staleness', () => {
    it('should reject expired rates', async () => {
      const expiredRate = {
        ...mockFxRate,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      (prismaService.fxRateSnapshot.findUnique as jest.Mock).mockResolvedValue(expiredRate);

      const result = await service.getRate('snapshot-expired');

      expect(result.isStale).toBe(true);
    });

    it('should flag rates nearing expiration', async () => {
      const nearExpiryRate = {
        ...mockFxRate,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes left
      };

      (prismaService.fxRateSnapshot.findUnique as jest.Mock).mockResolvedValue(nearExpiryRate);

      const result = await service.getRate('snapshot-near-expiry');

      expect(result.isExpiringSoon).toBe(true);
    });

    it('should fetch fresh rate when cached rate is stale', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, result: 0.86 }),
      } as any);

      const result = await service.getCurrentRate('USD', 'EUR');

      expect(result).toBe(0.86);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported currency pairs', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      global.fetch = jest.fn().mockRejectedValue(new Error('Unsupported currency'));

      await expect(service.convert(100, 'USD', 'XYZ')).rejects.toThrow();
    });

    it('should handle rate fetch failures', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      } as any);

      await expect(service.getCurrentRate('USD', 'EUR')).rejects.toThrow();
    });

    it('should use fallback rate when primary source fails', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      // Mock primary source to fail
      jest
        .spyOn(service as any, 'fetchRateFromApi')
        .mockRejectedValueOnce(new Error('Primary source down'));

      // Mock fallback to succeed
      jest.spyOn(service as any, 'fetchRateFromFallbackApi').mockResolvedValueOnce(0.85);

      const result = await service.getCurrentRateWithFallback('USD', 'EUR');

      expect(result).toBe(0.85);
    });
  });

  describe('Historical Rate Lookup', () => {
    it('should retrieve historical rate for date', async () => {
      const historicalDate = new Date('2024-01-01');

      (prismaService.fxRateSnapshot.findFirst as jest.Mock).mockResolvedValue({
        ...mockFxRate,
        fetchedAt: historicalDate,
      });

      const result = await service.getHistoricalRate('USD', 'EUR', historicalDate);

      expect(result).toBeDefined();
      expect(prismaService.fxRateSnapshot.findFirst).toHaveBeenCalledWith({
        where: {
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          capturedAt: { lte: historicalDate },
        },
        orderBy: { capturedAt: 'desc' },
      });
    });
  });
});
