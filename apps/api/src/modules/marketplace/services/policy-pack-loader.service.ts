import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

/**
 * YAML Policy Pack Loader (V5 Prompt 13 — Runtime YAML Loading)
 *
 * Loads *.yaml policy pack files from `policy-packs/` at startup
 * and provides runtime access by country code. Falls back to
 * hardcoded defaults if YAML files are missing.
 *
 * Supports hot-reload via `reloadAll()` for admin operations.
 */

export interface LoadedPolicyPack {
  general: {
    country_code: string;
    country_name: string;
    currency: { code: string; name: string; precision: number; symbol: string; allow_fractional: boolean };
    locale: string;
    fallback_locale: string;
    timezone: string;
    utc_offset: string;
    languages: string[];
    date_format: string;
    phone_prefix: string;
    address_format: any;
  };
  identity: {
    host_verification: any;
    renter_verification: any;
    kyc_provider: string;
    aml_screening: boolean;
  };
  tax: {
    platform_level: Array<{
      type: string;
      name: string;
      rate: number;
      applied_to: string[];
      remitted_by: string;
      effective_from: string;
    }>;
    host_level: any[];
    tourism_levy: any;
    withholding_tax: any;
  };
  payments: {
    supported_methods: string[];
    default_method: string;
    payout_methods: string[];
    payout_frequency: string;
    payout_minimum: number;
    escrow_hold_days: number;
    max_foreign_currency_withdrawal?: number | null;
  };
  booking: {
    min_duration_hours: number;
    max_duration_days: number;
    advance_booking_max_days: number;
    cancellation_minimum_hours: number;
    instant_book_enabled: boolean;
    allow_hourly: boolean;
    require_guest_count: boolean;
    max_guests_default: number;
  };
  compliance: {
    short_term_rental_cap: any;
    business_registration_required: boolean;
    safety_requirements: any;
    insurance_required: boolean;
    data_retention_days: number;
  };
  // Extended fields from specific packs
  [key: string]: any;
}

@Injectable()
export class PolicyPackLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PolicyPackLoaderService.name);
  private readonly packs = new Map<string, LoadedPolicyPack>();
  private readonly policyDir: string;

  constructor() {
    // Resolve policy-packs directory relative to this file's location
    this.policyDir = join(__dirname, '..', 'policy-packs');
  }

  async onModuleInit() {
    this.loadAll();
    this.logger.log(`Loaded ${this.packs.size} YAML policy packs: [${Array.from(this.packs.keys()).join(', ')}]`);
  }

  /**
   * Load all YAML policy packs from disk.
   */
  loadAll(): void {
    this.packs.clear();

    if (!existsSync(this.policyDir)) {
      this.logger.warn(`Policy packs directory not found: ${this.policyDir}`);
      return;
    }

    const files = readdirSync(this.policyDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of files) {
      try {
        const filePath = join(this.policyDir, file);
        const content = readFileSync(filePath, 'utf8');
        const parsed = yaml.load(content) as LoadedPolicyPack;

        const countryCode = parsed.general?.country_code || file.replace(/\.(yaml|yml)$/, '');

        this.packs.set(countryCode, parsed);
        this.logger.debug(`Loaded policy pack: ${countryCode} from ${file}`);
      } catch (error) {
        this.logger.error(`Failed to load policy pack ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Reload all policy packs (admin hot-reload).
   */
  reloadAll(): { loaded: string[]; errors: string[] } {
    const errors: string[] = [];
    this.packs.clear();

    if (!existsSync(this.policyDir)) {
      errors.push(`Policy packs directory not found: ${this.policyDir}`);
      return { loaded: [], errors };
    }

    const files = readdirSync(this.policyDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of files) {
      try {
        const filePath = join(this.policyDir, file);
        const content = readFileSync(filePath, 'utf8');
        const parsed = yaml.load(content) as LoadedPolicyPack;
        const countryCode = parsed.general?.country_code || file.replace(/\.(yaml|yml)$/, '');
        this.packs.set(countryCode, parsed);
      } catch (error) {
        errors.push(`${file}: ${error.message}`);
      }
    }

    return { loaded: Array.from(this.packs.keys()), errors };
  }

  /**
   * Get a loaded policy pack by country code.
   */
  getPack(countryCode: string): LoadedPolicyPack | undefined {
    return this.packs.get(countryCode);
  }

  /**
   * Get all loaded pack country codes.
   */
  getLoadedCountries(): string[] {
    return Array.from(this.packs.keys());
  }

  /**
   * Get tax rules from YAML for a country.
   */
  getTaxRules(countryCode: string): LoadedPolicyPack['tax'] | undefined {
    return this.packs.get(countryCode)?.tax;
  }

  /**
   * Get payment config from YAML for a country.
   */
  getPaymentConfig(countryCode: string): LoadedPolicyPack['payments'] | undefined {
    return this.packs.get(countryCode)?.payments;
  }

  /**
   * Get booking constraints from YAML for a country.
   */
  getBookingConstraints(countryCode: string): LoadedPolicyPack['booking'] | undefined {
    return this.packs.get(countryCode)?.booking;
  }

  /**
   * Get identity/KYC requirements from YAML for a country.
   */
  getIdentityRequirements(countryCode: string): LoadedPolicyPack['identity'] | undefined {
    return this.packs.get(countryCode)?.identity;
  }

  /**
   * Get compliance requirements from YAML for a country.
   */
  getComplianceRequirements(countryCode: string): LoadedPolicyPack['compliance'] | undefined {
    return this.packs.get(countryCode)?.compliance;
  }

  /**
   * Validate a booking against YAML policy constraints.
   */
  validateBookingAgainstPolicy(
    countryCode: string,
    booking: { durationHours: number; durationDays: number; guestCount?: number; advanceDays?: number },
  ): { valid: boolean; violations: string[] } {
    const constraints = this.getBookingConstraints(countryCode);
    if (!constraints) return { valid: true, violations: [] };

    const violations: string[] = [];

    if (booking.durationHours < constraints.min_duration_hours) {
      violations.push(`Minimum booking duration is ${constraints.min_duration_hours} hours in ${countryCode}`);
    }
    if (booking.durationDays > constraints.max_duration_days) {
      violations.push(`Maximum booking duration is ${constraints.max_duration_days} days in ${countryCode}`);
    }
    if (booking.guestCount && booking.guestCount > constraints.max_guests_default) {
      violations.push(`Maximum guests is ${constraints.max_guests_default} in ${countryCode}`);
    }
    if (booking.advanceDays && booking.advanceDays > constraints.advance_booking_max_days) {
      violations.push(`Advance booking limited to ${constraints.advance_booking_max_days} days in ${countryCode}`);
    }

    return { valid: violations.length === 0, violations };
  }
}
