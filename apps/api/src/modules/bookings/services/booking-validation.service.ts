import { Injectable, BadRequestException } from '@nestjs/common';
import { i18nBadRequest, i18nNotFound } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Listing } from '@rental-portal/database';

export interface DateValidationResult {
  isValid: boolean;
  nights?: number;
  errors?: string[];
}

export interface AvailabilityResult {
  isAvailable: boolean;
  conflicts?: Array<{
    startDate: Date;
    endDate: Date;
    status: string;
  }>;
}

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
   * Returns validation result with isValid flag and night count.
   */
  validateDates(startDate: Date, endDate: Date): DateValidationResult {
    const errors: string[] = [];

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      errors.push('Invalid dates provided');
      return { isValid: false, errors };
    }

    if (endDate <= startDate) {
      errors.push('End date must be after start date');
      return { isValid: false, errors };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const bookingStartDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    if (bookingStartDay < todayStart) {
      errors.push('Start date cannot be in the past');
      return { isValid: false, errors };
    }

    // Calculate nights
    const msPerDay = 24 * 60 * 60 * 1000;
    const nights = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);

    return { isValid: true, nights };
  }

  /**
   * Validate booking dates against listing constraints (min/max stay).
   */
  async validateBookingDates(
    startDate: Date,
    endDate: Date,
    listingId: string,
  ): Promise<DateValidationResult> {
    // First validate basic date logic
    const dateResult = this.validateDates(startDate, endDate);
    if (!dateResult.isValid) {
      return dateResult;
    }

    // Get listing constraints
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        minStayNights: true,
        maxStayNights: true,
      },
    });

    if (!listing) {
      return { isValid: false, errors: ['Listing not found'] };
    }

    const nights = dateResult.nights || 0;
    const errors: string[] = [];

    if (listing.minStayNights && nights < listing.minStayNights) {
      errors.push(`Minimum stay is ${listing.minStayNights} nights`);
    }

    if (listing.maxStayNights && nights > listing.maxStayNights) {
      errors.push(`Maximum stay is ${listing.maxStayNights} nights`);
    }

    if (errors.length > 0) {
      return { isValid: false, nights, errors };
    }

    return { isValid: true, nights };
  }

  /**
   * Check if listing is available for the given date range.
   */
  async checkAvailability(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AvailabilityResult> {
    // Check for blocked periods
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
      return {
        isAvailable: false,
        conflicts: blockedPeriods.map((p) => ({
          startDate: p.startDate,
          endDate: p.endDate,
          status: 'BLOCKED',
        })),
      };
    }

    // Check for existing confirmed bookings
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        listingId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        OR: [
          { AND: [{ startDate: { lte: startDate } }, { endDate: { gt: startDate } }] },
          { AND: [{ startDate: { lt: endDate } }, { endDate: { gte: endDate } }] },
          { AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }] },
        ],
      },
    });

    if (existingBookings.length > 0) {
      return {
        isAvailable: false,
        conflicts: existingBookings.map((b) => ({
          startDate: b.startDate,
          endDate: b.endDate,
          status: b.status,
        })),
      };
    }

    return { isAvailable: true };
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
  async checkBlockedPeriods(listingId: string, startDate: Date, endDate: Date): Promise<void> {
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
