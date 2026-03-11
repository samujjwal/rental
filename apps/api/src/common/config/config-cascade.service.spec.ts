import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigCascadeService, ResolvedConfig } from './config-cascade.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

describe('ConfigCascadeService', () => {
  let service: ConfigCascadeService;
  let prisma: any;
  let cache: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      userPreferences: { findUnique: jest.fn() },
      organizationMember: { findFirst: jest.fn() },
      countryConfig: { findUnique: jest.fn() },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        const map: Record<string, string> = {
          'platform.defaultLocale': 'en',
          'platform.defaultCurrency': 'USD',
          'platform.defaultTimezone': 'UTC',
        };
        return map[key] ?? defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigCascadeService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ConfigCascadeService>(ConfigCascadeService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('resolve', () => {
    it('should return env defaults when no userId is provided', async () => {
      const result = await service.resolve();
      expect(result).toEqual({ locale: 'en', currency: 'USD', timezone: 'UTC' });
    });

    it('should respect requestLocale over all other locale sources', async () => {
      const result = await service.resolve(undefined, 'ne');
      expect(result.locale).toBe('ne');
    });

    it('should return cached config if available', async () => {
      cache.get.mockResolvedValueOnce({ locale: 'ne', currency: 'NPR', timezone: 'Asia/Kathmandu' });

      const result = await service.resolve('user-1');
      expect(result.locale).toBe('ne');
      expect(result.currency).toBe('NPR');
      expect(prisma.userPreferences.findUnique).not.toHaveBeenCalled();
    });

    it('should merge org config from CountryConfig DB table', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.organizationMember.findFirst.mockResolvedValue({
        organization: { country: 'NP' },
      });
      prisma.countryConfig.findUnique.mockResolvedValue({
        defaultLocale: 'ne',
        defaultCurrency: 'NPR',
        defaultTimezone: 'Asia/Kathmandu',
      });

      const result = await service.resolve('user-1');

      expect(prisma.countryConfig.findUnique).toHaveBeenCalledWith({
        where: { code: 'NP' },
        select: { defaultLocale: true, defaultCurrency: true, defaultTimezone: true },
      });
      expect(result.currency).toBe('NPR');
      expect(result.timezone).toBe('Asia/Kathmandu');
    });

    it('should prioritize user prefs over org defaults', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue({
        language: 'fr',
        currency: 'EUR',
        timezone: 'Europe/Paris',
      });
      prisma.organizationMember.findFirst.mockResolvedValue({
        organization: { country: 'NP' },
      });
      prisma.countryConfig.findUnique.mockResolvedValue({
        defaultLocale: 'ne',
        defaultCurrency: 'NPR',
        defaultTimezone: 'Asia/Kathmandu',
      });

      const result = await service.resolve('user-1');
      expect(result.locale).toBe('fr');
      expect(result.currency).toBe('EUR');
      expect(result.timezone).toBe('Europe/Paris');
    });

    it('should fall back to env defaults when CountryConfig is not found', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.organizationMember.findFirst.mockResolvedValue({
        organization: { country: 'XX' },
      });
      prisma.countryConfig.findUnique.mockResolvedValue(null);

      const result = await service.resolve('user-1');
      expect(result.locale).toBe('en');
      expect(result.currency).toBe('USD');
    });

    it('should cache resolved config', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.organizationMember.findFirst.mockResolvedValue(null);

      await service.resolve('user-1');
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('user-1'),
        expect.objectContaining({ locale: 'en' }),
        300,
      );
    });

    it('should cache country defaults for 1 hour', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.organizationMember.findFirst.mockResolvedValue({
        organization: { country: 'NP' },
      });
      prisma.countryConfig.findUnique.mockResolvedValue({
        defaultLocale: 'ne',
        defaultCurrency: 'NPR',
        defaultTimezone: 'Asia/Kathmandu',
      });

      await service.resolve('user-1');

      // Should have two cache.set calls: one for country, one for user
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('country:NP'),
        expect.objectContaining({ currency: 'NPR' }),
        3600,
      );
    });

    it('should handle cache errors gracefully', async () => {
      cache.get.mockRejectedValue(new Error('Redis down'));
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.organizationMember.findFirst.mockResolvedValue(null);

      // Should not throw
      const result = await service.resolve('user-1');
      expect(result.locale).toBe('en');
    });

    it('should handle DB errors gracefully in org config', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.organizationMember.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await service.resolve('user-1');
      expect(result.locale).toBe('en');
    });
  });

  describe('invalidate', () => {
    it('should delete cache for given user', async () => {
      await service.invalidate('user-1');
      expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('user-1'));
    });

    it('should handle cache errors gracefully', async () => {
      cache.del.mockRejectedValue(new Error('Redis down'));
      // Should not throw
      await expect(service.invalidate('user-1')).resolves.toBeUndefined();
    });
  });
});
