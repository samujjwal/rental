import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Repository for payment data operations.
 * Provides a consistent interface for payment-related database operations.
 */
@Injectable()
export class PaymentRepository {
  private readonly logger = new Logger(PaymentRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async findByCurrency(currency: string) {
    return this.prisma.payment.findMany({
      where: { currency },
      take: 100,
    });
  }

  async createPayment(data: any) {
    return this.prisma.payment.create({
      data,
    });
  }

  async updatePayment(id: string, data: any) {
    return this.prisma.payment.update({
      where: { id },
      data,
    });
  }

  async getPaymentStats() {
    const payments = await this.prisma.payment.findMany({
      select: {
        currency: true,
        amount: true,
      },
    });

    const currencyBreakdown: Record<string, { volume: number; transactions: number }> = {};

    for (const payment of payments) {
      const currency = payment.currency;
      const amount =
        typeof payment.amount === 'number' ? payment.amount : payment.amount.toNumber();

      if (!currencyBreakdown[currency]) {
        currencyBreakdown[currency] = { volume: 0, transactions: 0 };
      }
      currencyBreakdown[currency].volume += amount;
      currencyBreakdown[currency].transactions += 1;
    }

    const totalRevenue = Object.values(currencyBreakdown).reduce(
      (sum, curr) => sum + curr.volume,
      0,
    );

    return {
      totalRevenue,
      totalExpenses: 0,
      currencyBreakdown,
    };
  }

  async convertPaymentCurrency(id: string, targetCurrency: string, rate: number) {
    const payment = await this.findById(id);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const amount = typeof payment.amount === 'number' ? payment.amount : payment.amount.toNumber();
    const convertedAmount = amount * rate;

    return this.updatePayment(id, {
      currency: targetCurrency,
      amount: convertedAmount as unknown as any,
    });
  }
}
