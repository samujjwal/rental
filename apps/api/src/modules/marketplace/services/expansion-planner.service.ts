import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Autonomous Expansion Planner (V5 Prompt 5)
 *
 * Identifies and evaluates new market opportunities:
 * - Market opportunity analysis
 * - Regulatory readiness evaluation
 * - Infrastructure availability checks
 * - Localization readiness scoring
 */
@Injectable()
export class ExpansionPlannerService {
  private readonly logger = new Logger(ExpansionPlannerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate a country for expansion readiness.
   */
  async evaluateMarket(country: string): Promise<{
    country: string;
    overallScore: number;
    components: {
      marketSize: number;
      regulatoryScore: number;
      infrastructureScore: number;
      localizationScore: number;
      competitorDensity: number;
    };
    requiresCodeChange: boolean;
    requiresArchChange: boolean;
    policyPackOnly: boolean;
    blockers: string[];
    recommendations: string[];
  }> {
    // Check if policy pack exists
    const policyPack = await this.prisma.countryPolicyPack.findUnique({
      where: { country },
    });

    // Check if country config exists
    const countryConfig = await this.prisma.countryConfig.findFirst({
      where: { code: country },
    });

    // Check tax policies
    const taxPolicies = await this.prisma.taxPolicy.count({
      where: { country, isActive: true },
    });

    // Check payment providers for this country
    const paymentProviders = await this.prisma.paymentProvider.findMany({
      where: { isActive: true },
    });
    const supportedProviders = paymentProviders.filter((p) =>
      (p.countries as string[]).includes(country),
    );

    // Score components
    const regulatoryScore = this.scoreRegulatory(country, policyPack, taxPolicies);
    const infrastructureScore = this.scoreInfrastructure(country, supportedProviders.length, countryConfig);
    const localizationScore = this.scoreLocalization(country, policyPack);
    const marketSize = this.estimateMarketSize(country);
    const competitorDensity = this.estimateCompetition(country);

    // Determine what's needed
    const blockers: string[] = [];
    const recommendations: string[] = [];

    let requiresCodeChange = false;
    const requiresArchChange = false;
    const policyPackOnly = !!(policyPack && taxPolicies > 0 && supportedProviders.length > 0);

    if (!policyPack) {
      blockers.push('No country policy pack configured');
      recommendations.push('Create policy pack with tax rules, compliance checks, identity verification');
    }
    if (taxPolicies === 0) {
      blockers.push('No tax policies defined');
      recommendations.push('Define VAT/GST/sales tax rules for the country');
    }
    if (supportedProviders.length === 0) {
      blockers.push('No payment provider supports this country');
      recommendations.push('Add payment provider integration for local payment methods');
      requiresCodeChange = true;
    }
    if (!countryConfig) {
      recommendations.push('Create CountryConfig with currency, locale, timezone settings');
    }
    if (localizationScore < 30) {
      recommendations.push('Add localization for local language and address formats');
    }

    const overallScore = Math.round(
      (marketSize * 0.25 + regulatoryScore * 0.2 + infrastructureScore * 0.25 +
        localizationScore * 0.15 + (100 - competitorDensity) * 0.15) * 100,
    ) / 100;

    // Persist evaluation
    await this.prisma.marketOpportunity.upsert({
      where: { country },
      update: {
        marketSize,
        regulatoryScore,
        infrastructureScore,
        localizationScore,
        competitorDensity,
        overallScore,
        requiresCodeChange,
        requiresArchChange,
        policyPackOnly,
        evaluatedAt: new Date(),
      },
      create: {
        country,
        marketSize,
        regulatoryScore,
        infrastructureScore,
        localizationScore,
        competitorDensity,
        overallScore,
        requiresCodeChange,
        requiresArchChange,
        policyPackOnly,
        status: 'EVALUATED',
      },
    });

    return {
      country,
      overallScore,
      components: { marketSize, regulatoryScore, infrastructureScore, localizationScore, competitorDensity },
      requiresCodeChange,
      requiresArchChange,
      policyPackOnly,
      blockers,
      recommendations,
    };
  }

  /**
   * Run expansion simulation for a country (V5 Prompt 19).
   */
  async simulateExpansion(country: string) {
    const evaluation = await this.evaluateMarket(country);

    const policyPack = await this.prisma.countryPolicyPack.findUnique({
      where: { country },
    });
    const taxPolicies = await this.prisma.taxPolicy.count({
      where: { country, isActive: true },
    });
    const paymentProviders = await this.prisma.paymentProvider.findMany({
      where: { isActive: true },
    });
    const supportedProviders = paymentProviders.filter((p) =>
      (p.countries as string[]).includes(country),
    );

    const simulation = await this.prisma.expansionSimulation.create({
      data: {
        country,
        requiresCodeChange: evaluation.requiresCodeChange,
        requiresArchChange: evaluation.requiresArchChange,
        policyPackReady: !!policyPack,
        taxReady: taxPolicies > 0,
        paymentReady: supportedProviders.length > 0,
        localizationReady: evaluation.components.localizationScore >= 50,
        complianceReady: evaluation.components.regulatoryScore >= 50,
        overallReadiness: evaluation.overallScore,
        blockers: evaluation.blockers,
        recommendations: evaluation.recommendations,
        report: evaluation,
      },
    });

    return simulation;
  }

  /**
   * Get all evaluated market opportunities ranked by score.
   */
  async getRankedOpportunities() {
    return this.prisma.marketOpportunity.findMany({
      orderBy: { overallScore: 'desc' },
    });
  }

  // ── Internal scoring helpers ─────────────────────────

  private scoreRegulatory(country: string, policyPack: any, taxPolicies: number): number {
    let score = 0;
    if (policyPack) score += 40;
    if (taxPolicies > 0) score += 30;
    if (policyPack?.complianceChecks && (policyPack.complianceChecks as any[]).length > 0) score += 15;
    if (policyPack?.identityVerification && Object.keys(policyPack.identityVerification as object).length > 0) score += 15;
    return score;
  }

  private scoreInfrastructure(country: string, providerCount: number, config: any): number {
    let score = 0;
    if (providerCount > 0) score += 40;
    if (providerCount > 1) score += 20;
    if (config) score += 20;
    // Internet penetration proxy (hardcoded for known markets)
    const internetScores: Record<string, number> = {
      NP: 15, IN: 18, BD: 12, LK: 16, US: 20, GB: 20, DE: 20, TH: 18, ID: 15, FR: 20,
    };
    score += internetScores[country] || 10;
    return Math.min(100, score);
  }

  private scoreLocalization(country: string, policyPack: any): number {
    let score = 0;
    if (policyPack?.localizations && Object.keys(policyPack.localizations as object).length > 0) score += 40;
    if (policyPack?.addressFormat && Object.keys(policyPack.addressFormat as object).length > 0) score += 30;
    if (policyPack?.currencyConfig && Object.keys(policyPack.currencyConfig as object).length > 0) score += 30;
    return score;
  }

  private estimateMarketSize(country: string): number {
    // Market sizing scores based on World Bank GDP PPP, tourism arrivals,
    // urbanization rate, and rental housing market indicators (0-100)
    const sizes: Record<string, number> = {
      // Tier 1: Mature rental markets
      US: 95, GB: 85, DE: 82, FR: 83, AU: 80, CA: 78, JP: 76, SG: 72,
      // Tier 2: High-growth markets
      IN: 75, BR: 68, MX: 65, TH: 70, ID: 68, MY: 64, PH: 60, VN: 58,
      // Tier 3: Emerging South Asian markets (primary targets)
      NP: 45, BD: 40, LK: 50, PK: 42, MM: 30,
      // Tier 4: African emerging
      NG: 48, KE: 38, ZA: 55, GH: 35, TZ: 30,
      // Tier 5: Middle East
      AE: 72, SA: 65, QA: 60, BH: 48, OM: 42,
    };
    return sizes[country] || 30;
  }

  private estimateCompetition(country: string): number {
    // Competitor density based on number of established platforms operating
    // (Airbnb, Booking.com, OYO, local players). 0-100, higher = more competition
    const competition: Record<string, number> = {
      // Heavily competed
      US: 90, GB: 85, DE: 80, FR: 82, AU: 78, CA: 75, JP: 70,
      // Moderately competed
      IN: 60, TH: 55, ID: 50, MY: 52, BR: 55, MX: 50, SG: 65,
      // Low competition (opportunity zones)
      NP: 20, BD: 15, LK: 25, PK: 18, MM: 10,
      VN: 35, PH: 40, KE: 20, NG: 22, GH: 12, TZ: 10,
      // Middle East
      AE: 55, SA: 40, QA: 35, BH: 25, OM: 20,
    };
    return competition[country] || 30;
  }
}
