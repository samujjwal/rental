import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Geo-Distributed Infrastructure (V5 Prompt 17)
 *
 * Region-aware configuration and routing:
 * - Region health and failover management
 * - Latency budgets per region
 * - Read replica routing hints
 * - CDN and edge cache configuration
 */
@Injectable()
export class GeoDistributionService {
  private readonly logger = new Logger(GeoDistributionService.name);

  private readonly defaultRegions: Record<string, any>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.defaultRegions = {
      'ap-south-1': {
        regionCode: 'ap-south-1',
        name: 'South Asia (Mumbai)',
        countries: ['NP', 'IN', 'BD', 'LK', 'BT', 'MV'],
        primaryDb: 'postgres-ap-south-1',
        readReplica: 'postgres-ap-south-1-ro',
        cdnEndpoint: this.config.get<string>('cdn.apSouth1') || 'cdn.gharbatai.com',
        latencyBudgetMs: 200,
      },
      'ap-southeast-1': {
        regionCode: 'ap-southeast-1',
        name: 'Southeast Asia (Singapore)',
        countries: ['TH', 'ID', 'MY', 'SG', 'VN', 'PH'],
        primaryDb: 'postgres-ap-southeast-1',
        readReplica: 'postgres-ap-southeast-1-ro',
        cdnEndpoint: this.config.get<string>('cdn.apSoutheast1') || 'cdn-sea.gharbatai.com',
        latencyBudgetMs: 250,
      },
      'us-east-1': {
        regionCode: 'us-east-1',
        name: 'US East (Virginia)',
        countries: ['US', 'CA', 'MX'],
        primaryDb: 'postgres-us-east-1',
        readReplica: 'postgres-us-east-1-ro',
        cdnEndpoint: this.config.get<string>('cdn.usEast1') || 'cdn-us.gharbatai.com',
        latencyBudgetMs: 150,
      },
      'eu-west-1': {
        regionCode: 'eu-west-1',
        name: 'Europe (Ireland)',
        countries: ['GB', 'DE', 'FR', 'ES', 'IT', 'NL'],
        primaryDb: 'postgres-eu-west-1',
        readReplica: 'postgres-eu-west-1-ro',
        cdnEndpoint: this.config.get<string>('cdn.euWest1') || 'cdn-eu.gharbatai.com',
        latencyBudgetMs: 150,
      },
    };
  }

  /**
   * Get region config for a country.
   */
  async getRegionForCountry(country: string): Promise<any> {
    // Check DB first
    const configs = await this.prisma.regionConfig.findMany({
      where: { isActive: true },
    });

    for (const config of configs) {
      const countries = (config.countries as string[]) || [];
      if (countries.includes(country)) {
        return config;
      }
    }

    // Fallback to default
    for (const [, region] of Object.entries(this.defaultRegions)) {
      if (region.countries.includes(country)) return region;
    }

    // Default to South Asia
    return this.defaultRegions['ap-south-1'];
  }

  /**
   * Upsert a region config.
   */
  async upsertRegionConfig(params: {
    regionCode: string;
    name: string;
    config: Record<string, any>;
  }) {
    return this.prisma.regionConfig.upsert({
      where: { regionCode: params.regionCode },
      update: {
        name: params.name,
        metadata: params.config,
      },
      create: {
        regionCode: params.regionCode,
        name: params.name,
        metadata: params.config,
        isActive: true,
      },
    });
  }

  /**
   * Get all active regions.
   */
  async getActiveRegions() {
    const dbRegions = await this.prisma.regionConfig.findMany({
      where: { isActive: true },
    });

    if (dbRegions.length > 0) return dbRegions;

    // Return defaults
    return Object.values(this.defaultRegions);
  }

  /**
   * Get routing hints (which DB, CDN, etc.) for a request from a country.
   */
  async getRoutingHints(country: string): Promise<{
    region: string;
    primaryDb: string;
    readReplica: string;
    cdnEndpoint: string;
    latencyBudgetMs: number;
  }> {
    const region = await this.getRegionForCountry(country);
    const config = (region.metadata as any) || region;

    return {
      region: config.regionCode || region.regionCode,
      primaryDb: config.primaryDb || 'postgres-default',
      readReplica: config.readReplica || config.primaryDb || 'postgres-default-ro',
      cdnEndpoint: config.cdnEndpoint || this.config.get<string>('cdn.apSouth1') || 'cdn.gharbatai.com',
      latencyBudgetMs: config.latencyBudgetMs || 200,
    };
  }

  /**
   * Simulate failover to a different region.
   */
  async simulateFailover(fromRegion: string, toRegion: string) {
    this.logger.warn(`Simulating failover: ${fromRegion} → ${toRegion}`);

    const from = await this.prisma.regionConfig.findUnique({ where: { regionCode: fromRegion } });
    const to = await this.prisma.regionConfig.findUnique({ where: { regionCode: toRegion } });

    return {
      fromRegion,
      toRegion,
      fromActive: from?.isActive ?? false,
      toActive: to?.isActive ?? true,
      estimatedDowntimeSeconds: 30,
      affectedCountries: (from?.countries as string[]) || this.defaultRegions[fromRegion]?.countries || [],
    };
  }

  /**
   * Seed default regions into DB.
   */
  async seedRegions() {
    const results = [];
    for (const [code, region] of Object.entries(this.defaultRegions)) {
      const existing = await this.prisma.regionConfig.findUnique({ where: { regionCode: code } });
      if (!existing) {
        const created = await this.prisma.regionConfig.create({
          data: {
            regionCode: code,
            name: region.name,
            countries: region.countries,
            metadata: region,
            isActive: true,
          },
        });
        results.push(created);
      }
    }
    return results;
  }
}
