import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { Prisma } from '@prisma/client';

/**
 * COMPREHENSIVE AVAILABILITY OVERLAP DETECTION TESTS
 * 
 * These tests validate the correctness of overlap detection logic for:
 * 1. Availability rule overlaps
 * 2. Booking conflict detection
 * 3. Multi-unit inventory allocation
 * 4. Concurrent reservation handling
 * 5. Edge cases and boundary conditions
 * 
 * Overlap Logic:
 * - Two periods [A, B] and [C, D] overlap if:
 *   - A <= D AND C <= B (inclusive)
 * - This covers: partial overlap, complete containment, and adjacent periods
 */
describe('AvailabilityService - Overlap Detection Validation', () => {
  let service: AvailabilityService;
  let prisma: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      availability: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      booking: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryUnit: {
        findMany: jest.fn(),
      },
      availabilitySlot: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        await callback(prisma);
        return { success: true };
      }),
      $executeRawUnsafe: jest.fn(),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AVAILABILITY RULE OVERLAP DETECTION', () => {
    describe('Exact Overlap Detection', () => {
      it('should detect exact overlap (identical periods)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-10'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-10'),
          isAvailable: true,
        };

        await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
        await expect(service.createAvailability(dto)).rejects.toThrow('Availability period overlaps with existing rules');
      });

      it('should detect partial overlap (new period starts during existing)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-10'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-05'), // Starts in the middle
          endDate: new Date('2023-01-15'),
          isAvailable: true,
        };

        await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
      });

      it('should detect partial overlap (new period ends during existing)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-15'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-10'), // Ends in the middle
          isAvailable: true,
        };

        await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
      });

      it('should detect complete containment (new period inside existing)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-20'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-05'),
          endDate: new Date('2023-01-15'), // Completely inside
          isAvailable: true,
        };

        await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
      });

      it('should detect complete containment (existing period inside new)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-15'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-20'), // Existing is inside
          isAvailable: true,
        };

        await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('No Overlap Detection', () => {
      it('should allow non-overlapping period (before existing)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-10'),
            endDate: new Date('2023-01-20'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);
        prisma.availability.create.mockResolvedValue({ id: 'avail-2' });

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-05'), // Completely before
          isAvailable: true,
        };

        const result = await service.createAvailability(dto);
        expect(result).toBeDefined();
        expect(prisma.availability.create).toHaveBeenCalled();
      });

      it('should allow non-overlapping period (after existing)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-10'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);
        prisma.availability.create.mockResolvedValue({ id: 'avail-2' });

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-15'),
          endDate: new Date('2023-01-20'), // Completely after
          isAvailable: true,
        };

        const result = await service.createAvailability(dto);
        expect(result).toBeDefined();
        expect(prisma.availability.create).toHaveBeenCalled();
      });

      it('should allow adjacent periods (end = start)', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-10'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);
        prisma.availability.create.mockResolvedValue({ id: 'avail-2' });

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-10'), // Starts exactly when existing ends
          endDate: new Date('2023-01-20'),
          isAvailable: true,
        };

        const result = await service.createAvailability(dto);
        expect(result).toBeDefined();
        expect(prisma.availability.create).toHaveBeenCalled();
      });
    });

    describe('Multiple Existing Rules', () => {
      it('should detect overlap with any of multiple existing rules', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-10'),
            status: 'AVAILABLE',
          },
          {
            id: 'avail-2',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-20'),
            endDate: new Date('2023-01-30'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-05'), // Overlaps with first rule
          endDate: new Date('2023-01-15'),
          isAvailable: true,
        };

        await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
      });

      it('should allow period that fits between multiple existing rules', async () => {
        const existingAvailability = [
          {
            id: 'avail-1',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-10'),
            status: 'AVAILABLE',
          },
          {
            id: 'avail-2',
            propertyId: 'listing-1',
            startDate: new Date('2023-01-20'),
            endDate: new Date('2023-01-30'),
            status: 'AVAILABLE',
          },
        ];

        prisma.availability.findMany.mockResolvedValue(existingAvailability);
        prisma.availability.create.mockResolvedValue({ id: 'avail-3' });

        const dto = {
          propertyId: 'listing-1',
          startDate: new Date('2023-01-12'), // Fits in the gap
          endDate: new Date('2023-01-18'),
          isAvailable: true,
        };

        const result = await service.createAvailability(dto);
        expect(result).toBeDefined();
        expect(prisma.availability.create).toHaveBeenCalled();
      });
    });
  });

  describe('BOOKING CONFLICT DETECTION', () => {
    describe('Single-Unit Listings', () => {
      it('should detect conflict with existing booking', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-10'),
            status: 'CONFIRMED',
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-15'),
        });

        expect(result.isAvailable).toBe(false);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts![0].id).toBe('booking-1');
        expect(result.conflicts![0].reason).toBe('Already booked');
      });

      it('should allow booking when no conflicts exist', async () => {
        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-10'),
        });

        expect(result.isAvailable).toBe(true);
        expect(result.conflicts).toBeUndefined();
      });

      it('should ignore cancelled bookings in conflict detection', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-10'),
            status: 'CANCELLED', // Should be ignored
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-15'),
        });

        expect(result.isAvailable).toBe(true);
      });

      it('should ignore refunded bookings in conflict detection', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-10'),
            status: 'REFUNDED', // Should be ignored
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-15'),
        });

        expect(result.isAvailable).toBe(true);
      });

      it('should detect conflict with multiple booking statuses', async () => {
        const bookingStatuses = [
          'PENDING_OWNER_APPROVAL',
          'PENDING_PAYMENT',
          'CONFIRMED',
          'IN_PROGRESS',
          'AWAITING_RETURN_INSPECTION',
          'COMPLETED',
          'SETTLED',
          'DISPUTED',
        ];

        for (const status of bookingStatuses) {
          const existingBookings = [
            {
              id: `booking-${status}`,
              listingId: 'listing-1',
              startDate: new Date('2023-01-05'),
              endDate: new Date('2023-01-10'),
              status,
            },
          ];

          prisma.availability.findMany.mockResolvedValue([]);
          prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

          const result = await service.checkAvailability({
            propertyId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-15'),
          });

          expect(result.isAvailable).toBe(false);
          expect(result.conflicts).toHaveLength(1);
        }
      });
    });

    describe('Booking Overlap Edge Cases', () => {
      it('should detect conflict when request starts during booking', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-10'),
            status: 'CONFIRMED',
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-07'), // Starts during booking
          endDate: new Date('2023-01-15'),
        });

        expect(result.isAvailable).toBe(false);
      });

      it('should detect conflict when request ends during booking', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-10'),
            status: 'CONFIRMED',
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-07'), // Ends during booking
        });

        expect(result.isAvailable).toBe(false);
      });

      it('should detect conflict when request completely contains booking', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-10'),
            status: 'CONFIRMED',
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-01'), // Contains booking
          endDate: new Date('2023-01-15'),
        });

        expect(result.isAvailable).toBe(false);
      });

      it('should detect conflict when booking completely contains request', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-15'),
            status: 'CONFIRMED',
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-05'), // Contained by booking
          endDate: new Date('2023-01-10'),
        });

        expect(result.isAvailable).toBe(false);
      });

      it('should detect conflict when request equals booking exactly', async () => {
        const existingBookings = [
          {
            id: 'booking-1',
            listingId: 'listing-1',
            startDate: new Date('2023-01-05'),
            endDate: new Date('2023-01-10'),
            status: 'CONFIRMED',
          },
        ];

        prisma.availability.findMany.mockResolvedValue([]);
        prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(existingBookings);

        const result = await service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-05'), // Exact same dates
          endDate: new Date('2023-01-10'),
        });

        expect(result.isAvailable).toBe(false);
      });
    });
  });

  describe('MULTI-UNIT INVENTORY ALLOCATION', () => {
    describe('checkAndReserve with Inventory Units', () => {
      it('should reserve available unit when multiple exist', async () => {
        const inventoryUnits = [
          { id: 'unit-1', listingId: 'listing-1', isActive: true },
          { id: 'unit-2', listingId: 'listing-1', isActive: true },
          { id: 'unit-3', listingId: 'listing-1', isActive: true },
        ];

        prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
        prisma.availabilitySlot.findMany.mockResolvedValue([]); // No conflicts for unit-1
        prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);

        const result = await service.checkAndReserve(
          'listing-1',
          new Date('2023-01-01'),
          new Date('2023-01-10'),
        );

        expect(result.success).toBe(true);
        expect(result.unitId).toBe('unit-1');
        expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            inventoryUnitId: 'unit-1',
            status: 'RESERVED',
          }),
        });
      });

      it('should try next unit when first has conflicts', async () => {
        const inventoryUnits = [
          { id: 'unit-1', listingId: 'listing-1', isActive: true },
          { id: 'unit-2', listingId: 'listing-1', isActive: true },
        ];

        prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);

        // First call: unit-1 has conflicts
        prisma.availabilitySlot.findMany
          .mockResolvedValueOnce([{ id: 'slot-1', status: 'BOOKED' }])
          // Second call: unit-2 has no conflicts
          .mockResolvedValueOnce([]);

        prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-2' });

        const result = await service.checkAndReserve(
          'listing-1',
          new Date('2023-01-01'),
          new Date('2023-01-10'),
        );

        expect(result.success).toBe(true);
        expect(result.unitId).toBe('unit-2');
      });

      it('should return failure when all units have conflicts', async () => {
        const inventoryUnits = [
          { id: 'unit-1', listingId: 'listing-1', isActive: true },
          { id: 'unit-2', listingId: 'listing-1', isActive: true },
        ];

        prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.availabilitySlot.findMany.mockResolvedValue([
          { id: 'slot-1', status: 'BOOKED' },
        ]);

        const result = await service.checkAndReserve(
          'listing-1',
          new Date('2023-01-01'),
          new Date('2023-01-10'),
        );

        expect(result.success).toBe(false);
        expect(result.conflicts).toBeDefined();
        expect(result.conflicts![0].reason).toBe('No available inventory units for selected dates');
      });

      it('should reserve specific unit when requested', async () => {
        const inventoryUnits = [
          { id: 'unit-1', listingId: 'listing-1', isActive: true },
          { id: 'unit-2', listingId: 'listing-1', isActive: true },
        ];

        prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.availabilitySlot.findMany.mockResolvedValue([]); // No conflicts for unit-2
        prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

        const result = await service.checkAndReserve(
          'listing-1',
          new Date('2023-01-01'),
          new Date('2023-01-10'),
          'unit-2', // Specific unit requested
        );

        expect(result.success).toBe(true);
        expect(result.unitId).toBe('unit-2');
        expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            inventoryUnitId: 'unit-2',
          }),
        });
      });

      it('should handle concurrent reservation attempts with P2002 error', async () => {
        const inventoryUnits = [{ id: 'unit-1', listingId: 'listing-1', isActive: true }];

        prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.availabilitySlot.findMany.mockResolvedValue([]);

        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          { code: 'P2002', clientVersion: '1.0.0' },
        );
        prisma.availabilitySlot.create.mockRejectedValue(prismaError);

        await expect(
          service.checkAndReserve('listing-1', new Date('2023-01-01'), new Date('2023-01-10')),
        ).rejects.toThrow(ConflictException);
        await expect(
          service.checkAndReserve('listing-1', new Date('2023-01-01'), new Date('2023-01-10')),
        ).rejects.toThrow('This time slot has already been reserved');
      });
    });

    describe('Single-Unit Fallback', () => {
      it('should use booking conflict check when no inventory units exist', async () => {
        prisma.inventoryUnit.findMany.mockResolvedValue([]); // No inventory units
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.booking.findMany.mockResolvedValue([]); // No conflicts

        const result = await service.checkAndReserve(
          'listing-1',
          new Date('2023-01-01'),
          new Date('2023-01-10'),
        );

        expect(result.success).toBe(true);
        expect(result.unitId).toBeUndefined();
        expect(prisma.booking.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            listingId: 'listing-1',
          }),
        });
      });

      it('should detect booking conflicts for single-unit listings', async () => {
        prisma.inventoryUnit.findMany.mockResolvedValue([]); // No inventory units
        prisma.$executeRawUnsafe.mockResolvedValue(undefined);
        prisma.booking.findMany.mockResolvedValue([
          { id: 'booking-1', startDate: new Date('2023-01-05'), endDate: new Date('2023-01-10') },
        ]);

        const result = await service.checkAndReserve(
          'listing-1',
          new Date('2023-01-01'),
          new Date('2023-01-10'),
        );

        expect(result.success).toBe(false);
        expect(result.conflicts).toBeDefined();
      });
    });
  });

  describe('RESERVATION LIFECYCLE', () => {
    it('should release reservation correctly', async () => {
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.releaseReservation(
        'listing-1',
        new Date('2023-01-01'),
        new Date('2023-01-10'),
        'unit-1',
      );

      expect(result.released).toBe(1);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          listingId: 'listing-1',
          status: 'RESERVED',
          inventoryUnitId: 'unit-1',
        }),
        data: { status: 'AVAILABLE' },
      });
    });

    it('should confirm reservation correctly', async () => {
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.confirmReservation(
        'listing-1',
        new Date('2023-01-01'),
        new Date('2023-01-10'),
        'booking-1',
        'unit-1',
      );

      expect(result.confirmed).toBe(true);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          listingId: 'listing-1',
          status: 'RESERVED',
          inventoryUnitId: 'unit-1',
        }),
        data: { status: 'BOOKED', bookingId: 'booking-1' },
      });
    });
  });

  describe('AVAILABILITY SUMMARY', () => {
    it('should calculate availability summary for multi-unit listing', async () => {
      const inventoryUnits = [
        { id: 'unit-1', listingId: 'listing-1', isActive: true },
        { id: 'unit-2', listingId: 'listing-1', isActive: true },
      ];

      prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
      prisma.availabilitySlot.count.mockResolvedValue(1); // 1 unit occupied

      const summary = await service.getAvailabilitySummary(
        'listing-1',
        new Date('2023-01-01'),
        new Date('2023-01-03'),
      );

      expect(summary).toHaveLength(3); // 3 days
      expect(summary[0].totalUnits).toBe(2);
      expect(summary[0].availableUnits).toBe(1);
      expect(summary[0].available).toBe(true);
    });

    it('should calculate availability summary for single-unit listing', async () => {
      prisma.inventoryUnit.findMany.mockResolvedValue([]); // No inventory units
      prisma.booking.count.mockResolvedValue(0); // No bookings

      const summary = await service.getAvailabilitySummary(
        'listing-1',
        new Date('2023-01-01'),
        new Date('2023-01-03'),
      );

      expect(summary).toHaveLength(3);
      expect(summary[0].totalUnits).toBe(1);
      expect(summary[0].availableUnits).toBe(1);
      expect(summary[0].available).toBe(true);
    });

    it('should show unavailable when all units booked', async () => {
      const inventoryUnits = [
        { id: 'unit-1', listingId: 'listing-1', isActive: true },
        { id: 'unit-2', listingId: 'listing-1', isActive: true },
      ];

      prisma.inventoryUnit.findMany.mockResolvedValue(inventoryUnits);
      prisma.availabilitySlot.count.mockResolvedValue(2); // All units occupied

      const summary = await service.getAvailabilitySummary(
        'listing-1',
        new Date('2023-01-01'),
        new Date('2023-01-03'),
      );

      expect(summary[0].available).toBe(false);
      expect(summary[0].availableUnits).toBe(0);
    });
  });

  describe('EDGE CASES AND BOUNDARY CONDITIONS', () => {
    it('should reject availability with end date before start date', async () => {
      const dto = {
        propertyId: 'listing-1',
        startDate: new Date('2023-01-10'),
        endDate: new Date('2023-01-01'), // End before start
        isAvailable: true,
      };

      await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
      await expect(service.createAvailability(dto)).rejects.toThrow('End date must be after start date');
    });

    it('should reject availability with same start and end date', async () => {
      const dto = {
        propertyId: 'listing-1',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-01'), // Same date
        isAvailable: true,
      };

      await expect(service.createAvailability(dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject availability check with end date before start date', async () => {
      await expect(
        service.checkAvailability({
          propertyId: 'listing-1',
          startDate: new Date('2023-01-10'),
          endDate: new Date('2023-01-01'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject availability check with past start date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        service.checkAvailability({
          propertyId: 'listing-1',
          startDate: pastDate,
          endDate: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.checkAvailability({
          propertyId: 'listing-1',
          startDate: pastDate,
          endDate: new Date(),
        }),
      ).rejects.toThrow('Start date cannot be in the past');
    });

    it('should allow availability check for today', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      prisma.availability.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: today,
        endDate: tomorrow,
      });

      expect(result.isAvailable).toBe(true);
    });

    it('should handle string date inputs', async () => {
      prisma.availability.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.checkAvailability({
        propertyId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(result.isAvailable).toBe(true);
    });
  });

  describe('BULK OPERATIONS', () => {
    it('should bulk update availability for multiple dates', async () => {
      const dates = [
        { date: new Date('2023-01-01'), isAvailable: true },
        { date: new Date('2023-01-02'), isAvailable: false },
        { date: new Date('2023-01-03'), isAvailable: true },
      ];

      prisma.availability.findFirst.mockResolvedValue(null);
      prisma.availability.create.mockResolvedValue({ id: 'avail-1' });

      const result = await service.bulkUpdateAvailability('listing-1', dates);

      expect(result).toBe(3);
      expect(prisma.availability.create).toHaveBeenCalledTimes(3);
    });

    it('should update existing availability in bulk', async () => {
      const dates = [
        { date: new Date('2023-01-01'), isAvailable: true },
      ];

      prisma.availability.findFirst.mockResolvedValue({ id: 'avail-1' });
      prisma.availability.update.mockResolvedValue({ id: 'avail-1' });

      const result = await service.bulkUpdateAvailability('listing-1', dates);

      expect(result).toBe(1);
      expect(prisma.availability.update).toHaveBeenCalled();
      expect(prisma.availability.create).not.toHaveBeenCalled();
    });
  });

  describe('AVAILABLE DATES QUERY', () => {
    it('should return available dates within range', async () => {
      prisma.availability.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const availableDates = await service.getAvailableDates(
        'listing-1',
        new Date('2023-01-01'),
        new Date('2023-01-05'),
      );

      expect(availableDates).toHaveLength(5);
    });

    it('should skip unavailable dates', async () => {
      prisma.availability.findMany.mockResolvedValue([
        { id: 'avail-1', status: 'BLOCKED', startDate: new Date('2023-01-03'), endDate: new Date('2023-01-04') },
      ]);
      prisma.booking.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const availableDates = await service.getAvailableDates(
        'listing-1',
        new Date('2023-01-01'),
        new Date('2023-01-05'),
      );

      expect(availableDates.length).toBeLessThan(5);
    });
  });
});
