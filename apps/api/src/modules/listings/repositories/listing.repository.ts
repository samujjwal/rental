import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Repository for listing data operations.
 * Provides a consistent interface for listing-related database operations.
 */
@Injectable()
export class ListingRepository {
  private readonly logger = new Logger(ListingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.listing.findUnique({
      where: { id },
    });
  }

  async findByCurrency(currency: string) {
    return this.prisma.listing.findMany({
      where: { currency },
      take: 100,
    });
  }

  async updateListing(id: string, data: any) {
    return this.prisma.listing.update({
      where: { id },
      data,
    });
  }

  async getListingStats() {
    const listings = await this.prisma.listing.findMany({
      select: {
        currency: true,
        basePrice: true,
      },
    });

    const currencyStats: Record<string, { volume: number; count: number }> = {};

    for (const listing of listings) {
      const currency = listing.currency;
      const price =
        typeof listing.basePrice === 'number' ? listing.basePrice : listing.basePrice.toNumber();

      if (!currencyStats[currency]) {
        currencyStats[currency] = { volume: 0, count: 0 };
      }
      currencyStats[currency].volume += price;
      currencyStats[currency].count += 1;
    }

    return {
      currencyStats,
    };
  }

  async convertListingCurrency(id: string, targetCurrency: string, rate: number) {
    const listing = await this.findById(id);
    if (!listing) {
      throw new Error('Listing not found');
    }

    const basePrice =
      typeof listing.basePrice === 'number' ? listing.basePrice : listing.basePrice.toNumber();
    const convertedPrice = basePrice * rate;

    return this.updateListing(id, {
      currency: targetCurrency,
      basePrice: convertedPrice as unknown as any,
    });
  }
}
