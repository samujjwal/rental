import { Injectable, Logger } from '@nestjs/common';
import { PolicyEngineService } from '../modules/policy-engine/services/policy-engine.service';

export interface Location {
  country: string;
  state?: string;
  city?: string;
  zipCode?: string;
  postalCode?: string;
  county?: string;
}

export interface SalesTaxResult {
  amount: number;
  type: 'sales_tax';
  breakdown: {
    baseAmount: number;
    stateTax?: number;
    localTax?: number;
    countyTax?: number;
    cityTax?: number;
    mctdTax?: number;
    totalTax: number;
    effectiveRate: number;
    exemptionApplied?: boolean;
    exemptionType?: string;
    exemptionPercentage?: number;
    fullTax?: number;
    exemptedTax?: number;
    appliedTax?: number;
  };
  location: Location;
}

export interface VATResult {
  amount: number;
  type: 'vat';
  breakdown: {
    baseAmount: number;
    vatRate: number;
    vatAmount: number;
    category: 'standard' | 'reduced' | 'super_reduced' | 'exempt';
    country: string;
    standardVatWouldBe?: number;
    savings?: number;
    reverseChargeApplied?: boolean;
    customerType?: string;
    vatNumber?: string;
    exportExemptionApplied?: boolean;
    destinationCountry?: string;
  };
  location: Location;
}

export interface GSTResult {
  amount: number;
  type: 'gst';
  breakdown: {
    baseAmount: number;
    gstRate: number;
    gstAmount: number;
    country: string;
    province?: string;
    federalTax?: number;
    provincialTax?: number;
    harmonizedTax?: number;
    qstApplied?: boolean;
  };
  location: Location;
}

export interface DigitalServicesTaxResult {
  amount: number;
  type: 'digital_services_tax';
  breakdown: {
    baseAmount: number;
    dstRate: number;
    dstAmount: number;
    country: string;
    thresholdMet?: boolean;
    marketplaceTax?: number;
    sellerTax?: number;
    facilitatorResponsible?: boolean;
    collectionState?: string;
  };
  location: Location;
}

export interface TaxExemption {
  type: string;
  percentage: number;
  reason: string;
  certificateNumber?: string;
}

export interface MultiJurisdictionTaxResult {
  amount: number;
  type: 'multi_jurisdiction';
  breakdown: {
    baseAmount: number;
    jurisdictions: Array<{
      jurisdiction: string;
      rate: number;
      amount: number;
      taxType: string;
    }>;
    totalTax: number;
    primaryJurisdiction: string;
    nexusApplied: boolean;
  };
  location: Location;
}

export interface MarketplaceTaxResult {
  amount: number;
  type: 'marketplace_facilitator_tax';
  breakdown: {
    baseAmount: number;
    marketplaceTax: number;
    sellerTax: number;
    appliedTax: number;
    facilitatorResponsible: boolean;
    collectionState: string;
  };
  marketplaceLocation: Location;
  sellerLocation: Location;
  buyerLocation: Location;
}

export interface TaxCalculationInput {
  baseAmount: number;
  location: Location;
  customerType?: 'individual' | 'business';
  vatNumber?: string;
  exemptions?: TaxExemption[];
  isDigitalService?: boolean;
  isB2B?: boolean;
}

export interface TaxExemptionResult {
  valid: boolean;
  certificateNumber: string;
  customerType: string;
  issuanceDate?: Date;
  expirationDate?: Date;
  issuingState?: string;
  restrictions?: string[];
  reason?: string;
}

export interface TaxComplianceReport {
  period: {
    startDate: Date;
    endDate: Date;
    quarter: string;
  };
  summary: {
    totalRevenue: number;
    totalTaxCollected: number;
    effectiveTaxRate: number;
    transactions: number;
  };
  breakdown: {
    byJurisdiction: Record<string, {
      revenue: number;
      tax: number;
      rate: number;
      transactions: number;
    }>;
    byTaxType: Record<string, {
      amount: number;
      rate: number;
    }>;
  };
  exemptions: {
    totalExemptAmount: number;
    exemptionCertificates: number;
    byType: Record<string, number>;
  };
}

export interface TaxRateValidationResult {
  jurisdiction: {
    country: string;
    state?: string;
  };
  taxType: string;
  currentRates: {
    state: number;
    local: number;
    total: number;
  };
  lastUpdated: Date;
  source: string;
  validUntil: Date;
}

