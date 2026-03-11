import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  LedgerSide,
  TransactionType,
  AccountType,
  LedgerEntryStatus,
  toNumber,
} from '@rental-portal/database';
import { roundForCurrency } from '@rental-portal/shared-types';

// Export for test imports
export { TransactionType, AccountType };

export interface LedgerEntryDto {
  bookingId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  description: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LedgerService {
  private readonly defaultCurrency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.defaultCurrency = this.config.get<string>('platform.defaultCurrency', 'USD');
  }

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
    await this.prisma.$transaction(async (tx: any) => {
      // 1. Renter pays total amount (debit renter cash/bank, credit platform liability)
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.CASH, // Renter's "account"
            transactionType: TransactionType.PAYMENT,
            side: LedgerSide.DEBIT,
            amount: roundForCurrency(amounts.total, amounts.currency),
            currency: amounts.currency,
            description: 'Booking payment',
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.LIABILITY, // Platform liability
            transactionType: TransactionType.PAYMENT,
            side: LedgerSide.CREDIT,
            amount: roundForCurrency(amounts.total, amounts.currency),
            currency: amounts.currency,
            description: 'Booking payment received',
            status: LedgerEntryStatus.SETTLED,
          },
        ],
      });

      // 2. Record platform fee as revenue
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.LIABILITY,
            transactionType: TransactionType.PLATFORM_FEE,
            side: LedgerSide.DEBIT,
            amount: roundForCurrency(amounts.platformFee, amounts.currency),
            currency: amounts.currency,
            description: 'Platform fee',
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.REVENUE,
            transactionType: TransactionType.PLATFORM_FEE,
            side: LedgerSide.CREDIT,
            amount: roundForCurrency(amounts.platformFee, amounts.currency),
            currency: amounts.currency,
            description: 'Platform fee revenue',
            status: LedgerEntryStatus.SETTLED,
          },
        ],
      });

      // 3. Record service fee as revenue
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.LIABILITY,
            transactionType: TransactionType.SERVICE_FEE,
            side: LedgerSide.DEBIT,
            amount: roundForCurrency(amounts.serviceFee, amounts.currency),
            currency: amounts.currency,
            description: 'Service fee',
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.REVENUE,
            transactionType: TransactionType.SERVICE_FEE,
            side: LedgerSide.CREDIT,
            amount: roundForCurrency(amounts.serviceFee, amounts.currency),
            currency: amounts.currency,
            description: 'Service fee revenue',
            status: LedgerEntryStatus.SETTLED,
          },
        ],
      });

      // 4. Record owner earnings as payable
      const ownerEarnings = amounts.subtotal; // Assuming subtotal is what owner gets before platform fee deduction?
      // Actually standard: Owner Earnings = Total - ServiceFee - PlatformFee.
      // The parameter says 'subtotal'. Let's stick to the logic provided in params.
      // previous code: const ownerEarnings = amounts.subtotal - amounts.platformFee;
      const calculatedOwnerEarnings = roundForCurrency(amounts.subtotal - amounts.platformFee, amounts.currency);

      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.LIABILITY,
            transactionType: TransactionType.OWNER_EARNING,
            side: LedgerSide.DEBIT,
            amount: calculatedOwnerEarnings,
            currency: amounts.currency,
            description: 'Owner earnings',
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.RECEIVABLE, // Owner's Receivable
            transactionType: TransactionType.OWNER_EARNING,
            side: LedgerSide.CREDIT,
            amount: calculatedOwnerEarnings,
            currency: amounts.currency,
            description: 'Booking earnings',
            status: LedgerEntryStatus.SETTLED,
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
    await this.prisma.$transaction(async (tx: any) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.CASH,
            transactionType: TransactionType.REFUND,
            // Refund: Credit CASH = money leaves the platform
            side: LedgerSide.CREDIT,
            amount: amount,
            currency,
            description: 'Booking refund',
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.LIABILITY,
            transactionType: TransactionType.REFUND,
            // Refund: Debit LIABILITY = platform's liability to renter decreases
            side: LedgerSide.DEBIT,
            amount: amount,
            currency,
            description: 'Refund processed',
            status: LedgerEntryStatus.SETTLED,
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
    const latestBooking = await this.prisma.booking.findFirst({
      where: {
        listing: { ownerId },
        status: { in: ['COMPLETED', 'SETTLED'] },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!latestBooking) {
      throw new Error('No completed booking found to attach payout ledger entry');
    }

    await this.recordPayoutWithBooking(latestBooking.id, ownerId, amount, currency, payoutId);
  }

  async recordPayoutWithBooking(
    bookingId: string,
    ownerId: string,
    amount: number,
    currency: string,
    payoutId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.RECEIVABLE,
            transactionType: TransactionType.PAYOUT,
            side: LedgerSide.DEBIT, // Debit Receivable (Decrease liability to owner)
            amount: amount,
            currency,
            description: `Payout ${payoutId}`,
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.CASH,
            transactionType: TransactionType.PAYOUT,
            side: LedgerSide.CREDIT, // Credit Cash (Money leaves platform)
            amount: amount,
            currency,
            description: `Payout ${payoutId}`,
            status: LedgerEntryStatus.SETTLED,
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
    await this.prisma.$transaction(async (tx: any) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.CASH,
            transactionType: TransactionType.DEPOSIT_HOLD,
            side: LedgerSide.CREDIT, // Credit Renter (Hold money out)
            amount: amount,
            currency,
            description: 'Security deposit hold',
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.LIABILITY,
            transactionType: TransactionType.DEPOSIT_HOLD,
            side: LedgerSide.DEBIT, // Debit Liability (We owe it back/hold it)
            amount: amount,
            currency,
            description: 'Deposit held',
            status: LedgerEntryStatus.SETTLED,
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
    await this.prisma.$transaction(async (tx: any) => {
      await tx.ledgerEntry.createMany({
        data: [
          {
            bookingId,
            accountType: AccountType.CASH,
            transactionType: TransactionType.DEPOSIT_RELEASE,
            side: LedgerSide.DEBIT, // Receive money back
            amount: amount,
            currency,
            description: 'Security deposit released',
            status: LedgerEntryStatus.SETTLED,
          },
          {
            bookingId,
            accountType: AccountType.LIABILITY,
            transactionType: TransactionType.DEPOSIT_RELEASE,
            side: LedgerSide.CREDIT, // Release liability
            amount: amount,
            currency,
            description: 'Deposit released',
            status: LedgerEntryStatus.SETTLED,
          },
        ],
      });
    });
  }

  async getUserBalance(userId: string, currency?: string): Promise<number> {
    // Determine balance by aggregating Booking-related ledger entries?
    // Since LedgerEntry doesn't have userId, this is hard.
    // We assume AccountType.RECEIVABLE for Owner Earnings + Payouts matches ownerId.
    // We assume AccountType.CASH for Renter payments matches renterId.

    // Aggregation logic:
    // Find bookings where User is Owner -> sum(Receivable Side=Credit) - sum(Receivable Side=Debit)
    // Find bookings where User is Renter -> sum(Cash Side=Debit) - sum(Cash Side=Credit) ?

    // Simplified: Just use the transaction types.
    // Owner Balance = OWNER_EARNING + PAYOUT (Negative)

    const ownerBookings = await this.prisma.booking.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const ownerBookingIds = ownerBookings.map((b) => b.id);

    if (ownerBookingIds.length === 0) return 0;

    // Calculate Owner Balance (Receivable Account)
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        bookingId: { in: ownerBookingIds },
        accountType: AccountType.RECEIVABLE,
        currency,
        status: LedgerEntryStatus.SETTLED,
      },
    });

    return entries.reduce((balance, entry) => {
      // Credit increases Receivable (Earning), Debit decreases it (Payout)
      if (entry.side === LedgerSide.CREDIT) return balance + toNumber(entry.amount);
      if (entry.side === LedgerSide.DEBIT) return balance - toNumber(entry.amount);
      return balance;
    }, 0);
  }

  async getBookingLedger(bookingId: string): Promise<unknown[]> {
    return this.prisma.ledgerEntry.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPlatformRevenue(
    startDate: Date,
    endDate: Date,
    currency?: string,
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
        status: LedgerEntryStatus.SETTLED,
      },
    });

    const platformFees = entries
      .filter((e) => e.transactionType === TransactionType.PLATFORM_FEE)
      .reduce((sum, e) => {
        // Revenue: Credit is positive
        const sign = e.side === LedgerSide.CREDIT ? 1 : -1;
        return sum + toNumber(e.amount) * sign;
      }, 0);

    const serviceFees = entries
      .filter((e) => e.transactionType === TransactionType.SERVICE_FEE)
      .reduce((sum, e) => {
        const sign = e.side === LedgerSide.CREDIT ? 1 : -1;
        return sum + toNumber(e.amount) * sign;
      }, 0);

    return {
      platformFees,
      serviceFees,
      total: platformFees + serviceFees,
    };
  }

  async getUserTransactions(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(Math.max(1, options.limit || 20), 100);
    const skip = (page - 1) * limit;

    // Get user's bookings (both as owner and renter)
    const ownerBookings = await this.prisma.booking.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        ownerId: true,
        renterId: true,
        totalPrice: true,
        currency: true,
        createdAt: true,
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const renterBookings = await this.prisma.booking.findMany({
      where: { renterId: userId },
      select: {
        id: true,
        ownerId: true,
        renterId: true,
        totalPrice: true,
        currency: true,
        createdAt: true,
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const bookings = [...ownerBookings, ...renterBookings];
    const ownerBookingIds = ownerBookings.map((b) => b.id);
    const renterBookingIds = renterBookings.map((b) => b.id);

    if (ownerBookingIds.length === 0 && renterBookingIds.length === 0) {
      return { transactions: [], total: 0, page, limit };
    }

    // Build where clause for ledger entries, scoped by role-specific account types
    const where: any = {
      OR: [
        ownerBookingIds.length
          ? { bookingId: { in: ownerBookingIds }, accountType: AccountType.RECEIVABLE }
          : undefined,
        renterBookingIds.length
          ? { bookingId: { in: renterBookingIds }, accountType: AccountType.CASH }
          : undefined,
      ].filter(Boolean),
    };

    if (options.type) {
      where.transactionType = options.type;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    // Get total count
    const total = await this.prisma.ledgerEntry.count({ where });

    // Get paginated entries
    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    // Format transactions for frontend
    const transactions = entries.map((entry) => {
      const booking = bookings.find((b) => b.id === entry.bookingId);
      const isOwner = booking?.ownerId === userId;
      const isRenter = booking?.renterId === userId;
      const isReceivable = entry.accountType === AccountType.RECEIVABLE;
      const isCash = entry.accountType === AccountType.CASH;
      const isCredit = entry.side === LedgerSide.CREDIT;
      const amount = toNumber(entry.amount);
      let amountSigned = amount;

      if (isOwner && isReceivable) {
        amountSigned = isCredit ? amount : -amount;
      } else if (isRenter && isCash) {
        amountSigned = isCredit ? amount : -amount;
      } else {
        amountSigned = isCredit ? amount : -amount;
      }

      return {
        id: entry.id,
        bookingId: entry.bookingId,
        type: entry.transactionType,
        amount: amount,
        amountSigned,
        currency: entry.currency,
        status: entry.status,
        description: entry.description,
        createdAt: entry.createdAt,
        side: entry.side,
        accountType: entry.accountType,
        booking: booking?.listing
          ? {
              id: booking.id,
              listing: {
                id: booking.listing.id,
                title: booking.listing.title,
              },
            }
          : undefined,
      };
    });

    return { transactions, total, page, limit };
  }

  async getOwnerEarningsSummary(
    ownerId: string,
    currency?: string,
  ): Promise<{ thisMonth: number; lastMonth: number; total: number; currency: string }> {
    const bookings = await this.prisma.booking.findMany({
      where: { ownerId },
      select: { id: true },
    });
    const bookingIds = bookings.map((b) => b.id);

    if (bookingIds.length === 0) {
      return { thisMonth: 0, lastMonth: 0, total: 0, currency };
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const baseWhere = {
      bookingId: { in: bookingIds },
      transactionType: TransactionType.OWNER_EARNING,
      accountType: AccountType.RECEIVABLE,
      side: LedgerSide.CREDIT,
      currency,
      status: LedgerEntryStatus.SETTLED,
    };

    const [thisMonthAgg, lastMonthAgg, totalAgg] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { ...baseWhere, createdAt: { gte: thisMonthStart, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { ...baseWhere, createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { ...baseWhere },
        _sum: { amount: true },
      }),
    ]);

    return {
      thisMonth: toNumber(thisMonthAgg._sum.amount || 0),
      lastMonth: toNumber(lastMonthAgg._sum.amount || 0),
      total: toNumber(totalAgg._sum.amount || 0),
      currency,
    };
  }
}
