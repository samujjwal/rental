import { Test, TestingModule } from '@nestjs/testing';
import { BulkOperationsService } from './bulk-operations.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/common/storage/storage.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { BookingStateMachineService } from '@/modules/bookings/services/booking-state-machine.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('BulkOperationsService', () => {
  let service: BulkOperationsService;
  let mockPrisma: {
    listing: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    availability: { createMany: jest.Mock };
    booking: { findMany: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
  };
  let mockBookingStateMachine: { transition: jest.Mock };

  const mockPrismaService = {
    listing: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    availability: { createMany: jest.fn() },
    booking: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
  };

  const mockStorageService = { delete: jest.fn() };
  const mockNotificationsService = { createNotification: jest.fn() };
  const mockBookingStateMachineService = { transition: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkOperationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: BookingStateMachineService, useValue: mockBookingStateMachineService },
      ],
    }).compile();

    service = module.get<BulkOperationsService>(BulkOperationsService);
    mockPrisma = mockPrismaService as any;
    mockBookingStateMachine = mockBookingStateMachineService as any;

    jest.clearAllMocks();
  });

  describe('bulkUpdateListings', () => {
    it('should update multiple listings successfully', async () => {
      mockPrisma.listing.findMany.mockResolvedValue([{ id: 'listing-1' }, { id: 'listing-2' }]);
      mockPrisma.listing.update.mockResolvedValue({});

      const result = await service.bulkUpdateListings('owner-123', {
        listingIds: ['listing-1', 'listing-2'],
        updates: { status: 'UNAVAILABLE' },
      });

      expect(result.success).toBe(true);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockPrisma.listing.update).toHaveBeenCalledTimes(2);
    });

    it('should throw error for more than 100 listings', async () => {
      const listingIds = Array.from({ length: 101 }, (_, i) => `listing-${i}`);

      await expect(
        service.bulkUpdateListings('owner-123', {
          listingIds,
          updates: { basePrice: 1000 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for unauthorized listings', async () => {
      mockPrisma.listing.findMany.mockResolvedValue([{ id: 'listing-1' }]);

      await expect(
        service.bulkUpdateListings('owner-123', {
          listingIds: ['listing-1', 'listing-2'],
          updates: { status: 'AVAILABLE' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should track failed updates', async () => {
      mockPrisma.listing.findMany.mockResolvedValue([{ id: 'listing-1' }, { id: 'listing-2' }]);
      mockPrisma.listing.update
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Update failed'));

      const result = await service.bulkUpdateListings('owner-123', {
        listingIds: ['listing-1', 'listing-2'],
        updates: { basePrice: 1500 },
      });

      expect(result.success).toBe(false);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('bulkUpdateAvailability', () => {
    it('should block availability for multiple listings', async () => {
      mockPrisma.listing.findFirst.mockResolvedValue({ id: 'listing-1', ownerId: 'owner-123' });
      mockPrisma.availability.createMany.mockResolvedValue({ count: 14 });

      const result = await service.bulkUpdateAvailability('owner-123', {
        listingIds: ['listing-1', 'listing-2'],
        action: 'BLOCK',
        dateRange: { startDate: '2025-12-01', endDate: '2025-12-07' },
        reason: 'Maintenance',
      });

      expect(result.processed).toBe(2);
      expect(mockPrisma.listing.findFirst).toHaveBeenCalled();
    });

    it('should throw error for more than 50 listings', async () => {
      const listingIds = Array.from({ length: 51 }, (_, i) => `listing-${i}`);

      await expect(
        service.bulkUpdateAvailability('owner-123', {
          listingIds,
          action: 'UNBLOCK',
          dateRange: { startDate: '2025-12-01', endDate: '2025-12-07' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkRespondToBookings', () => {
    it('should confirm multiple bookings', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        listing: { ownerId: 'owner-123' },
      });
      mockBookingStateMachine.transition.mockResolvedValue({ success: true });

      const result = await service.bulkRespondToBookings('owner-123', {
        bookingIds: ['booking-1', 'booking-2'],
        action: 'ACCEPT',
      });

      expect(result.processed).toBe(2);
      expect(mockBookingStateMachine.transition).toHaveBeenCalledTimes(2);
    });

    it('should reject bookings with reason', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        listing: { ownerId: 'owner-123' },
      });
      mockBookingStateMachine.transition.mockResolvedValue({ success: true });

      const result = await service.bulkRespondToBookings('owner-123', {
        bookingIds: ['booking-1'],
        action: 'DECLINE',
      });

      expect(result.processed).toBe(1);
    });

    it('should throw error for more than 50 bookings', async () => {
      const bookingIds = Array.from({ length: 51 }, (_, i) => `booking-${i}`);

      await expect(
        service.bulkRespondToBookings('owner-123', {
          bookingIds,
          action: 'ACCEPT',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkArchiveListings', () => {
    it('should archive listings with images', async () => {
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.listing.update.mockResolvedValue({
        id: 'listing-1',
        ownerId: 'owner-123',
        images: ['img1.jpg', 'img2.jpg'],
      });

      const result = await service.bulkArchiveListings('owner-123', {
        listingIds: ['listing-1', 'listing-2'],
      });

      expect(result.processed).toBe(2);
      expect(mockPrisma.listing.update).toHaveBeenCalledTimes(2);
    });

    it('should archive without deleting images', async () => {
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.listing.findFirst.mockResolvedValue({
        id: 'listing-1',
        ownerId: 'owner-123',
        images: ['img1.jpg'],
      });

      const result = await service.bulkArchiveListings('owner-123', {
        listingIds: ['listing-1'],
      });

      expect(result.processed).toBe(1);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });
  });
});
