import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PolicyPackLoaderService } from './policy-pack-loader.service';

/**
 * Country Policy Pack Framework (V5 Prompt 13)
 *
 * Manages per-country policy packs with three-tier cascade:
 *   1. YAML file packs (from policy-packs/*.yaml) — loaded at startup
 *   2. DB overrides (CountryPolicyPack table) — admin-editable at runtime
 *   3. Hardcoded defaults — last-resort fallback
 *
 * The cascade: DB overrides → YAML → hardcoded defaults
 */
@Injectable()
export class CountryPolicyPackService {
  private readonly logger = new Logger(CountryPolicyPackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yamlLoader: PolicyPackLoaderService,
  ) {}

  /**
   * Get policy pack with cascade: DB → YAML → hardcoded defaults.
   */
  async getPolicyPack(country: string): Promise<any> {
    // Tier 1: DB override
    const dbPack = await this.prisma.countryPolicyPack.findUnique({
      where: { country },
    });

    if (dbPack) {
      const currencyConfig = (dbPack.currencyConfig as any) || {};
      const localizations = (dbPack.localizations as any) || {};
      const taxRules = (dbPack.taxRules as any) || {};
      return {
        country: dbPack.country,
        currency: currencyConfig.code || 'NPR',
        languages: localizations.languages || [],
        timezone: localizations.timezone || 'Asia/Kathmandu',
        ...taxRules,
        isActive: dbPack.isActive,
        version: dbPack.version,
        source: 'DATABASE',
      };
    }

    // Tier 2: YAML policy pack
    const yamlPack = this.yamlLoader.getPack(country);
    if (yamlPack) {
      return {
        country: yamlPack.general.country_code,
        currency: yamlPack.general.currency.code,
        languages: yamlPack.general.languages,
        timezone: yamlPack.general.timezone,
        kycRequired: yamlPack.identity?.kyc_provider !== 'none',
        maxBookingDays: yamlPack.booking?.max_duration_days || 365,
        minBookingHours: yamlPack.booking?.min_duration_hours || 24,
        paymentMethods: yamlPack.payments?.supported_methods || [],
        taxConfig: yamlPack.tax,
        legal: {
          minHostAge: yamlPack.identity?.host_verification?.minimum_age || 18,
          requiresBusinessRegistration: yamlPack.compliance?.business_registration_required || false,
          requiresPropertyVerification: true,
        },
        booking: yamlPack.booking,
        compliance: yamlPack.compliance,
        identity: yamlPack.identity,
        payments: yamlPack.payments,
        source: 'YAML',
      };
    }

    // Tier 3: Hardcoded defaults
    return this.getHardcodedDefault(country);
  }

  private getHardcodedDefault(country: string): any {
    const defaults: Record<string, any> = {
      NP: {
        country: 'NP', currency: 'NPR', languages: ['ne', 'en'], timezone: 'Asia/Kathmandu',
        kycRequired: true, maxBookingDays: 365, minBookingHours: 24,
        paymentMethods: ['esewa', 'khalti', 'bank_transfer', 'cash'],
        taxConfig: { vat: 0.13, serviceTax: 0.10, tourismFee: 0.02 },
        legal: { minHostAge: 18, requiresBusinessRegistration: false, requiresPropertyVerification: true },
        source: 'HARDCODED',
      },
      IN: {
        country: 'IN', currency: 'INR', languages: ['hi', 'en'], timezone: 'Asia/Kolkata',
        kycRequired: true, maxBookingDays: 365, minBookingHours: 24,
        paymentMethods: ['upi', 'paytm', 'bank_transfer', 'credit_card'],
        taxConfig: { gst: 0.18 },
        legal: { minHostAge: 18, requiresBusinessRegistration: true, requiresPropertyVerification: true },
        source: 'HARDCODED',
      },
      BD: {
        country: 'BD', currency: 'BDT', languages: ['bn', 'en'], timezone: 'Asia/Dhaka',
        kycRequired: true, maxBookingDays: 180, minBookingHours: 24,
        paymentMethods: ['bkash', 'nagad', 'bank_transfer'],
        taxConfig: { vat: 0.15 },
        legal: { minHostAge: 18, requiresBusinessRegistration: false, requiresPropertyVerification: true },
        source: 'HARDCODED',
      },
    };
    return defaults[country] || defaults['NP'];
  }

