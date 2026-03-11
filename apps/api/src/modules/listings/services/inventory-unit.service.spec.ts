import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { InventoryUnitService } from './inventory-unit.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('InventoryUnitService', () => {
  let service: InventoryUnitService;
  let prisma: any;

  const listingId = 'listing-1';
  const unitId = 'unit-1';

  const mockUnit = {
    id: unitId,
    listingId,
    sku: 'UNIT-A',
    label: 'Unit A',
    isActive: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
      inventoryUnit: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      availabilitySlot: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryUnitService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InventoryUnitService>(InventoryUnitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an inventory unit successfully', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.inventoryUnit.findUnique.mockResolvedValue(null); // No duplicate SKU
      prisma.inventoryUnit.create.mockResolvedValue(mockUnit);

      const result = await service.create({
        listingId,
        sku: 'UNIT-A',
        label: 'Unit A',
      });

      expect(result).toEqual(mockUnit);
      expect(prisma.inventoryUnit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listingId,
          sku: 'UNIT-A',
          label: 'Unit A',
        }),
      });
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ listingId, sku: 'UNIT-A' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate SKU', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.inventoryUnit.findUnique.mockResolvedValue(mockUnit);

      await expect(
        service.create({ listingId, sku: 'UNIT-A' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should serialize metadata as JSON', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.inventoryUnit.findUnique.mockResolvedValue(null);
      prisma.inventoryUnit.create.mockResolvedValue(mockUnit);

      await service.create({
        listingId,
        sku: 'UNIT-B',
        metadata: { color: 'red', size: 'large' },
      });

      expect(prisma.inventoryUnit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: JSON.stringify({ color: 'red', size: 'large' }),
        }),
      });
    });

    it('should set metadata to null when not provided', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.inventoryUnit.findUnique.mockResolvedValue(null);
      prisma.inventoryUnit.create.mockResolvedValue(mockUnit);

      await service.create({ listingId, sku: 'UNIT-C' });

      expect(prisma.inventoryUnit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ metadata: null }),
      });
    });
  });

  describe('update', () => {
    it('should update an inventory unit', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(mockUnit);
      prisma.inventoryUnit.update.mockResolvedValue({
        ...mockUnit,
        label: 'Updated Label',
      });

      const result = await service.update(unitId, { label: 'Updated Label' });

      expect(result.label).toBe('Updated Label');
    });

    it('should throw NotFoundException if unit not found', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { label: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only update provided fields', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(mockUnit);
      prisma.inventoryUnit.update.mockResolvedValue(mockUnit);

      await service.update(unitId, { isActive: false });

      expect(prisma.inventoryUnit.update).toHaveBeenCalledWith({
        where: { id: unitId },
        data: { isActive: false },
      });
    });
  });

  describe('deactivate', () => {
    it('should deactivate a unit by setting isActive to false', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(mockUnit);
      prisma.inventoryUnit.update.mockResolvedValue({
        ...mockUnit,
        isActive: false,
      });

      const result = await service.deactivate(unitId);

      expect(result.isActive).toBe(false);
    });
  });

  describe('findByListing', () => {
    it('should return only active units by default', async () => {
      prisma.inventoryUnit.findMany.mockResolvedValue([mockUnit]);

      const result = await service.findByListing(listingId);

      expect(result).toHaveLength(1);
      expect(prisma.inventoryUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ listingId, isActive: true }),
        }),
      );
    });

    it('should include inactive units when flag is set', async () => {
      prisma.inventoryUnit.findMany.mockResolvedValue([mockUnit]);

      await service.findByListing(listingId, true);

      expect(prisma.inventoryUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { listingId },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return a unit with relations', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue({
        ...mockUnit,
        listing: { id: listingId, title: 'Test' },
        availabilitySlots: [],
      });

      const result = await service.findById(unitId);

      expect(result.listing).toBeDefined();
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete a unit with no active bookings', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(mockUnit);
      prisma.availabilitySlot.count.mockResolvedValue(0);
      prisma.inventoryUnit.delete.mockResolvedValue(mockUnit);

      const result = await service.delete(unitId);

      expect(result).toEqual(mockUnit);
    });

    it('should throw NotFoundException if unit not found', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if unit has booked slots', async () => {
      prisma.inventoryUnit.findUnique.mockResolvedValue(mockUnit);
      prisma.availabilitySlot.count.mockResolvedValue(3);

      await expect(service.delete(unitId)).rejects.toThrow(ConflictException);
    });
  });

  describe('getActiveCount', () => {
    it('should return count of active units', async () => {
      prisma.inventoryUnit.count.mockResolvedValue(5);

      const result = await service.getActiveCount(listingId);

      expect(result).toBe(5);
      expect(prisma.inventoryUnit.count).toHaveBeenCalledWith({
        where: { listingId, isActive: true },
      });
    });
  });
});
