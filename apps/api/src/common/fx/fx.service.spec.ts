import { Test, TestingModule } from '@nestjs/testing';
import { FxService } from './fx.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';

describe('FxService', () => {
  let service: FxService;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxService,
        { provide: CacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FxService>(FxService);
    cacheService = module.get(CacheService);
  });

  describe('getRate', () => {
    it('should return rate=1 for same currency', async () => {
      const fxRate = await service.getRate('NPR', 'NPR');
      expect(fxRate.rate).toBe(1);
      expect(fxRate.source).toBe('identity');
    });

    it('should return a fallback rate for NPR→USD', async () => {
      const fxRate = await service.getRate('NPR', 'USD');
      expect(fxRate.rate).toBeGreaterThan(0);
      expect(fxRate.rate).toBeLessThan(1); // NPR is weaker than USD
      expect(fxRate.source).toBe('static-fallback');
    });

    it('should return a fallback rate for USD→NPR', async () => {
      const fxRate = await service.getRate('USD', 'NPR');
      expect(fxRate.rate).toBeGreaterThan(1); // 1 USD = ~133 NPR
    });

    it('should return a fallback rate for NPR→INR', async () => {
      const fxRate = await service.getRate('NPR', 'INR');
      expect(fxRate.rate).toBeGreaterThan(0);
    });

    it('should use cached rate when available', async () => {
      const cachedRate = { base: 'NPR', target: 'USD', rate: 0.0075, source: 'cached', fetchedAt: new Date() };
      cacheService.get.mockResolvedValueOnce(cachedRate);
      const fxRate = await service.getRate('NPR', 'USD');
      expect(fxRate.rate).toBe(0.0075);
      expect(cacheService.get).toHaveBeenCalledWith('fx:NPR:USD');
    });
  });

  describe('convert', () => {
    it('should convert amount between currencies', async () => {
      const result = await service.convert(1000, 'NPR', 'USD');
      expect(result.amount).toBeGreaterThan(0);
      expect(result.amount).toBeLessThan(1000); // NPR → USD shrinks value
      expect(result.rate).toBeDefined();
    });

    it('should return same amount for same currency', async () => {
      const result = await service.convert(1000, 'NPR', 'NPR');
      expect(result.amount).toBe(1000);
      expect(result.rate.rate).toBe(1);
    });

    it('should handle zero amount', async () => {
      const result = await service.convert(0, 'USD', 'NPR');
      expect(result.amount).toBe(0);
    });
  });
});
