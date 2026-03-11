import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AvailabilitySlotService } from './availability-slot.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('AvailabilitySlotService', () => {
  let service: AvailabilitySlotService;
  let prisma: any;

  const listingId = 'listing-1';
  const slotId = 'slot-1';
  const inventoryUnitId = 'unit-1';
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const dayAfter = new Date(now.getTime() + 2 * 86400000);

  const mockSlot = {
    id: slotId,
    listingId,
    inventoryUnitId: null,
    startTime: tomorrow,
    endTime: dayAfter,
    status: 'AVAILABLE',
    price: 100,
    currency: 'NPR',
    notes: null,
    bookingId: null,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
      inventoryUnit: {
        findUnique: jest.fn(),
      },
      availabilitySlot: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilitySlotService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AvailabilitySlotService>(AvailabilitySlotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a slot successfully', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.availabilitySlot.findFirst.mockResolvedValue(null); // No overlap
      prisma.availabilitySlot.create.mockResolvedValue(mockSlot);

      const result = await service.create({
        listingId,
        startTime: tomorrow,
        endTime: dayAfter,
        price: 100,
      });

      expect(result).toEqual(mockSlot);
      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listingId,
          status: 'AVAILABLE',
          price: 100,
          currency: 'NPR',
        }),
      });
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          listingId,
          startTime: tomorrow,
          endTime: dayAfter,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if startTime >= endTime', async () => {
      await expect(
        service.create({
          listingId,
          startTime: dayAfter,
          endTime: tomorrow,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if startTime equals endTime', async () => {
      await expect(
        service.create({
          listingId,
          startTime: tomorrow,
          endTime: tomorrow,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on overlapping slots', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.availabilitySlot.findFirst.mockResolvedValue({
        ...mockSlot,
        startTime: tomorrow,
        endTime: dayAfter,
      });

      await expect(
        service.create({
          listingId,
          startTime: tomorrow,
          endTime: dayAfter,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate inventory unit exists when provided', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.inventoryUnit.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          listingId,
          inventoryUnitId,
          startTime: tomorrow,
          endTime: dayAfter,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set defaults for optional fields', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.availabilitySlot.findFirst.mockResolvedValue(null);
      prisma.availabilitySlot.create.mockResolvedValue(mockSlot);

      await service.create({
        listingId,
        startTime: tomorrow,
        endTime: dayAfter,
      });

      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: null,
          price: null,
          currency: 'NPR',
          notes: null,
        }),
      });
    });
  });

  describe('bulkCreate', () => {
    it('should bulk create slots in a transaction', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      const created = [mockSlot, { ...mockSlot, id: 'slot-2' }];
      prisma.$transaction.mockResolvedValue(created);

      const result = await service.bulkCreate({
        listingId,
        slots: [
          { startTime: tomorrow, endTime: dayAfter },
          { startTime: dayAfter, endTime: new Date(dayAfter.getTime() + 86400000) },
        ],
      });

      expect(result.created).toBe(2);
      expect(result.slots).toHaveLength(2);
    });

    it('should throw BadRequestException if any slot has invalid time range', async () => {
      await expect(
        service.bulkCreate({
          listingId,
          slots: [
            { startTime: tomorrow, endTime: dayAfter },
            { startTime: dayAfter, endTime: tomorrow }, // Invalid
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.bulkCreate({
          listingId,
          slots: [{ startTime: tomorrow, endTime: dayAfter }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update slot status', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(mockSlot);
      prisma.availabilitySlot.update.mockResolvedValue({
        ...mockSlot,
        status: 'BLOCKED',
      });

      const result = await service.update(slotId, { status: 'BLOCKED' });

      expect(result.status).toBe('BLOCKED');
    });

    it('should throw NotFoundException if slot not found', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { status: 'BLOCKED' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if slot is BOOKED', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'BOOKED',
      });

      await expect(service.update(slotId, { status: 'BLOCKED' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if slot is RESERVED', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'RESERVED',
      });

      await expect(service.update(slotId, { price: 200 })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('reserve', () => {
    it('should reserve an available slot', async () => {
      const bookingId = 'booking-1';
      const reservedSlot = {
        ...mockSlot,
        status: 'RESERVED',
        bookingId,
      };
      const tx = {
        availabilitySlot: {
          findUnique: jest.fn().mockResolvedValue(mockSlot),
          update: jest.fn().mockResolvedValue(reservedSlot),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      const result = await service.reserve(slotId, bookingId) as any;

      expect(result.status).toBe('RESERVED');
      expect(result.bookingId).toBe(bookingId);
    });

    it('should throw NotFoundException if slot not found', async () => {
      const tx = {
        availabilitySlot: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await expect(service.reserve(slotId, 'booking-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if slot is not AVAILABLE', async () => {
      const tx = {
        availabilitySlot: {
          findUnique: jest.fn().mockResolvedValue({
            ...mockSlot,
            status: 'BOOKED',
          }),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await expect(service.reserve(slotId, 'booking-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('confirmReservation', () => {
    it('should confirm a reserved slot', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'RESERVED',
      });
      prisma.availabilitySlot.update.mockResolvedValue({
        ...mockSlot,
        status: 'BOOKED',
      });

      const result = await service.confirmReservation(slotId);

      expect(result.status).toBe('BOOKED');
    });

    it('should throw NotFoundException if slot not found', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(null);

      await expect(service.confirmReservation('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if slot is not RESERVED', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(mockSlot); // AVAILABLE

      await expect(service.confirmReservation(slotId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('releaseReservation', () => {
    it('should release a reserved slot back to AVAILABLE', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'RESERVED',
        bookingId: 'booking-1',
      });
      prisma.availabilitySlot.update.mockResolvedValue({
        ...mockSlot,
        status: 'AVAILABLE',
        bookingId: null,
      });

      const result = await service.releaseReservation(slotId);

      expect(result.status).toBe('AVAILABLE');
      expect(result.bookingId).toBeNull();
    });

    it('should release a booked slot', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'BOOKED',
      });
      prisma.availabilitySlot.update.mockResolvedValue({
        ...mockSlot,
        status: 'AVAILABLE',
        bookingId: null,
      });

      const result = await service.releaseReservation(slotId);

      expect(result.status).toBe('AVAILABLE');
    });

    it('should throw NotFoundException if slot not found', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(null);

      await expect(service.releaseReservation('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if slot is AVAILABLE', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(mockSlot);

      await expect(service.releaseReservation(slotId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAvailable', () => {
    it('should query available slots within range', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([mockSlot]);

      const result = await service.findAvailable({
        listingId,
        startTime: tomorrow,
        endTime: dayAfter,
      });

      expect(result).toHaveLength(1);
      expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            listingId,
          }),
        }),
      );
    });

    it('should filter by inventoryUnitId when provided', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([]);

      await service.findAvailable({
        listingId,
        inventoryUnitId,
        startTime: tomorrow,
        endTime: dayAfter,
      });

      expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ inventoryUnitId }),
        }),
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when no conflicting slots', async () => {
      prisma.availabilitySlot.count.mockResolvedValue(0);

      const result = await service.isAvailable(listingId, tomorrow, dayAfter);

      expect(result).toBe(true);
    });

    it('should return false when conflicting slots exist', async () => {
      prisma.availabilitySlot.count.mockResolvedValue(2);

      const result = await service.isAvailable(listingId, tomorrow, dayAfter);

      expect(result).toBe(false);
    });

    it('should include inventoryUnitId in query when provided', async () => {
      prisma.availabilitySlot.count.mockResolvedValue(0);

      await service.isAvailable(listingId, tomorrow, dayAfter, inventoryUnitId);

      expect(prisma.availabilitySlot.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ inventoryUnitId }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete an AVAILABLE slot', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(mockSlot);
      prisma.availabilitySlot.delete.mockResolvedValue(mockSlot);

      const result = await service.delete(slotId);

      expect(result).toEqual(mockSlot);
    });

    it('should delete a BLOCKED slot', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'BLOCKED',
      });
      prisma.availabilitySlot.delete.mockResolvedValue(mockSlot);

      await service.delete(slotId);

      expect(prisma.availabilitySlot.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if slot not found', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if slot is BOOKED', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'BOOKED',
      });

      await expect(service.delete(slotId)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if slot is RESERVED', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({
        ...mockSlot,
        status: 'RESERVED',
      });

      await expect(service.delete(slotId)).rejects.toThrow(ConflictException);
    });
  });
});
