import { Test, TestingModule } from '@nestjs/testing';
import { BookingValidationService } from './booking-validation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { i18nBadRequest, i18nNotFound } from '@/common/errors/i18n-exceptions';

// Mock i18n exceptions
jest.mock('@/common/errors/i18n-exceptions', () => ({
  i18nBadRequest: jest.fn((key: string) => new Error(key)),
  i18nNotFound: jest.fn((key: string) => new Error(key)),
}));

describe('BookingValidationService', () => {
  let service: BookingValidationService;
  let mockPrismaService: {
    listing: { findUnique: jest.Mock };
    availability: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    mockPrismaService = {
      listing: { findUnique: jest.fn() },
      availability: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingValidationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BookingValidationService>(BookingValidationService);

    jest.clearAllMocks();
  });

  describe('validateDates', () => {
    it('should return invalid for invalid dates (NaN)', () => {
      const invalidDate = new Date('invalid');

      const result1 = service.validateDates(invalidDate, new Date());
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Invalid dates provided');

      const result2 = service.validateDates(new Date(), invalidDate);
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Invalid dates provided');
    });

    it('should return invalid when end date is before start date', () => {
      const startDate = new Date('2025-12-10');
      const endDate = new Date('2025-12-05');

      const result = service.validateDates(startDate, endDate);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End date must be after start date');
    });

    it('should return invalid when start date is in the past', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = service.validateDates(yesterday, tomorrow);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date cannot be in the past');
    });

    it('should return valid for valid future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 8);

      const result = service.validateDates(tomorrow, nextWeek);
      expect(result.isValid).toBe(true);
      expect(result.nights).toBe(7);
    });

    it('should allow booking starting today', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = service.validateDates(today, tomorrow);
      expect(result.isValid).toBe(true);
      expect(result.nights).toBe(1);
    });
  });

  describe('validateListing', () => {
    const renterId = 'renter-123';
    const ownerId = 'owner-456';
    const listingId = 'listing-789';

    it('should throw error if listing not found', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      await expect(service.validateListing(listingId, renterId)).rejects.toThrow(
        'listing.notFound',
      );
    });

    it('should throw error if listing is not available', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
        status: 'UNAVAILABLE',
        ownerId: ownerId,
        owner: { id: ownerId },
      });

      await expect(service.validateListing(listingId, renterId)).rejects.toThrow(
        'booking.unavailable',
      );
    });

    it('should throw error if renter is the owner', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
        status: 'AVAILABLE',
        ownerId: renterId,
        owner: { id: renterId },
      });

      await expect(service.validateListing(listingId, renterId)).rejects.toThrow(
        'booking.cannotBookOwn',
      );
    });

    it('should throw error if guest count exceeds capacity', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
        status: 'AVAILABLE',
        ownerId: ownerId,
        owner: { id: ownerId },
        maxGuests: 4,
      });

      await expect(service.validateListing(listingId, renterId, 5)).rejects.toThrow(
        'Guest count 5 exceeds listing capacity of 4',
      );
    });

    it('should return listing for valid request', async () => {
      const mockListing = {
        id: listingId,
        status: 'AVAILABLE',
        ownerId: ownerId,
        owner: { id: ownerId },
        maxGuests: 4,
      };
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);

      const result = await service.validateListing(listingId, renterId, 3);

      expect(result).toEqual(mockListing);
      expect(mockPrismaService.listing.findUnique).toHaveBeenCalledWith({
        where: { id: listingId },
        include: { owner: true },
      });
    });

    it('should allow booking when no guest count specified', async () => {
      const mockListing = {
        id: listingId,
        status: 'AVAILABLE',
        ownerId: ownerId,
        owner: { id: ownerId },
        maxGuests: null,
      };
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);

      const result = await service.validateListing(listingId, renterId);

      expect(result).toEqual(mockListing);
    });
  });

  describe('checkBlockedPeriods', () => {
    const listingId = 'listing-789';
    const startDate = new Date('2025-12-10');
    const endDate = new Date('2025-12-15');

    it('should not throw when no blocked periods exist', async () => {
      mockPrismaService.availability.findMany.mockResolvedValue([]);

      await expect(
        service.checkBlockedPeriods(listingId, startDate, endDate),
      ).resolves.not.toThrow();
    });

    it('should throw error when booking overlaps with blocked period', async () => {
      mockPrismaService.availability.findMany.mockResolvedValue([
        {
          id: 'block-1',
          propertyId: listingId,
          startDate: new Date('2025-12-12'),
          endDate: new Date('2025-12-14'),
          status: 'BLOCKED',
        },
      ]);

      await expect(service.checkBlockedPeriods(listingId, startDate, endDate)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not throw when blocked period is outside booking range', async () => {
      // Mock returns empty array since blocked period (Dec 20-25) is outside booking range (Dec 10-15)
      mockPrismaService.availability.findMany.mockResolvedValue([]);

      // Should not throw when blocked period is outside range
      const result = await service.checkBlockedPeriods(listingId, startDate, endDate);
      expect(result).toBeUndefined();
    });

    it('should include blocked period details in error', async () => {
      const blockedPeriod = {
        id: 'block-1',
        propertyId: listingId,
        startDate: new Date('2025-12-12'),
        endDate: new Date('2025-12-14'),
        status: 'BLOCKED',
      };
      mockPrismaService.availability.findMany.mockResolvedValue([blockedPeriod]);

      try {
        await service.checkBlockedPeriods(listingId, startDate, endDate);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toBe('Listing is blocked for the selected dates');
        expect(error.response.blockedPeriods).toHaveLength(1);
      }
    });
  });
});