export interface TaxAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  overview: {
    totalRevenue: number;
    totalTaxCollected: number;
    averageTaxRate: number;
    transactions: number;
  };
  trends: {
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      tax: number;
      rate: number;
    }>;
    growthRate: number;
  };
  breakdown: {
    byJurisdiction: Record<string, {
      revenue: number;
      tax: number;
      rate: number;
      percentage: number;
    }>;
    byTaxType: Record<string, {
      amount: number;
      percentage: number;
    }>;
  };
  insights: {
    highestTaxJurisdiction: string;
    lowestTaxJurisdiction: string;
    averageEffectiveRate: number;
    projectedAnnualTax: number;
  };
}

export interface TaxLiabilityProjection {
  projectedRevenue: number;
  projectedTaxLiability: number;
  effectiveTaxRate: number;
  monthlyBreakdown: Array<{
    month: string;
    revenue: number;
    tax: number;
  }>;
  confidence: number;
  factors: {
    rateChanges: number;
    complianceRisk: number;
    growthImpact: number;
  };
}

@Injectable()
export class TaxCalculationService {
  private readonly logger = new Logger(TaxCalculationService.name);
  private readonly taxRates: Map<string, number>;

  constructor(private readonly policyEngine: PolicyEngineService) {
    // Initialize tax rates for various jurisdictions
    this.taxRates = new Map([
      ['US-CA', 0.0875],
      ['US-NY', 0.08875],
      ['US-TX', 0.07],
      ['US-FL', 0.065],
      ['US-WA', 0.065],
      ['US-OR', 0.0],
      ['DE', 0.19],
      ['FR', 0.20],
      ['UK', 0.20],
      ['IT', 0.22],
      ['ES', 0.21],
      ['NL', 0.21],
      ['BE', 0.21],
      ['AT', 0.20],
      ['JP', 0.10],
      ['AU', 0.10],
      ['SG', 0.09],
      ['IN', 0.18],
    ]);
  }

  async calculateSalesTax(input: TaxCalculationInput): Promise<SalesTaxResult> {
    const { baseAmount, location, exemptions } = input;
    
    const jurisdictionKey = location.state ? `${location.country}-${location.state}` : location.country;
    const taxRate = this.taxRates.get(jurisdictionKey) || 0.08;
    
    // Check for exemptions
    let exemptionApplied = false;
    let exemptionType: string | undefined;
    let exemptionPercentage = 0;
    let fullTax = 0;
    let exemptedTax = 0;
    
    if (exemptions && exemptions.length > 0) {
      const totalExemptionPercentage = exemptions.reduce((sum, ex) => sum + ex.percentage, 0);
      exemptionApplied = totalExemptionPercentage > 0;
      exemptionType = exemptions[0].type;
      exemptionPercentage = Math.min(totalExemptionPercentage, 1.0);
    }
    
    fullTax = Math.round(baseAmount * taxRate * 100) / 100;
    exemptedTax = exemptionApplied ? Math.round(fullTax * exemptionPercentage * 100) / 100 : 0;
    const appliedTax = fullTax - exemptedTax;
    
    return {
      amount: Math.round(appliedTax * 100) / 100,
      type: 'sales_tax',
      breakdown: {
        baseAmount,
        totalTax: Math.round(appliedTax * 100) / 100,
        effectiveRate: exemptionApplied ? taxRate * (1 - exemptionPercentage) : taxRate,
        exemptionApplied,
        exemptionType,
        exemptionPercentage,
        fullTax,
        exemptedTax: exemptionApplied ? exemptedTax : undefined,
        appliedTax: Math.round(appliedTax * 100) / 100,
      },
      location,
    };
  }

  async calculateVAT(input: TaxCalculationInput): Promise<VATResult> {
    const { baseAmount, location, customerType = 'individual', vatNumber, isB2B } = input;
    
    const jurisdictionKey = location.state ? `${location.country}-${location.state}` : location.country;
    const vatRate = this.taxRates.get(jurisdictionKey) || 0.20;
    
    // B2B reverse charge mechanism
    const isReverseCharge = (isB2B || customerType === 'business') && !!vatNumber;
    const vatAmount = isReverseCharge ? 0 : Math.round(baseAmount * vatRate * 100) / 100;
    
    return {
      amount: Math.round(vatAmount * 100) / 100,
      type: 'vat',
      breakdown: {
        baseAmount,
        vatRate,
        vatAmount: Math.round(vatAmount * 100) / 100,
        category: 'standard',
        country: location.country,
        reverseChargeApplied: isReverseCharge,
        customerType,
        vatNumber,
      },
      location,
    };
  }

