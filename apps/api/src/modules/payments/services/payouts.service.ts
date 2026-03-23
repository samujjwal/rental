import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayoutStatus, UserRole, toNumber, decimalSubtract } from '@rental-portal/database';
import { PaymentCommandLogService } from './payment-command-log.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentCommandLog: PaymentCommandLogService,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
  ) {}

  async createPayout(
    ownerId: string,
    amount?: number,
  ): Promise<{ payoutId: string; amount: number; currency: string; status: PayoutStatus }> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        stripeConnectId: true,
        stripeOnboardingComplete: true,
      },
    });

    if (!owner?.stripeConnectId) {
      throw i18nBadRequest('payment.ownerNotConnected');
    }

    if (!owner.stripeOnboardingComplete) {
      throw i18nBadRequest('payment.ownerNotVerified');
    }

    // Get pending earnings
    const pendingEarnings = await this.getPendingEarnings(ownerId);

    if (pendingEarnings.amount === 0) {
      throw i18nBadRequest('payment.noPendingEarnings');
    }

    const payoutAmount = amount || pendingEarnings.amount;

    if (payoutAmount > pendingEarnings.amount) {
      throw i18nBadRequest('payment.insufficientFunds');
    }

    const eligibleBookings = await this.prisma.booking.findMany({
      where: {
        listing: { ownerId },
        status: { in: ['COMPLETED', 'SETTLED'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      select: { id: true },
    });
    const bookingIds = eligibleBookings.map((booking) => booking.id);

    // DB3/G10 fix: wrap payout record + command-log audit record in a single
    // atomic transaction so a crash between the two writes can never produce an
    // orphaned payout with no audit trail (or vice-versa).
    // The Bull-queue enqueue happens AFTER commit — queue ops cannot be rolled
    // back with a DB transaction.  A pending payout without a queue job is safe:
    // the reconciliation sweep picks it up on its next run.
    const { payout, command } = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.create({
        data: {
          ownerId,
          amount: payoutAmount,
          currency: pendingEarnings.currency,
          status: PayoutStatus.PENDING,
          metadata: JSON.stringify({ bookingIds }),
        },
      });

      const command = await tx.auditLog.create({
        data: {
          userId: ownerId,
          action: 'PAYOUT_COMMAND_REQUESTED',
          entityType: 'PAYOUT',
          entityId: payout.id,
          newValues: JSON.stringify({
            commandType: 'PAYOUT',
            status: 'PENDING',
            amount: payoutAmount,
            currency: pendingEarnings.currency,
            queueName: 'payments',
            requestedAt: new Date().toISOString(),
            metadata: { bookingIds },
          }),
        },
      });

      return { payout, command };
    });

    await this.paymentsQueue.add(
      'process-payout',
      {
        payoutId: payout.id,
        ownerId,
        ownerStripeConnectId: owner.stripeConnectId,
        bookingIds,
        amount: payoutAmount,
        currency: pendingEarnings.currency,
        commandId: command.id,
        timestamp: new Date().toISOString(),
      },
      {
        jobId: `payout:${payout.id}`,
      },
    );

    await this.paymentCommandLog.markEnqueued(command.id, {
      jobName: 'process-payout',
      jobId: `payout:${payout.id}`,
    });

    return {
      payoutId: payout.id,
      amount: payoutAmount,
      currency: pendingEarnings.currency,
      status: PayoutStatus.PENDING,
    };
  }

  async getPendingEarnings(ownerId: string): Promise<{ amount: number; currency: string }> {
    // Group completed booking earnings by currency to avoid summing across
    // different currencies (e.g. NPR + USD would produce a meaningless total).
    const earningsByCurrency = await this.prisma.booking.groupBy({
      by: ['currency'],
      where: {
        listing: { ownerId },
        status: { in: ['COMPLETED', 'SETTLED'] },
      },
      _sum: {
        ownerEarnings: true,
      },
    });

    // Group already-paid/pending payouts by currency as well.
    const payoutsByCurrency = await this.prisma.payout.groupBy({
      by: ['currency'],
      where: {
        ownerId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PAID, PayoutStatus.IN_TRANSIT] },
      },
      _sum: {
        amount: true,
      },
    });

    // Build a net-pending map: currency → pending amount.
    const payoutMap = new Map<string, number>(
      payoutsByCurrency.map((p) => [p.currency, toNumber(p._sum.amount || 0)]),
    );

    const pendingMap = new Map<string, number>();
    for (const e of earningsByCurrency) {
      const gross = toNumber(e._sum.ownerEarnings || 0);
      const alreadyPaid = payoutMap.get(e.currency) ?? 0;
      const net = decimalSubtract(gross, alreadyPaid);
      if (net > 0) {
        pendingMap.set(e.currency, net);
      }
    }

    // Determine the owner's primary payout currency from preferences.
    const userPrefs = await this.prisma.userPreferences.findUnique({
      where: { userId: ownerId },
      select: { currency: true },
    });
    const primaryCurrency = userPrefs?.currency || 'NPR';

    // Return earnings in the owner's primary currency; if none exist in that
    // currency, sum all currencies as a fallback warning scenario.
    if (pendingMap.has(primaryCurrency)) {
      return { amount: pendingMap.get(primaryCurrency)!, currency: primaryCurrency };
    }

    if (pendingMap.size === 1) {
      const [[currency, amount]] = [...pendingMap];
      return { amount, currency };
    }

    if (pendingMap.size > 1) {
      this.logger.warn(
        `Owner ${ownerId} has pending earnings in multiple currencies: ` +
          `[${[...pendingMap.keys()].join(', ')}]. Returning primary currency (${primaryCurrency}) ` +
          'balance only. Use getPendingEarningsByCurrency() for full breakdown.',
      );
      return { amount: pendingMap.get(primaryCurrency) ?? 0, currency: primaryCurrency };
    }

    return { amount: 0, currency: primaryCurrency };
  }

  /**
   * Returns pending earnings broken down by currency.
   * Use this for displaying per-currency balances to owners.
   */
  async getPendingEarningsByCurrency(
    ownerId: string,
  ): Promise<Array<{ amount: number; currency: string }>> {
    const earningsByCurrency = await this.prisma.booking.groupBy({
      by: ['currency'],
      where: {
        listing: { ownerId },
        status: { in: ['COMPLETED', 'SETTLED'] },
      },
      _sum: { ownerEarnings: true },
    });

    const payoutsByCurrency = await this.prisma.payout.groupBy({
      by: ['currency'],
      where: {
        ownerId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PAID, PayoutStatus.IN_TRANSIT] },
      },
      _sum: { amount: true },
    });

    const payoutMap = new Map<string, number>(
      payoutsByCurrency.map((p) => [p.currency, toNumber(p._sum.amount || 0)]),
    );

    return earningsByCurrency
      .map((e) => ({
        amount: decimalSubtract(
          toNumber(e._sum.ownerEarnings || 0),
          payoutMap.get(e.currency) ?? 0,
        ),
        currency: e.currency,
      }))
      .filter((e) => e.amount > 0);
  }

  async getOwnerPayouts(ownerId: string): Promise<unknown[]> {
    return this.prisma.payout.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePayoutStatus(payoutId: string, status: PayoutStatus): Promise<void> {
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status,
        paidAt: status === PayoutStatus.PAID ? new Date() : undefined,
      },
    });
  }

  async scheduleAutomaticPayouts(): Promise<number> {
    // Batch approach: 3 queries total regardless of owner count (was N×3 before — G10 fix).

    const PAYOUT_THRESHOLD = this.configService.get<number>('PAYOUT_THRESHOLD', 5000);
    const defaultCurrency = this.configService.get<string>('DEFAULT_CURRENCY', 'NPR');

    // 1. Fetch all eligible owners (Stripe onboarding complete) in one query.
    const owners = await this.prisma.user.findMany({
      where: {
        role: UserRole.HOST,
        stripeConnectId: { not: null },
        stripeOnboardingComplete: true,
      },
      select: { id: true, stripeConnectId: true },
    });

    if (owners.length === 0) return 0;
    const ownerIds = owners.map((o) => o.id);

    // 2. Aggregate completed-booking earnings per owner in one query.
    const earningsAgg = await this.prisma.booking.groupBy({
      by: ['ownerId'],
      where: {
        ownerId: { in: ownerIds },
        status: { in: ['COMPLETED', 'SETTLED'] },
      },
      _sum: { ownerEarnings: true },
    });

    // 3. Aggregate already-paid / pending payout amounts per owner in one query.
    const payoutsAgg = await this.prisma.payout.groupBy({
      by: ['ownerId'],
      where: {
        ownerId: { in: ownerIds },
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PAID, PayoutStatus.IN_TRANSIT] },
      },
      _sum: { amount: true },
    });

    const earningsMap = new Map(
      earningsAgg.map((e) => [e.ownerId, toNumber(e._sum.ownerEarnings || 0)]),
    );
    const payoutsMap = new Map(
      payoutsAgg.map((p) => [p.ownerId, toNumber(p._sum.amount || 0)]),
    );

    let count = 0;
    for (const owner of owners) {
      const totalEarnings = earningsMap.get(owner.id) ?? 0;
      const totalPayouts = payoutsMap.get(owner.id) ?? 0;
      const pendingAmount = decimalSubtract(totalEarnings, totalPayouts);

      if (pendingAmount >= PAYOUT_THRESHOLD) {
        try {
          // createPayout handles the Stripe-readiness guard and idempotent job enqueue.
          // We pass `pendingAmount` so it skips the internal getPendingEarnings re-query.
          await this.createPayout(owner.id, pendingAmount);
          count++;
        } catch (error) {
          this.logger.error(`Failed to schedule payout for owner ${owner.id}:`, error);
        }
      }
    }

    return count;
  }
}
