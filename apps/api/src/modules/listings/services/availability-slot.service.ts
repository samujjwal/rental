import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface CreateAvailabilitySlotDto {
  listingId: string;
  inventoryUnitId?: string;
  startTime: Date;
  endTime: Date;
  price?: number;
  currency?: string;
  notes?: string;
}

export interface UpdateAvailabilitySlotDto {
  status?: 'AVAILABLE' | 'BLOCKED' | 'MAINTENANCE';
  price?: number;
  notes?: string;
}

export interface BulkCreateSlotsDto {
  listingId: string;
  inventoryUnitId?: string;
  slots: Array<{
    startTime: Date;
    endTime: Date;
    price?: number;
  }>;
  currency?: string;
}

export interface AvailabilityQuery {
  listingId: string;
  inventoryUnitId?: string;
  startTime: Date;
  endTime: Date;
  status?: string[];
}

@Injectable()
export class AvailabilitySlotService {
  private readonly logger = new Logger(AvailabilitySlotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a single availability slot.
   */
  async create(dto: CreateAvailabilitySlotDto): Promise<any> {
    this.validateTimeRange(dto.startTime, dto.endTime);
    const listing = await this.ensureListingExists(dto.listingId);

    if (dto.inventoryUnitId) {
      await this.ensureInventoryUnitExists(dto.inventoryUnitId);
    }

    // Check for overlapping slots
    await this.checkOverlap(
      dto.listingId,
      dto.startTime,
      dto.endTime,
      dto.inventoryUnitId,
    );

    return this.prisma.availabilitySlot.create({
      data: {
        listingId: dto.listingId,
        inventoryUnitId: dto.inventoryUnitId ?? null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: 'AVAILABLE',
        price: dto.price ?? null,
        currency: dto.currency ?? listing.currency ?? 'NPR',
        notes: dto.notes ?? null,
      },
    });
  }

  /**
   * Bulk create availability slots for a listing.
   */
  async bulkCreate(dto: BulkCreateSlotsDto) {
    // Validate all time ranges
    for (const slot of dto.slots) {
      this.validateTimeRange(slot.startTime, slot.endTime);
    }

    await this.ensureListingExists(dto.listingId);

    if (dto.inventoryUnitId) {
      await this.ensureInventoryUnitExists(dto.inventoryUnitId);
    }

    const created = await this.prisma.$transaction(
      dto.slots.map((slot) =>
        this.prisma.availabilitySlot.create({
          data: {
            listingId: dto.listingId,
            inventoryUnitId: dto.inventoryUnitId ?? null,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: 'AVAILABLE',
            price: slot.price ?? null,
            currency: dto.currency ?? 'NPR',
          },
        }),
      ),
    );

    return { created: created.length, slots: created };
  }

  /**
   * Update a slot's status, price, or notes.
   */
  async update(id: string, dto: UpdateAvailabilitySlotDto): Promise<any> {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id },
    });

    if (!slot) {
      throw new NotFoundException(`Availability slot ${id} not found`);
    }

    // Cannot modify booked/reserved slots directly
    if (['BOOKED', 'RESERVED'].includes(slot.status)) {
      throw new ConflictException(
        `Cannot modify slot with status '${slot.status}'. Cancel the booking first.`,
      );
    }

    return this.prisma.availabilitySlot.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  /**
   * Reserve a slot (mark as RESERVED during checkout flow).
   * Returns the reserved slot or throws if unavailable.
   */
  async reserve(slotId: string, bookingId: string) {
    // Use transaction for atomicity
    return this.prisma.$transaction(async (tx: any) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
      });

      if (!slot) {
        throw new NotFoundException(`Availability slot ${slotId} not found`);
      }

      if (slot.status !== 'AVAILABLE') {
        throw new ConflictException(
          `Slot is not available (current status: ${slot.status})`,
        );
      }

      return tx.availabilitySlot.update({
        where: { id: slotId },
        data: {
          status: 'RESERVED',
          bookingId,
        },
      });
    });
  }

  /**
   * Confirm a reservation (mark as BOOKED).
   */
  async confirmReservation(slotId: string): Promise<any> {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new NotFoundException(`Availability slot ${slotId} not found`);
    }

    if (slot.status !== 'RESERVED') {
      throw new ConflictException(
        `Cannot confirm slot with status '${slot.status}'. Must be RESERVED.`,
      );
    }

    return this.prisma.availabilitySlot.update({
      where: { id: slotId },
      data: { status: 'BOOKED' },
    });
  }

  /**
   * Release a reservation (mark back as AVAILABLE).
   */
  async releaseReservation(slotId: string): Promise<any> {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new NotFoundException(`Availability slot ${slotId} not found`);
    }

    if (!['RESERVED', 'BOOKED'].includes(slot.status)) {
      throw new ConflictException(
        `Cannot release slot with status '${slot.status}'`,
      );
    }

    return this.prisma.availabilitySlot.update({
      where: { id: slotId },
      data: {
        status: 'AVAILABLE',
        bookingId: null,
      },
    });
  }

  /**
   * Query available slots for a listing within a time range.
   */
  async findAvailable(query: AvailabilityQuery): Promise<any[]> {
    return this.prisma.availabilitySlot.findMany({
      where: {
        listingId: query.listingId,
        ...(query.inventoryUnitId && {
          inventoryUnitId: query.inventoryUnitId,
        }),
        startTime: { gte: query.startTime },
        endTime: { lte: query.endTime },
        status: {
          in: (query.status as any[]) ?? ['AVAILABLE'],
        },
      },
      include: {
        inventoryUnit: {
          select: { id: true, sku: true, label: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Check if a time range is fully available.
   */
  async isAvailable(
    listingId: string,
    startTime: Date,
    endTime: Date,
    inventoryUnitId?: string,
  ): Promise<boolean> {
    const conflicting = await this.prisma.availabilitySlot.count({
      where: {
        listingId,
        ...(inventoryUnitId && { inventoryUnitId }),
        status: { in: ['RESERVED', 'BOOKED', 'BLOCKED', 'MAINTENANCE'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    return conflicting === 0;
  }

  /**
   * Delete a slot (only if AVAILABLE or BLOCKED).
   */
  async delete(id: string): Promise<any> {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id },
    });

    if (!slot) {
      throw new NotFoundException(`Availability slot ${id} not found`);
    }

    if (['BOOKED', 'RESERVED'].includes(slot.status)) {
      throw new ConflictException(
        `Cannot delete slot with status '${slot.status}'`,
      );
    }

    return this.prisma.availabilitySlot.delete({
      where: { id },
    });
  }

  // ──────── Private helpers ────────

  private validateTimeRange(startTime: Date, endTime: Date) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw i18nBadRequest('validation.invalidDateFormat');
    }

    if (start >= end) {
      throw i18nBadRequest('booking.endBeforeStart');
    }
  }

  private async checkOverlap(
    listingId: string,
    startTime: Date,
    endTime: Date,
    inventoryUnitId?: string,
    excludeId?: string,
  ) {
    const overlapping = await this.prisma.availabilitySlot.findFirst({
      where: {
        listingId,
        ...(inventoryUnitId && { inventoryUnitId }),
        ...(excludeId && { id: { not: excludeId } }),
        startTime: { lt: new Date(endTime) },
        endTime: { gt: new Date(startTime) },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Overlapping slot exists (${overlapping.startTime.toISOString()} - ${overlapping.endTime.toISOString()})`,
      );
    }
  }

  private async ensureListingExists(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, currency: true },
    });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
    return listing;
  }

  private async ensureInventoryUnitExists(inventoryUnitId: string) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id: inventoryUnitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException(
        `Inventory unit ${inventoryUnitId} not found`,
      );
    }
  }
}
