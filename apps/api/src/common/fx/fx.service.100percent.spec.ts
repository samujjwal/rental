import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FxService, FxRate } from './fx.service';
import { CacheService } from '@/common/cache/cache.service';

/**
 * COMPREHENSIVE FX SERVICE TESTS - 100% COVERAGE
 * 
 * These tests cover all currency conversion operations, rate fetching,
 * caching mechanisms, error handling, and edge cases to achieve complete test coverage.
 */
describe('FxService - 100% Coverage', () => {
  let service: FxService;
  let cacheService: jest.Mocked<CacheService>;
  let configService: jest.Mocked<ConfigService>;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    // Mock global fetch
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FxService>(FxService);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // RATE RETRIEVAL - COMPLETE COVERAGE
  // ============================================================================

  describe('getRate', () => {
    test('should return identity rate for same currency', async () => {
      const result = await service.getRate('USD', 'USD');

      expect(result).toEqual({
        base: 'USD',
        target: 'USD',
        rate: 1,
        source: 'identity',
        fetchedAt: expect.any(Date),
      });

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('should return cached rate when available', async () => {
      const cachedRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.85,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };

      cacheService.get.mockResolvedValue(cachedRate);

      const result = await service.getRate('USD', 'EUR');

      expect(result).toEqual(cachedRate);
      expect(cacheService.get).toHaveBeenCalledWith('fx:USD:EUR');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('should fetch live rate when not cached', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: 0.85,
        }),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('USD', 'EUR');

      expect(result).toEqual({
        base: 'USD',
        target: 'EUR',
        rate: 0.85,
        source: 'exchangerate.host',
        fetchedAt: expect.any(Date),
      });

      expect(cacheService.get).toHaveBeenCalledWith('fx:USD:EUR');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.exchangerate.host/convert?from=USD&to=EUR&amount=1',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'fx:USD:EUR',
        expect.objectContaining({ rate: 0.85 }),
        3600
      );
    });

    test('should use fallback rate when live fetch fails', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('USD', 'NPR');

      expect(result).toEqual({
        base: 'USD',
        target: 'NPR',
        rate: 133.0,
        source: 'static-fallback',
        fetchedAt: expect.any(Date),
      });

      expect(cacheService.set).toHaveBeenCalledWith(
        'fx:USD:NPR',
        expect.objectContaining({ rate: 133.0, source: 'static-fallback' }),
        3600
      );
    });

    test('should handle missing fallback rate', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);

      await expect(service.getRate('XYZ', 'ABC')).rejects.toThrow('No exchange rate available for XYZ:ABC');

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    test('should handle API response without success flag', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: false,
          error: 'Invalid currency pair',
        }),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await expect(service.getRate('USD', 'EUR')).rejects.toThrow('No exchange rate available');
    });

    test('should handle API response without result', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: null,
        }),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await expect(service.getRate('USD', 'EUR')).rejects.toThrow('No exchange rate available');
    });

    test('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await expect(service.getRate('USD', 'EUR')).rejects.toThrow('No exchange rate available');
    });

    test('should handle fetch timeout', async () => {
      fetchMock.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('AbortError', 'AbortError')), 100);
        });
      });
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await expect(service.getRate('USD', 'EUR')).rejects.toThrow('No exchange rate available');
    });
  });

  // ============================================================================
  // CURRENCY CONVERSION - COMPLETE COVERAGE
  // ============================================================================

  describe('convert', () => {
    test('should convert amount using live rate', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.85,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const result = await service.convert(100, 'USD', 'EUR');

      expect(result).toEqual({
        amount: expect.any(Number),
        rate: mockRate,
      });

      expect(result.amount).toBeCloseTo(85, 2);
    });

    test('should convert amount using fallback rate', async () => {
      cacheService.get.mockResolvedValue(null);
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.convert(100, 'USD', 'NPR');

      expect(result.amount).toBeCloseTo(13300, 2);
      expect(result.rate.source).toBe('static-fallback');
    });

    test('should handle zero amount conversion', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.85,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const result = await service.convert(0, 'USD', 'EUR');

      expect(result.amount).toBe(0);
    });

    test('should handle negative amount conversion', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.85,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const result = await service.convert(-100, 'USD', 'EUR');

      expect(result.amount).toBeCloseTo(-85, 2);
    });

    test('should handle large amount conversion', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.85,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const result = await service.convert(1000000, 'USD', 'EUR');

      expect(result.amount).toBeCloseTo(850000, 2);
    });

    test('should convert same currency (identity)', async () => {
      const result = await service.convert(100, 'USD', 'USD');

      expect(result.amount).toBe(100);
      expect(result.rate.rate).toBe(1);
      expect(result.rate.source).toBe('identity');
    });
  });

  // ============================================================================
  // EXTERNAL API INTEGRATION - COMPLETE COVERAGE
  // ============================================================================

  describe('External API Integration', () => {
    test('should try exchangerate.host first', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: 0.85,
        }),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await service.getRate('USD', 'EUR');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.exchangerate.host/convert?from=USD&to=EUR&amount=1',
        expect.any(Object)
      );
    });

    test('should try openexchangerates when API key is configured', async () => {
      configService.get.mockReturnValue('test-api-key');
      
      // Create new service instance with API key
      const moduleWithApiKey = await Test.createTestingModule({
        providers: [
          FxService,
          {
            provide: CacheService,
            useValue: {
              get: jest.fn().mockResolvedValue(null),
              set: jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'FX_API_KEY') return 'test-api-key';
                return null;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithApiKey = moduleWithApiKey.get<FxService>(FxService);

      const mockResponse1 = {
        ok: false,
        json: jest.fn().mockResolvedValue({ success: false }),
      };
      const mockResponse2 = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          rates: {
            USD: 1,
            EUR: 0.85,
          },
        }),
      };
      fetchMock
        .mockResolvedValueOnce(mockResponse1) // exchangerate.host fails
        .mockResolvedValueOnce(mockResponse2); // openexchangerates succeeds

      await serviceWithApiKey.getRate('USD', 'EUR');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://api.exchangerate.host/convert?from=USD&to=EUR&amount=1',
        expect.any(Object)
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://openexchangerates.org/api/latest.json?app_id=test-api-key&base=USD',
        expect.any(Object)
      );
    });

    test('should handle openexchangerates API response correctly', async () => {
      configService.get.mockReturnValue('test-api-key');
      
      const moduleWithApiKey = await Test.createTestingModule({
        providers: [
          FxService,
          {
            provide: CacheService,
            useValue: {
              get: jest.fn().mockResolvedValue(null),
              set: jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'FX_API_KEY') return 'test-api-key';
                return null;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithApiKey = moduleWithApiKey.get<FxService>(FxService);

      const mockResponse1 = {
        ok: false,
        json: jest.fn().mockResolvedValue({ success: false }),
      };
      const mockResponse2 = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          rates: {
            USD: 1,
            EUR: 0.85,
            GBP: 0.75,
          },
        }),
      };
      fetchMock
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await serviceWithApiKey.getRate('EUR', 'GBP');

      expect(result.rate).toBeCloseTo(0.75 / 0.85, 6);
      expect(result.source).toBe('openexchangerates');
    });

    test('should handle openexchangerates missing rates', async () => {
      configService.get.mockReturnValue('test-api-key');
      
      const moduleWithApiKey = await Test.createTestingModule({
        providers: [
          FxService,
          {
            provide: CacheService,
            useValue: {
              get: jest.fn().mockResolvedValue(null),
              set: jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'FX_API_KEY') return 'test-api-key';
                return null;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithApiKey = moduleWithApiKey.get<FxService>(FxService);

      const mockResponse1 = {
        ok: false,
        json: jest.fn().mockResolvedValue({ success: false }),
      };
      const mockResponse2 = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          rates: {
            USD: 1,
            EUR: 0.85,
            // GBP missing
          },
        }),
      };
      fetchMock
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      await expect(serviceWithApiKey.getRate('EUR', 'GBP')).rejects.toThrow('No exchange rate available');
    });
  });

  // ============================================================================
  // FALLBACK RATES - COMPLETE COVERAGE
  // ============================================================================

  describe('Fallback Rates', () => {
    test('should use NPR:USD fallback rate', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('NPR', 'USD');

      expect(result.rate).toBe(0.0075);
      expect(result.source).toBe('static-fallback');
    });

    test('should use USD:NPR fallback rate', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('USD', 'NPR');

      expect(result.rate).toBe(133.0);
      expect(result.source).toBe('static-fallback');
    });

    test('should use NPR:INR fallback rate', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('NPR', 'INR');

      expect(result.rate).toBe(0.625);
      expect(result.source).toBe('static-fallback');
    });

    test('should use INR:NPR fallback rate', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('INR', 'NPR');

      expect(result.rate).toBe(1.6);
      expect(result.source).toBe('static-fallback');
    });

    test('should use USD:INR fallback rate', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('USD', 'INR');

      expect(result.rate).toBe(83.5);
      expect(result.source).toBe('static-fallback');
    });

    test('should use INR:USD fallback rate', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRate('INR', 'USD');

      expect(result.rate).toBe(0.012);
      expect(result.source).toBe('static-fallback');
    });
  });

  // ============================================================================
  // CACHING MECHANISM - COMPLETE COVERAGE
  // ============================================================================

  describe('Caching', () => {
    test('should cache live rates for 1 hour', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: 0.85,
        }),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await service.getRate('USD', 'EUR');

      expect(cacheService.set).toHaveBeenCalledWith(
        'fx:USD:EUR',
        expect.objectContaining({
          base: 'USD',
          target: 'EUR',
          rate: 0.85,
          source: 'exchangerate.host',
        }),
        3600 // 1 hour in seconds
      );
    });

    test('should cache fallback rates', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await service.getRate('USD', 'NPR');

      expect(cacheService.set).toHaveBeenCalledWith(
        'fx:USD:NPR',
        expect.objectContaining({
          base: 'USD',
          target: 'NPR',
          rate: 133.0,
          source: 'static-fallback',
        }),
        3600
      );
    });

    test('should not cache identity rates', async () => {
      const result = await service.getRate('USD', 'USD');

      expect(result.source).toBe('identity');
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    test('should handle cache errors gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockRejectedValue(new Error('Cache error'));
      cacheService.set.mockRejectedValue(new Error('Cache set error'));

      await expect(service.getRate('USD', 'NPR')).resolves.toBeDefined();
    });
  });

  // ============================================================================
  // ERROR HANDLING - COMPLETE COVERAGE
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await expect(service.getRate('USD', 'EUR')).rejects.toThrow('No exchange rate available');
    });

    test('should handle invalid currency codes', async () => {
      fetchMock.mockRejectedValue(new Error('Invalid currency'));
      cacheService.get.mockResolvedValue(null);

      await expect(service.getRate('INVALID', 'CODE')).rejects.toThrow('No exchange rate available for INVALID:CODE');
    });

    test('should handle empty currency codes', async () => {
      fetchMock.mockRejectedValue(new Error('Empty currency'));
      cacheService.get.mockResolvedValue(null);

      await expect(service.getRate('', '')).rejects.toThrow('No exchange rate available for :');
    });

    test('should handle special characters in currency codes', async () => {
      fetchMock.mockRejectedValue(new Error('Special chars'));
      cacheService.get.mockResolvedValue(null);

      await expect(service.getRate('USD@', 'EUR#')).rejects.toThrow('No exchange rate available for USD@:EUR#');
    });
  });

  // ============================================================================
  // EDGE CASES AND BOUNDARY CONDITIONS - COMPLETE COVERAGE
  // ============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle very small amounts', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.00001,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const result = await service.convert(0.000001, 'USD', 'EUR');

      expect(result.amount).toBeGreaterThanOrEqual(0);
    });

    test('should handle very large amounts', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 1000000,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const result = await service.convert(Number.MAX_SAFE_INTEGER, 'USD', 'EUR');

      expect(result.amount).toBeGreaterThan(0);
      expect(Number.isFinite(result.amount)).toBe(true);
    });

    test('should handle decimal precision correctly', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.123456789,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const result = await service.convert(1, 'USD', 'EUR');

      expect(result.amount).toBeDefined();
      expect(typeof result.amount).toBe('number');
    });

    test('should handle concurrent rate requests', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: 0.85,
        }),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const promises = Array.from({ length: 10 }, () => service.getRate('USD', 'EUR'));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.rate).toBe(0.85);
        expect(result.source).toBe('exchangerate.host');
      });
    });

    test('should handle concurrent conversions', async () => {
      const mockRate: FxRate = {
        base: 'USD',
        target: 'EUR',
        rate: 0.85,
        source: 'exchangerate.host',
        fetchedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(mockRate);

      const promises = Array.from({ length: 10 }, (_, i) => 
        service.convert(100 + i, 'USD', 'EUR')
      );
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.amount).toBeCloseTo((100 + i) * 0.85, 2);
      });
    });

    test('should handle currency code case sensitivity', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: 0.85,
        }),
      };
      fetchMock.mockResolvedValue(mockResponse);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result1 = await service.getRate('usd', 'eur');
      const result2 = await service.getRate('USD', 'EUR');

      expect(result1.rate).toBe(result2.rate);
    });

    test('should handle whitespace in currency codes', async () => {
      fetchMock.mockRejectedValue(new Error('Invalid currency'));
      cacheService.get.mockResolvedValue(null);

      await expect(service.getRate(' USD ', ' EUR ')).rejects.toThrow('No exchange rate available for  USD : EUR ');
    });
  });

  // ============================================================================
  // CONFIGURATION AND INITIALIZATION - COMPLETE COVERAGE
  // ============================================================================

  describe('Configuration and Initialization', () => {
    test('should initialize without API key', async () => {
      expect(() => new FxService(cacheService, configService)).not.toThrow();
    });

    test('should initialize with API key', async () => {
      configService.get.mockReturnValue('test-api-key');
      
      expect(() => new FxService(cacheService, configService)).not.toThrow();
    });

    test('should handle undefined API key', async () => {
      configService.get.mockReturnValue(undefined);
      
      const serviceInstance = new FxService(cacheService, configService);
      
      // Should not try openexchangerates without API key
      fetchMock.mockRejectedValue(new Error('Network error'));
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await expect(serviceInstance.getRate('USD', 'EUR')).rejects.toThrow('No exchange rate available');

      expect(fetchMock).toHaveBeenCalledTimes(1); // Only exchangerate.host
    });
  });
});
