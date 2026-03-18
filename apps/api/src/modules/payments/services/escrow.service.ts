/**
 * Escrow Service
 *
 * Manages the escrow lifecycle for rental bookings:
 * 1. PENDING → FUNDED: Capture payment and hold in escrow
 * 2. FUNDED → RELEASED: Release funds to host after successful checkout
 * 3. FUNDED → DISPUTED: Freeze funds during dispute
 * 4. FUNDED → REFUNDED: Return funds to renter on cancellation
 * 5. FUNDED → PARTIALLY_RELEASED: Partial release (e.g., deposit deduction)
 *
 * Integrates with PolicyEngine for country-specific escrow rules (hold periods, etc.)
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService, type EscrowFrozenEvent } from '@/common/events/events.service';
import { CacheService } from '@/common/cache/cache.service';

export interface CreateEscrowParams {
  bookingId: string;
  amount: number;
  currency: string;
  releaseCondition?: string;
  holdDays?: number;
  providerId?: string;
}

export interface EscrowState {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
  holdUntil: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
}

export interface ReleaseResult {
  success: boolean;
  releasedAmount: number;
  remainingAmount: number;
  escrowId: string;
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Create an escrow hold for a booking.
   * Funds are captured and held until release conditions are met.
   */
  async createEscrow(params: CreateEscrowParams): Promise<EscrowState> {
    const { bookingId, amount, currency, releaseCondition, holdDays, providerId } = params;

    // Validate booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new BadRequestException(`Booking ${bookingId} not found`);
    }

    // Check for existing active escrow
    const existing = await this.prisma.escrowTransaction.findFirst({
      where: {
        bookingId,
        status: { in: ['PENDING', 'FUNDED'] },
      },
    });

    if (existing) {
      throw new BadRequestException(`Active escrow already exists for booking ${bookingId}`);
    }

    const holdUntil = holdDays != null
      ? new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000)
      : new Date(booking.endDate.getTime() + 48 * 60 * 60 * 1000); // Default: 48h after checkout

    const escrow = await this.prisma.escrowTransaction.create({
      data: {
        bookingId,
        amount,
        currency,
        status: 'PENDING',
        releaseCondition: releaseCondition || 'checkout_confirmed',
        holdUntil,
        providerId,
        metadata: {},
      },
    });

    this.logger.log(`Created escrow ${escrow.id} for booking ${bookingId}: ${amount} ${currency}`);
    return this.mapToState(escrow);
  }

  /**
   * Fund the escrow (transition PENDING → FUNDED).
   * Called after successful payment capture.
   * DB5 fix: records a LIABILITY ledger entry so the escrow hold is visible
   * in the accounting ledger for reconciliation.
   */
  async fundEscrow(escrowId: string, externalId?: string): Promise<EscrowState> {
    const escrow = await this.prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: {
        status: 'FUNDED',
        capturedAt: new Date(),
        externalId,
      },
    });

    this.logger.log(`Escrow ${escrowId} funded: ${escrow.amount} ${escrow.currency}`);

    // Write ledger entry for the escrow hold (DB5 fix).
    // CREDIT to LIABILITY account represents funds held in trust.
    try {
      await this.prisma.ledgerEntry.create({
        data: {
          bookingId: escrow.bookingId,
          accountId: escrow.id,
          accountType: 'LIABILITY',
          side: 'CREDIT',
          transactionType: 'DEPOSIT_HOLD',
          amount: escrow.amount,
          currency: escrow.currency,
          description: `Escrow funded for booking ${escrow.bookingId}`,
          status: 'POSTED',
          referenceId: escrowId,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write ledger entry for escrow funded ${escrowId}`, err);
    }

    // Emit event safely — don't let listener errors crash the process
    try {
      await this.events.emitEscrowFunded({
        escrowId: escrow.id,
        bookingId: escrow.bookingId,
        amount: Number(escrow.amount),
        currency: escrow.currency,
      });
    } catch (err) {
      this.logger.error(`Failed to emit escrow funded event for ${escrowId}`, err);
    }

    return this.mapToState(escrow);
  }

  /**
   * Release escrow funds to the host.
   * May be partial (e.g., deducting damage charges).
   */
  async releaseEscrow(escrowId: string, releaseAmount?: number): Promise<ReleaseResult> {
    const escrow = await this.prisma.escrowTransaction.findUnique({
      where: { id: escrowId },
    });

    if (!escrow) {
      throw new BadRequestException(`Escrow ${escrowId} not found`);
    }

    if (escrow.status !== 'FUNDED' && escrow.status !== 'PARTIALLY_RELEASED') {
      throw new BadRequestException(`Escrow ${escrowId} is in ${escrow.status} state, cannot release`);
    }

    // Check hold period
    if (escrow.holdUntil && escrow.holdUntil > new Date()) {
      throw new BadRequestException(
        `Escrow ${escrowId} hold period not yet expired (until ${escrow.holdUntil.toISOString()})`,
      );
    }

    const totalAmount = Number(escrow.amount);
    const toRelease = releaseAmount ?? totalAmount;

    if (toRelease > totalAmount) {
      throw new BadRequestException(`Release amount ${toRelease} exceeds escrow amount ${totalAmount}`);
    }

    const remaining = totalAmount - toRelease;
    const newStatus = remaining > 0 ? 'PARTIALLY_RELEASED' : 'RELEASED';

    await this.prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: {
        status: newStatus,
        releasedAt: new Date(),
        metadata: {
          ...(escrow.metadata as object || {}),
          releasedAmount: toRelease,
          remainingAmount: remaining,
        },
      },
    });

    // Write ledger entry for the escrow release (DB5 fix).
    // DEBIT to LIABILITY account reverses the escrow hold; CREDIT to ASSET = host earnings.
    try {
      await this.prisma.ledgerEntry.create({
        data: {
          bookingId: escrow.bookingId,
          accountId: escrow.id,
          accountType: 'LIABILITY',
          side: 'DEBIT',
          transactionType: 'DEPOSIT_RELEASE',
          amount: toRelease,
          currency: escrow.currency,
          description: `Escrow released to host for booking ${escrow.bookingId}`,
          status: 'POSTED',
          referenceId: escrowId,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write ledger entry for escrow release ${escrowId}`, err);
    }

    // Emit event safely — don't let listener errors crash the process
    try {
      await this.events.emitEscrowReleased({
        escrowId: escrow.id,
        bookingId: escrow.bookingId,
        amount: toRelease,
        currency: escrow.currency,
        releasedTo: 'host',
      });
    } catch (err) {
      this.logger.error(`Failed to emit escrow released event for ${escrowId}`, err);
    }

    this.logger.log(
      `Escrow ${escrowId} ${newStatus}: released ${toRelease}, remaining ${remaining}`,
    );

    return {
      success: true,
      releasedAmount: toRelease,
      remainingAmount: remaining,
      escrowId,
    };
  }

  /**
   * Freeze escrow during a dispute.
   */
  async freezeEscrow(escrowId: string, disputeId: string): Promise<EscrowState> {
    const escrow = await this.prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: {
        status: 'DISPUTED',
        metadata: {
          disputeId,
          frozenAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Escrow ${escrowId} frozen for dispute ${disputeId}`);

    // Emit event safely — don't let listener errors propagate
    try {
      this.events.emitEscrowFrozen({
        escrowId: escrow.id,
        bookingId: escrow.bookingId,
        amount: Number(escrow.amount),
        currency: escrow.currency,
        disputeId,
      } satisfies EscrowFrozenEvent);
    } catch (err) {
      this.logger.error(`Failed to emit escrow frozen event for ${escrowId}`, err);
    }

    return this.mapToState(escrow);
  }

  /**
   * Refund escrow to renter.
   */
  async refundEscrow(escrowId: string, reason?: string): Promise<EscrowState> {
    const escrow = await this.prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: {
        status: 'REFUNDED',
        releasedAt: new Date(),
        metadata: { refundReason: reason },
      },
    });

    // Write ledger entry for the escrow refund (DB5 fix).
    // DEBIT to LIABILITY account reverses the hold; funds returned to renter.
    try {
      await this.prisma.ledgerEntry.create({
        data: {
          bookingId: escrow.bookingId,
          accountId: escrow.id,
          accountType: 'LIABILITY',
          side: 'DEBIT',
          transactionType: 'REFUND',
          amount: escrow.amount,
          currency: escrow.currency,
          description: `Escrow refunded to renter for booking ${escrow.bookingId}`,
          status: 'POSTED',
          referenceId: escrowId,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write ledger entry for escrow refund ${escrowId}`, err);
    }

    // Emit event safely — don't let listener errors crash the process
    try {
      await this.events.emitEscrowReleased({
        escrowId: escrow.id,
        bookingId: escrow.bookingId,
        amount: Number(escrow.amount),
        currency: escrow.currency,
        releasedTo: 'renter',
      });
    } catch (err) {
      this.logger.error(`Failed to emit escrow refund event for ${escrowId}`, err);
    }

    this.logger.log(`Escrow ${escrowId} refunded: ${escrow.amount} ${escrow.currency}`);
    return this.mapToState(escrow);
  }

  /**
   * Get escrow state for a booking.
   */
  async getEscrowForBooking(bookingId: string): Promise<EscrowState | null> {
    const escrow = await this.prisma.escrowTransaction.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
    return escrow ? this.mapToState(escrow) : null;
  }

  /**
   * Find escrows ready for automatic release (hold period expired).
   */
  async findReleasableEscrows(limit = 50): Promise<EscrowState[]> {
    const escrows = await this.prisma.escrowTransaction.findMany({
      where: {
        status: 'FUNDED',
        holdUntil: { lt: new Date() },
      },
      take: limit,
      orderBy: { holdUntil: 'asc' },
    });

    return escrows.map((e) => this.mapToState(e));
  }

  private mapToState(escrow: any): EscrowState {
    return {
      id: escrow.id,
      bookingId: escrow.bookingId,
      amount: Number(escrow.amount),
      currency: escrow.currency,
      status: escrow.status,
      holdUntil: escrow.holdUntil,
      releasedAt: escrow.releasedAt,
      createdAt: escrow.createdAt,
    };
  }
}
