import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { toNumber } from '@rental-portal/database';
import { roundForCurrency } from '@rental-portal/shared-types';

export interface QuoteSnapshotData {
  bookingId: string;
  userId: string;
  listingId: string;
  currency: string;
  basePrice: number;
  duration: number;
  durationType: string;
  subtotal: number;
  platformFee: number;
  serviceFee: number;
  taxes: number;
  depositAmount: number;
  total: number;
  ownerEarnings: number;
  breakdown: Record<string, any>;
  taxLines: Array<any>;
  discountBreakdown?: Array<any>;
  pricingVersion: string;
}

export interface QuoteSnapshot extends QuoteSnapshotData {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

@Injectable()
export class QuoteSnapshotService {
  private readonly logger = new Logger(QuoteSnapshotService.name);
  private readonly DEFAULT_TTL_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a quote snapshot for a booking
   * Persists the pricing calculation for use through checkout, invoice, refund, payout, and ledger
   */
  async createSnapshot(data: QuoteSnapshotData, ttlHours: number = this.DEFAULT_TTL_HOURS): Promise<QuoteSnapshot> {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const snapshot = await this.prisma.$queryRaw<QuoteSnapshot[]>`
      INSERT INTO quote_snapshots (
        id, booking_id, user_id, listing_id, currency,
        base_price, duration, duration_type, subtotal, platform_fee,
        service_fee, taxes, deposit_amount, total, owner_earnings,
        breakdown, tax_lines, discount_breakdown, pricing_version,
        created_at, expires_at
      )
      VALUES (
        ${randomUUID()},
        ${data.bookingId},
        ${data.userId},
        ${data.listingId},
        ${data.currency},
        ${data.basePrice},
        ${data.duration},
        ${data.durationType},
        ${data.subtotal},
        ${data.platformFee},
        ${data.serviceFee},
        ${data.taxes},
        ${data.depositAmount},
        ${data.total},
        ${data.ownerEarnings},
        ${JSON.stringify(data.breakdown)}::jsonb,
        ${JSON.stringify(data.taxLines)}::jsonb,
        ${JSON.stringify(data.discountBreakdown || [])}::jsonb,
        ${data.pricingVersion},
        NOW(),
        ${expiresAt}
      )
      RETURNING *
    `;

    this.logger.log(`Created quote snapshot ${snapshot[0].id} for booking ${data.bookingId}`);
    return snapshot[0];
  }

  /**
   * Get a quote snapshot by booking ID
   */
  async getByBookingId(bookingId: string): Promise<QuoteSnapshot | null> {
    const snapshots = await this.prisma.$queryRaw<QuoteSnapshot[]>`
      SELECT * FROM quote_snapshots
      WHERE booking_id = ${bookingId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * Get a quote snapshot by ID
   */
  async getById(id: string): Promise<QuoteSnapshot | null> {
    const snapshots = await this.prisma.$queryRaw<QuoteSnapshot[]>`
      SELECT * FROM quote_snapshots
      WHERE id = ${id}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;

    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * Mark a quote snapshot as used
   */
  async markAsUsed(id: string): Promise<void> {
    await this.prisma.$queryRaw`
      UPDATE quote_snapshots
      SET used_at = NOW()
      WHERE id = ${id}
    `;

    this.logger.log(`Quote snapshot ${id} marked as used`);
  }

  /**
   * Get the latest quote snapshot for a user
   */
  async getLatestByUser(userId: string, limit: number = 10): Promise<QuoteSnapshot[]> {
    const snapshots = await this.prisma.$queryRaw<QuoteSnapshot[]>`
      SELECT * FROM quote_snapshots
      WHERE user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return snapshots;
  }

  /**
   * Clean up expired quote snapshots
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.$queryRaw`
      DELETE FROM quote_snapshots
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `;

    const count = Number(result);
    this.logger.log(`Cleaned up ${count} expired quote snapshots`);
    return count;
  }

  /**
   * Get statistics about quote snapshots
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    used: number;
    unused: number;
  }> {
    const stats = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT 
        CASE 
          WHEN expires_at < NOW() THEN 'expired'
          WHEN used_at IS NOT NULL THEN 'used'
          ELSE 'unused'
        END as status,
        COUNT(*) as count
      FROM quote_snapshots
      GROUP BY status
    `;

    const result = {
      total: 0,
      active: 0,
      expired: 0,
      used: 0,
      unused: 0,
    };

    for (const stat of stats) {
      result[stat.status as keyof typeof result] = Number(stat.count);
      result.total += Number(stat.count);
    }

    result.active = result.used + result.unused;

    return result;
  }

  /**
   * Validate a quote snapshot against current pricing
   * Returns true if the snapshot is still valid (within tolerance)
   */
  async validateSnapshot(snapshotId: string, currentPrice: number, tolerancePercent: number = 5): Promise<boolean> {
    const snapshot = await this.getById(snapshotId);
    if (!snapshot) {
      return false;
    }

    const priceDifference = Math.abs(currentPrice - snapshot.total);
    const tolerance = snapshot.total * (tolerancePercent / 100);

    return priceDifference <= tolerance;
  }
}
