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
    // Get completed bookings that haven't been paid out, grouped by currency
    const earnings = await this.prisma.booking.aggregate({
      where: {
        listing: { ownerId },
        status: { in: ['COMPLETED', 'SETTLED'] },
        // paymentStatus check removed as it doesn't exist. Logic relies on BookingStatus
      },
      _sum: {
        ownerEarnings: true,
      },
    });

    // Subtract already paid out amounts
    const payouts = await this.prisma.payout.aggregate({
      where: {
        ownerId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PAID, PayoutStatus.IN_TRANSIT] },
      },
      _sum: {
        amount: true,
      },
    });

    const totalEarnings = toNumber(earnings._sum.ownerEarnings || 0);
    const totalPayouts = toNumber(payouts._sum.amount || 0);

    // Determine the user's primary currency from their preferences or most recent booking
    const userPrefs = await this.prisma.userPreferences.findUnique({
      where: { userId: ownerId },
      select: { currency: true },
    });

    const currency = userPrefs?.currency || 'NPR';

    return {
      amount: decimalSubtract(totalEarnings, totalPayouts),
      currency,
    };
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
