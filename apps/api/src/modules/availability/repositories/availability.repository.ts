import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Strict type for availability bulk updates that enforces listingId inclusion
 * and separates it from mutable fields to prevent type safety violations.
 * Note: This repository now uses AvailabilitySlot as the canonical model.
 */
export interface AvailabilityBulkUpdateInput {
  listingId: string;
  updateData: Prisma.AvailabilitySlotUpdateInput;
}

@Injectable()
export class AvailabilityRepository {
  private readonly logger = new Logger(AvailabilityRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAvailability(id: string): Promise<any | null> {
    return this.prisma.availabilitySlot.findUnique({
      where: { id },
      include: { listing: true, inventoryUnit: true, booking: true },
    });
  }

  async createAvailability(data: Prisma.AvailabilitySlotCreateInput): Promise<any> {
    return this.prisma.availabilitySlot.create({
      data,
      include: { listing: true, inventoryUnit: true, booking: true },
    });
  }

  async updateAvailability(listingId: string, updateData: Prisma.AvailabilitySlotUpdateInput): Promise<any> {
    return this.prisma.availabilitySlot.updateMany({
      where: { listingId },
      data: updateData,
    });
  }

  async deleteAvailability(id: string): Promise<void> {
    await this.prisma.availabilitySlot.delete({
      where: { id },
    });
    this.logger.log(`Deleted availability slot ${id}`);
  }

  async findConflicts(listingId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const conflicts = await this.prisma.$queryRaw`
      SELECT 
        id,
        listingId,
        startTime,
        endTime,
        status,
        'booking_conflict' as conflictType
      FROM availability_slot
      WHERE listingId = ${listingId}
        AND status IN ('BOOKED', 'BLOCKED', 'RESERVED')
        AND (
          -- Canonical half-open interval overlap: [a, b) overlaps [c, d) if a < d AND c < b
          (startTime < ${endDate} AND endTime > ${startDate})
        )
    `;
    return conflicts;
  }

  async resolveConflicts(listingId: string, conflicts?: any[]): Promise<any> {
    let resolved = 0;
    let failed = 0;

    for (const conflict of conflicts || []) {
      try {
        // Resolution logic depends on conflict type
        // For now, log and mark as reviewed
        await this.prisma.availabilitySlot.update({
          where: { id: conflict.id },
          data: { notes: `Conflict resolved: ${new Date().toISOString()}` },
        });
        resolved++;
      } catch (error) {
        this.logger.error(`Failed to resolve conflict ${conflict.id}`, error);
        failed++;
      }
    }

    this.logger.log(`Resolved ${resolved} conflicts for ${listingId}, ${failed} failed`);
    return { resolved, failed };
  }

  async findBlockedPeriods(listingId: string): Promise<any[]> {
    return this.prisma.availabilitySlot.findMany({
      where: {
        listingId,
        status: 'BLOCKED',
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async syncAvailability(listingId: string, syncData?: any): Promise<any> {
    this.logger.log(`Syncing availability for ${listingId}`);
    
    // In a real implementation, this would sync with external channels
    // For now, return success
    return {
      overallSuccess: true,
      channelResults: {
        internal: { success: true, syncedAt: new Date() },
      },
      successfulChannels: ['internal'],
      failedChannels: [],
    };
  }

  async getAvailabilityStats(
    listingId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const where: Prisma.AvailabilitySlotWhereInput = {
      listingId,
    };

    if (startDate && endDate) {
      where.startTime = { gte: startDate };
      where.endTime = { lte: endDate };
    }

    const [total, available, booked, blocked] = await Promise.all([
      this.prisma.availabilitySlot.count({ where }),
      this.prisma.availabilitySlot.count({ where: { ...where, status: 'AVAILABLE' } }),
      this.prisma.availabilitySlot.count({ where: { ...where, status: 'BOOKED' } }),
      this.prisma.availabilitySlot.count({ where: { ...where, status: 'BLOCKED' } }),
    ]);

    return {
      totalDays: total,
      availableDays: available,
      bookedDays: booked,
      blockedDays: blocked,
    };
  }

  async bulkUpdateAvailability(updates: AvailabilityBulkUpdateInput[]): Promise<void> {
    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.availabilitySlot.updateMany({
          where: { listingId: update.listingId },
          data: update.updateData,
        }),
      ),
    );
    this.logger.log(`Bulk updated ${updates.length} availability slot records`);
  }

  async findAvailabilityByListing(listingIds: string): Promise<Record<string, any[]>> {
    const listingIdArray = listingIds.split(',');
    const availabilities = await this.prisma.availabilitySlot.findMany({
      where: {
        listingId: { in: listingIdArray },
        startTime: { gte: new Date() },
      },
      include: { listing: true, inventoryUnit: true, booking: true },
      orderBy: { startTime: 'asc' },
    });

    // Group by listingId
    const result: Record<string, any[]> = {};
    for (const listingId of listingIdArray) {
      result[listingId] = availabilities.filter((a) => a.listingId === listingId);
    }

    return result;
  }

  async createBlockedPeriod(data: Prisma.AvailabilitySlotCreateInput): Promise<any> {
    return this.prisma.availabilitySlot.create({
      data: { ...data, status: 'BLOCKED' },
      include: { listing: true, inventoryUnit: true, booking: true },
    });
  }

  async removeBlockedPeriod(id: string): Promise<void> {
    await this.prisma.availabilitySlot.delete({
      where: { id },
    });
    this.logger.log(`Removed blocked period ${id}`);
  }

  async findAvailabilitySlots(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.prisma.availabilitySlot.findMany({
      where: {
        listingId,
        startTime: { gte: startDate },
        endTime: { lte: endDate },
      },
      include: { booking: true, inventoryUnit: true },
      orderBy: { startTime: 'asc' },
    });
  }

  async createAvailabilitySlot(data: Prisma.AvailabilitySlotCreateInput): Promise<any> {
    return this.prisma.availabilitySlot.create({
      data,
      include: { booking: true, inventoryUnit: true },
    });
  }

  async reserveAvailabilitySlot(
    slotId: string,
    bookingId: string,
  ): Promise<any> {
    return this.prisma.availabilitySlot.update({
      where: { id: slotId },
      data: {
        status: 'BOOKED',
        bookingId,
      },
      include: { booking: true, inventoryUnit: true },
    });
  }

  async releaseAvailabilitySlot(slotId: string): Promise<void> {
    await this.prisma.availabilitySlot.update({
      where: { id: slotId },
      data: {
        status: 'AVAILABLE',
        bookingId: null,
      },
    });
  }
}
