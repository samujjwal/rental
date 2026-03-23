import { Injectable, BadRequestException } from '@nestjs/common';
import { i18nBadRequest, i18nNotFound } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Listing } from '@rental-portal/database';

/**
 * Pure domain validation for the booking creation flow.
 *
 * Responsibilities:
 *   - Date arithmetic checks (invalid, end-before-start, past)
 *   - Listing existence, availability status, ownership, capacity
 *   - Blocked-period cross-check against the Availability table
 *
 * Intentionally has no dependency on the pricing or eligibility ports so it stays
 * a lean, deterministic domain object with no external I/O beyond the database.
 */
@Injectable()
export class BookingValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that startDate and endDate form a legal booking window.
   * Throws i18n-aware BadRequestException on failure.
   */
  validateDates(startDate: Date, endDate: Date): void {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw i18nBadRequest('booking.invalidDates');
    }

    if (endDate <= startDate) {
      throw i18nBadRequest('booking.endBeforeStart');
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const bookingStartDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    if (bookingStartDay < todayStart) {
      throw i18nBadRequest('booking.startInPast');
    }
  }

  /**
   * Validate that the listing is bookable by the given renter.
   * Throws on: not found, not available, renter is owner, over capacity.
   * Returns the listing with its owner relation included for downstream use.
   */
  async validateListing(
    listingId: string,
    renterId: string,
    guestCount?: number,
  ): Promise<Listing & { owner: { id: string } }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });

    if (!listing) {
      throw i18nNotFound('listing.notFound');
    }

    if (listing.status !== 'AVAILABLE') {
      throw i18nBadRequest('booking.unavailable');
    }

    if (listing.ownerId === renterId) {
      throw i18nBadRequest('booking.cannotBookOwn');
    }

    if (guestCount && listing.maxGuests && guestCount > listing.maxGuests) {
      throw new BadRequestException({
        message: `Guest count ${guestCount} exceeds listing capacity of ${listing.maxGuests}`,
        guestCount,
        maxGuests: listing.maxGuests,
      });
    }

    return listing as Listing & { owner: { id: string } };
  }

  /**
   * Cross-check the Availability table for BLOCKED periods that overlap the
   * requested booking window.  Throws BadRequestException if any overlap is found.
   *
   * Errors from the Availability table query are intentionally re-thrown only for
   * BadRequestException instances; other DB errors are swallowed and the caller
   * falls back to the booking-conflict check inside the transaction.
   */
  async checkBlockedPeriods(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const blockedPeriods = await this.prisma.availability.findMany({
      where: {
        propertyId: listingId,
        status: 'BLOCKED',
        OR: [
          { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: startDate } }] },
          { AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }] },
          { AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }] },
        ],
      },
    });

    if (blockedPeriods.length > 0) {
      throw new BadRequestException({
        message: 'Listing is blocked for the selected dates',
        blockedPeriods: blockedPeriods.map((p) => ({
          startDate: p.startDate,
          endDate: p.endDate,
        })),
      });
    }
  }
}
