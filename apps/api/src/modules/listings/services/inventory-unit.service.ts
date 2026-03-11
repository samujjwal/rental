import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
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

@Injectable()
export class InventoryUnitService {
  private readonly logger = new Logger(InventoryUnitService.name);

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

    return this.prisma.inventoryUnit.create({
      data: {
        listingId: dto.listingId,
        sku: dto.sku,
        label: dto.label ?? null,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
      },
    });
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

    return this.prisma.inventoryUnit.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.metadata !== undefined && {
          metadata: JSON.stringify(dto.metadata),
        }),
      },
    });
  }

  /**
   * Soft-deactivate an inventory unit.
   */
  async deactivate(id: string) {
    return this.update(id, { isActive: false });
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
