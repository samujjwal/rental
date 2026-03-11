import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Real-Time Availability Graph (V5 Prompt 10)
 *
 * Enhanced availability management with Redis distributed locking:
 * - Real-time slot availability with Redis cache layer
 * - 10-minute TTL soft-lock via Redis `SETNX` for booking holds
 * - Bulk availability queries with cache
 * - Calendar heatmaps
 * - Demand signal emission for pricing engine
 */
@Injectable()
export class AvailabilityGraphService {
  private readonly logger = new Logger(AvailabilityGraphService.name);
  private static readonly LOCK_PREFIX = 'slot_lock:';
  private static readonly LOCK_TTL = 600; // 10 min
  private static readonly CACHE_PREFIX = 'avail:';
  private static readonly CACHE_TTL = 30; // 30s cache for availability checks

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Check real-time availability for a listing across a date range.
   * Uses Redis cache (30s TTL) with DB fallback.
   */
  async checkRealTimeAvailability(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    available: boolean;
    blockedDates: Date[];
    confirmedBookings: number;
    pricePerNight: number;
    hasActiveLock: boolean;
  }> {
    // Check Redis cache
    const cacheKey = `${AvailabilityGraphService.CACHE_PREFIX}${listingId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    // Check for active soft-lock (another user holding this slot)
    const lockKey = `${AvailabilityGraphService.LOCK_PREFIX}${listingId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const hasActiveLock = await this.cache.exists(lockKey);

    const [availabilities, bookings, listing] = await Promise.all([
      this.prisma.availability.findMany({
        where: {
          propertyId: listingId,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
          status: 'BLOCKED',
        },
      }),
      this.prisma.booking.findMany({
        where: {
          listingId,
          startDate: { lt: endDate },
          endDate: { gt: startDate },
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      }),
      this.prisma.listing.findUnique({
        where: { id: listingId },
        select: { basePrice: true },
      }),
    ]);

    const blockedDates: Date[] = [];
    for (const a of availabilities) {
      const cur = new Date(a.startDate);
      while (cur <= a.endDate && cur <= endDate) {
        if (cur >= startDate) blockedDates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    const result = {
      available: bookings.length === 0 && blockedDates.length === 0 && !hasActiveLock,
      blockedDates,
      confirmedBookings: bookings.length,
      pricePerNight: listing ? Number(listing.basePrice) : 0,
      hasActiveLock,
    };

    // Cache for 30s
    await this.cache.set(cacheKey, result, AvailabilityGraphService.CACHE_TTL);
    return result;
  }

  /**
   * Bulk availability check for multiple listings.
   */
  async bulkCheckAvailability(
    listingIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, boolean>> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        listingId: { in: listingIds },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      select: { listingId: true },
    });

    const bookedListingIds = new Set(bookings.map((b) => b.listingId));
    const result = new Map<string, boolean>();
    for (const id of listingIds) {
      result.set(id, !bookedListingIds.has(id));
    }
    return result;
  }

  /**
   * Get a calendar heatmap showing availability density by date.
   */
  async getCalendarHeatmap(
    listingId: string,
    year: number,
    month: number,
  ): Promise<Array<{ date: string; status: 'available' | 'booked' | 'blocked' }>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [bookings, blockedSlots] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          listingId,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      }),
      this.prisma.availability.findMany({
        where: {
          propertyId: listingId,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
          status: 'BLOCKED',
        },
      }),
    ]);

    const bookedDates = new Set<string>();
    const blockedDates = new Set<string>();

    for (const b of bookings) {
      const d = new Date(b.startDate);
      while (d < b.endDate) {
        bookedDates.add(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
    }

    for (const a of blockedSlots) {
      const d = new Date(a.startDate);
      while (d <= a.endDate) {
        blockedDates.add(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
    }

    const heatmap: Array<{ date: string; status: 'available' | 'booked' | 'blocked' }> = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      let status: 'available' | 'booked' | 'blocked' = 'available';
      if (bookedDates.has(dateStr)) status = 'booked';
      else if (blockedDates.has(dateStr)) status = 'blocked';
      heatmap.push({ date: dateStr, status });
      current.setDate(current.getDate() + 1);
    }

    return heatmap;
  }

  /**
   * Reserve a time slot with Redis distributed lock (10-min TTL) + Prisma transaction.
   *
   * Two-phase reserve:
   *   1. Acquire Redis SETNX lock with 10-min TTL (prevents double-booking across pods)
   *   2. Verify in DB (no conflicting bookings or blocked dates)
   *   3. Create PENDING booking
   *
   * Lock is auto-released after 10 min if not confirmed.
   */
  async reserveSlot(params: {
    listingId: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    currency?: string;
  }): Promise<any> {
    const lockKey = `${AvailabilityGraphService.LOCK_PREFIX}${params.listingId}:${params.startDate.toISOString()}:${params.endDate.toISOString()}`;

    // Phase 1: Acquire Redis distributed lock
    const lockAcquired = await this.cache.setNx(
      lockKey,
      { userId: params.userId, acquiredAt: new Date().toISOString() },
      AvailabilityGraphService.LOCK_TTL,
    );

    if (!lockAcquired) {
      throw new BadRequestException(
        'These dates are currently held by another user. Please try again in a few minutes.',
      );
    }

    try {
      // Phase 2: DB transaction to verify and create booking
      const booking: any = await this.prisma.$transaction(async (tx: any) => {
        // Fetch listing to get ownerId (DB-D10: ownerId is required on Booking)
        const listing = await tx.listing.findUnique({
          where: { id: params.listingId },
          select: { ownerId: true },
        });
        if (!listing) {
          throw new BadRequestException('Listing not found');
        }

        const conflicts = await tx.booking.findMany({
          where: {
            listingId: params.listingId,
            startDate: { lt: params.endDate },
            endDate: { gt: params.startDate },
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
        });

        if (conflicts.length > 0) {
          throw new BadRequestException('SLOT_CONFLICT: Dates already booked');
        }

        const blocked = await tx.availability.findMany({
          where: {
            propertyId: params.listingId,
            startDate: { lte: params.endDate },
            endDate: { gte: params.startDate },
            status: 'BLOCKED',
          },
        });

        if (blocked.length > 0) {
          throw new BadRequestException('SLOT_BLOCKED: Dates are blocked by host');
        }

        return tx.booking.create({
          data: {
            listingId: params.listingId,
            renterId: params.userId,
            ownerId: listing.ownerId,
            startDate: params.startDate,
            endDate: params.endDate,
            basePrice: params.totalPrice,
            totalPrice: params.totalPrice,
            currency: params.currency || 'NPR',
            status: 'PENDING',
          },
        });
      });

      // Invalidate availability cache
      await this.cache.del(
        `${AvailabilityGraphService.CACHE_PREFIX}${params.listingId}:${params.startDate.toISOString()}:${params.endDate.toISOString()}`,
      );

      this.eventEmitter.emit('availability.slot_reserved', {
        bookingId: booking.id,
        listingId: params.listingId,
        startDate: params.startDate,
        endDate: params.endDate,
        lockKey,
      });

      // Emit demand signal for pricing engine
      this.eventEmitter.emit('demand.signal', {
        type: 'RESERVATION',
        listingId: params.listingId,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      return { ...booking, lockKey, lockTtlSeconds: AvailabilityGraphService.LOCK_TTL };
    } catch (error) {
      // Release lock on failure
      await this.cache.del(lockKey);
      throw error;
    }
  }

  /**
   * Release a held slot lock (e.g., when user abandons checkout).
   */
  async releaseSlotLock(lockKey: string): Promise<void> {
    await this.cache.del(lockKey);
    this.logger.log(`Released slot lock: ${lockKey}`);
  }

  /**
   * Refresh a slot lock TTL (heartbeat during payment processing).
   */
  async refreshSlotLock(lockKey: string): Promise<boolean> {
    const exists = await this.cache.exists(lockKey);
    if (exists) {
      const data = await this.cache.get(lockKey);
      await this.cache.set(lockKey, { ...data as any, refreshedAt: new Date().toISOString() }, AvailabilityGraphService.LOCK_TTL);
      return true;
    }
    return false;
  }

  /**
   * Get occupancy stats for a listing over a period.
   */
  async getOccupancyStats(listingId: string, days: number = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bookings = await this.prisma.booking.findMany({
      where: {
        listingId,
        startDate: { gte: startDate },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    });

    let totalBookedDays = 0;
    for (const b of bookings) {
      const diffTime = Math.abs(b.endDate.getTime() - b.startDate.getTime());
      totalBookedDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      totalDays: days,
      bookedDays: totalBookedDays,
      occupancyRate: totalBookedDays / days,
      totalBookings: bookings.length,
    };
  }
}
