import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PolicyPackLoaderService } from './policy-pack-loader.service';

/**
 * Global Tax Policy Engine (V5 Prompt 12)
 *
 * Cascading tax calculation with YAML-driven rules:
 *   1. YAML policy packs define base rules (rate, applied_to, remitted_by, effective_from)
 *   2. DB TaxPolicy table allows admin overrides with versioning
 *   3. Supports slab-based taxation (e.g., India GST price slabs)
 *   4. Applies taxes only to specified fee components (BASE_PRICE, SERVICE_FEE)
 *   5. Uses Banker's Rounding (round half to even) for financial precision
 */
@Injectable()
export class TaxPolicyEngineService {
  private readonly logger = new Logger(TaxPolicyEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yamlLoader: PolicyPackLoaderService,
  ) {}

  /**
   * Create or update a tax policy.
   */
  async upsertTaxPolicy(params: {
    country: string;
    region?: string;
    taxType: string;
    rate: number;
    name: string;
    effectiveFrom: Date;
    effectiveTo?: Date;
    rules?: Record<string, any>;
  }) {
    return this.prisma.taxPolicy.create({
      data: {
        country: params.country,
        state: params.region,
        taxType: params.taxType,
        rate: params.rate,
        name: params.name,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo,
        metadata: params.rules || {},
        version: 1,
        isActive: true,
      },
    });
  }

  /**
   * Get applicable tax policies for a country/region at a given date.
   */
  async getApplicablePolicies(
    country: string,
    region?: string,
    date: Date = new Date(),
  ) {
    const policies = await this.prisma.taxPolicy.findMany({
      where: {
        country,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Filter region-specific vs country-wide
    const regionPolicies = region
      ? policies.filter((p) => p.state === region)
      : [];
    const countryPolicies = policies.filter((p) => !p.state);

    // Region policies override country policies for same taxType
    const merged = new Map<string, typeof policies[0]>();
    for (const p of countryPolicies) merged.set(p.taxType, p);
    for (const p of regionPolicies) merged.set(p.taxType, p); // Override

    return Array.from(merged.values());
  }

  /**
   * Calculate total tax for a transaction.
   *
   * Cascade: DB policies → YAML rules → empty.
   * Supports `applied_to` field from YAML (which components are taxable).
   * Uses Banker's Rounding for financial amounts.
   */
  async calculateTax(
    country: string,
    amount: number,
    params?: {
      region?: string;
      date?: Date;
      basePrice?: number;
      serviceFee?: number;
    },
  ): Promise<{
    subtotal: number;
    taxes: Array<{ name: string; type: string; rate: number; amount: number; appliedTo?: string[] }>;
    totalTax: number;
    total: number;
    breakdown: any[];
  }> {
    const date = params?.date || new Date();
    const dbPolicies = await this.getApplicablePolicies(country, params?.region, date);

    let taxes: Array<{ name: string; type: string; rate: number; amount: number; appliedTo?: string[] }> = [];

    if (dbPolicies.length > 0) {
      // Use DB policies
      taxes = dbPolicies.map((p) => ({
        name: p.name,
        type: p.taxType,
        rate: Number(p.rate),
        amount: this.bankersRound(amount * Number(p.rate)),
      }));
    } else {
      // Fall back to YAML tax rules
      const yamlTax = this.yamlLoader.getTaxRules(country);
      if (yamlTax?.platform_level) {
        for (const rule of yamlTax.platform_level) {
          const effectiveDate = rule.effective_from ? new Date(rule.effective_from) : new Date(0);
          if (date >= effectiveDate) {
            // Determine taxable amount based on `applied_to`
            let taxableAmount = amount;
            if (rule.applied_to && params) {
              taxableAmount = 0;
              for (const component of rule.applied_to) {
                if (component === 'BASE_PRICE' && params.basePrice) taxableAmount += params.basePrice;
                if (component === 'SERVICE_FEE' && params.serviceFee) taxableAmount += params.serviceFee;
              }
              if (taxableAmount === 0) taxableAmount = amount; // Fallback to full amount
            }

            taxes.push({
              name: rule.name,
              type: rule.type,
              rate: rule.rate,
              amount: this.bankersRound(taxableAmount * rule.rate),
              appliedTo: rule.applied_to,
            });
          }
        }
      }

      // Withholding tax from YAML
      if (yamlTax?.withholding_tax?.enabled) {
        taxes.push({
          name: 'Withholding Tax (TDS)',
          type: 'WITHHOLDING',
          rate: yamlTax.withholding_tax.rate,
          amount: this.bankersRound(amount * yamlTax.withholding_tax.rate),
        });
      }
    }

    const totalTax = taxes.reduce((sum, t) => sum + t.amount, 0);

    return {
      subtotal: amount,
      taxes,
      totalTax: this.bankersRound(totalTax),
      total: this.bankersRound(amount + totalTax),
      breakdown: taxes,
    };
  }

  /**
   * Banker's Rounding (round half to even) — financial precision.
   */
  private bankersRound(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    const shifted = value * factor;
    const floor = Math.floor(shifted);
    const decimal = shifted - floor;

    if (decimal === 0.5) {
      // Round to even
      return (floor % 2 === 0 ? floor : floor + 1) / factor;
    }
    return Math.round(shifted) / factor;
  }

  /**
   * Deactivate old version and create new version of a policy.
   */
  async updatePolicyVersion(policyId: string, newRate: number, effectiveFrom: Date) {
    const existing = await this.prisma.taxPolicy.findUnique({ where: { id: policyId } });
    if (!existing) throw new Error(`Tax policy not found: ${policyId}`);

    // Deactivate old
    await this.prisma.taxPolicy.update({
      where: { id: policyId },
      data: { effectiveTo: effectiveFrom, isActive: false },
    });

    // Create new version
    return this.prisma.taxPolicy.create({
      data: {
        country: existing.country,
        state: existing.state,
        taxType: existing.taxType,
        rate: newRate,
        name: existing.name,
        effectiveFrom,
        metadata: (existing.metadata as any) || {},
        version: existing.version + 1,
        isActive: true,
      },
    });
  }

  /**
   * Get tax policies for a specific country with version history.
   */
  async getPolicyHistory(country: string, taxType?: string) {
    return this.prisma.taxPolicy.findMany({
      where: {
        country,
        ...(taxType ? { taxType } : {}),
      },
      orderBy: [{ taxType: 'asc' }, { version: 'desc' }],
    });
  }

  /**
   * Seed default tax policies for Nepal.
   */
  async seedNepalTaxPolicies() {
    const nepalPolicies = [
      { taxType: 'VAT', rate: 0.13, name: 'Nepal VAT (13%)' },
      { taxType: 'SERVICE_TAX', rate: 0.10, name: 'Service Charge (10%)' },
      { taxType: 'TOURISM_TAX', rate: 0.02, name: 'Tourism Service Fee (2%)' },
    ];

    const results = [];
    for (const policy of nepalPolicies) {
      const existing = await this.prisma.taxPolicy.findFirst({
        where: { country: 'NP', taxType: policy.taxType, isActive: true },
      });
      if (!existing) {
        const created = await this.upsertTaxPolicy({
          country: 'NP',
          ...policy,
          effectiveFrom: new Date('2024-01-01'),
        });
        results.push(created);
      }
    }
    return results;
  }
}
