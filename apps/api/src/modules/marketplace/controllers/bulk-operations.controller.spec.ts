import { Test, TestingModule } from '@nestjs/testing';
import { BulkOperationsController } from './bulk-operations.controller';
import { BulkOperationsService } from '../services/bulk-operations.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@rental-portal/database';

describe('BulkOperationsController', () => {
  let controller: BulkOperationsController;
  let bulkService: jest.Mocked<BulkOperationsService>;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkOperationsController],
      providers: [
        {
          provide: BulkOperationsService,
          useValue: {
            bulkUpdateListings: jest.fn(),
            bulkUpdateAvailability: jest.fn(),
            bulkRespondToBookings: jest.fn(),
            bulkArchiveListings: jest.fn(),
            exportListings: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BulkOperationsController>(BulkOperationsController);
    bulkService = module.get(BulkOperationsService) as jest.Mocked<BulkOperationsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('bulkUpdateListings', () => {
    it('should bulk update multiple listings', async () => {
      const dto = {
        listingIds: ['listing-1', 'listing-2', 'listing-3'],
        updates: {
          basePrice: 1500,
        },
      };

      const mockResult = {
        success: true,
        processed: 3,
        succeeded: 3,
        failed: 0,
        errors: [],
      };

      bulkService.bulkUpdateListings.mockResolvedValue(mockResult);

      const result = await controller.bulkUpdateListings(mockUserId, dto);

      expect(bulkService.bulkUpdateListings).toHaveBeenCalledWith(mockUserId, dto);
      expect(result).toEqual(mockResult);
    });

    it('should handle partial failures', async () => {
      const dto = {
        listingIds: ['listing-1', 'listing-2', 'listing-3'],
        updates: { basePrice: 1500 },
      };

      const mockResult = {
        success: false,
        processed: 2,
        succeeded: 2,
        failed: 1,
        errors: [
          { id: 'listing-3', error: 'Listing not found' },
        ],
      };

      bulkService.bulkUpdateListings.mockResolvedValue(mockResult);

      const result = await controller.bulkUpdateListings(mockUserId, dto);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle unauthorized access', async () => {
      const dto = {
        listingIds: ['listing-1'],
        updates: { basePrice: 1500 },
      };

      bulkService.bulkUpdateListings.mockRejectedValue(
        new ForbiddenException('Not authorized to update some listings')
      );

      await expect(controller.bulkUpdateListings(mockUserId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should handle empty listingIds array', async () => {
      const dto = {
        listingIds: [],
        updates: { basePrice: 1500 },
      };

      bulkService.bulkUpdateListings.mockRejectedValue(
        new BadRequestException('At least one listing ID is required')
      );

      await expect(controller.bulkUpdateListings(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid update data', async () => {
      const dto = {
        listingIds: ['listing-1'],
        updates: { basePrice: -100 },
      };

      bulkService.bulkUpdateListings.mockRejectedValue(
        new BadRequestException('Invalid price value')
      );

      await expect(controller.bulkUpdateListings(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkUpdateAvailability', () => {
    it('should bulk update availability for multiple listings', async () => {
      const dto = {
        listingIds: ['listing-1', 'listing-2'],
        action: 'BLOCK' as const,
        dateRange: {
          startDate: '2025-02-01',
          endDate: '2025-02-10',
        },
        reason: 'Maintenance',
      };

      const mockResult = {
        success: true,
        processed: 2,
        succeeded: 2,
        failed: 0,
        errors: [],
      };

      bulkService.bulkUpdateAvailability.mockResolvedValue(mockResult);

      const result = await controller.bulkUpdateAvailability(mockUserId, dto);

      expect(bulkService.bulkUpdateAvailability).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.success).toBe(true);
    });

    it('should handle overlapping availability conflicts', async () => {
      const dto = {
        listingIds: ['listing-1'],
        action: 'BLOCK' as const,
        dateRange: {
          startDate: '2025-02-01',
          endDate: '2025-02-10',
        },
      };

      bulkService.bulkUpdateAvailability.mockRejectedValue(
        new BadRequestException('Conflicts with existing bookings')
      );

      await expect(controller.bulkUpdateAvailability(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid date ranges', async () => {
      const dto = {
        listingIds: ['listing-1'],
        action: 'BLOCK' as const,
        dateRange: {
          startDate: '2025-02-10',
          endDate: '2025-02-01',
        },
      };

      bulkService.bulkUpdateAvailability.mockRejectedValue(
        new BadRequestException('End date must be after start date')
      );

      await expect(controller.bulkUpdateAvailability(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkRespondToBookings', () => {
    it('should bulk respond to booking requests', async () => {
      const dto = {
        bookingIds: ['booking-1', 'booking-2'],
        action: 'ACCEPT' as const,
        message: 'Approved!',
      };

      const mockResult = {
        success: true,
        processed: 2,
        succeeded: 2,
        failed: 0,
        errors: [],
      };

      bulkService.bulkRespondToBookings.mockResolvedValue(mockResult);

      const result = await controller.bulkRespondToBookings(mockUserId, dto);

      expect(bulkService.bulkRespondToBookings).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.processed).toBe(2);
    });

    it('should handle already processed bookings', async () => {
      const dto = {
        bookingIds: ['booking-1'],
        action: 'ACCEPT' as const,
      };

      const mockResult = {
        success: false,
        processed: 0,
        succeeded: 0,
        failed: 1,
        errors: [
          { id: 'booking-1', error: 'Booking already processed' },
        ],
      };

      bulkService.bulkRespondToBookings.mockResolvedValue(mockResult);

      const result = await controller.bulkRespondToBookings(mockUserId, dto);

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
    });

    it('should require message for approval', async () => {
      const dto = {
        bookingIds: ['booking-1'],
        action: 'ACCEPT' as const,
      };

      bulkService.bulkRespondToBookings.mockRejectedValue(
        new BadRequestException('Message is required for approval')
      );

      await expect(controller.bulkRespondToBookings(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should require reason for rejection', async () => {
      const dto = {
        bookingIds: ['booking-1'],
        action: 'DECLINE' as const,
      };

      bulkService.bulkRespondToBookings.mockRejectedValue(
        new BadRequestException('Reason is required for rejection')
      );

      await expect(controller.bulkRespondToBookings(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkArchiveListings', () => {
    it('should bulk archive multiple listings', async () => {
      const dto = {
        listingIds: ['listing-1', 'listing-2', 'listing-3'],
        reason: 'Seasonal closure',
      };

      const mockResult = {
        success: true,
        processed: 3,
        succeeded: 3,
        failed: 0,
        errors: [],
      };

      bulkService.bulkArchiveListings.mockResolvedValue(mockResult);

      const result = await controller.bulkArchiveListings(mockUserId, dto);

      expect(bulkService.bulkArchiveListings).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.processed).toBe(3);
    });

    it('should handle active bookings when archiving', async () => {
      const dto = {
        listingIds: ['listing-1'],
        reason: 'Maintenance',
      };

      const mockResult = {
        success: false,
        processed: 0,
        succeeded: 0,
        failed: 1,
        errors: [
          { id: 'listing-1', error: 'Cannot archive: active bookings exist' },
        ],
      };

      bulkService.bulkArchiveListings.mockResolvedValue(mockResult);

      const result = await controller.bulkArchiveListings(mockUserId, dto);

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('active bookings');
    });

    it('should require archive reason', async () => {
      const dto = {
        listingIds: ['listing-1'],
        reason: '',
      };

      bulkService.bulkArchiveListings.mockRejectedValue(
        new BadRequestException('Archive reason is required')
      );

      await expect(controller.bulkArchiveListings(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportListings', () => {
    it('should export listings to CSV', async () => {
      const filters = {
        status: 'ACTIVE',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
      };

      const mockResult = {
        downloadUrl: 'https://storage.example.com/exports/user-123-export-456.csv',
        expiresAt: new Date('2025-02-01T00:00:00Z').toISOString(),
      };

      bulkService.exportListings.mockResolvedValue(mockResult);

      const result = await controller.exportListings(mockUserId, filters);

      expect(bulkService.exportListings).toHaveBeenCalledWith(mockUserId, filters);
      expect(result.downloadUrl).toContain('.csv');
      expect(result.expiresAt).toBeDefined();
    });

    it('should export with no filters', async () => {
      const filters = {};

      const mockResult = {
        downloadUrl: 'https://storage.example.com/exports/user-123-all.csv',
        expiresAt: new Date().toISOString(),
      };

      bulkService.exportListings.mockResolvedValue(mockResult);

      const result = await controller.exportListings(mockUserId, filters);

      expect(bulkService.exportListings).toHaveBeenCalledWith(mockUserId, filters);
    });

    it('should handle export generation failure', async () => {
      const filters = { status: 'ACTIVE' };

      bulkService.exportListings.mockRejectedValue(
        new Error('Export generation failed')
      );

      await expect(controller.exportListings(mockUserId, filters)).rejects.toThrow('Export generation failed');
    });

    it('should handle no listings to export', async () => {
      const filters = { status: 'ARCHIVED' };

      bulkService.exportListings.mockRejectedValue(
        new BadRequestException('No listings found matching criteria')
      );

      await expect(controller.exportListings(mockUserId, filters)).rejects.toThrow(BadRequestException);
    });
  });

  describe('authorization', () => {
    it('should have JWT and Roles guards applied', () => {
      const guards = Reflect.getMetadata('__guards__', BulkOperationsController);
      expect(guards).toBeDefined();
    });

    it('should require USER, HOST, or ADMIN role', () => {
      const roles = Reflect.getMetadata('roles', BulkOperationsController);
      expect(roles).toContain(UserRole.USER);
      expect(roles).toContain(UserRole.HOST);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('should reject non-owner from bulk operations on others listings', async () => {
      const dto = {
        listingIds: ['listing-1'],
        updates: { basePrice: 1500 },
      };

      bulkService.bulkUpdateListings.mockRejectedValue(
        new ForbiddenException('Not authorized for listing listing-1')
      );

      await expect(controller.bulkUpdateListings('other-user', dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('large batch handling', () => {
    it('should handle maximum batch size', async () => {
      const dto = {
        listingIds: Array(100).fill(null).map((_, i) => `listing-${i}`),
        updates: { basePrice: 1500 },
      };

      const mockResult = {
        success: true,
        processed: 100,
        succeeded: 100,
        failed: 0,
        errors: [],
      };

      bulkService.bulkUpdateListings.mockResolvedValue(mockResult);

      const result = await controller.bulkUpdateListings(mockUserId, dto);

      expect(result.processed).toBe(100);
    });
  });

  describe('validation edge cases', () => {
    it('should handle duplicate listing IDs', async () => {
      const dto = {
        listingIds: ['listing-1', 'listing-1', 'listing-2'],
        updates: { basePrice: 1500 },
      };

      const mockResult = {
        success: true,
        processed: 2,
        succeeded: 2,
        failed: 0,
        errors: [],
      };

      bulkService.bulkUpdateListings.mockResolvedValue(mockResult);

      const result = await controller.bulkUpdateListings(mockUserId, dto);

      expect(result.processed).toBe(2); // Duplicates should be deduplicated
    });

    it('should handle non-existent listing IDs', async () => {
      const dto = {
        listingIds: ['non-existent-listing'],
        updates: { basePrice: 1500 },
      };

      const mockResult = {
        success: false,
        processed: 0,
        succeeded: 0,
        failed: 1,
        errors: [
          { id: 'non-existent-listing', error: 'Listing not found' },
        ],
      };

      bulkService.bulkUpdateListings.mockResolvedValue(mockResult);

      const result = await controller.bulkUpdateListings(mockUserId, dto);

      expect(result.failed).toBe(1);
    });
  });
});