  /**
   * Create or update a country policy pack.
   */
  async upsertPolicyPack(params: {
    country: string;
    currency: string;
    languages: string[];
    timezone: string;
    policies: Record<string, any>;
  }) {
    const existing = await this.prisma.countryPolicyPack.findUnique({
      where: { country: params.country },
    });

    if (existing) {
      return this.prisma.countryPolicyPack.update({
        where: { country: params.country },
        data: {
          currencyConfig: { code: params.currency },
          localizations: { languages: params.languages, timezone: params.timezone },
          taxRules: params.policies,
          version: existing.version + 1,
        },
      });
    }

    return this.prisma.countryPolicyPack.create({
      data: {
        country: params.country,
        name: `${params.country} Policy Pack`,
        currencyConfig: { code: params.currency },
        localizations: { languages: params.languages, timezone: params.timezone },
        taxRules: params.policies,
        version: 1,
        isActive: true,
      },
    });
  }

  /**
   * Validate a booking against country policies.
   * Accepts either legacy params or checkout orchestrator params.
   */
  async validateBooking(
    country: string,
    params: {
      durationDays?: number;
      durationHours?: number;
      hostAge?: number;
      startDate?: Date;
      endDate?: Date;
      guestCount?: number;
      currency?: string;
    },
  ): Promise<{ valid: boolean; violations: string[] }> {
    const pack = await this.getPolicyPack(country);
    const violations: string[] = [];

    // Calculate durations from dates if not provided directly
    let durationDays = params.durationDays;
    let durationHours = params.durationHours;
    if (!durationDays && params.startDate && params.endDate) {
      const diffMs = params.endDate.getTime() - params.startDate.getTime();
      durationDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      durationHours = Math.ceil(diffMs / (1000 * 60 * 60));
    }

    if (pack.maxBookingDays && durationDays && durationDays > pack.maxBookingDays) {
      violations.push(`Booking exceeds maximum ${pack.maxBookingDays} days for ${country}`);
    }

    if (pack.minBookingHours && durationHours && durationHours < pack.minBookingHours) {
      violations.push(`Booking below minimum ${pack.minBookingHours} hours for ${country}`);
    }

    if (pack.legal?.minHostAge && params.hostAge && params.hostAge < pack.legal.minHostAge) {
      violations.push(`Host must be at least ${pack.legal.minHostAge} years old in ${country}`);
    }

    // YAML-based booking constraints
    const yamlConstraints = this.yamlLoader.getBookingConstraints(country);
    if (yamlConstraints) {
      if (params.guestCount && params.guestCount > yamlConstraints.max_guests_default) {
        violations.push(`Maximum ${yamlConstraints.max_guests_default} guests allowed in ${country}`);
      }
    }

    return { valid: violations.length === 0, violations };
  }

  /**
   * Get supported payment methods for a country.
   */
  async getPaymentMethods(country: string): Promise<string[]> {
    const pack = await this.getPolicyPack(country);
    return pack.paymentMethods || ['bank_transfer'];
  }

  /**
   * Get all active policy packs (DB + YAML + defaults merged).
   */
  async getAllPolicyPacks() {
    const dbPacks = await this.prisma.countryPolicyPack.findMany({
      where: { isActive: true },
    });

    const yamlCountries = this.yamlLoader.getLoadedCountries();
    const defaultCountries = ['NP', 'IN', 'BD'];

    const countries = new Set([
      ...yamlCountries,
      ...defaultCountries,
      ...dbPacks.map((p) => p.country),
    ]);

    const result: any[] = [];
    for (const c of countries) {
      result.push(await this.getPolicyPack(c));
    }
    return result;
  }

  /**
   * Seed all packs (YAML + defaults) into DB.
   */
  async seedDefaultPacks() {
    const results = [];
    const allCountries = new Set([
      ...(this.yamlLoader.getLoadedCountries?.() || []),
      'NP', 'IN', 'BD',
    ]);

    for (const country of allCountries) {
      const existing = await this.prisma.countryPolicyPack.findUnique({ where: { country } });
      if (!existing) {
        const pack = await this.getPolicyPack(country);
        const created = await this.prisma.countryPolicyPack.create({
          data: {
            country,
            name: `${country} Policy Pack`,
            currencyConfig: { code: pack.currency },
            localizations: { languages: pack.languages, timezone: pack.timezone },
            taxRules: pack.taxConfig || pack,
            version: 1,
            isActive: true,
          },
        });
        results.push(created);
      }
    }
    return results;
  }
}
