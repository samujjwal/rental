import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
  supportedRegions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Repository for managing currency data.
 *
 * Note: Currency data is currently managed via configuration
 * rather than database storage. This repository provides
 * a consistent interface for currency operations.
 */
@Injectable()
export class CurrencyRepository {
  private readonly logger = new Logger(CurrencyRepository.name);

  // Supported currencies from configuration
  private readonly supportedCurrencies: Map<string, Currency> = new Map([
    [
      'NPR',
      {
        code: 'NPR',
        name: 'Nepalese Rupee',
        symbol: '₹',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['NP', 'IN'],
      },
    ],
    [
      'USD',
      {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['US', 'CA', 'International'],
      },
    ],
    [
      'EUR',
      {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['EU', 'International'],
      },
    ],
    [
      'GBP',
      {
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['GB', 'International'],
      },
    ],
    [
      'INR',
      {
        code: 'INR',
        name: 'Indian Rupee',
        symbol: '₹',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['IN'],
      },
    ],
    [
      'CAD',
      {
        code: 'CAD',
        name: 'Canadian Dollar',
        symbol: 'C$',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['CA'],
      },
    ],
    [
      'AUD',
      {
        code: 'AUD',
        name: 'Australian Dollar',
        symbol: 'A$',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['AU'],
      },
    ],
    [
      'JPY',
      {
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        decimalPlaces: 0,
        isActive: true,
        supportedRegions: ['JP'],
      },
    ],
    [
      'CHF',
      {
        code: 'CHF',
        name: 'Swiss Franc',
        symbol: 'Fr',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['CH'],
      },
    ],
    [
      'CNY',
      {
        code: 'CNY',
        name: 'Chinese Yuan',
        symbol: '¥',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['CN'],
      },
    ],
  ]);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Currency | null> {
    // For now, return null as we don't have ID-based currency storage
    this.logger.warn(`findById not implemented for currencies, returning null for ${id}`);
    return null;
  }

  async findAll(): Promise<Currency[]> {
    return Array.from(this.supportedCurrencies.values()).filter((c) => c.isActive);
  }

  async findByCode(code: string): Promise<Currency | null> {
    const currency = this.supportedCurrencies.get(code.toUpperCase());
    if (currency && currency.isActive) {
      return currency;
    }
    return null;
  }

  async create(data: Partial<Currency>): Promise<Currency> {
    // For now, this is a no-op as currencies are configuration-based
    this.logger.warn(`create not implemented for currencies, currency data is configuration-based`);
    throw new Error('Currency creation not supported - currencies are configuration-based');
  }

  async update(code: string, data: Partial<Currency>): Promise<Currency> {
    // For now, this is a no-op as currencies are configuration-based
    this.logger.warn(`update not implemented for currencies, currency data is configuration-based`);
    throw new Error('Currency update not supported - currencies are configuration-based');
  }

  async getActiveCurrencies(): Promise<Currency[]> {
    return this.findAll();
  }

  async getCurrencyStats(): Promise<{
    total: number;
    active: number;
    byRegion: Record<string, number>;
  }> {
    const currencies = Array.from(this.supportedCurrencies.values());
    const active = currencies.filter((c) => c.isActive).length;
    const byRegion: Record<string, number> = {};

    for (const currency of currencies) {
      if (currency.supportedRegions) {
        for (const region of currency.supportedRegions) {
          byRegion[region] = (byRegion[region] || 0) + 1;
        }
      }
    }

    return {
      total: currencies.length,
      active,
      byRegion,
    };
  }
}
