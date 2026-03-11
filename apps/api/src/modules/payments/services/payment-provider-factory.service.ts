import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PaymentProvider, PaymentProviderConfig, PAYMENT_PROVIDER } from '../interfaces/payment-provider.interface';
import { StripeService } from './stripe.service';

/**
 * PaymentProviderFactory selects the correct payment provider based on
 * country code and/or currency. It reads the `CountryConfig.paymentMethods`
 * DB column to determine which provider is configured for each country.
 *
 * Currently supports:
 *   - `stripe` (default global provider)
 *
 * Future providers can be registered via `registerProvider()`.
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {
    // Register built-in providers
    this.registerProvider(this.stripeService);
  }

  /**
   * Register a payment provider implementation.
   */
  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.providerId, provider);
    this.logger.log(`Registered payment provider: ${provider.providerId}`);
  }

  /**
   * Get all registered providers.
   */
  getRegisteredProviders(): PaymentProviderConfig[] {
    return Array.from(this.providers.values()).map((p) => p.config);
  }

  /**
   * Resolve the appropriate PaymentProvider for a given country + currency.
   *
   * Resolution order:
   *   1. CountryConfig.paymentMethods (DB-driven per-country provider)
   *   2. Currency-based fallback (e.g., USD → Stripe)
   *   3. Default provider from config
   *   4. Stripe as ultimate fallback
   */
  async getProvider(country?: string, currency?: string): Promise<PaymentProvider> {
    // 1. Try country-specific provider from DB
    if (country) {
      try {
        const countryConfig = await this.prisma.countryConfig.findUnique({
          where: { code: country.toUpperCase() },
          select: { supportedPaymentMethods: true },
        });

        if (countryConfig?.supportedPaymentMethods?.length) {
          const methods = countryConfig.supportedPaymentMethods as any;
          const preferredProvider = Array.isArray(methods)
            ? methods[0]
            : typeof methods === 'object' && methods.default
              ? methods.default
              : null;

          if (preferredProvider && this.providers.has(preferredProvider)) {
            this.logger.debug(`Using DB-configured provider '${preferredProvider}' for country ${country}`);
            return this.providers.get(preferredProvider)!;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to look up CountryConfig for ${country}`, err);
      }
    }

    // 2. Check if any registered provider explicitly supports the country
    if (country) {
      for (const [, provider] of this.providers) {
        if (provider.config.supportedCountries.includes(country.toUpperCase())) {
          return provider;
        }
      }
    }

    // 3. Check if any registered provider supports the currency
    if (currency) {
      for (const [, provider] of this.providers) {
        if (provider.config.supportedCurrencies.includes(currency.toUpperCase())) {
          return provider;
        }
      }
    }

    // 4. Default provider from config
    const defaultProviderId = this.configService.get<string>('PAYMENT_PROVIDER', 'stripe');
    if (this.providers.has(defaultProviderId)) {
      return this.providers.get(defaultProviderId)!;
    }

    // 5. Stripe as ultimate fallback
    if (this.providers.has('stripe')) {
      return this.providers.get('stripe')!;
    }

    throw new Error(
      `No payment provider found for country=${country}, currency=${currency}. ` +
      `Registered providers: ${Array.from(this.providers.keys()).join(', ')}`,
    );
  }

  /**
   * Get a specific provider by its ID.
   */
  getProviderById(providerId: string): PaymentProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Check if a country is supported by any registered provider.
   */
  isCountrySupported(country: string): boolean {
    const upperCountry = country.toUpperCase();
    for (const [, provider] of this.providers) {
      if (provider.config.supportedCountries.includes(upperCountry)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all supported countries across all providers.
   */
  getSupportedCountries(): string[] {
    const countries = new Set<string>();
    for (const [, provider] of this.providers) {
      for (const c of provider.config.supportedCountries) {
        countries.add(c);
      }
    }
    return Array.from(countries).sort();
  }

  /**
   * Get all supported currencies across all providers.
   */
  getSupportedCurrencies(): string[] {
    const currencies = new Set<string>();
    for (const [, provider] of this.providers) {
      for (const c of provider.config.supportedCurrencies) {
        currencies.add(c);
      }
    }
    return Array.from(currencies).sort();
  }
}
