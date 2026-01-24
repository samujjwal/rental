import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { TransactionType, AccountType } from '@rental-portal/database';

export interface LedgerEntryDto {
  bookingId?: string;
  userId?: string;
  amount: number;
  currency: string;
  type: TransactionType;
  description: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Double-entry bookkeeping: Every transaction creates two entries (debit + credit)
   * Assets = Liabilities + Equity
   */
  async recordBookingPayment(
    bookingId: string,
    renterId: string,
    ownerId: string,
    amounts: {
      total: number;
      subtotal: number;
      platformFee: number;
      serviceFee: number;
      currency: string;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Renter pays total amount (debit renter cash, credit platform liability)
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            userId: renterId,
            accountType: AccountType.CASH,
            type: TransactionType.PAYMENT,
            debit: 0,
            credit: amounts.total,
            balance: 0, // Will be calculated
            currency: amounts.currency,
            description: 'Booking payment',
          },
          {
            bookingId,
            userId: null, // Platform
            accountType: AccountType.LIABILITY,
            type: TransactionType.PAYMENT,
            debit: amounts.total,
            credit: 0,
            balance: 0,
            currency: amounts.currency,
            description: 'Booking payment received',
          },
        ],
      });

      // 2. Record platform fee as revenue
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            userId: null,
            accountType: AccountType.LIABILITY,
            type: TransactionType.PLATFORM_FEE,
            debit: 0,
            credit: amounts.platformFee,
            balance: 0,
            currency: amounts.currency,
            description: 'Platform fee',
          },
          {
            bookingId,
            userId: null,
            accountType: AccountType.REVENUE,
            type: TransactionType.PLATFORM_FEE,
            debit: amounts.platformFee,
            credit: 0,
            balance: 0,
            currency: amounts.currency,
            description: 'Platform fee revenue',
          },
        ],
      });

      // 3. Record service fee as revenue
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            userId: null,
            accountType: AccountType.LIABILITY,
            type: TransactionType.SERVICE_FEE,
            debit: 0,
            credit: amounts.serviceFee,
            balance: 0,
            currency: amounts.currency,
            description: 'Service fee',
          },
          {
            bookingId,
            userId: null,
            accountType: AccountType.REVENUE,
            type: TransactionType.SERVICE_FEE,
            debit: amounts.serviceFee,
            credit: 0,
            balance: 0,
            currency: amounts.currency,
            description: 'Service fee revenue',
          },
        ],
      });

      // 4. Record owner earnings as payable
      const ownerEarnings = amounts.subtotal - amounts.platformFee;
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            userId: null,
            accountType: AccountType.LIABILITY,
            type: TransactionType.OWNER_EARNING,
            debit: 0,
            credit: ownerEarnings,
            balance: 0,
            currency: amounts.currency,
            description: 'Owner earnings',
          },
          {
            bookingId,
            userId: ownerId,
            accountType: AccountType.RECEIVABLE,
            type: TransactionType.OWNER_EARNING,
            debit: ownerEarnings,
            credit: 0,
            balance: 0,
            currency: amounts.currency,
            description: 'Booking earnings',
          },
        ],
      });
    });
  }

  async recordRefund(
    bookingId: string,
    renterId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            userId: renterId,
            accountType: AccountType.CASH,
            type: TransactionType.REFUND,
            debit: amount,
            credit: 0,
            balance: 0,
            currency,
            description: 'Booking refund',
          },
          {
            bookingId,
            userId: null,
            accountType: AccountType.LIABILITY,
            type: TransactionType.REFUND,
            debit: 0,
            credit: amount,
            balance: 0,
            currency,
            description: 'Refund processed',
          },
        ],
      });
    });
  }

  async recordPayout(
    ownerId: string,
    amount: number,
    currency: string,
    payoutId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            userId: ownerId,
            accountType: AccountType.RECEIVABLE,
            type: TransactionType.PAYOUT,
            debit: 0,
            credit: amount,
            balance: 0,
            currency,
            description: `Payout ${payoutId}`,
          },
          {
            userId: ownerId,
            accountType: AccountType.CASH,
            type: TransactionType.PAYOUT,
            debit: amount,
            credit: 0,
            balance: 0,
            currency,
            description: `Payout ${payoutId}`,
          },
        ],
      });
    });
  }

  async recordDepositHold(
    bookingId: string,
    renterId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            userId: renterId,
            accountType: AccountType.CASH,
            type: TransactionType.DEPOSIT_HOLD,
            debit: 0,
            credit: amount,
            balance: 0,
            currency,
            description: 'Security deposit hold',
          },
          {
            bookingId,
            userId: null,
            accountType: AccountType.LIABILITY,
            type: TransactionType.DEPOSIT_HOLD,
            debit: amount,
            credit: 0,
            balance: 0,
            currency,
            description: 'Deposit held',
          },
        ],
      });
    });
  }

  async recordDepositRelease(
    bookingId: string,
    renterId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            userId: renterId,
            accountType: AccountType.CASH,
            type: TransactionType.DEPOSIT_RELEASE,
            debit: amount,
            credit: 0,
            balance: 0,
            currency,
            description: 'Security deposit released',
          },
          {
            bookingId,
            userId: null,
            accountType: AccountType.LIABILITY,
            type: TransactionType.DEPOSIT_RELEASE,
            debit: 0,
            credit: amount,
            balance: 0,
            currency,
            description: 'Deposit released',
          },
        ],
      });
    });
  }

  async getUserBalance(userId: string, currency: string = 'USD'): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        userId,
        currency,
      },
    });

    return entries.reduce((balance, entry) => {
      return balance + entry.debit - entry.credit;
    }, 0);
  }

  async getBookingLedger(bookingId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async getPlatformRevenue(
    startDate: Date,
    endDate: Date,
    currency: string = 'USD',
  ): Promise<{
    platformFees: number;
    serviceFees: number;
    total: number;
  }> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        accountType: AccountType.REVENUE,
        currency,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const platformFees = entries
      .filter((e) => e.type === TransactionType.PLATFORM_FEE)
      .reduce((sum, e) => sum + e.debit, 0);

    const serviceFees = entries
      .filter((e) => e.type === TransactionType.SERVICE_FEE)
      .reduce((sum, e) => sum + e.debit, 0);

    return {
      platformFees,
      serviceFees,
      total: platformFees + serviceFees,
    };
  }
}
