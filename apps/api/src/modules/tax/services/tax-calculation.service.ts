import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

export interface TaxBreakdown {
  subtotal: number;
  taxLines: TaxLineItem[];
  totalTax: number;
  total: number;
  currency: string;
}

export interface TaxLineItem {
  type: 'SALES_TAX' | 'VAT' | 'GST' | 'LODGING_TAX' | 'LOCAL_TAX';
  name: string;
  rate: number; // Percentage
  amount: number;
  jurisdiction: string;
}

export interface TaxCalculationInput {
  amount: number;
  currency: string;
  listingId: string;
  country: string;
  state?: string;
  city?: string;
  categoryId?: string;
  bookingType?: 'SHORT_TERM' | 'LONG_TERM';
}

// Tax rates by jurisdiction (in real implementation, use API like TaxJar, Avalara, or Stripe Tax)
interface TaxRate {
  jurisdiction: string;
  type: string;
  name: string;
  rate: number;
  applies_to: string[];
}

@Injectable()
export class TaxCalculationService {
  private readonly logger = new Logger(TaxCalculationService.name);

  // Static tax rates (for demonstration - use real tax service in production)
  private readonly taxRates: Map<string, TaxRate[]> = new Map([
    // United States
    [
      'US:CA',
      [
        {
          jurisdiction: 'California',
          type: 'SALES_TAX',
          name: 'State Sales Tax',
          rate: 7.25,
          applies_to: ['ALL'],
        },
        {
          jurisdiction: 'San Francisco',
          type: 'LOCAL_TAX',
          name: 'Local Tax',
          rate: 0.5,
          applies_to: ['ALL'],
        },
        {
          jurisdiction: 'California',
          type: 'LODGING_TAX',
          name: 'Transient Occupancy Tax',
          rate: 14.0,
          applies_to: ['SPACES'],
        },
      ],
    ],
    [
      'US:NY',
      [
        {
          jurisdiction: 'New York',
          type: 'SALES_TAX',
          name: 'State Sales Tax',
          rate: 4.0,
          applies_to: ['ALL'],
        },
        {
          jurisdiction: 'New York City',
          type: 'LOCAL_TAX',
          name: 'City Sales Tax',
          rate: 4.5,
          applies_to: ['ALL'],
        },
        {
          jurisdiction: 'New York City',
          type: 'LODGING_TAX',
          name: 'Hotel Room Occupancy Tax',
          rate: 5.875,
          applies_to: ['SPACES'],
        },
      ],
    ],
    [
      'US:TX',
      [
        {
          jurisdiction: 'Texas',
          type: 'SALES_TAX',
          name: 'State Sales Tax',
          rate: 6.25,
          applies_to: ['ALL'],
        },
      ],
    ],
    // European Union - VAT
    [
      'GB',
      [
        {
          jurisdiction: 'United Kingdom',
          type: 'VAT',
          name: 'VAT',
          rate: 20.0,
          applies_to: ['ALL'],
        },
      ],
    ],
    [
      'DE',
      [
        {
          jurisdiction: 'Germany',
          type: 'VAT',
          name: 'VAT',
          rate: 19.0,
          applies_to: ['ALL'],
        },
      ],
    ],
    [
      'FR',
      [
        {
          jurisdiction: 'France',
          type: 'VAT',
          name: 'VAT',
          rate: 20.0,
          applies_to: ['ALL'],
        },
      ],
    ],
    // Canada - GST/HST
    [
      'CA:ON',
      [
        {
          jurisdiction: 'Ontario',
          type: 'GST',
          name: 'HST (Harmonized Sales Tax)',
          rate: 13.0,
          applies_to: ['ALL'],
        },
      ],
    ],
    [
      'CA:BC',
      [
        {
          jurisdiction: 'British Columbia',
          type: 'GST',
          name: 'GST',
          rate: 5.0,
          applies_to: ['ALL'],
        },
        {
          jurisdiction: 'British Columbia',
          type: 'SALES_TAX',
          name: 'PST',
          rate: 7.0,
          applies_to: ['ALL'],
        },
      ],
    ],
    // Australia - GST
    [
      'AU',
      [
        {
          jurisdiction: 'Australia',
          type: 'GST',
          name: 'GST',
          rate: 10.0,
          applies_to: ['ALL'],
        },
      ],
    ],
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Calculate tax for a booking
   */
  async calculateTax(input: TaxCalculationInput): Promise<TaxBreakdown> {
    try {
      // Get listing details for category
      const listing = await this.prisma.listing.findUnique({
        where: { id: input.listingId },
        include: {
          category: true,
        },
      });

      if (!listing) {
        throw new Error('Listing not found');
      }

      // Determine applicable tax rates
      const taxRates = this.getTaxRates(
        input.country,
        input.state,
        input.city,
        listing.category?.slug,
      );

      // Calculate each tax line item
      const taxLines: TaxLineItem[] = [];
      let totalTax = 0;

      for (const rate of taxRates) {
        const amount = this.calculateTaxAmount(input.amount, rate.rate);
        totalTax += amount;

        taxLines.push({
          type: rate.type as any,
          name: rate.name,
          rate: rate.rate,
          amount,
          jurisdiction: rate.jurisdiction,
        });
      }

      return {
        subtotal: input.amount,
        taxLines,
        totalTax,
        total: input.amount + totalTax,
        currency: input.currency,
      };
    } catch (error) {
      this.logger.error('Tax calculation error', error);
      // Return zero tax on error to not block bookings
      return {
        subtotal: input.amount,
        taxLines: [],
        totalTax: 0,
        total: input.amount,
        currency: input.currency,
      };
    }
  }

  /**
   * Get applicable tax rates for jurisdiction and category
   */
  private getTaxRates(
    country: string,
    state?: string,
    city?: string,
    categorySlug?: string,
  ): TaxRate[] {
    // Build jurisdiction keys
    const keys: string[] = [];

    if (country && state) {
      keys.push(`${country}:${state}`);
    }
    if (country) {
      keys.push(country);
    }

    // Get all applicable rates
    let rates: TaxRate[] = [];
    for (const key of keys) {
      const jurisdictionRates = this.taxRates.get(key);
      if (jurisdictionRates) {
        rates = rates.concat(jurisdictionRates);
      }
    }

    // Filter by category if needed
    if (categorySlug) {
      rates = rates.filter((rate) => {
        return (
          rate.applies_to.includes('ALL') ||
          rate.applies_to.includes(categorySlug.toUpperCase())
        );
      });
    }

    return rates;
  }

  /**
   * Calculate tax amount from rate
   */
  private calculateTaxAmount(amount: number, ratePercent: number): number {
    return Math.round((amount * ratePercent) / 100 * 100) / 100; // Round to 2 decimals
  }

  /**
   * Check if tax exemption applies
   */
  async checkTaxExemption(
    userId: string,
    country: string,
  ): Promise<{ exempt: boolean; reason?: string }> {
    // Check if user has tax exemption certificate on file
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        country: true,
        // In real implementation, check for tax exemption fields
      },
    });

