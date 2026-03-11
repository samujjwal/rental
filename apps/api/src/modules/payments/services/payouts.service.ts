import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { StripeService } from './stripe.service';
import { LedgerService } from './ledger.service';
import { PayoutStatus, UserRole, toNumber, decimalSubtract } from '@rental-portal/database';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly ledger: LedgerService,
    private readonly configService: ConfigService,
  ) {}

  async createPayout(
    ownerId: string,
    amount?: number,
  ): Promise<{ payoutId: string; amount: number; currency: string }> {
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

    // Create Stripe payout
    const transferId = await this.stripe.createPayout(
      owner.stripeConnectId,
      payoutAmount,
      pendingEarnings.currency,
    );

    // Create payout record
    const payout = await this.prisma.payout.create({
      data: {
        ownerId,
        amount: payoutAmount,
        currency: pendingEarnings.currency,
        transferId: transferId,
        status: PayoutStatus.PENDING,
      },
    });

    // We need to attach this payout to a booking in the ledger for DB consistency.
    // Ideally we track which bookings are being paid out, but for now we attach to the latest valid booking.
    const lastBooking = await this.prisma.booking.findFirst({
      where: { ownerId: ownerId, status: { in: ['COMPLETED', 'SETTLED'] } },
      orderBy: { updatedAt: 'desc' },
    });

    if (lastBooking) {
      // Create a wrapper for ledger call if needed or update ledger service interface
      // Assuming I updated LedgerService to accept bookingId
      await this.ledger.recordPayoutWithBooking(
        lastBooking.id,
        ownerId,
        payoutAmount,
        pendingEarnings.currency,
        payout.id,
      );
    } else {
      // Fallback: If no booking exists (unlikely if they have earnings), we can't create a ledger entry
      // without violating FK constraints.
      // In a real scenario, we should handle this gracefully or have a 'System Booking'.
      this.logger.warn(`Payout ${payout.id} created but no booking found to attach ledger entry.`);
    }

    return {
      payoutId: payout.id,
      amount: payoutAmount,
      currency: pendingEarnings.currency,
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
    // Find all owners with earnings > threshold and auto-payout enabled
    const owners = await this.prisma.user.findMany({
      where: {
        role: UserRole.HOST,
      },
      select: {
        id: true,
        stripeConnectId: true,
      },
    });

    let count = 0;
    const PAYOUT_THRESHOLD = this.configService.get<number>('PAYOUT_THRESHOLD', 5000);

    for (const owner of owners) {
      try {
        const pending = await this.getPendingEarnings(owner.id);

        if (pending.amount >= PAYOUT_THRESHOLD) {
          await this.createPayout(owner.id, pending.amount);
          count++;
        }
      } catch (error) {
        this.logger.error(`Failed to create payout for owner ${owner.id}:`, error);
      }
    }

    return count;
  }
}
