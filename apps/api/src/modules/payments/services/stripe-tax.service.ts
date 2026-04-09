import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { toMinorUnits, fromMinorUnits } from '@rental-portal/shared-types';
import { PrismaService } from '@/common/prisma/prisma.service';
import { toNumber } from '@rental-portal/database';

export interface TaxCalculationRequest {
  amount: number;
  currency: string;
  customerAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  businessAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  customerId?: string;
  listingId?: string;
  bookingId?: string;
}

export interface TaxCalculationResult {
  amount: number;
  tax: number;
  total: number;
  taxBreakdown: TaxLineItem[];
  taxRate: number;
  jurisdiction: string;
  taxable: boolean;
}

export interface TaxLineItem {
  name: string;
  amount: number;
  rate: number;
  type: 'state' | 'local' | 'county' | 'special' | 'federal';
}

export interface TaxRegistration {
  id: string;
  country: string;
  state?: string;
  taxId?: string;
  registrationStatus: 'registered' | 'pending' | 'exempt' | 'not_registered';
  effectiveDate: Date;
}

@Injectable()
export class StripeTaxService {
  private readonly logger = new Logger(StripeTaxService.name);
  private stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const stripeSecretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      this.logger.warn(
        'Stripe secret key not configured — tax calculations will return 0 tax until STRIPE_SECRET_KEY is set',
      );
      return;
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-01-28.clover',
    });
  }

  /**
   * Calculate tax for a transaction
   */
  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    if (!this.stripe) {
      this.logger.warn('calculateTax called but Stripe is not configured — using default 8% rate');
      const defaultTaxRate = 0.08; // 8% default tax rate
      const tax = Math.round(request.amount * defaultTaxRate);
      return {
        amount: request.amount,
        tax: tax,
        total: request.amount + tax,
        taxBreakdown: [
          {
            name: 'Default Tax',
            amount: tax,
            rate: defaultTaxRate,
            type: 'state',
          },
        ],
        taxRate: defaultTaxRate,
        jurisdiction: this.config.get<string>('platform.country', ''),
        taxable: true,
      };
    }

    try {
      const calculation = await this.stripe.tax.calculations.create({
        currency: request.currency,
        line_items: [
          {
            amount: toMinorUnits(request.amount, request.currency), // Use currency-aware conversion
            reference: 'rental',
          },
        ],
        customer_details: {
          address: {
            country:
              request.customerAddress?.country || this.config.get<string>('platform.country', ''),

            postal_code: request.customerAddress?.postalCode,
            state: request.customerAddress?.state,
            city: request.customerAddress?.city,
            line1: request.customerAddress?.line1,
            line2: request.customerAddress?.line2,
          },
        },
      });

      const taxAmount = fromMinorUnits(
        calculation.tax_amount_exclusive + calculation.tax_amount_inclusive,
        request.currency,
      );

      const taxBreakdown = calculation.tax_breakdown.map((breakdown) => ({
        name: breakdown.taxability_reason || 'Tax',
        amount: fromMinorUnits(breakdown.amount, request.currency),
        rate: Number(breakdown.tax_rate_details?.percentage_decimal || 0),
        type: 'state' as const, // Simplified mapping
      }));

      const result: TaxCalculationResult = {
        amount: request.amount,
        tax: taxAmount,
        total: request.amount + taxAmount,
        taxBreakdown,
        taxRate:
          calculation.tax_breakdown.length > 0
            ? Number(calculation.tax_breakdown[0].tax_rate_details?.percentage_decimal || 0)
            : 0,
        jurisdiction:
          request.customerAddress?.country || this.config.get<string>('platform.country', ''),
        taxable: calculation.tax_amount_exclusive > 0 || calculation.tax_amount_inclusive > 0,
      };

      // Persist asynchronously — log on failure but do not block the response.
      this.saveTaxCalculation(request, result, calculation.id).catch((err) =>
        this.logger.error('Failed to persist tax calculation record', err),
      );

      return result;
    } catch (error) {
      // CRITICAL: Stripe Tax API call failed — do NOT silently apply a hardcoded rate.
      // Return 0 tax so the booking can proceed without overcharging the user.
      // Operators should configure Stripe Tax and ensure the API key is valid.
      this.logger.error(
        'CRITICAL: Tax calculation via Stripe failed. Returning 0 tax to avoid incorrect charges. ' +
          'Verify STRIPE_SECRET_KEY and Stripe Tax configuration.',
        error,
      );
      return {
        amount: request.amount,
        tax: 0,
        total: request.amount,
        taxBreakdown: [],
        taxRate: 0,
        jurisdiction: this.config.get<string>('platform.country', ''),
        taxable: false,
      };
    }
  }

  /**
   * Create tax transaction for a completed payment
   */
  async createTaxTransaction(paymentIntentId: string, taxCalculationId?: string): Promise<any> {
    try {
      const taxTransaction = await this.stripe.tax.transactions.createFromCalculation({
        calculation: taxCalculationId || '',
        reference: paymentIntentId,
      });

      this.logger.log(`Tax transaction created: ${taxTransaction.id}`);

      return taxTransaction;
    } catch (error) {
      this.logger.error('Failed to create tax transaction', error);
      throw error;
    }
  }

  /**
   * Get tax registrations for the business from Stripe
   */
  async getTaxRegistrations(): Promise<TaxRegistration[]> {
    if (!this.stripe) {
      this.logger.warn('getTaxRegistrations called but Stripe is not configured');
      return [];
    }

    try {
      const registrations = await this.stripe.tax.registrations.list({
        status: 'active',
        limit: 100,
      });
      return registrations.data.map((reg) => ({
        id: reg.id,
        country: reg.country,
        state: (reg.country_options as any)?.[reg.country.toLowerCase()]?.state ?? undefined,
        taxId: undefined as any,
        registrationStatus:
          reg.status === 'active'
            ? 'registered'
            : reg.status === 'scheduled'
              ? 'pending'
              : 'not_registered',
        effectiveDate: new Date(reg.active_from * 1000),
      }));
    } catch (error) {
      this.logger.error('Failed to get tax registrations from Stripe', error);
      return [];
    }
  }

  /**
   * Register for tax in a new jurisdiction via Stripe Tax Registrations API.
   * See https://stripe.com/docs/api/tax/registrations/create
   */
  async registerForTax(country: string, state?: string, taxId?: string): Promise<TaxRegistration> {
    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY to enable tax registration.',
      );
    }

    try {
      // Build country-specific options required by Stripe Tax Registrations
      const countryKey = country.toLowerCase();
      const countryOptions: Record<string, any> = {
        [countryKey]: this.buildCountryOptions(country, state),
      };

      const registration = await this.stripe.tax.registrations.create({
        country: country.toUpperCase(),
        active_from: 'now',
        country_options: countryOptions as any,
      });

      this.logger.log(
        `Stripe Tax Registration created: ${registration.id} for ${country}${state ? `/${state}` : ''}`,
      );

      return {
        id: registration.id,
        country: registration.country,
        state,
        taxId,
        registrationStatus: registration.status === 'active' ? 'registered' : 'pending',
        effectiveDate: new Date(registration.active_from * 1000),
      };
    } catch (error) {
      this.logger.error(`Failed to register for tax in ${country}`, error);
      throw error;
    }
  }

  /**
   * Build country-specific tax options for the Stripe Tax Registrations API.
   * Stripe requires different option shapes per country/registration type.
   */
  private buildCountryOptions(country: string, state?: string): Record<string, any> {
    const upper = country.toUpperCase();

    // US: state-level sales tax registration
    if (upper === 'US' && state) {
      return { type: 'state_sales_tax', state };
    }

    // EU countries: standard VAT
    const euCountries = new Set([
      'AT',
      'BE',
      'BG',
      'CY',
      'CZ',
      'DE',
      'DK',
      'EE',
      'ES',
      'FI',
      'FR',
      'GR',
      'HR',
      'HU',
      'IE',
      'IT',
      'LT',
      'LU',
      'LV',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SE',
      'SI',
      'SK',
    ]);
    if (euCountries.has(upper)) {
      return { type: 'standard' };
    }

    // NP (Nepal), IN, AU, GB and other countries: standard / simplified
    return { type: 'simplified' };
  }

  /**
   * Get tax summary for a user
   */
  async getUserTaxSummary(userId: string, year?: number): Promise<any> {
    const taxYear = year || new Date().getFullYear();

    try {
      // Get all bookings for the user in the specified year
      const bookings = await this.prisma.booking.findMany({
        where: {
          OR: [{ renterId: userId }, { listing: { ownerId: userId } }],
          createdAt: {
            gte: new Date(taxYear, 0, 1),
            lt: new Date(taxYear + 1, 0, 1),
          },
          status: 'COMPLETED',
        },
        include: {
          payments: true,
          listing: true,
        },
      });

      // Calculate totals
      let totalIncome = 0;
      let totalTax = 0;
      let totalExpenses = 0;

      for (const booking of bookings) {
        if (booking.listing.ownerId === userId) {
          // Owner income
          totalIncome += toNumber(booking.totalPrice);
          // Sum tax amounts from associated payments
          for (const payment of booking.payments) {
            if ((payment as any).taxAmount) {
              totalTax += toNumber((payment as any).taxAmount);
            }
          }
        } else {
          // Renter expenses
          totalExpenses += toNumber(booking.totalPrice);
        }
      }

      return {
        year: taxYear,
        totalIncome,
        totalTax,
        totalExpenses,
        netIncome: totalIncome - totalTax,
        bookingCount: bookings.length,
        effectiveTaxRate: totalIncome > 0 ? totalTax / totalIncome : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get user tax summary', error);
      throw error;
    }
  }

  /**
   * Generate 1099 form for US users
   */
  async generate1099Form(userId: string, year: number): Promise<any> {
    try {
      const taxSummary = await this.getUserTaxSummary(userId, year);

      // Check if user needs 1099 (US person with >$600 income)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          country: true,
          governmentIdNumber: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
        },
      });

      if (!user || user.country !== 'US') {
        throw i18nBadRequest('payment.notEligibleFor1099');
      }

      if (taxSummary.totalIncome < 600) {
        throw i18nBadRequest('payment.belowThreshold');
      }

      // Generate 1099 data
      const formData = {
        recipient: {
          name: `${user.firstName} ${user.lastName}`,
          taxId: user.governmentIdNumber ?? 'N/A',
          address: {
            line1: user.addressLine1,
            line2: user.addressLine2,
            city: user.city,
            state: user.state,
            postalCode: user.postalCode,
            country: user.country,
          },
        },
        payer: {
          name: 'GharBatai Rentals Pvt. Ltd.',
          taxId: this.config.get('BUSINESS_TAX_ID'),
          address: this.config.get('BUSINESS_ADDRESS'),
        },
        year,
        totalIncome: taxSummary.totalIncome,
        totalTax: taxSummary.totalTax,
        rentalIncome: taxSummary.totalIncome,
        rentalTax: taxSummary.totalTax,
        generatedAt: new Date(),
      };

      // Persist the 1099 form record so it can be retrieved later
      const savedForm = await this.prisma.taxForm.create({
        data: {
          userId,
          type: 'FORM_1099',
          year,
          formData: formData as any,
          generatedAt: new Date(),
        },
      });

      this.logger.log(
        `1099 form generated and saved for user ${userId}, year ${year}, formId ${savedForm.id}`,
      );

      return { ...formData, id: savedForm.id };
    } catch (error) {
      this.logger.error('Failed to generate 1099 form', error);
      throw error;
    }
  }

  /**
   * Get supported tax jurisdictions
   */
  async getSupportedJurisdictions(): Promise<any[]> {
    if (!this.stripe) {
      this.logger.warn('getSupportedJurisdictions called but Stripe is not configured');
      return [];
    }

    try {
      const registrations = await this.stripe.tax.registrations.list({
        status: 'active',
        limit: 100,
      });
      return registrations.data.map((reg) => ({
        country: reg.country,
        state: (reg.country_options as any)?.[reg.country.toLowerCase()]?.state ?? undefined,
        supported: true,
        registrationId: reg.id,
        activeFrom: new Date(reg.active_from * 1000),
      }));
    } catch (error) {
      this.logger.error('Failed to get supported jurisdictions from Stripe', error);
      return [];
    }
  }

  /**
   * Test tax calculation
   */
  async testTaxCalculation(): Promise<{
    success: boolean;
    message: string;
    result?: TaxCalculationResult;
  }> {
    try {
      const testRequest: TaxCalculationRequest = {
        amount: 100,
        currency: this.config.get<string>('platform.defaultCurrency', 'USD'),
        customerAddress: {
          line1: '123 Main St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '10001',
          country: this.config.get<string>('platform.country', 'US'),
        },
        businessAddress: {
          line1: '456 Business Ave',
          city: 'Test City',
          state: 'Test State',
          postalCode: '10001',
          country: this.config.get<string>('platform.country', 'US'),
        },
      };

      const result = await this.calculateTax(testRequest);

      return {
        success: true,
        message: 'Tax calculation test completed successfully',
        result,
      };
    } catch (error) {
      this.logger.error('Tax calculation test failed', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  private async saveTaxCalculation(
    request: TaxCalculationRequest,
    result: TaxCalculationResult,
    stripeTaxId?: string,
  ): Promise<void> {
    try {
      await this.prisma.taxCalculation.create({
        data: {
          bookingId: request.bookingId ?? null,
          listingId: request.listingId ?? null,
          stripeTaxId: stripeTaxId ?? null,
          amount: result.amount,
          taxAmount: result.tax,
          totalAmount: result.total,
          taxRate: result.taxRate,
          currency: request.currency,
          jurisdiction: result.jurisdiction ?? null,
          taxBreakdown: result.taxBreakdown as any,
          customerAddress: request.customerAddress ? (request.customerAddress as any) : undefined,
          taxable: result.taxable,
        },
      });
      this.logger.log(
        `Tax calculation persisted: amount=${result.amount} tax=${result.tax} ` +
          `currency=${request.currency} stripe_id=${stripeTaxId ?? 'n/a'}`,
      );
    } catch (error) {
      this.logger.error('Failed to save tax calculation', error);
    }
  }

  private mapTaxJurisdictionType(jurisdiction: string): TaxLineItem['type'] {
    if (jurisdiction.includes('state')) return 'state';
    if (jurisdiction.includes('local')) return 'local';
    if (jurisdiction.includes('county')) return 'county';
    if (jurisdiction.includes('special')) return 'special';
    if (jurisdiction.includes('federal')) return 'federal';
    return 'local';
  }

  private getPrimaryJurisdiction(taxBreakdown: TaxLineItem[]): string {
    if (taxBreakdown.length === 0) return 'Unknown';

    // Find the highest tax amount
    const primaryTax = taxBreakdown.reduce((max, current) =>
      current.amount > max.amount ? current : max,
    );

    return primaryTax.name;
  }
}