    if (!user) {
      return { exempt: false };
    }

    // Example: Check for business users with valid tax ID
    // In real implementation, verify with tax authority APIs

    return { exempt: false };
  }

  /**
   * Generate tax receipt/invoice data
   */
  async generateTaxReceipt(bookingId: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          include: {
            owner: true,
            category: true,
          },
        },
        renter: true,
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Calculate tax breakdown
    const taxBreakdown = await this.calculateTax({
      amount: booking.basePrice,
      currency: booking.currency,
      listingId: booking.listingId,
      country: booking.listing.country || 'US',
      state: booking.listing.state,
      city: booking.listing.city,
    });

    return {
      bookingId: booking.id,
      invoiceNumber: `INV-${booking.id.substring(0, 8).toUpperCase()}`,
      invoiceDate: new Date(),
      dueDate: booking.startDate,
      seller: {
        name: `${booking.listing.owner.firstName} ${booking.listing.owner.lastName}`,
        email: booking.listing.owner.email,
        taxId: booking.listing.owner.stripeConnectId, // Or actual tax ID
      },
      buyer: {
        name: `${booking.renter.firstName} ${booking.renter.lastName}`,
        email: booking.renter.email,
      },
      lineItems: [
        {
          description: `Rental: ${booking.listing.title}`,
          quantity: 1,
          unitPrice: booking.basePrice,
          amount: booking.basePrice,
        },
      ],
      taxBreakdown,
      totalAmount: taxBreakdown.total,
      currency: booking.currency,
    };
  }

  /**
   * Generate 1099 form data for owner (US tax reporting)
   */
  async generate1099Data(ownerId: string, year: number): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: {
        bookingsAsOwner: {
          where: {
            status: { in: ['COMPLETED', 'SETTLED'] },
            startDate: {
              gte: new Date(`${year}-01-01`),
              lt: new Date(`${year + 1}-01-01`),
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate total income
    const totalIncome = user.bookingsAsOwner.reduce((sum, booking) => {
      return sum + (booking.ownerEarnings || 0);
    }, 0);

    // Only need to issue 1099 if > $600 (US requirement)
    if (totalIncome < 600) {
      return null;
    }

    return {
      year,
      form: '1099-MISC',
      recipient: {
        name: `${user.firstName} ${user.lastName}`,
        taxId: user.governmentIdNumber, // SSN/EIN (encrypted in real implementation)
        address: {
          line1: user.addressLine1,
          line2: user.addressLine2,
          city: user.city,
          state: user.state,
          zip: user.postalCode,
        },
      },
      nonemployeeCompensation: totalIncome, // Box 7
      payerTaxId: process.env.COMPANY_TAX_ID, // Platform's tax ID
    };
  }

  /**
   * Get tax summary for user (for their tax filing)
   */
  async getUserTaxSummary(userId: string, year: number): Promise<any> {
    const [rentalIncome, rentalExpenses, serviceFeesPaid] = await Promise.all([
      // Income from renting out
      this.prisma.booking.aggregate({
        where: {
          listing: { ownerId: userId },
          status: { in: ['COMPLETED', 'SETTLED'] },
          startDate: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          },
        },
        _sum: {
          ownerEarnings: true,
        },
      }),
      // Expenses (platform fees)
      this.prisma.booking.aggregate({
        where: {
          listing: { ownerId: userId },
          status: { in: ['COMPLETED', 'SETTLED'] },
          startDate: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          },
        },
        _sum: {
          platformFee: true,
        },
      }),
      // Service fees paid as renter
      this.prisma.booking.aggregate({
        where: {
          renterId: userId,
          status: { in: ['COMPLETED', 'SETTLED'] },
          startDate: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          },
        },
        _sum: {
          serviceFee: true,
        },
      }),
    ]);

    return {
      year,
      rentalIncome: {
        gross: rentalIncome._sum.ownerEarnings || 0,
        platformFees: rentalExpenses._sum.platformFee || 0,
        net: (rentalIncome._sum.ownerEarnings || 0) - (rentalExpenses._sum.platformFee || 0),
      },
      rentalExpenses: {
        serviceFees: serviceFeesPaid._sum.serviceFee || 0,
      },
      taxDocuments: {
        form1099Available: (rentalIncome._sum.ownerEarnings || 0) >= 600,
      },
    };
  }

  /**
   * Validate VAT/Tax ID (for EU businesses)
   */
  async validateVATNumber(vatNumber: string, country: string): Promise<boolean> {
    // In real implementation, use VIES API for EU VAT validation
    // http://ec.europa.eu/taxation_customs/vies/
    
    const cacheKey = `vat:${country}:${vatNumber}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    try {
      // Example validation logic (simplified)
      const vatRegex = /^[A-Z]{2}[A-Z0-9]{2,13}$/;
      const isValid = vatRegex.test(vatNumber);

      // Cache result for 24 hours
      await this.cache.set(cacheKey, isValid, 24 * 60 * 60);

      return isValid;
    } catch (error) {
      this.logger.error('VAT validation error', error);
      return false;
    }
  }
}