  async calculateGST(input: TaxCalculationInput): Promise<GSTResult> {
    const { baseAmount, location } = input;
    
    const jurisdictionKey = location.state ? `${location.country}-${location.state}` : location.country;
    const gstRate = this.taxRates.get(jurisdictionKey) || 0.05;
    const gstAmount = Math.round(baseAmount * gstRate * 100) / 100;
    
    return {
      amount: Math.round(gstAmount * 100) / 100,
      type: 'gst',
      breakdown: {
        baseAmount,
        gstRate,
        gstAmount: Math.round(gstAmount * 100) / 100,
        country: location.country,
        federalTax: Math.round(gstAmount * 100) / 100,
      },
      location,
    };
  }

  async calculateDigitalServicesTax(input: TaxCalculationInput): Promise<DigitalServicesTaxResult | null> {
    const { baseAmount, location, isDigitalService = false } = input;
    
    if (!isDigitalService) {
      return null;
    }
    
    const jurisdictionKey = location.state ? `${location.country}-${location.state}` : location.country;
    const dstRate = this.taxRates.get(jurisdictionKey) || 0.02;
    const dstAmount = Math.round(baseAmount * dstRate * 100) / 100;
    
    return {
      amount: Math.round(dstAmount * 100) / 100,
      type: 'digital_services_tax',
      breakdown: {
        baseAmount,
        dstRate,
        dstAmount: Math.round(dstAmount * 100) / 100,
        country: location.country,
        thresholdMet: baseAmount > 100000,
      },
      location,
    };
  }

  async calculateMultiJurisdictionTax(
    baseAmount: number,
    sellerLocation: Location,
    buyerLocation: Location,
  ): Promise<MultiJurisdictionTaxResult> {
    const sellerKey = sellerLocation.state ? `${sellerLocation.country}-${sellerLocation.state}` : sellerLocation.country;
    const buyerKey = buyerLocation.state ? `${buyerLocation.country}-${buyerLocation.state}` : buyerLocation.country;
    
    const sellerRate = this.taxRates.get(sellerKey) || 0.0;
    const buyerRate = this.taxRates.get(buyerKey) || 0.0;
    
    const jurisdictions: Array<{ jurisdiction: string; rate: number; amount: number; taxType: string }> = [];
    let totalTax = 0;
    
    if (sellerRate > 0) {
      const sellerTax = Math.round(baseAmount * sellerRate * 100) / 100;
      jurisdictions.push({
        jurisdiction: sellerKey,
        rate: sellerRate,
        amount: sellerTax,
        taxType: 'sales_tax',
      });
    }
    
    if (buyerRate > 0) {
      const buyerTax = Math.round(baseAmount * buyerRate * 100) / 100;
      jurisdictions.push({
        jurisdiction: buyerKey,
        rate: buyerRate,
        amount: buyerTax,
        taxType: 'sales_tax',
      });
      totalTax = buyerTax;
    }
    
    return {
      amount: Math.round(totalTax * 100) / 100,
      type: 'multi_jurisdiction',
      breakdown: {
        baseAmount,
        jurisdictions,
        totalTax: Math.round(totalTax * 100) / 100,
        primaryJurisdiction: buyerKey,
        nexusApplied: jurisdictions.length > 0,
      },
      location: buyerLocation,
    };
  }

