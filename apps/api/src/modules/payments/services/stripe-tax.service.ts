import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '@/common/prisma/prisma.service';

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
      this.logger.warn('Stripe secret key not configured');
      return;
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  /**
   * Calculate tax for a transaction
   */
  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    try {
      // For now, return a simple tax calculation
      // In production, this would use Stripe Tax API
      const taxRate = 0.08; // 8% default tax rate
      const taxAmount = request.amount * taxRate;

      const result: TaxCalculationResult = {
        amount: request.amount,
        tax: taxAmount,
        total: request.amount + taxAmount,
        taxBreakdown: [
          {
            name: 'Sales Tax',
            amount: taxAmount,
            rate: taxRate * 100,
            type: 'state',
          },
        ],
        taxRate,
        jurisdiction: 'US',
        taxable: true,
      };

      // Save tax calculation to database (simplified)
      // await this.saveTaxCalculation(request, result);

      return result;
    } catch (error) {
      this.logger.error('Tax calculation failed', error);

      // Return default tax calculation (no tax)
      return {
        amount: request.amount,
        tax: 0,
        total: request.amount,
        taxBreakdown: [],
        taxRate: 0,
        jurisdiction: 'Unknown',
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
   * Get tax registrations for the business
   */
  async getTaxRegistrations(): Promise<TaxRegistration[]> {
    try {
      // Return empty array for now - would integrate with Stripe Tax API in production
      return [];
    } catch (error) {
      this.logger.error('Failed to get tax registrations', error);
      return [];
    }
  }

  /**
   * Register for tax in a new jurisdiction
   */
  async registerForTax(country: string, state?: string, taxId?: string): Promise<TaxRegistration> {
    try {
      // Return mock registration for now
      const result: TaxRegistration = {
        id: 'mock_registration',
        country,
        state,
        taxId,
        registrationStatus: 'pending',
        effectiveDate: new Date(),
      };

      this.logger.log(`Tax registration created: ${result.id}`);

      return result;
    } catch (error) {
      this.logger.error('Failed to register for tax', error);
      throw error;
    }
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
          totalIncome += booking.totalPrice;
          // totalTax would be calculated from payments in a real implementation
        } else {
          // Renter expenses
          totalExpenses += booking.totalPrice;
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
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
        },
      });

      if (!user || user.country !== 'US') {
        throw new Error('User is not eligible for 1099 form');
      }

      if (taxSummary.totalIncome < 600) {
        throw new Error('Income is below 1099 threshold');
      }

      // Generate 1099 data
      const formData = {
        recipient: {
          name: `${user.firstName} ${user.lastName}`,
          taxId: 'N/A', // Would be stored in user profile in production
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
          name: 'Rental Portal Inc.',
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

      // Save 1099 form to database (simplified - would use proper schema in production)
      // const savedForm = await this.prisma.taxForm.create({
      //   data: { userId, type: 'FORM_1099', year, formData, generatedAt: new Date() },
      // });

      this.logger.log(`1099 form generated for user ${userId}, year ${year}`);

      return { ...formData, id: 'mock_id' };
    } catch (error) {
      this.logger.error('Failed to generate 1099 form', error);
      throw error;
    }
  }

  /**
   * Get supported tax jurisdictions
   */
  async getSupportedJurisdictions(): Promise<any[]> {
    try {
      // Return mock jurisdictions for now
      return [
        { country: 'US', state: 'CA', supported: true, taxRates: [] },
        { country: 'US', state: 'NY', supported: true, taxRates: [] },
        { country: 'US', state: 'TX', supported: true, taxRates: [] },
      ];
    } catch (error) {
      this.logger.error('Failed to get supported jurisdictions', error);
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
        currency: 'USD',
        customerAddress: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
        businessAddress: {
          line1: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
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
  ): Promise<void> {
    try {
      // Save to database (simplified - would use proper schema in production)
      // await this.prisma.taxCalculation.create({
      //   data: { amount: result.amount, tax: result.tax, requestData: request, resultData: result },
      // });
      this.logger.log('Tax calculation saved (mock implementation)');
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
