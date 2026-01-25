import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Availability } from '@rental-portal/database';

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  until?: Date;
  count?: number;
}

export interface CreateAvailabilityDto {
  listingId: string;
  startDate: Date;
  endDate: Date;
  isAvailable: boolean;
  recurrenceRule?: RecurrenceRule;
  overrideBookings?: boolean;
}

export interface UpdateAvailabilityDto extends Partial<CreateAvailabilityDto> {}

export interface AvailabilityCheckDto {
  listingId: string;
  startDate: Date;
  endDate: Date;
}

export interface AvailabilityResult {
  isAvailable: boolean;
  conflicts?: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  }>;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async createAvailability(dto: CreateAvailabilityDto): Promise<Availability> {
    // Validate dates
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping availability rules
    const overlapping = await this.prisma.availability.findMany({
      where: {
        listingId: dto.listingId,
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
        listingId: dto.listingId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        available: dto.isAvailable,
      },
    });
  }

  async updateAvailability(id: string, dto: UpdateAvailabilityDto): Promise<Availability> {
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

  async getListingAvailability(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Availability[]> {
    return this.prisma.availability.findMany({
      where: {
        listingId,
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
    const { listingId, startDate, endDate } = dto;

    // Validate dates
    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const now = new Date();
    if (startDate < now) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    // Check availability rules
    const availabilityRules = await this.getListingAvailability(listingId, startDate, endDate);

    const unavailableRules = availabilityRules.filter((rule) => !rule.available);
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

    // Check for existing bookings
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        listingId,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT'] },
        OR: [
          {
            AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
          },
        ],
      },
    });

    if (existingBookings.length > 0) {
      return {
        isAvailable: false,
        conflicts: existingBookings.map((booking) => ({
          id: booking.id,
          startDate: booking.startDate,
          endDate: booking.endDate,
          reason: 'Already booked',
        })),
      };
    }

    // Check listing advance notice and lead time
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { advanceNotice: true, leadTime: true },
    });

    if (listing) {
      const advanceNoticeHours = listing.advanceNotice || 0;
      const minStartDate = new Date(now.getTime() + advanceNoticeHours * 60 * 60 * 1000);

      if (startDate < minStartDate) {
        return {
          isAvailable: false,
          conflicts: [
            {
              id: 'advance-notice',
              startDate: now,
              endDate: minStartDate,
              reason: `Requires ${advanceNoticeHours} hours advance notice`,
            },
          ],
        };
      }
    }

    return {
      isAvailable: true,
    };
  }

  async bulkUpdateAvailability(
    listingId: string,
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
          listingId,
          startDate: startOfDay,
        },
      });

      if (existing) {
        await this.prisma.availability.update({
          where: { id: existing.id },
          data: { available: isAvailable },
        });
      } else {
        await this.prisma.availability.create({
          data: {
            listingId,
            startDate: startOfDay,
            endDate: endOfDay,
            available: isAvailable,
          },
        });
      }

      count++;
    }

    return count;
  }

  async getAvailableDates(listingId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    const availableDates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const result = await this.checkAvailability({
        listingId,
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
}
