import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface CreateInventoryUnitDto {
  listingId: string;
  sku: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateInventoryUnitDto {
  label?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ReserveInventoryUnitDto {
  inventoryUnitId: string;
  listingId: string;
  bookingId: string;
  startTime: Date;
  endTime: Date;
}

@Injectable()
export class InventoryUnitService {
  private readonly logger = new Logger(InventoryUnitService.name);
  private readonly LOW_INVENTORY_THRESHOLD = 2;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new inventory unit for a listing.
   */
  async create(dto: CreateInventoryUnitDto) {
    await this.ensureListingExists(dto.listingId);

    const existing = await this.prisma.inventoryUnit.findUnique({
      where: {
        listingId_sku: {
          listingId: dto.listingId,
          sku: dto.sku,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `SKU '${dto.sku}' already exists for this listing`,
      );
    }

    const unit = await this.prisma.inventoryUnit.create({
      data: {
        listingId: dto.listingId,
        sku: dto.sku,
        label: dto.label ?? null,
        isActive: true,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
      },
    });

    // Check if this creates a low inventory situation
    await this.checkLowInventoryAlert(dto.listingId);

    return unit;
  }

  /**
   * Update an inventory unit.
   */
  async update(id: string, dto: UpdateInventoryUnitDto) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id },
    });

    if (!unit) {
      throw new NotFoundException(`Inventory unit ${id} not found`);
    }

    const updated = await this.prisma.inventoryUnit.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.metadata !== undefined && {
          metadata: JSON.stringify(dto.metadata),
        }),
      },
    });

    // Check for low inventory if status changed to active
    if (dto.isActive === true) {
      await this.checkLowInventoryAlert(unit.listingId);
    }

    return updated;
  }

  /**
   * Soft-deactivate an inventory unit.
   */
  async deactivate(id: string) {
    return this.update(id, { isActive: false });
  }

  /**
   * Activate an inventory unit.
   */
  async activate(id: string) {
    return this.update(id, { isActive: true });
  }

  /**
   * Get all inventory units for a listing.
   */
  async findByListing(listingId: string, includeInactive = false) {
    return this.prisma.inventoryUnit.findMany({
      where: {
        listingId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: { availabilitySlots: true },
        },
      },
      orderBy: { sku: 'asc' },
    });
  }

  /**
   * Get available inventory units for a listing within a time range.
   */
  async getAvailableUnits(
    listingId: string,
    startTime: Date,
    endTime: Date,
  ) {
    const allUnits = await this.findByListing(listingId, false);

    const availableUnits: any[] = [];

    for (const unit of allUnits) {
      // Check if unit has any conflicting availability slots
      const conflictingSlots = await this.prisma.availabilitySlot.count({
        where: {
          inventoryUnitId: unit.id,
          status: { in: ['RESERVED', 'BOOKED'] },
          OR: [
            {
              AND: [
                { startTime: { lte: startTime } },
                { endTime: { gt: startTime } },
              ],
            },
            {
              AND: [
                { startTime: { lt: endTime } },
                { endTime: { gte: endTime } },
              ],
            },
            {
              AND: [
                { startTime: { gte: startTime } },
                { endTime: { lte: endTime } },
              ],
            },
          ],
        },
      });

      if (conflictingSlots === 0) {
        availableUnits.push(unit);
      }
    }

    return availableUnits;
  }

  /**
   * Get a single inventory unit by ID.
   */
  async findById(id: string): Promise<any> {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id },
      include: {
        listing: {
          select: { id: true, title: true },
        },
        availabilitySlots: {
          where: { status: 'AVAILABLE' },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Inventory unit ${id} not found`);
    }

    return unit;
  }

  /**
   * Delete an inventory unit (hard delete).
   * Only allowed if no booked availability slots reference it.
   */
  async delete(id: string) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            availabilitySlots: {
              // This doesn't work with _count, check manually below
            } as any,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Inventory unit ${id} not found`);
    }

    // Check for booked slots
    const bookedSlots = await this.prisma.availabilitySlot.count({
      where: {
        inventoryUnitId: id,
        status: { in: ['BOOKED', 'RESERVED'] },
      },
    });

    if (bookedSlots > 0) {
      throw new ConflictException(
        `Cannot delete inventory unit with ${bookedSlots} active booking(s). Deactivate instead.`,
      );
    }

    return this.prisma.inventoryUnit.delete({
      where: { id },
    });
  }

  /**
   * Get the count of active units for a listing.
   */
  async getActiveCount(listingId: string): Promise<number> {
    return this.prisma.inventoryUnit.count({
      where: { listingId, isActive: true },
    });
  }

  /**
   * Reserve an inventory unit for a booking.
   */
  async reserveUnit(dto: ReserveInventoryUnitDto) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id: dto.inventoryUnitId },
      include: {
        listing: {
          select: { id: true, currency: true },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Inventory unit ${dto.inventoryUnitId} not found`);
    }

    if (!unit.isActive) {
      throw new BadRequestException(
        `Cannot reserve inactive inventory unit`,
      );
    }

    // Check for conflicting reservations
    const conflictingSlots = await this.prisma.availabilitySlot.count({
      where: {
        inventoryUnitId: dto.inventoryUnitId,
        status: { in: ['RESERVED', 'BOOKED'] },
        OR: [
          {
            AND: [
              { startTime: { lte: dto.startTime } },
              { endTime: { gt: dto.startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: dto.endTime } },
              { endTime: { gte: dto.endTime } },
            ],
          },
          {
            AND: [
              { startTime: { gte: dto.startTime } },
              { endTime: { lte: dto.endTime } },
            ],
          },
        ],
      },
    });

    if (conflictingSlots > 0) {
      throw new ConflictException(
        `Inventory unit is already reserved for the requested time range`,
      );
    }

    // Create availability slot for the reservation
    const slot = await this.prisma.availabilitySlot.create({
      data: {
        listingId: dto.listingId,
        inventoryUnitId: dto.inventoryUnitId,
        bookingId: dto.bookingId,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: 'RESERVED',
        currency: unit.listing.currency || 'USD',
      },
    });

    this.logger.log(
      `Reserved inventory unit ${dto.inventoryUnitId} for booking ${dto.bookingId}`,
    );

    // Check if this creates a low inventory situation
    await this.checkLowInventoryAlert(unit.listingId);

    return slot;
  }

  /**
   * Release a reservation for an inventory unit.
   */
  async releaseUnit(inventoryUnitId: string, bookingId: string) {
    const slot = await this.prisma.availabilitySlot.findFirst({
      where: {
        inventoryUnitId,
        bookingId,
        status: 'RESERVED',
      },
    });

    if (!slot) {
      throw new NotFoundException(
        `No active reservation found for unit ${inventoryUnitId} and booking ${bookingId}`,
      );
    }

    await this.prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: 'AVAILABLE' },
    });

    this.logger.log(
      `Released inventory unit ${inventoryUnitId} reservation for booking ${bookingId}`,
    );

    // Check if inventory is still low after release
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id: inventoryUnitId },
    });
    if (unit) {
      await this.checkLowInventoryAlert(unit.listingId);
    }
  }

  /**
   * Confirm a reservation as booked.
   */
  async confirmBooking(inventoryUnitId: string, bookingId: string) {
    const slot = await this.prisma.availabilitySlot.findFirst({
      where: {
        inventoryUnitId,
        bookingId,
        status: 'RESERVED',
      },
    });

    if (!slot) {
      throw new NotFoundException(
        `No active reservation found for unit ${inventoryUnitId} and booking ${bookingId}`,
      );
    }

    return this.prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: 'BOOKED' },
    });
  }

  /**
   * Check for low inventory and trigger alert if needed.
   */
  private async checkLowInventoryAlert(listingId: string) {
    const activeCount = await this.getActiveCount(listingId);

    if (activeCount <= this.LOW_INVENTORY_THRESHOLD) {
      this.logger.warn(
        `Low inventory alert: Listing ${listingId} has only ${activeCount} active unit(s)`,
      );
    }
  }

  private async ensureListingExists(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
  }
}
