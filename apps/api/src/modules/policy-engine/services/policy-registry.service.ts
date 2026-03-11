/**
 * Policy Registry — Loads, caches, and queries policy rules from the database.
 *
 * Two-layer caching:
 * - L1: In-memory Map (60s TTL)
 * - L2: Redis via CacheService (5min TTL)
 * - L3: PostgreSQL via Prisma (source of truth)
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import {
  SerializedPolicyRule,
  PolicyType,
  RuleCondition,
  RuleAction,
} from '../interfaces';

interface CacheEntry {
  rules: SerializedPolicyRule[];
  cachedAt: number;
}

const L1_TTL_MS = 60_000; // 60 seconds
const L2_TTL_S = 300;     // 5 minutes

@Injectable()
export class PolicyRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PolicyRegistryService.name);
  private readonly l1Cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    // Pre-warm cache for common policy types on startup
    try {
      await this.warmCache();
    } catch (error) {
      this.logger.warn('Failed to warm policy cache on startup — will load on demand', error);
    }
  }

  /**
   * Query active policy rules by type, optionally scoped to a jurisdiction.
   * Returns rules sorted by jurisdictionPriority DESC, priority ASC.
   */
  async findActiveRules(
    type: PolicyType,
    country: string,
    state?: string | null,
    city?: string | null,
    evaluationDate?: Date,
  ): Promise<SerializedPolicyRule[]> {
    const cacheKey = this.buildCacheKey(type, country, state, city);
    const evalDate = evaluationDate || new Date();

    // L1: in-memory
    const l1 = this.l1Cache.get(cacheKey);
    if (l1 && Date.now() - l1.cachedAt < L1_TTL_MS) {
      return this.filterByEffectiveDate(l1.rules, evalDate);
    }

    // L2: Redis
    try {
      const l2 = await this.cacheService.get<SerializedPolicyRule[]>(cacheKey);
      if (l2) {
        this.l1Cache.set(cacheKey, { rules: l2, cachedAt: Date.now() });
        return this.filterByEffectiveDate(l2, evalDate);
      }
    } catch (error) {
      this.logger.debug(`Policy cache read failed, falling through to DB: ${error instanceof Error ? error.message : error}`);
    }

    // L3: Database
    const rules = await this.queryRulesFromDb(type, country, state, city);

    // Store into caches
    this.l1Cache.set(cacheKey, { rules, cachedAt: Date.now() });
    try {
      await this.cacheService.set(cacheKey, rules, L2_TTL_S);
    } catch (error) {
      this.logger.debug(`Policy cache write failed: ${error instanceof Error ? error.message : error}`);
    }

    return this.filterByEffectiveDate(rules, evalDate);
  }

  /**
   * Invalidate cache for a specific scope (called when rules are modified).
   */
  async invalidateCache(type?: PolicyType, country?: string): Promise<void> {
    // Clear all L1 entries matching the pattern
    for (const key of this.l1Cache.keys()) {
      if ((!type || key.startsWith(`policy:${type}:`)) && (!country || key.includes(`:${country}`))) {
        this.l1Cache.delete(key);
      }
    }

    // Clear L2 (best effort)
    try {
      if (type && country) {
        await this.cacheService.del(this.buildCacheKey(type, country));
      }
      // For broad invalidation, we clear the entire L1 and let L2 expire
    } catch {
      this.logger.warn('Failed to invalidate L2 cache');
    }
  }

  /**
   * Pre-warm cache for commonly used policy types and countries.
   */
  private async warmCache(): Promise<void> {
    const commonTypes: PolicyType[] = ['TAX', 'FEE', 'PRICING', 'BOOKING_CONSTRAINT'];
    const activeCountries = await this.getActiveCountries();

    for (const type of commonTypes) {
      for (const country of activeCountries) {
        await this.findActiveRules(type, country);
      }
    }

    this.logger.log(`Policy cache warmed: ${commonTypes.length} types × ${activeCountries.length} countries`);
  }

  /**
   * Get distinct active countries from the policy_rules table.
   */
  private async getActiveCountries(): Promise<string[]> {
    const result = await this.prisma.policyRule.findMany({
      where: { status: 'ACTIVE' },
      select: { country: true },
      distinct: ['country'],
    });
    const countries = result.map((r) => r.country).filter((c) => c !== '*');
    // Always include wildcard scope
    return ['*', ...countries];
  }

  /**
   * Query rules from the database with jurisdiction-scoped fallback.
   * Returns rules for: exact city match, state match, country match, AND global (*) match.
   */
  private async queryRulesFromDb(
    type: PolicyType,
    country: string,
    state?: string | null,
    city?: string | null,
  ): Promise<SerializedPolicyRule[]> {
    const countryValues = [country];
    if (country !== '*') countryValues.push('*');

    const where: Record<string, unknown> = {
      type,
      status: 'ACTIVE',
      country: { in: countryValues },
    };

    // Build OR conditions for jurisdiction matching
    const orConditions: Record<string, unknown>[] = [
      // Global rules (country = '*', no state/city)
      { country: '*', state: null, city: null },
      // Country-level rules
      { country, state: null, city: null },
    ];

    if (state) {
      orConditions.push(
        // State-level rules
        { country, state, city: null },
      );
    }

    if (city && state) {
      orConditions.push(
        // City-level rules
        { country, state, city },
      );
    }

    const rules = await this.prisma.policyRule.findMany({
      where: {
        type,
        status: 'ACTIVE',
        OR: orConditions,
      },
      orderBy: [
        { jurisdictionPriority: 'desc' },
        { priority: 'asc' },
        { version: 'desc' },
      ],
    });

    return rules.map((r) => this.serializeRule(r));
  }

  /**
   * Serialize a Prisma model into our interface shape.
   */
  private serializeRule(dbRule: any): SerializedPolicyRule {
    return {
      id: dbRule.id,
      type: dbRule.type as PolicyType,
      name: dbRule.name,
      description: dbRule.description,
      country: dbRule.country,
      state: dbRule.state,
      city: dbRule.city,
      jurisdictionPriority: dbRule.jurisdictionPriority,
      version: dbRule.version,
      effectiveFrom: new Date(dbRule.effectiveFrom),
      effectiveTo: dbRule.effectiveTo ? new Date(dbRule.effectiveTo) : null,
      supersedesId: dbRule.supersedesId,
      priority: dbRule.priority,
      conditions: (dbRule.conditions || []) as RuleCondition[],
      actions: (dbRule.actions || []) as RuleAction[],
      status: dbRule.status,
      tags: dbRule.tags || [],
      metadata: (dbRule.metadata || {}) as Record<string, unknown>,
    };
  }

  /**
   * Filter rules by effective date range.
   */
  private filterByEffectiveDate(rules: SerializedPolicyRule[], evalDate: Date): SerializedPolicyRule[] {
    return rules.filter((r) => {
      // Dates from Redis cache may be ISO strings — handle both
      const from = r.effectiveFrom instanceof Date
        ? r.effectiveFrom.getTime()
        : new Date(r.effectiveFrom as unknown as string).getTime();
      const to = r.effectiveTo
        ? (r.effectiveTo instanceof Date ? r.effectiveTo.getTime() : new Date(r.effectiveTo as unknown as string).getTime())
        : Infinity;
      const eval_ = evalDate.getTime();
      return eval_ >= from && eval_ < to;
    });
  }

  private buildCacheKey(type: PolicyType, country: string, state?: string | null, city?: string | null): string {
    return `policy:${type}:${country}:${state || '*'}:${city || '*'}`;
  }
}