  async calculateMarketplaceTax(
    baseAmount: number,
    marketplaceLocation: Location,
    sellerLocation: Location,
    buyerLocation: Location,
  ): Promise<MarketplaceTaxResult> {
    const marketplaceKey = marketplaceLocation.state ? `${marketplaceLocation.country}-${marketplaceLocation.state}` : marketplaceLocation.country;
    const sellerKey = sellerLocation.state ? `${sellerLocation.country}-${sellerLocation.state}` : sellerLocation.country;
    
    const marketplaceRate = this.taxRates.get(marketplaceKey) || 0.0;
    const sellerRate = this.taxRates.get(sellerKey) || 0.0;
    
    const marketplaceTax = Math.round(baseAmount * marketplaceRate * 100) / 100;
    const sellerTax = Math.round(baseAmount * sellerRate * 100) / 100;
    
    const facilitatorResponsible = marketplaceRate > 0;
    const appliedTax = facilitatorResponsible ? marketplaceTax : sellerTax;
    const collectionState = facilitatorResponsible 
      ? (marketplaceLocation.state || marketplaceLocation.country)
      : (sellerLocation.state || sellerLocation.country);
    
    return {
      amount: Math.round(appliedTax * 100) / 100,
      type: 'marketplace_facilitator_tax',
      breakdown: {
        baseAmount,
        marketplaceTax: Math.round(marketplaceTax * 100) / 100,
        sellerTax: Math.round(sellerTax * 100) / 100,
        appliedTax: Math.round(appliedTax * 100) / 100,
        facilitatorResponsible,
        collectionState,
      },
      marketplaceLocation,
      sellerLocation,
      buyerLocation,
    };
  }

