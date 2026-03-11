import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { formatCurrency } from '@rental-portal/shared-types';

export interface CreatePriceBreakdownDto {
  bookingId: string;
  lines: Array<{
    lineType: string;
    label: string;
    amount: number;
    currency?: string;
    metadata?: Record<string, unknown>;
    sortOrder?: number;
  }>;
}

export interface FxRateDto {
  bookingId: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  rateSource: string;
}

@Injectable()
export class BookingPricingService {
  private readonly logger = new Logger(BookingPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create price breakdown line items for a booking.
   * Replaces any existing breakdown for the booking.
   */
  async createBreakdown(dto: CreatePriceBreakdownDto) {
    await this.ensureBookingExists(dto.bookingId);

    // Replace existing breakdown atomically
    const lines = await this.prisma.$transaction(async (tx: any) => {
      await tx.bookingPriceBreakdown.deleteMany({
        where: { bookingId: dto.bookingId },
      });

      const created = [];
      for (const [index, line] of dto.lines.entries()) {
        const item = await tx.bookingPriceBreakdown.create({
          data: {
            bookingId: dto.bookingId,
            lineType: line.lineType as any,
            label: line.label,
            amount: line.amount,
            currency: line.currency ?? 'NPR',
            metadata: line.metadata ? JSON.stringify(line.metadata) : null,
            sortOrder: line.sortOrder ?? index,
          },
        });
        created.push(item);
      }
      return created;
    });

    return lines;
  }

  /**
   * Get the full price breakdown for a booking.
   */
  async getBreakdown(bookingId: string): Promise<any> {
    const lines = await this.prisma.bookingPriceBreakdown.findMany({
      where: { bookingId },
      orderBy: { sortOrder: 'asc' },
    });

    const subtotal = lines.reduce(
      (sum, line) => sum + Number(line.amount),
      0,
    );

    return {
      bookingId,
      lines,
      subtotal,
      currency: lines[0]?.currency ?? 'NPR',
    };
  }

  /**
   * Calculate and create a standard price breakdown for a booking.
   */
  async calculateAndPersist(
    bookingId: string,
    params: {
      basePrice: number;
      nights: number;
      cleaningFee?: number;
      serviceFeeRate?: number;
      platformFeeRate?: number;
      securityDeposit?: number;
      taxRate?: number;
      currency?: string;
    },
  ) {
    const currency = params.currency ?? 'NPR';
    const lines: CreatePriceBreakdownDto['lines'] = [];

    // Base rate
    const baseTotal = params.basePrice * params.nights;
    lines.push({
      lineType: 'BASE_RATE',
      label: `${params.nights} night${params.nights > 1 ? 's' : ''} × ${formatCurrency(params.basePrice, currency)}`,

      amount: baseTotal,
      currency,
    });

    // Cleaning fee
    if (params.cleaningFee && params.cleaningFee > 0) {
      lines.push({
        lineType: 'CLEANING_FEE',
        label: 'Cleaning fee',
        amount: params.cleaningFee,
        currency,
      });
    }

    // Service fee (renter-side)
    const defaultServiceFeeRate = this.config.get<number>('fees.serviceFeePercent', 5) / 100;
    const serviceFeeRate = params.serviceFeeRate ?? defaultServiceFeeRate;
    const serviceFee = baseTotal * serviceFeeRate;
    if (serviceFee > 0) {
      lines.push({
        lineType: 'SERVICE_FEE',
        label: `Service fee (${(serviceFeeRate * 100).toFixed(0)}%)`,
        amount: Math.round(serviceFee * 100) / 100,
        currency,
      });
    }

    // Platform fee
    const defaultPlatformFeeRate = this.config.get<number>('fees.platformFeePercent', 10) / 100;
    const platformFeeRate = params.platformFeeRate ?? defaultPlatformFeeRate;
    const platformFee = baseTotal * platformFeeRate;
    if (platformFee > 0) {
      lines.push({
        lineType: 'PLATFORM_FEE',
        label: `Platform fee (${(platformFeeRate * 100).toFixed(0)}%)`,
        amount: Math.round(platformFee * 100) / 100,
        currency,
      });
    }

    // Security deposit
    if (params.securityDeposit && params.securityDeposit > 0) {
      lines.push({
        lineType: 'SECURITY_DEPOSIT',
        label: 'Security deposit (refundable)',
        amount: params.securityDeposit,
        currency,
      });
    }

    // Tax
    if (params.taxRate && params.taxRate > 0) {
      const taxableAmount = baseTotal + (params.cleaningFee ?? 0) + serviceFee;
      const tax = taxableAmount * params.taxRate;
      lines.push({
        lineType: 'TAX',
        label: `Tax (${(params.taxRate * 100).toFixed(1)}%)`,
        amount: Math.round(tax * 100) / 100,
        currency,
        metadata: { rate: params.taxRate, taxableAmount },
      });
    }

    return this.createBreakdown({ bookingId, lines });
  }

  /**
   * Capture FX rate at booking time.
   */
  async captureFxRate(dto: FxRateDto): Promise<any> {
    await this.ensureBookingExists(dto.bookingId);

    // Upsert to handle re-captures (e.g., if booking is recalculated)
    return this.prisma.fxRateSnapshot.upsert({
      where: { bookingId: dto.bookingId },
      create: {
        bookingId: dto.bookingId,
        baseCurrency: dto.baseCurrency,
        targetCurrency: dto.targetCurrency,
        rate: dto.rate,
        rateSource: dto.rateSource,
      },
      update: {
        baseCurrency: dto.baseCurrency,
        targetCurrency: dto.targetCurrency,
        rate: dto.rate,
        rateSource: dto.rateSource,
        capturedAt: new Date(),
      },
    });
  }

  /**
   * Get FX rate for a booking.
   */
  async getFxRate(bookingId: string): Promise<any> {
    return this.prisma.fxRateSnapshot.findUnique({
      where: { bookingId },
    });
  }

  private async ensureBookingExists(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }
  }
}
