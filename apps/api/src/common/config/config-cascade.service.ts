import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

/**
 * Resolved configuration for locale, currency, and timezone
 * following the cascade: env → org/workspace → user preference.
 */
export interface ResolvedConfig {
  locale: string;
  currency: string;
  timezone: string;
}

/**
 * ConfigCascadeService resolves locale, currency, and timezone
 * with a three-level precedence cascade:
 *
 *   1. **User preference**  (highest priority — from UserPreferences table)
 *   2. **Organization**     (from Organization.country → mapped defaults)
 *   3. **Environment**      (lowest priority — env vars via ConfigService)
 *
 * Results are cached per-user for 5 minutes to avoid repeated DB hits.
 */
@Injectable()
export class ConfigCascadeService {
  private readonly logger = new Logger(ConfigCascadeService.name);
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly CACHE_PREFIX = 'config-cascade:';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Resolve locale/currency/timezone for a given user, applying the cascade.
   * If requestLocale is provided (e.g. from Accept-Language header), it takes
   * precedence over all other locale sources.
   */
  async resolve(
    userId?: string,
    requestLocale?: string,
  ): Promise<ResolvedConfig> {
    // Start with environment defaults
    const envDefaults = this.getEnvDefaults();

    if (!userId) {
      return {
        ...envDefaults,
        ...(requestLocale ? { locale: requestLocale } : {}),
      };
    }

    // Check cache first
    const cacheKey = `${ConfigCascadeService.CACHE_PREFIX}${userId}`;
    try {
      const cached = await this.cacheService.get<ResolvedConfig>(cacheKey);
      if (cached) {
        return {
          ...cached,
          // Accept-Language always wins for locale if provided
          ...(requestLocale ? { locale: requestLocale } : {}),
        };
      }
    } catch (error) {
      this.logger.debug(`Config cache miss/unavailable for ${userId}: ${error instanceof Error ? error.message : error}`);
    }

    // Layer 2: Organization-level defaults
    const orgConfig = await this.getOrgConfig(userId);

    // Layer 3: User preferences (highest priority)
    const userConfig = await this.getUserConfig(userId);

    // Merge: env < org < user
    const resolved: ResolvedConfig = {
      locale: userConfig.locale ?? orgConfig.locale ?? envDefaults.locale,
      currency: userConfig.currency ?? orgConfig.currency ?? envDefaults.currency,
      timezone: userConfig.timezone ?? orgConfig.timezone ?? envDefaults.timezone,
    };

    // Cache the resolved config (without request-level locale override)
    try {
      await this.cacheService.set(cacheKey, resolved, ConfigCascadeService.CACHE_TTL);
    } catch (error) {
      this.logger.debug(`Config cache write failed: ${error instanceof Error ? error.message : error}`);
    }

    return {
      ...resolved,
      // Accept-Language always wins for locale if provided
      ...(requestLocale ? { locale: requestLocale } : {}),
    };
  }

  /**
   * Invalidate cached config when user preferences or org settings change.
   */
  async invalidate(userId: string): Promise<void> {
    try {
      await this.cacheService.del(`${ConfigCascadeService.CACHE_PREFIX}${userId}`);
    } catch (error) {
      this.logger.debug(`Config cache invalidation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private getEnvDefaults(): ResolvedConfig {
    return {
      locale: this.config.get<string>('platform.defaultLocale', 'en'),
      currency: this.config.get<string>('platform.defaultCurrency', 'USD'),
      timezone: this.config.get<string>('platform.defaultTimezone', 'UTC'),
    };
  }

  private async getUserConfig(
    userId: string,
  ): Promise<Partial<ResolvedConfig>> {
    try {
      const prefs = await this.prisma.userPreferences.findUnique({
        where: { userId },
        select: { language: true, currency: true, timezone: true },
      });

      if (!prefs) return {};

      return {
        // Only override if user has explicitly set a non-default value
        locale: prefs.language && prefs.language !== 'en' ? prefs.language : undefined,
        currency: prefs.currency && prefs.currency !== 'USD' ? prefs.currency : undefined,
        timezone: prefs.timezone && prefs.timezone !== 'UTC' ? prefs.timezone : undefined,
      };
    } catch (err) {
      this.logger.warn('Failed to load user preferences for config cascade', err);
      return {};
    }
  }

  private async getOrgConfig(
    userId: string,
  ): Promise<Partial<ResolvedConfig>> {
    try {
      // Find the user's primary organization membership
      const membership = await this.prisma.organizationMember.findFirst({
        where: { userId },
        include: {
          organization: {
            select: { country: true },
          },
        },
        orderBy: { createdAt: 'asc' }, // Earliest membership = primary org
      });

      if (!membership?.organization?.country) return {};

      // Look up country defaults from the CountryConfig DB table
      const countryDefaults = await this.getCountryDefaults(membership.organization.country);
      return countryDefaults;
    } catch (err) {
      this.logger.warn('Failed to load org config for cascade', err);
      return {};
    }
  }

  /**
   * Look up locale/currency/timezone defaults from `CountryConfig` DB table.
   * Falls back to an empty object when the country is unknown — the cascade
   * will then use env-level defaults.
   */
  private async getCountryDefaults(
    countryCode: string,
  ): Promise<Partial<ResolvedConfig>> {
    const code = countryCode.toUpperCase();
    const countryCacheKey = `${ConfigCascadeService.CACHE_PREFIX}country:${code}`;

    // Check cache first
    try {
      const cached = await this.cacheService.get<Partial<ResolvedConfig>>(countryCacheKey);
      if (cached) return cached;
    } catch (error) {
      this.logger.debug(`Country config cache miss/unavailable for ${code}: ${error instanceof Error ? error.message : error}`);
    }

    try {
      const countryConfig = await this.prisma.countryConfig.findUnique({
        where: { code },
        select: { defaultLocale: true, defaultCurrency: true, defaultTimezone: true },
      });

      if (!countryConfig) {
        this.logger.debug(`No CountryConfig found for ${code}, using env defaults`);
        return {};
      }

      const defaults: Partial<ResolvedConfig> = {
        locale: countryConfig.defaultLocale ?? undefined,
        currency: countryConfig.defaultCurrency ?? undefined,
        timezone: countryConfig.defaultTimezone ?? undefined,
      };

      // Cache country defaults for 1 hour (they change rarely)
      try {
        await this.cacheService.set(countryCacheKey, defaults, 3600);
      } catch (error) {
        this.logger.debug(`Country config cache write failed for ${code}: ${error instanceof Error ? error.message : error}`);
      }

      return defaults;
    } catch (err) {
      this.logger.warn(`Failed to load CountryConfig for ${code}`, err);
      return {};
    }
  }
}