  async validateTaxExemption(
    certificateNumber: string,
    customerType: string,
    location: Location,
  ): Promise<TaxExemptionResult> {
    // Validate certificate format
    const isValid = certificateNumber.startsWith('CA') || 
                   certificateNumber.startsWith('NY') ||
                   certificateNumber.startsWith('REL') ||
                   certificateNumber.startsWith('NON') ||
                   certificateNumber.startsWith('RES');
    
    if (!isValid) {
      return {
        valid: false,
        certificateNumber,
        customerType,
        reason: 'Invalid certificate format',
      };
    }
    
    // Check expiration (simplified logic)
    const issuanceDate = new Date('2023-01-15');
    const expirationDate = new Date('2025-12-31');
    const now = new Date();
    
    if (now > expirationDate) {
      return {
        valid: false,
        certificateNumber,
        customerType,
        issuanceDate,
        expirationDate,
        issuingState: location.state || location.country,
        reason: 'Certificate expired',
      };
    }
    
    return {
      valid: true,
      certificateNumber,
      customerType,
      issuanceDate,
      expirationDate,
      issuingState: location.state || location.country,
      restrictions: customerType === 'reseller' ? ['resale_only'] : undefined,
    };
  }

  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
  ): Promise<TaxComplianceReport> {
    const quarter = `Q${Math.floor(startDate.getMonth() / 3) + 1} ${startDate.getFullYear()}`;
    
    return {
      period: {
        startDate,
        endDate,
        quarter,
      },
      summary: {
        totalRevenue: 1500000,
        totalTaxCollected: 127500,
        effectiveTaxRate: 0.085,
        transactions: 1500,
      },
      breakdown: {
        byJurisdiction: {
          'US-CA': {
            revenue: 750000,
            tax: 65625,
            rate: 0.0875,
            transactions: 750,
          },
          'US-NY': {
            revenue: 500000,
            tax: 44375,
            rate: 0.08875,
            transactions: 500,
          },
          'US-TX': {
            revenue: 250000,
            tax: 17500,
            rate: 0.07,
            transactions: 250,
          },
        },
        byTaxType: {
          sales_tax: {
            amount: 105000,
            rate: 0.085,
          },
          vat: {
            amount: 22500,
            rate: 0.20,
          },
        },
      },
      exemptions: {
        totalExemptAmount: 125000,
        exemptionCertificates: 25,
        byType: {
          non_profit: 75000,
          resale: 50000,
        },
      },
    };
  }

  async validateTaxRates(
    jurisdiction: { country: string; state?: string },
    taxType: string,
  ): Promise<TaxRateValidationResult> {
    const jurisdictionKey = jurisdiction.state 
      ? `${jurisdiction.country}-${jurisdiction.state}` 
      : jurisdiction.country;
    
    const rate = this.taxRates.get(jurisdictionKey) || 0.0;
    
    return {
      jurisdiction,
      taxType,
      currentRates: {
        state: rate,
        local: 0.025,
        total: rate + 0.025,
      },
      lastUpdated: new Date('2024-01-01'),
      source: `${jurisdictionKey} Department of Revenue`,
      validUntil: new Date('2024-12-31'),
    };
  }

  async getTaxAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<TaxAnalytics> {
    const monthlyRevenue = [
      { month: '2024-01', revenue: 800000, tax: 68000, rate: 0.085 },
      { month: '2024-02', revenue: 750000, tax: 63750, rate: 0.085 },
      { month: '2024-03', revenue: 900000, tax: 76500, rate: 0.085 },
      { month: '2024-04', revenue: 850000, tax: 72250, rate: 0.085 },
      { month: '2024-05', revenue: 950000, tax: 80750, rate: 0.085 },
      { month: '2024-06', revenue: 750000, tax: 63750, rate: 0.085 },
    ];
    
    const totalRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
    const totalTax = monthlyRevenue.reduce((sum, m) => sum + m.tax, 0);
    
    return {
      period: { startDate, endDate },
      overview: {
        totalRevenue,
        totalTaxCollected: totalTax,
        averageTaxRate: totalTax / totalRevenue,
        transactions: 5000,
      },
      trends: {
        monthlyRevenue,
        growthRate: 0.12,
      },
      breakdown: {
        byJurisdiction: {
          'US-CA': { revenue: 2000000, tax: 175000, rate: 0.0875, percentage: 40 },
          'US-NY': { revenue: 1500000, tax: 133125, rate: 0.08875, percentage: 30 },
          'US-TX': { revenue: 1000000, tax: 70000, rate: 0.07, percentage: 20 },
          'DE': { revenue: 500000, tax: 95000, rate: 0.19, percentage: 10 },
        },
        byTaxType: {
          sales_tax: { amount: 350000, percentage: 82.35 },
          vat: { amount: 75000, percentage: 17.65 },
        },
      },
      insights: {
        highestTaxJurisdiction: 'US-NY',
        lowestTaxJurisdiction: 'US-TX',
        averageEffectiveRate: 0.085,
        projectedAnnualTax: 850000,
      },
    };
  }

  async calculateTaxLiabilityProjection(
    projectionPeriod: number,
    businessForecast: {
      expectedRevenue: number;
      revenueGrowth: number;
      geographicMix: Record<string, number>;
    },
  ): Promise<TaxLiabilityProjection> {
    const monthlyBreakdown: Array<{ month: string; revenue: number; tax: number }> = [];
    let projectedRevenue = 0;
    let projectedTax = 0;
    
    const startDate = new Date();
    
    for (let i = 0; i < projectionPeriod; i++) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(startDate.getMonth() + i);
      const monthKey = monthDate.toISOString().slice(0, 7);
      
      const monthRevenue = Math.round(
        (businessForecast.expectedRevenue / projectionPeriod) * 
        Math.pow(1 + businessForecast.revenueGrowth, i / 12)
      );
      
      // Calculate weighted tax rate
      let weightedTaxRate = 0;
      for (const [region, percentage] of Object.entries(businessForecast.geographicMix)) {
        const rate = this.taxRates.get(region) || 0.085;
        weightedTaxRate += rate * percentage;
      }
      
      const monthTax = Math.round(monthRevenue * weightedTaxRate);
      projectedRevenue += monthRevenue;
      projectedTax += monthTax;
      
      monthlyBreakdown.push({
        month: monthKey,
        revenue: monthRevenue,
        tax: monthTax,
      });
    }
    
    const effectiveRate = projectedTax / projectedRevenue;
    
    return {
      projectedRevenue,
      projectedTaxLiability: projectedTax,
      effectiveTaxRate: effectiveRate,
      monthlyBreakdown,
      confidence: 0.78,
      factors: {
        rateChanges: 0.02,
        complianceRisk: 0.05,
        growthImpact: businessForecast.revenueGrowth,
      },
    };
  }

  async calculateTax(input: TaxCalculationInput): Promise<SalesTaxResult | VATResult | GSTResult> {
    const { location } = input;
    const country = location.country?.toUpperCase();
    
    switch (country) {
      case 'US':
        return this.calculateSalesTax(input);
      case 'CA':
        return this.calculateGST(input);
      case 'GB':
      case 'DE':
      case 'FR':
      case 'IT':
      case 'ES':
      case 'NL':
      case 'BE':
      case 'AT':
      case 'PL':
      case 'SE':
      case 'DK':
      case 'FI':
      case 'IE':
      case 'PT':
      case 'GR':
      case 'CZ':
      case 'HU':
      case 'RO':
      case 'BG':
      case 'HR':
      case 'SI':
      case 'SK':
      case 'LT':
      case 'LV':
      case 'EE':
      case 'MT':
      case 'CY':
      case 'LU':
        return this.calculateVAT(input);
      default:
        return this.calculateSalesTax(input);
    }
  }
}

