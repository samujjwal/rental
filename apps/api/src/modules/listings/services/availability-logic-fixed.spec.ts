import { BadRequestException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

/**
 * CRITICAL: Availability Logic Validation Tests
 *
 * Isolated unit tests with mocked Prisma and Cache services.
 * Validates date overlap detection, date validation, status filtering,
 * availability rules, and error handling.
 *
 * Risk Level: HIGH - Prevents double bookings and business disputes
 */
describe('AvailabilityService - Logic Validation', () => {
  let service: AvailabilityService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      availability: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'avail-1' }),
        update: jest.fn().mockResolvedValue({ id: 'avail-1' }),
        delete: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      listing: {
        findUnique: jest.fn().mockResolvedValue({ id: 'listing-1' }),
      },
      availabilitySlot: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockPrisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(null),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new AvailabilityService(mockPrisma, mockCache);
  });

  describe('CRITICAL: Date Overlap Detection Logic', () => {
    it('should detect complete overlap when existing booking encompasses new request', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-15'),
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-05'),
        endDate: new Date('2026-06-10'),
      });

      expect(result.isAvailable).toBe(false);
    });

    it('should detect partial overlap when new request starts during existing booking', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-07'),
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-05'),
        endDate: new Date('2026-06-12'),
      });

      expect(result.isAvailable).toBe(false);
    });

    it('should detect partial overlap when new request ends during existing booking', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2026-06-10'),
          endDate: new Date('2026-06-15'),
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-05'),
        endDate: new Date('2026-06-12'),
      });

      expect(result.isAvailable).toBe(false);
    });

    it('should allow booking with no conflicts', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-07'),
      });

      expect(result.isAvailable).toBe(true);
    });

    it('should detect multiple overlapping bookings', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-05'),
          status: 'CONFIRMED',
        },
        {
          id: 'booking-2',
          startDate: new Date('2026-06-08'),
          endDate: new Date('2026-06-12'),
          status: 'PENDING',
        },
      ]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-15'),
      });

      expect(result.isAvailable).toBe(false);
      expect(result.conflicts!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CRITICAL: Date Validation Logic', () => {
    it('should reject when start date equals end date', async () => {
      const sameDate = new Date('2026-06-05');
      await expect(
        service.createAvailability({
          propertyId: 'listing-1',
          startDate: sameDate,
          endDate: sameDate,
          isAvailable: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when start date is after end date', async () => {
      await expect(
        service.createAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2025-06-10'),
          endDate: new Date('2025-06-05'),
          isAvailable: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle string date inputs in checkAvailability', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: '2026-07-01' as any,
        endDate: '2026-07-07' as any,
      });

      expect(result).toBeDefined();
      expect(typeof result.isAvailable).toBe('boolean');
    });
  });

  describe('CRITICAL: Booking Status Filtering Logic', () => {
    it('should consider confirmed bookings as conflicts', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2026-06-05'),
          endDate: new Date('2026-06-10'),
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-05'),
        endDate: new Date('2026-06-10'),
      });

      expect(result.isAvailable).toBe(false);
    });

    it('should consider pending payment bookings as conflicts', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2026-06-05'),
          endDate: new Date('2026-06-10'),
          status: 'PENDING_PAYMENT',
        },
      ]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-05'),
        endDate: new Date('2026-06-10'),
      });

      expect(result.isAvailable).toBe(false);
    });
  });

  describe('CRITICAL: Availability Rules Logic', () => {
    it('should respect blocked availability rules', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-30'),
          status: 'BLOCKED',
        },
      ]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-15'),
      });

      expect(result.isAvailable).toBe(false);
    });

    it('should allow booking during available periods', async () => {
      mockPrisma.availability.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-30'),
          status: 'AVAILABLE',
        },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-15'),
      });

      expect(result.isAvailable).toBe(true);
    });
  });

  describe('CRITICAL: Error Handling', () => {
    it('should handle database errors in checkAvailability gracefully', async () => {
      mockPrisma.availability.findMany.mockRejectedValue(new Error('DB connection lost'));
      mockPrisma.booking.findMany.mockResolvedValue([]);

      // Service catches errors and returns a result (fallback behavior)
      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-15'),
      });

      // Result is returned despite error (graceful degradation)
      expect(result).toBeDefined();
      expect(typeof result.isAvailable).toBe('boolean');
    });

    it('should validate date range boundaries in createAvailability', async () => {
      // Negative range should be rejected
      await expect(
        service.createAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2026-06-15'),
          endDate: new Date('2026-06-10'),
          isAvailable: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate date range boundaries in updateAvailability', async () => {
      await expect(
        service.updateAvailability('avail-1', {
          startDate: new Date('2026-06-15'),
          endDate: new Date('2026-06-10'),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
