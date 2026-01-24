import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StripeService } from './stripe.service';
import { LedgerService } from './ledger.service';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly ledger: LedgerService,
  ) {}

  async createPayout(
    ownerId: string,
    amount?: number,
  ): Promise<{ payoutId: string; amount: number; currency: string }> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
      },
    });

    if (!owner?.stripeAccountId) {
      throw new Error('Owner has not connected a payout account');
    }

    if (owner.stripeAccountStatus !== 'VERIFIED') {
      throw new Error('Owner account not verified');
    }

    // Get pending earnings
    const pendingEarnings = await this.getPendingEarnings(ownerId);

    if (pendingEarnings.amount === 0) {
      throw new Error('No pending earnings to payout');
    }

    const payoutAmount = amount || pendingEarnings.amount;

    if (payoutAmount > pendingEarnings.amount) {
      throw new Error('Insufficient funds');
    }

    // Create Stripe payout
    const stripePayoutId = await this.stripe.createPayout(
      owner.stripeAccountId,
      payoutAmount,
      pendingEarnings.currency,
    );

    // Create payout record
    const payout = await this.prisma.payout.create({
      data: {
        ownerId,
        amount: payoutAmount,
        currency: pendingEarnings.currency,
        stripePayoutId,
        status: 'PENDING',
      },
    });

    // Record in ledger
    await this.ledger.recordPayout(ownerId, payoutAmount, pendingEarnings.currency, payout.id);

    return {
      payoutId: payout.id,
      amount: payoutAmount,
      currency: pendingEarnings.currency,
    };
  }

  async getPendingEarnings(ownerId: string): Promise<{ amount: number; currency: string }> {
    // Get completed bookings that haven't been paid out
    const earnings = await this.prisma.booking.aggregate({
      where: {
        listing: { ownerId },
        status: { in: ['COMPLETED', 'SETTLED'] },
        paymentStatus: 'COMPLETED',
      },
      _sum: {
        ownerEarnings: true,
      },
    });

    // Subtract already paid out amounts
    const payouts = await this.prisma.payout.aggregate({
      where: {
        ownerId,
        status: { in: ['PENDING', 'COMPLETED'] },
      },
      _sum: {
        amount: true,
      },
    });

    const totalEarnings = earnings._sum.ownerEarnings || 0;
    const totalPayouts = payouts._sum.amount || 0;

    return {
      amount: totalEarnings - totalPayouts,
      currency: 'USD', // Should be retrieved from user's settings
    };
  }

  async getOwnerPayouts(ownerId: string) {
    return this.prisma.payout.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePayoutStatus(
    payoutId: string,
    status: 'PENDING' | 'COMPLETED' | 'FAILED',
  ): Promise<void> {
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status,
        paidAt: status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  async scheduleAutomaticPayouts(): Promise<number> {
    // Find all owners with earnings > threshold and auto-payout enabled
    const owners = await this.prisma.user.findMany({
      where: {
        role: 'OWNER',
        stripeAccountStatus: 'VERIFIED',
        // Add settings field check for auto-payout enabled
      },
      select: {
        id: true,
        stripeAccountId: true,
      },
    });

    let count = 0;
    const PAYOUT_THRESHOLD = 50; // Minimum $50 for automatic payout

    for (const owner of owners) {
      try {
        const pending = await this.getPendingEarnings(owner.id);

        if (pending.amount >= PAYOUT_THRESHOLD) {
          await this.createPayout(owner.id, pending.amount);
          count++;
        }
      } catch (error) {
        console.error(`Failed to create payout for owner ${owner.id}:`, error);
      }
    }

    return count;
  }
}
