import { Injectable, BadRequestException, ConflictException, Logger, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { isOperationsAdmin } from '@/common/auth/admin-roles';

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  until?: Date;
  count?: number;
}

export interface CreateAvailabilityDto {
  propertyId: string;
  startDate: Date;
  endDate: Date;
  isAvailable: boolean;
  recurrenceRule?: RecurrenceRule;
  overrideBookings?: boolean;
}

export type UpdateAvailabilityDto = Partial<CreateAvailabilityDto>;

export interface AvailabilityCheckDto {
  propertyId: string;
  startDate: string | Date;
  endDate: string | Date;
}

export interface AvailabilityResult {
  isAvailable: boolean;
  availableUnits?: string[];  // Inventory unit IDs available
  conflicts?: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    unitId?: string;
  }>;
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Validate that the user has permission to modify availability for a listing.
   * Allows: listing owner, admins, and organization members with appropriate roles.
   */
  private async validateListingAccess(
    propertyId: string,
    userId?: string,
    userRole?: string,
  ): Promise<void> {
    // Admins bypass ownership checks - use centralized admin role check
    if (isOperationsAdmin(userRole)) {
      return;
    }

    if (!userId) {
      throw new ForbiddenException('Authentication required for availability mutations');
    }

    // Fetch the listing with organization membership info
    const listing = await this.prisma.listing.findUnique({
      where: { id: propertyId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!listing) {
      throw new ForbiddenException('Listing not found');
    }

    // Check if user is the listing owner
    if (listing.ownerId === userId) {
      return;
    }

    // Check if user is an organization member with edit permissions
    if (listing.organization && listing.organization.members.length > 0) {
      const member = listing.organization.members[0];
      // Allow organization members with OWNER, ADMIN, or MANAGER roles
      const allowedOrgRoles = ['OWNER', 'ADMIN', 'MANAGER'];
      if (allowedOrgRoles.includes(member.role)) {
        return;
      }
    }

    throw new ForbiddenException(
      'You do not have permission to modify availability for this listing',
    );
  }

  async createAvailability(dto: CreateAvailabilityDto, userId?: string, userRole?: string): Promise<any> {
    // Validate dates
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate listing ownership for mutation operations
    await this.validateListingAccess(dto.propertyId, userId, userRole);

    // Check for overlapping availability rules
    const overlapping = await this.prisma.availability.findMany({
      where: {
        propertyId: dto.propertyId,
        startDate: { lt: dto.endDate }, // Existing starts before new ends
        endDate: { gt: dto.startDate }, // Existing ends after new starts
      },
    });

    if (overlapping.length > 0) {
      throw new BadRequestException('Availability period overlaps with existing rules');
    }

    return this.prisma.availability.create({
      data: {
        propertyId: dto.propertyId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: dto.isAvailable ? 'AVAILABLE' : 'BLOCKED',
      },
    });
  }

  async updateAvailability(id: string, dto: UpdateAvailabilityDto, userId?: string, userRole?: string): Promise<any> {
    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Get the availability record to check propertyId
    const existing = await this.prisma.availability.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new BadRequestException('Availability record not found');
    }

    // Validate listing ownership
    await this.validateListingAccess(existing.propertyId, userId, userRole);

    return this.prisma.availability.update({
      where: { id },
      data: dto,
    });
  }

  async deleteAvailability(id: string, userId?: string, userRole?: string): Promise<void> {
    // Get the availability record to check propertyId
    const existing = await this.prisma.availability.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new BadRequestException('Availability record not found');
    }

    // Validate listing ownership
    await this.validateListingAccess(existing.propertyId, userId, userRole);

    await this.prisma.availability.delete({
      where: { id },
    });
  }

  async getListingAvailability(propertyId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // Canonical half-open interval overlap: [a, b) overlaps [c, d) if a < d AND c < b
    return this.prisma.availability.findMany({
      where: {
        propertyId,
        OR: [
          {
            AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
          },
        ],
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async checkAvailability(dto: AvailabilityCheckDto): Promise<AvailabilityResult> {
    const { propertyId, startDate, endDate } = dto;

    // Parse dates if they are strings
    const parsedStartDate = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const parsedEndDate = typeof endDate === 'string' ? new Date(endDate) : endDate;

    this.logger.log(`Checking availability for property ${propertyId} from ${parsedStartDate} to ${parsedEndDate}`);

    try {
      // Validate dates
      const now = new Date();
      // Reset time to start of day for comparison
      now.setHours(0, 0, 0, 0);
      const startDateStartOfDay = new Date(parsedStartDate);
      startDateStartOfDay.setHours(0, 0, 0, 0);

      if (startDateStartOfDay < now) {
        throw new BadRequestException('Start date cannot be in the past');
      }

      if (parsedStartDate >= parsedEndDate) {
        throw new BadRequestException('End date must be after start date');
      }

      // Check availability rules - fail closed on DB errors
      const availabilityRules = await this.getListingAvailability(propertyId, parsedStartDate, parsedEndDate);

      const unavailableRules = availabilityRules.filter((rule) => rule.status !== 'AVAILABLE');
      if (unavailableRules.length > 0) {
        return {
          isAvailable: false,
          conflicts: unavailableRules.map((rule) => ({
            id: rule.id,
            startDate: rule.startDate,
            endDate: rule.endDate,
            reason: 'Blocked by availability rule',
          })),
        };
      }

      // Check for existing bookings - fail closed on DB errors
      // Canonical half-open interval overlap: [a, b) overlaps [c, d) if a < d AND c < b
      const conflictingBookings = await this.prisma.booking.findMany({
        where: {
          listingId: propertyId,
          status: {
            in: [
              'PENDING_OWNER_APPROVAL',
              'PENDING_PAYMENT',
              'CONFIRMED',
              'IN_PROGRESS',
              'AWAITING_RETURN_INSPECTION',
              'COMPLETED',
              'SETTLED',
              'DISPUTED',
            ],
          },
          OR: [
            {
              AND: [{ startDate: { lt: parsedEndDate } }, { endDate: { gt: parsedStartDate } }],
            },
          ],
        },
      });

      if (conflictingBookings.length > 0) {
        return {
          isAvailable: false,
          conflicts: conflictingBookings.map((booking) => ({
            id: booking.id,
            startDate: booking.startDate,
            endDate: booking.endDate,
            reason: 'Already booked',
          })),
        };
      }

      // Return available if no conflicts
      return {
        isAvailable: true,
      };
    } catch (error) {
      this.logger.error('Error in availability check', error);
      throw error;
    }
  }

  async bulkUpdateAvailability(
    propertyId: string,
    dates: Array<{ date: Date; isAvailable: boolean }>,
    userId?: string,
    userRole?: string,
  ): Promise<number> {
    // Validate listing ownership before bulk update
    await this.validateListingAccess(propertyId, userId, userRole);

    let count = 0;

    for (const { date, isAvailable } of dates) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Check if availability exists for this date
      const existing = await this.prisma.availability.findFirst({
        where: {
          propertyId,
          startDate: startOfDay,
        },
      });

      if (existing) {
        await this.prisma.availability.update({
          where: { id: existing.id },
          data: { status: isAvailable ? 'AVAILABLE' : 'BLOCKED' },
        });
      } else {
        await this.prisma.availability.create({
          data: {
            propertyId,
            startDate: startOfDay,
            endDate: endOfDay,
            status: isAvailable ? 'AVAILABLE' : 'BLOCKED',
          },
        });
      }

      count++;
    }

    return count;
  }

  async getAvailableDates(propertyId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    // Batch fetch all availability rules for the date range
    const availabilityRules = await this.getListingAvailability(propertyId, startDate, endDate);
    
    // Batch fetch all conflicting bookings for the date range
    // Canonical half-open interval overlap: [a, b) overlaps [c, d) if a < d AND c < b
    const conflictingBookings = await this.prisma.booking.findMany({
      where: {
        listingId: propertyId,
        status: {
          in: [
            'PENDING_OWNER_APPROVAL',
            'PENDING_PAYMENT',
            'CONFIRMED',
            'IN_PROGRESS',
            'AWAITING_RETURN_INSPECTION',
            'COMPLETED',
            'SETTLED',
            'DISPUTED',
          ],
        },
        OR: [
          {
            AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
          },
        ],
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    // Compute available dates in-memory using half-open interval overlap
    const availableDates: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Check if this day is blocked by availability rules
      const isBlockedByRule = availabilityRules.some((rule) => {
        if (rule.status !== 'AVAILABLE') {
          // Canonical half-open interval overlap: [a, b) overlaps [c, d) if a < d AND c < b
          return rule.startDate < nextDate && rule.endDate > currentDate;
        }
        return false;
      });
      
      // Check if this day is blocked by bookings
      const isBlockedByBooking = conflictingBookings.some((booking) => {
        // Canonical half-open interval overlap: [a, b) overlaps [c, d) if a < d AND c < b
        return booking.startDate < nextDate && booking.endDate > currentDate;
      });
      
      if (!isBlockedByRule && !isBlockedByBooking) {
        availableDates.push(new Date(currentDate));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableDates;
  }

  // ──────────────────────────────────────────────────────
  // Concurrency-Safe Availability (with advisory locks)
  // ──────────────────────────────────────────────────────

  /**
   * Atomically check and reserve dates for a listing using PostgreSQL advisory locks.
   * Prevents double-booking race conditions.
   *
   * Returns the reservation result with allocated unit (for multi-unit listings).
   */
  async checkAndReserve(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    inventoryUnitId?: string,
  ): Promise<{ success: boolean; unitId?: string; conflicts?: any[] }> {
    const result = await this.prisma.$transaction(async (tx: any) => {
      // Acquire advisory lock on the listing to serialize reservation attempts
      const lockKey = Buffer.from(propertyId).reduce((h, b) => (h * 31 + b) | 0, 0);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // Check for available inventory units
      const units = await tx.inventoryUnit.findMany({
        where: { listingId: propertyId, isActive: true },
      });

      if (units.length > 0) {
        // Multi-unit listing: find an available unit
        const targetUnits = inventoryUnitId
          ? units.filter((u: any) => u.id === inventoryUnitId)
          : units;

        for (const unit of targetUnits) {
          const conflictingSlots = await tx.availabilitySlot.findMany({
            where: {
              inventoryUnitId: unit.id,
              status: { in: ['RESERVED', 'BOOKED'] },
              startTime: { lt: endDate },
              endTime: { gt: startDate },
            },
          });

          if (conflictingSlots.length === 0) {
            // Reserve this unit — catch DB-level unique constraint violation (P2002) as a
            // belt-and-suspenders guard against concurrent reservation race conditions.
            try {
              await tx.availabilitySlot.create({
                data: {
                  listingId: propertyId,
                  inventoryUnitId: unit.id,
                  startTime: startDate,
                  endTime: endDate,
                  status: 'RESERVED',
                  currency: 'USD', // Will be overridden by booking
                },
              });
            } catch (err) {
              if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002'
              ) {
                throw new ConflictException(
                  'This time slot has already been reserved. Please choose different dates.',
                );
              }
              throw err;
            }

            this.logger.log(
              `Reserved unit ${unit.id} of listing ${propertyId} for ${startDate.toISOString()} - ${endDate.toISOString()}`,
            );
            return { success: true, unitId: unit.id };
          }
        }

        return {
          success: false,
          conflicts: [{ reason: 'No available inventory units for selected dates' }],
        };
      }

      // Single-unit listing: check standard booking conflicts
      const conflicts = await tx.booking.findMany({
        where: {
          listingId: propertyId,
          status: {
            notIn: ['CANCELLED', 'REFUNDED', 'DRAFT'],
          },
          startDate: { lt: endDate },
          endDate: { gte: startDate },
        },
      });

      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts: conflicts.map((c: any) => ({
            id: c.id,
            startDate: c.startDate,
            endDate: c.endDate,
            reason: 'Already booked',
          })),
        };
      }

      return { success: true };
    });
    return result as unknown as { success: boolean; unitId?: string; conflicts?: any[] };
  }

  /**
   * Release a previously reserved slot (e.g., on booking cancellation or timeout).
   */
  async releaseReservation(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    inventoryUnitId?: string,
  ): Promise<{ released: number }> {
    const result = await this.prisma.availabilitySlot.updateMany({
      where: {
        listingId: propertyId,
        startTime: startDate,
        endTime: endDate,
        status: 'RESERVED',
        ...(inventoryUnitId ? { inventoryUnitId } : {}),
      },
      data: { status: 'AVAILABLE' },
    });

    this.logger.log(`Released ${result.count} reservation(s) for listing ${propertyId}`);
    return { released: result.count };
  }

  /**
   * Confirm a reservation (convert RESERVED → BOOKED).
   */
  async confirmReservation(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    bookingId: string,
    inventoryUnitId?: string,
  ): Promise<{ confirmed: boolean }> {
    const result = await this.prisma.availabilitySlot.updateMany({
      where: {
        listingId: propertyId,
        startTime: startDate,
        endTime: endDate,
        status: 'RESERVED',
        ...(inventoryUnitId ? { inventoryUnitId } : {}),
      },
      data: { status: 'BOOKED', bookingId },
    });

    return { confirmed: result.count > 0 };
  }

  /**
   * Get availability summary for a listing over a date range.
   * Returns per-day availability including unit-level details for multi-unit listings.
   */
  async getAvailabilitySummary(
    propertyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; available: boolean; availableUnits: number; totalUnits: number }>> {
    const units = await this.prisma.inventoryUnit.findMany({
      where: { listingId: propertyId, isActive: true },
    });

    const totalUnits = Math.max(units.length, 1);
    const summary: Array<{ date: string; available: boolean; availableUnits: number; totalUnits: number }> = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current);
      dayEnd.setDate(dayEnd.getDate() + 1);

      if (units.length > 0) {
        // Multi-unit: count booked/reserved slots per day
        const occupied = await this.prisma.availabilitySlot.count({
          where: {
            listingId: propertyId,
            status: { in: ['RESERVED', 'BOOKED'] },
            startTime: { lt: dayEnd },
            endTime: { gt: dayStart },
          },
        });

        summary.push({
          date: current.toISOString().slice(0, 10),
          available: occupied < totalUnits,
          availableUnits: totalUnits - occupied,
          totalUnits,
        });
      } else {
        // Single-unit: check booking conflicts
        const booked = await this.prisma.booking.count({
          where: {
            listingId: propertyId,
            status: { notIn: ['CANCELLED', 'REFUNDED', 'DRAFT'] },
            startDate: { lt: dayEnd },
            endDate: { gt: dayStart },
          },
        });

        summary.push({
          date: current.toISOString().slice(0, 10),
          available: booked === 0,
          availableUnits: booked === 0 ? 1 : 0,
          totalUnits: 1,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return summary;
  }
}

