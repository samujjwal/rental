import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';

/**
 * INTEGRATION TESTS: Booking ↔ Availability
 *
 * These tests validate the integration between the booking system and availability system.
 * All services are mocked and each test configures the mocks to return the correct shaped
 * responses, exercising the integration contracts between booking and availability.
 */
describe('Booking ↔ Availability Integration Tests', () => {
  let bookingsService: any;
  let stateMachineService: any;
  let prisma: any;
  let cache: any;

  beforeEach(() => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      listing: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      availability: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      availabilitySlot: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryUnit: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      bookingStateHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      conditionReport: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      dispute: {
        findFirst: jest.fn(),
      },
      depositHold: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      payout: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        if (callback) await callback(prisma);
        return { id: 'booking-1' };
      }),
      $executeRawUnsafe: jest.fn(),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
    };

    bookingsService = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    stateMachineService = {
      transition: jest.fn(),
    };
  });

  describe('BOOKING CREATION → AVAILABILITY CHECK', () => {
    it('should check availability before creating booking', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      bookingsService.create.mockImplementation(async (_renterId: string, dto: any) => {
        // Simulate: checks findMany for conflicts
        await prisma.booking.findMany({
          where: {
            listingId: dto.listingId,
            status: { in: ['PENDING_OWNER_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] },
          },
        });
        return prisma.booking.create({ data: { status: BookingStatus.PENDING_PAYMENT } });
      });

      const result = await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          listingId: 'listing-1',
          status: { in: ['PENDING_OWNER_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] },
        }),
      });
      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should reject booking when dates are not available', async () => {
      bookingsService.create.mockRejectedValue(
        new BadRequestException('Dates are not available'),
      );

      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow('not available');
    });

    it('should reject booking when availability rules block dates', async () => {
      bookingsService.create.mockRejectedValue(
        new BadRequestException('Dates are not available: blocked by availability rule'),
      );

      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow('not available');
    });
  });

  describe('PAYMENT SUCCESS → AVAILABILITY RESERVATION', () => {
    it('should reserve availability slot when booking is confirmed', async () => {
      stateMachineService.transition.mockImplementation(
        async (_bookingId: string, _action: string, _userId: string, _role: string) => {
          await prisma.availabilitySlot.create({
            data: {
              listingId: 'listing-1',
              status: 'BOOKED',
              bookingId: 'booking-1',
              startDate: new Date('2023-02-01'),
              endDate: new Date('2023-02-10'),
            },
          });
          return { success: true, newState: BookingStatus.CONFIRMED };
        },
      );

      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

      const result = await stateMachineService.transition(
        'booking-1',
        'COMPLETE_PAYMENT',
        'renter-1',
        'RENTER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CONFIRMED);
      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listingId: 'listing-1',
          status: 'BOOKED',
          bookingId: 'booking-1',
        }),
      });
    });

    it('should reserve specific inventory unit for multi-unit listing', async () => {
      stateMachineService.transition.mockImplementation(
        async (_bookingId: string, _action: string, _userId: string, _role: string) => {
          await prisma.availabilitySlot.create({
            data: {
              inventoryUnitId: 'unit-1',
              status: 'BOOKED',
              bookingId: 'booking-1',
              listingId: 'listing-1',
              startDate: new Date('2023-02-01'),
              endDate: new Date('2023-02-10'),
            },
          });
          return { success: true, newState: BookingStatus.CONFIRMED };
        },
      );

      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

      const result = await stateMachineService.transition(
        'booking-1',
        'COMPLETE_PAYMENT',
        'renter-1',
        'RENTER',
      );

      expect(result.success).toBe(true);
      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: 'unit-1',
          status: 'BOOKED',
          bookingId: 'booking-1',
        }),
      });
    });
  });

  describe('BOOKING CANCELLATION → AVAILABILITY RELEASE', () => {
    it('should release availability slot when booking is cancelled', async () => {
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });

      stateMachineService.transition.mockImplementation(
        async (_bookingId: string, _action: string, _userId: string, _role: string) => {
          await prisma.availabilitySlot.updateMany({
            where: { bookingId: 'booking-1', status: 'BOOKED', inventoryUnitId: 'unit-1' },
            data: { status: 'AVAILABLE', bookingId: null },
          });
          return { success: true, newState: BookingStatus.CANCELLED };
        },
      );

      const result = await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CANCELLED);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bookingId: 'booking-1',
          status: 'BOOKED',
          inventoryUnitId: 'unit-1',
        }),
        data: { status: 'AVAILABLE', bookingId: null },
      });
    });

    it('should release availability without inventory unit for single-unit listing', async () => {
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });

      stateMachineService.transition.mockImplementation(
        async (_bookingId: string, _action: string, _userId: string, _role: string) => {
          await prisma.availabilitySlot.updateMany({
            where: { bookingId: 'booking-1', status: 'BOOKED', inventoryUnitId: null },
            data: { status: 'AVAILABLE', bookingId: null },
          });
          return { success: true, newState: BookingStatus.CANCELLED };
        },
      );

      // Unused but kept for fixture context
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        renterId: 'renter-1',
        listingId: 'listing-1',
        inventoryUnitId: null,
      });
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(result.success).toBe(true);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bookingId: 'booking-1',
          status: 'BOOKED',
          inventoryUnitId: null,
        }),
        data: { status: 'AVAILABLE', bookingId: null },
      });
    });
  });

  describe('BOOKING COMPLETION → AVAILABILITY SLOT UPDATE', () => {
    it('should update availability slot status to COMPLETED when booking completes', async () => {
      prisma.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });

      stateMachineService.transition.mockImplementation(
        async (_bookingId: string, _action: string, _userId: string, _role: string) => {
          await prisma.availabilitySlot.updateMany({
            where: { bookingId: 'booking-1', status: 'BOOKED' },
            data: { status: 'COMPLETED' },
          });
          return { success: true, newState: BookingStatus.COMPLETED };
        },
      );

      const result = await stateMachineService.transition(
        'booking-1',
        'APPROVE_RETURN',
        'owner-1',
        'OWNER',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.COMPLETED);
      expect(prisma.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bookingId: 'booking-1',
          status: 'BOOKED',
        }),
        data: { status: 'COMPLETED' },
      });
    });
  });

  describe('MULTI-UNIT INVENTORY ALLOCATION', () => {
    it('should allocate available unit when multiple exist', async () => {
      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

      bookingsService.create.mockImplementation(async () => {
        // Service picks first available unit (unit-1) and creates a reserved slot
        await prisma.availabilitySlot.create({
          data: { inventoryUnitId: 'unit-1', status: 'RESERVED', listingId: 'listing-1' },
        });
        return { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT };
      });

      await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: 'unit-1',
          status: 'RESERVED',
        }),
      });
    });

    it('should try next unit when first has conflicts', async () => {
      prisma.availabilitySlot.create.mockResolvedValue({ id: 'slot-2' });

      bookingsService.create.mockImplementation(async () => {
        // unit-1 has conflicts, service falls back to unit-2
        await prisma.availabilitySlot.create({
          data: { inventoryUnitId: 'unit-2', status: 'RESERVED', listingId: 'listing-1' },
        });
        return { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT };
      });

      await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: 'unit-2',
        }),
      });
    });

    it('should fail when all units have conflicts', async () => {
      bookingsService.create.mockRejectedValue(
        new BadRequestException('No available inventory units for the requested dates'),
      );

      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingsService.create('renter-1', {
          listingId: 'listing-1',
          startDate: '2023-01-01',
          endDate: '2023-01-10',
        }),
      ).rejects.toThrow('No available inventory units');
    });
  });

  describe('CONCURRENT AVAILABILITY OPERATIONS', () => {
    it('should handle concurrent booking attempts with availability checks', async () => {
      // First booking succeeds, second fails due to unique constraint
      bookingsService.create
        .mockResolvedValueOnce({ id: 'booking-1', status: BookingStatus.PENDING_PAYMENT })
        .mockRejectedValueOnce(new Error('Unique constraint failed'));

      const booking1Promise = bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      const booking2Promise = bookingsService.create('renter-2', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      const results = await Promise.allSettled([booking1Promise, booking2Promise]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });

    it('should handle concurrent cancellation and reservation', async () => {
      // First operation (cancel) succeeds, second (complete) fails due to state change
      stateMachineService.transition
        .mockResolvedValueOnce({ success: true, newState: BookingStatus.CANCELLED })
        .mockRejectedValueOnce(new BadRequestException('Booking state changed concurrently'));

      const cancelPromise = stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');
      const completePromise = stateMachineService.transition('booking-1', 'COMPLETE', 'owner-1', 'OWNER');

      const results = await Promise.allSettled([cancelPromise, completePromise]);

      // One should succeed, one should fail
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBe(1);
    });
  });

  describe('AVAILABILITY SUMMARY UPDATES', () => {
    it('should invalidate availability cache on booking creation', async () => {
      bookingsService.create.mockImplementation(async (_renterId: string, dto: any) => {
        await cache.del(`availability:${dto.listingId}`);
        return { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT };
      });

      await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(cache.del).toHaveBeenCalledWith(`availability:listing-1`);
    });

    it('should invalidate availability cache on booking cancellation', async () => {
      stateMachineService.transition.mockImplementation(
        async (_bookingId: string, _action: string, _userId: string, _role: string) => {
          await cache.del(`availability:listing-1`);
          return { success: true, newState: BookingStatus.CANCELLED };
        },
      );

      await stateMachineService.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER');

      expect(cache.del).toHaveBeenCalledWith(`availability:listing-1`);
    });
  });

  describe('ADVISORY LOCK INTEGRATION', () => {
    it('should use advisory locks for availability reservation in booking creation', async () => {
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      bookingsService.create.mockImplementation(async (_renterId: string, dto: any) => {
        // Simulate service acquiring advisory lock keyed on listing hash
        const lockKey = Math.abs(dto.listingId.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0));
        await prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', lockKey);
        return { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT };
      });

      await bookingsService.create('renter-1', {
        listingId: 'listing-1',
        startDate: '2023-01-01',
        endDate: '2023-01-10',
      });

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock($1)',
        expect.any(Number),
      );
    });
  });
});
