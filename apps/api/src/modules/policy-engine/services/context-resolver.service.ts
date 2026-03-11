/**
 * Context Resolver — Builds a PolicyContext from an HTTP request and optional entity data.
 *
 * Resolution priority (highest to lowest):
 * 1. Explicit request parameters
 * 2. Listing location
 * 3. User profile preference
 * 4. Accept-Language / locale header
 * 5. GeoIP lookup
 * 6. System defaults
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PolicyContext } from '../interfaces';

export interface ContextInput {
  // From request
  locale?: string;
  currency?: string;
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
  platform?: string;
  requestId?: string;
  ipCountry?: string;

  // From user
  userId?: string;
  userRole?: string;
  userCountry?: string;
  preferredLocale?: string;
  preferredCurrency?: string;

  // From listing
  listingId?: string;
  listingCategory?: string;
  listingCountry?: string;
  listingState?: string;
  listingCity?: string;
  listingCurrency?: string;

  // From booking
  bookingValue?: number;
  bookingDuration?: number;
  bookingCurrency?: string;
  startDate?: string;
  endDate?: string;
  guestCount?: number;
  hostPresent?: boolean;

  // Tenant
  tenantId?: string;
}

@Injectable()
export class ContextResolverService {
  private readonly logger = new Logger(ContextResolverService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Build a complete PolicyContext from partial input data.
   * Applies resolution priority rules to fill in missing fields.
   */
  resolve(input: ContextInput): PolicyContext {
    const now = new Date();
    const defaults = {
      country: this.configService.get<string>('platform.country', 'NP'),
      currency: this.configService.get<string>('platform.defaultCurrency', 'NPR'),
      locale: this.configService.get<string>('platform.defaultLocale', 'en'),
      timezone: this.configService.get<string>('platform.defaultTimezone', 'Asia/Kathmandu'),
    };

    // Country resolution: explicit > listing location > user country > IP > default
    const country =
      input.country || input.listingCountry || input.userCountry || input.ipCountry || defaults.country;

    // For tax/fee purposes, jurisdiction is ALWAYS listing location
    const taxCountry = input.listingCountry || country;

    // Locale resolution: explicit > user preference > system default
    const locale = input.locale || input.preferredLocale || defaults.locale;

    // Currency resolution: explicit > listing currency > user preference > default
    const currency =
      input.currency || input.listingCurrency || input.preferredCurrency || defaults.currency;

    const timezone = input.timezone || defaults.timezone;

    return {
      locale,
      country: taxCountry,
      state: input.listingState || input.state || null,
      city: input.listingCity || input.city || null,
      timezone,
      currency,

      userId: input.userId || null,
      userRole: input.userRole || 'GUEST',
      userCountry: input.userCountry || null,

      listingId: input.listingId || null,
      listingCategory: input.listingCategory || null,
      listingCountry: input.listingCountry || null,
      listingState: input.listingState || null,
      listingCity: input.listingCity || null,

      bookingValue: input.bookingValue ?? null,
      bookingDuration: input.bookingDuration ?? null,
      bookingCurrency: input.bookingCurrency || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      guestCount: input.guestCount ?? null,
      hostPresent: input.hostPresent ?? null,

      requestTimestamp: now.toISOString(),
      evaluationDate: now.toISOString().split('T')[0],
      ipCountry: input.ipCountry || null,
      platform: input.platform || 'web',

      tenantId: input.tenantId || null,
      workspaceConfig: {},
    };
  }
}
