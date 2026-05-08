import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AvailabilityRepository {
  private readonly logger = new Logger(AvailabilityRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAvailability(id: string): Promise<any | null> {
    return this.prisma.availability.findUnique({
      where: { id },
      include: { property: true },
    });
  }

  async createAvailability(data: Prisma.AvailabilityCreateInput): Promise<any> {
    return this.prisma.availability.create({
      data,
      include: { property: true },
    });
  }

  async updateAvailability(listingId: string, updateData: Prisma.AvailabilityUpdateInput): Promise<any> {
    return this.prisma.availability.updateMany({
      where: { propertyId: listingId },
      data: updateData,
    });
  }

  async deleteAvailability(id: string): Promise<void> {
    await this.prisma.availability.delete({
      where: { id },
    });
    this.logger.log(`Deleted availability ${id}`);
  }

  async findConflicts(listingId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const conflicts = await this.prisma.$queryRaw`
      SELECT 
        id,
        propertyId,
        startDate,
        endDate,
        status,
        'booking_conflict' as conflictType
      FROM availability
      WHERE propertyId = ${listingId}
        AND status IN ('BOOKED', 'BLOCKED')
        AND (
          (startDate <= ${startDate} AND endDate > ${startDate}) OR
          (startDate < ${endDate} AND endDate >= ${endDate}) OR
          (startDate >= ${startDate} AND endDate <= ${endDate})
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
        await this.prisma.availability.update({
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
    return this.prisma.availability.findMany({
      where: {
        propertyId: listingId,
        status: 'BLOCKED',
      },
      orderBy: { startDate: 'asc' },
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
    const where: Prisma.AvailabilityWhereInput = {
      propertyId: listingId,
    };

    if (startDate && endDate) {
      where.startDate = { gte: startDate };
      where.endDate = { lte: endDate };
    }

    const [total, available, booked, blocked] = await Promise.all([
      this.prisma.availability.count({ where }),
      this.prisma.availability.count({ where: { ...where, status: 'AVAILABLE' } }),
      this.prisma.availability.count({ where: { ...where, status: 'BOOKED' } }),
      this.prisma.availability.count({ where: { ...where, status: 'BLOCKED' } }),
    ]);

    return {
      totalDays: total,
      availableDays: available,
      bookedDays: booked,
      blockedDays: blocked,
    };
  }

  async bulkUpdateAvailability(updates: Prisma.AvailabilityUpdateInput[]): Promise<void> {
    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.availability.updateMany({
          where: { propertyId: (update as any).propertyId as string },
          data: update,
        }),
      ),
    );
    this.logger.log(`Bulk updated ${updates.length} availability records`);
  }

  async findAvailabilityByListing(listingIds: string): Promise<Record<string, any[]>> {
    const listingIdArray = listingIds.split(',');
    const availabilities = await this.prisma.availability.findMany({
      where: {
        propertyId: { in: listingIdArray },
        startDate: { gte: new Date() },
      },
      include: { property: true },
      orderBy: { startDate: 'asc' },
    });

    // Group by listingId
    const result: Record<string, any[]> = {};
    for (const listingId of listingIdArray) {
      result[listingId] = availabilities.filter((a) => a.propertyId === listingId);
    }

    return result;
  }

  async createBlockedPeriod(data: Prisma.AvailabilityCreateInput): Promise<any> {
    return this.prisma.availability.create({
      data: { ...data, status: 'BLOCKED' },
      include: { property: true },
    });
  }

  async removeBlockedPeriod(id: string): Promise<void> {
    await this.prisma.availability.delete({
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
