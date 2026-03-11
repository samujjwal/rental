import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
// import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';

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

  async createAvailability(dto: CreateAvailabilityDto): Promise<any> {
    // Validate dates
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping availability rules
    const overlapping = await this.prisma.availability.findMany({
      where: {
        propertyId: dto.propertyId,
        OR: [
          {
            AND: [{ startDate: { lte: dto.startDate } }, { endDate: { gte: dto.startDate } }],
          },
          {
            AND: [{ startDate: { lte: dto.endDate } }, { endDate: { gte: dto.endDate } }],
          },
          {
            AND: [{ startDate: { gte: dto.startDate } }, { endDate: { lte: dto.endDate } }],
          },
        ],
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

  async updateAvailability(id: string, dto: UpdateAvailabilityDto): Promise<any> {
    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    return this.prisma.availability.update({
      where: { id },
      data: dto,
    });
  }

  async deleteAvailability(id: string): Promise<void> {
    await this.prisma.availability.delete({
      where: { id },
    });
  }

  async getListingAvailability(propertyId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return this.prisma.availability.findMany({
      where: {
        propertyId,
        OR: [
          {
            AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
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
      if (parsedStartDate >= parsedEndDate) {
        throw new BadRequestException('End date must be after start date');
      }

      const now = new Date();
      // Compare calendar dates only so selecting today is valid
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startDay = new Date(parsedStartDate.getFullYear(), parsedStartDate.getMonth(), parsedStartDate.getDate());
      if (startDay < todayStart) {
        throw new BadRequestException('Start date cannot be in the past');
      }

      // Check availability rules
      try {
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
      } catch (availabilityError) {
        this.logger.error('Error checking availability rules', availabilityError);
        // Continue without availability check for now
      }

      // Check for existing bookings
      try {
        // Start with a very simple query to isolate the issue
        const existingBookings = await this.prisma.booking.findMany({
          where: {
            listingId: propertyId,
          },
          take: 1, // Just test if we can query the table at all
        });
        this.logger.log(`Found ${existingBookings.length} bookings for listing ${propertyId}`);
        
        // If the simple query works, try the more complex one
        if (existingBookings.length >= 0) {
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
                  AND: [{ startDate: { lte: parsedEndDate } }, { endDate: { gte: parsedStartDate } }],
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
        }
      } catch (bookingError) {
        this.logger.error('Error checking existing bookings', bookingError);
        // Continue without booking check for now
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
  ): Promise<number> {
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
    const availableDates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const result = await this.checkAvailability({
        propertyId,
        startDate: currentDate,
        endDate: nextDate,
      });

      if (result.isAvailable) {
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
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', lockKey);

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
          endDate: { gt: startDate },
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

    while (current < endDate) {
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

