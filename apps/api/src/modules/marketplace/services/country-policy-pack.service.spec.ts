import { Test, TestingModule } from '@nestjs/testing';
import { CountryPolicyPackService } from './country-policy-pack.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PolicyPackLoaderService } from './policy-pack-loader.service';

describe('CountryPolicyPackService', () => {
  let service: CountryPolicyPackService;
  let prisma: any;

  const mockYamlLoader = {
    getPack: jest.fn().mockImplementation((country: string) => {
      if (country === 'US') {
        return {
          general: { country_code: 'US', currency: { code: 'USD' }, languages: ['en'], timezone: 'America/New_York' },
          identity: { kyc_provider: 'stripe_identity', host_verification: { minimum_age: 18 } },
          payments: { supported_methods: ['stripe', 'credit_card', 'bank_transfer'] },
          booking: { max_duration_days: 365, min_duration_hours: 24 },
          tax: { platform_level: [] },
          compliance: { business_registration_required: false },
        };
      }
      return null;
    }),
    getTaxRules: jest.fn().mockReturnValue(null),
    getPaymentConfig: jest.fn().mockReturnValue(null),
    getBookingConstraints: jest.fn().mockReturnValue(null),
    getIdentityRequirements: jest.fn().mockReturnValue(null),
    getComplianceRequirements: jest.fn().mockReturnValue(null),
    getLoadedCountries: jest.fn().mockReturnValue(['US']),
    getAllCountries: jest.fn().mockReturnValue(['US']),
  };

  beforeEach(async () => {
    prisma = {
      countryPolicyPack: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cpp-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cpp-1', version: 2, ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountryPolicyPackService,
        { provide: PrismaService, useValue: prisma },
        { provide: PolicyPackLoaderService, useValue: mockYamlLoader },
      ],
    }).compile();

    service = module.get<CountryPolicyPackService>(CountryPolicyPackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPolicyPack', () => {
    it('should return default Nepal pack when not in DB', async () => {
      const pack = await service.getPolicyPack('NP');
      expect(pack).toBeDefined();
      expect(pack.country).toBe('NP');
      expect(pack.currency).toBe('NPR');
      expect(pack.languages).toContain('ne');
    });

    it('should return default US pack', async () => {
      const pack = await service.getPolicyPack('US');
      expect(pack.currency).toBe('USD');
      expect(pack.paymentMethods).toContain('stripe');
    });

    it('should return DB pack when available', async () => {
      prisma.countryPolicyPack.findUnique.mockResolvedValue({
        country: 'NP',
        currencyConfig: { code: 'NPR' },
        localizations: { languages: ['ne', 'en'], timezone: 'Asia/Kathmandu' },
        taxRules: { maxBookingDays: 365 },
        isActive: true,
        version: 1,
      });
      const pack = await service.getPolicyPack('NP');
      expect(pack.isActive).toBe(true);
    });

    it('should fallback to NP for unknown country', async () => {
      const pack = await service.getPolicyPack('XX');
      expect(pack.currency).toBe('NPR');
    });
  });

  describe('upsertPolicyPack', () => {
    it('should create a new policy pack', async () => {
      const result = await service.upsertPolicyPack({
        country: 'JP',
        currency: 'JPY',
        languages: ['ja'],
        timezone: 'Asia/Tokyo',
        policies: { maxBookingDays: 365 },
      });
      expect(result).toBeDefined();
      expect(prisma.countryPolicyPack.create).toHaveBeenCalled();
    });

    it('should update an existing policy pack', async () => {
      prisma.countryPolicyPack.findUnique.mockResolvedValue({
        country: 'NP',
        version: 1,
      });
      const result = await service.upsertPolicyPack({
        country: 'NP',
        currency: 'NPR',
        languages: ['ne', 'en'],
        timezone: 'Asia/Kathmandu',
        policies: { maxBookingDays: 180 },
      });
      expect(prisma.countryPolicyPack.update).toHaveBeenCalled();
    });
  });

  describe('validateBooking', () => {
    it('should pass valid booking', async () => {
      const result = await service.validateBooking('NP', {
        durationDays: 7,
        durationHours: 168,
      });
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail booking exceeding max days', async () => {
      const result = await service.validateBooking('NP', {
        durationDays: 400,
        durationHours: 9600,
      });
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should fail booking below min hours', async () => {
      const result = await service.validateBooking('NP', {
        durationDays: 0,
        durationHours: 1,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('getPaymentMethods', () => {
    it('should return Nepal payment methods', async () => {
      const methods = await service.getPaymentMethods('NP');
      expect(methods).toContain('esewa');
      expect(methods).toContain('khalti');
    });
  });

  describe('seedDefaultPacks', () => {
    it('should seed all default countries', async () => {
      const result = await service.seedDefaultPacks();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
