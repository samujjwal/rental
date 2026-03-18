import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/common/storage/storage.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { BookingStateMachineService } from '@/modules/bookings/services/booking-state-machine.service';
import { NotificationType } from '@rental-portal/database';
import {
  BulkArchiveListingsDto,
  BulkOperationResult,
  BulkRespondToBookingsDto,
  BulkUpdateAvailabilityDto,
  BulkUpdateListingsDto,
} from '../dto/bulk-operations.dto';

@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly bookingStateMachine: BookingStateMachineService,
  ) {}

  /**
   * Bulk update multiple listings
   */
  async bulkUpdateListings(userId: string, dto: BulkUpdateListingsDto): Promise<BulkOperationResult> {
    const { listingIds, updates } = dto;
    
    if (listingIds.length > 100) {
      throw new BadRequestException('Cannot update more than 100 listings at once');
    }

    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // Verify ownership of all listings
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds }, ownerId: userId },
    });

    if (listings.length !== listingIds.length) {
      const ownedIds = new Set(listings.map((listing) => listing.id));
      const unauthorized = listingIds.filter(id => !ownedIds.has(id));
      throw new ForbiddenException(`Not authorized to update listings: ${unauthorized.join(', ')}`);
    }

    // Process updates in transaction
    for (const listingId of listingIds) {
      try {
        await this.prisma.listing.update({
          where: { id: listingId },
          data: {
            ...updates,
            updatedAt: new Date(),
          },
        });
        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: listingId, error: error.message });
        this.logger.error(`Failed to update listing ${listingId}:`, error.message);
      }
      result.processed++;
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Bulk update availability for multiple listings
   */
  async bulkUpdateAvailability(userId: string, dto: BulkUpdateAvailabilityDto): Promise<BulkOperationResult> {
    const { listingIds, action, dateRange, price, reason } = dto;
    
    if (listingIds.length > 50) {
      throw new BadRequestException('Cannot update more than 50 listings at once');
    }

    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    for (const listingId of listingIds) {
      try {
        // Verify ownership
        const listing = await this.prisma.listing.findFirst({
          where: { id: listingId, ownerId: userId },
        });

        if (!listing) {
          throw new ForbiddenException(`Not authorized for listing ${listingId}`);
        }

        // Handle different actions
        switch (action) {
          case 'BLOCK':
            await this.blockDates(listingId, startDate, endDate, reason);
            break;
          case 'UNBLOCK':
            await this.unblockDates(listingId, startDate, endDate);
            break;
          case 'SET_PRICE':
            if (price === undefined) {
              throw new BadRequestException('Price required for SET_PRICE action');
            }
            await this.setDynamicPrice(listingId, startDate, endDate, price, reason);
            break;
        }

        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: listingId, error: error.message });
        this.logger.error(`Failed to update availability for ${listingId}:`, error.message);
      }
      result.processed++;
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Bulk respond to booking requests
   */
  async bulkRespondToBookings(userId: string, dto: BulkRespondToBookingsDto): Promise<BulkOperationResult> {
    const { bookingIds, action, message, declineReason } = dto;
    
    if (bookingIds.length > 50) {
      throw new BadRequestException('Cannot respond to more than 50 bookings at once');
    }

    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const bookingId of bookingIds) {
      try {
        // Verify ownership
        const booking = await this.prisma.booking.findFirst({
          where: { id: bookingId, ownerId: userId },
          include: { listing: true, renter: true },
        });

        if (!booking) {
          throw new ForbiddenException(`Not authorized for booking ${bookingId}`);
        }

        switch (action) {
          case 'ACCEPT':
            await this.bookingStateMachine.transition(bookingId, 'OWNER_APPROVE', userId, 'OWNER');
            break;
          case 'DECLINE':
            await this.bookingStateMachine.transition(bookingId, 'OWNER_REJECT', userId, 'OWNER');
            break;
          case 'MESSAGE':
            await this.notifications.sendNotification({
              userId: booking.renterId,
              type: NotificationType.MESSAGE_RECEIVED,
              title: `Message about your booking: ${booking.listing.title}`,
              message: message || 'No message provided',
              data: {
                bookingId,
                senderId: userId,
                source: 'bulk-owner-message',
              },
              channels: ['IN_APP'],
            });
            break;
        }

        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: bookingId, error: error.message });
        this.logger.error(`Failed to respond to booking ${bookingId}:`, error.message);
      }
      result.processed++;
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Bulk archive listings
   */
  async bulkArchiveListings(userId: string, dto: BulkArchiveListingsDto): Promise<BulkOperationResult> {
    const { listingIds, reason } = dto;
    
    if (listingIds.length > 100) {
      throw new BadRequestException('Cannot archive more than 100 listings at once');
    }

    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // Check for active bookings
    const activeBookings = await this.prisma.booking.count({
      where: {
        listingId: { in: listingIds },
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING'] },
      },
    });

    if (activeBookings > 0) {
      throw new BadRequestException(`Cannot archive: ${activeBookings} listings have active bookings`);
    }

    for (const listingId of listingIds) {
      try {
        await this.prisma.listing.update({
          where: { id: listingId, ownerId: userId },
          data: {
            status: 'UNAVAILABLE',
            isActive: false,
            deletedAt: new Date(),
            metadata: JSON.stringify({ archivedAt: new Date(), reason }),
          },
        });
        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: listingId, error: error.message });
        this.logger.error(`Failed to archive listing ${listingId}:`, error.message);
      }
      result.processed++;
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Export listings to CSV
   */
  async exportListings(
    userId: string,
    filters: { status?: string; dateFrom?: string; dateTo?: string },
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    const where: any = { ownerId: userId };
    
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const listings = await this.prisma.listing.findMany({
      where,
      include: {
        category: { select: { name: true } },
        _count: {
          select: { bookings: true, reviews: true },
        },
      },
    });

    const records = listings.map(l => ({
      id: l.id,
      title: l.title,
      category: l.category?.name || '',
      status: l.status,
      basePrice: l.basePrice,
      currency: l.currency,
      city: l.city,
      totalBookings: l._count.bookings,
      totalReviews: l.totalReviews,
      averageRating: l.averageRating,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }));

    const headers = [
      'ID',
      'Title',
      'Category',
      'Status',
      'Price',
      'Currency',
      'City',
      'Total Bookings',
      'Total Reviews',
      'Rating',
      'Created At',
      'Updated At',
    ];
    const csv = [
      headers.join(','),
      ...records.map((record) => [
        record.id,
        record.title,
        record.category,
        record.status,
        record.basePrice,
        record.currency,
        record.city,
        record.totalBookings,
        record.totalReviews,
        record.averageRating,
        record.createdAt,
        record.updatedAt,
      ].map((value) => this.escapeCsvValue(value)).join(',')),
    ].join('\n');
    
    const fileName = `listings-${userId}-${Date.now()}.csv`;
    const uploadResult = await this.storage.upload({
      file: Buffer.from(csv),
      fileName,
      mimeType: 'text/csv',
      folder: 'exports',
    });
    
    const downloadUrl = await this.storage.getSignedUrl(uploadResult.key, 3600);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return { downloadUrl, expiresAt };
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  private async blockDates(listingId: string, startDate: Date, endDate: Date, reason?: string) {
    await this.prisma.availability.create({
      data: {
        propertyId: listingId,
        startDate,
        endDate,
        status: 'BLOCKED',
        notes: reason,
      },
    });
  }

  private async unblockDates(listingId: string, startDate: Date, endDate: Date) {
    await this.prisma.availability.deleteMany({
      where: {
        propertyId: listingId,
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        status: 'BLOCKED',
      },
    });
  }

  private async setDynamicPrice(
    listingId: string,
    startDate: Date,
    endDate: Date,
    price: number,
    reason?: string,
  ) {
    const existing = await this.prisma.availability.findFirst({
      where: {
        propertyId: listingId,
        startDate,
        endDate,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.availability.update({
        where: { id: existing.id },
        data: {
          price,
          notes: reason,
        },
      });
      return;
    }

    await this.prisma.availability.create({
      data: {
        propertyId: listingId,
        startDate,
        endDate,
        status: 'AVAILABLE',
        price,
        notes: reason,
      },
    });
  }

  private escapeCsvValue(value: unknown): string {
    const stringValue = String(value ?? '');
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}
