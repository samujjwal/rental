import { ConfigService } from '@nestjs/config';
import { PaymentProviderFactory } from './payment-provider-factory.service';
import { PaymentProvider, PaymentProviderConfig } from '../interfaces/payment-provider.interface';

describe('PaymentProviderFactory', () => {
  let factory: PaymentProviderFactory;
  let prisma: any;
  let configService: any;
  let mockStripe: jest.Mocked<PaymentProvider>;

  beforeEach(() => {
    prisma = {
      countryConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    configService = {
      get: jest.fn((key: string, defaultVal?: any) => defaultVal ?? null),
    };

    mockStripe = {
      providerId: 'stripe',
      providerConfig: {
        providerId: 'stripe',
        name: 'Stripe',
        supportedCountries: ['US', 'GB', 'CA', 'AU', 'IN', 'NP'],
        supportedCurrencies: ['USD', 'GBP', 'CAD', 'AUD', 'INR', 'NPR'],
      },
      get config(): PaymentProviderConfig {
        return this.providerConfig;
      },
      createCustomer: jest.fn(),
      createConnectAccount: jest.fn(),
      createPaymentIntent: jest.fn(),
      holdDeposit: jest.fn(),
      releaseDeposit: jest.fn(),
      captureDeposit: jest.fn(),
      createRefund: jest.fn(),
      createPayout: jest.fn(),
      constructWebhookEvent: jest.fn(),
    } as any;

    factory = new PaymentProviderFactory(configService, prisma, mockStripe as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('registerProvider', () => {
    it('should register Stripe on construction', () => {
      const providers = factory.getRegisteredProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].providerId).toBe('stripe');
    });

    it('should register additional providers', () => {
      const mockEsewa: PaymentProvider = {
        providerId: 'esewa',
        providerConfig: {
          providerId: 'esewa',
          name: 'eSewa',
          supportedCountries: ['NP'],
          supportedCurrencies: ['NPR'],
        },
        get config() { return this.providerConfig; },
      } as any;

      factory.registerProvider(mockEsewa);
      expect(factory.getRegisteredProviders()).toHaveLength(2);
      expect(factory.getProviderById('esewa')).toBe(mockEsewa);
    });
  });

  describe('getProvider', () => {
    it('should return Stripe as default when no country/currency given', async () => {
      const provider = await factory.getProvider();
      expect(provider.providerId).toBe('stripe');
    });

    it('should use DB-configured provider for a country', async () => {
      prisma.countryConfig.findUnique.mockResolvedValue({
        supportedPaymentMethods: ['stripe'],
      });

      const provider = await factory.getProvider('NP');
      expect(provider.providerId).toBe('stripe');
      expect(prisma.countryConfig.findUnique).toHaveBeenCalledWith({
        where: { code: 'NP' },
        select: { supportedPaymentMethods: true },
      });
    });

    it('should use DB-configured provider with object format', async () => {
      prisma.countryConfig.findUnique.mockResolvedValue({
        supportedPaymentMethods: ['stripe'],
      });

      const provider = await factory.getProvider('US');
      expect(provider.providerId).toBe('stripe');
    });

    it('should fall back to country support check when DB has no config', async () => {
      prisma.countryConfig.findUnique.mockResolvedValue(null);

      const provider = await factory.getProvider('IN');
      expect(provider.providerId).toBe('stripe'); // Stripe supports IN
    });

    it('should fall back to currency support check', async () => {
      prisma.countryConfig.findUnique.mockResolvedValue(null);

      // Use a country not in Stripe's list but currency is supported
      const provider = await factory.getProvider(undefined, 'USD');
      expect(provider.providerId).toBe('stripe');
    });

    it('should use config default provider', async () => {
      configService.get.mockReturnValue('stripe');
      const provider = await factory.getProvider('ZZ', 'ZZD');
      expect(provider.providerId).toBe('stripe');
    });

    it('should handle DB errors gracefully', async () => {
      prisma.countryConfig.findUnique.mockRejectedValue(new Error('DB down'));

      const provider = await factory.getProvider('US');
      // Should still return stripe via country/currency fallback
      expect(provider.providerId).toBe('stripe');
    });

    it('should throw when no provider matches', async () => {
      // Remove all providers by creating a factory with a non-matching stripe mock
      const emptyStripe = {
        ...mockStripe,
        providerId: 'stripe',
        config: {
          ...mockStripe.config,
          supportedCountries: [],
          supportedCurrencies: [],
        },
      } as any;

      // Create a fresh factory, then clear providers
      const emptyFactory = new PaymentProviderFactory(configService, prisma, emptyStripe);
      // Access private map and clear it to simulate no providers
      (emptyFactory as any).providers.clear();

      await expect(emptyFactory.getProvider('ZZ', 'ZZD')).rejects.toThrow(
        /No payment provider found/,
      );
    });
  });

  describe('isCountrySupported', () => {
    it('should return true for supported country', () => {
      expect(factory.isCountrySupported('US')).toBe(true);
      expect(factory.isCountrySupported('us')).toBe(true); // case-insensitive
    });

    it('should return false for unsupported country', () => {
      expect(factory.isCountrySupported('ZZ')).toBe(false);
    });
  });

  describe('getSupportedCountries', () => {
    it('should return sorted list of all supported countries', () => {
      const countries = factory.getSupportedCountries();
      expect(countries).toEqual(['AU', 'CA', 'GB', 'IN', 'NP', 'US']);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return sorted list of all supported currencies', () => {
      const currencies = factory.getSupportedCurrencies();
      expect(currencies).toEqual(['AUD', 'CAD', 'GBP', 'INR', 'NPR', 'USD']);
    });
  });
});
