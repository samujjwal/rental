import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prismaService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: {
            availability: {
              create: jest.fn(),
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            booking: {
              findMany: jest.fn(),
            },
            listing: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAvailability', () => {
    it('should throw error when availability rule lookup fails (fail closed)', async () => {
      const propertyId = 'listing-123';
      const startDate = new Date('2026-01-10');
      const endDate = new Date('2026-01-15');

      // Mock getListingAvailability to throw DB error
      jest.spyOn(service, 'getListingAvailability').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(
        service.checkAvailability({ propertyId, startDate, endDate })
      ).rejects.toThrow('Database connection failed');
    });

    it('should throw error when booking conflict lookup fails (fail closed)', async () => {
      const propertyId = 'listing-123';
      const startDate = new Date('2026-01-10');
      const endDate = new Date('2026-01-15');

      // Mock availability rules to return no conflicts
      jest.spyOn(service, 'getListingAvailability').mockResolvedValueOnce([]);

      // Mock booking query to throw DB error
      prismaService.booking.findMany.mockRejectedValueOnce(
        new Error('Database timeout')
      );

      await expect(
        service.checkAvailability({ propertyId, startDate, endDate })
      ).rejects.toThrow('Database timeout');
    });

    it('should return unavailable when availability rules block dates', async () => {
      const propertyId = 'listing-123';
      const startDate = new Date('2026-01-10');
      const endDate = new Date('2026-01-15');

      const blockedRule = {
        id: 'rule-1',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-15'),
        status: 'BLOCKED',
      };

      jest.spyOn(service, 'getListingAvailability').mockResolvedValueOnce([blockedRule]);
      prismaService.booking.findMany.mockResolvedValueOnce([]);

      const result = await service.checkAvailability({ propertyId, startDate, endDate });

      expect(result.isAvailable).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('Blocked by availability rule');
    });

    it('should return unavailable when booking conflicts exist', async () => {
      const propertyId = 'listing-123';
      const startDate = new Date('2026-01-10');
      const endDate = new Date('2026-01-15');

      jest.spyOn(service, 'getListingAvailability').mockResolvedValueOnce([]);

      const existingBooking = {
        id: 'booking-1',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-15'),
        status: 'CONFIRMED',
      };

      prismaService.booking.findMany.mockResolvedValueOnce([existingBooking]);

      const result = await service.checkAvailability({ propertyId, startDate, endDate });

      expect(result.isAvailable).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('Already booked');
    });

    it('should return available when no conflicts exist', async () => {
      const propertyId = 'listing-123';
      const startDate = new Date('2026-01-10');
      const endDate = new Date('2026-01-15');

      jest.spyOn(service, 'getListingAvailability').mockResolvedValueOnce([]);
      prismaService.booking.findMany.mockResolvedValueOnce([]);

      const result = await service.checkAvailability({ propertyId, startDate, endDate });

      expect(result.isAvailable).toBe(true);
      expect(result.conflicts).toBeUndefined();
    });
  });

  describe('Authorization', () => {
    const mockListing = {
      id: 'listing-123',
      ownerId: 'owner-123',
      organization: null,
    };

    const mockListingWithOrg = {
      id: 'listing-456',
      ownerId: 'owner-456',
      organization: {
        id: 'org-123',
        members: [
          {
            userId: 'member-123',
            role: 'ADMIN',
          },
        ],
      },
    };

    it('should allow listing owner to create availability', async () => {
      const dto = {
        propertyId: 'listing-123',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-15'),
        isAvailable: true,
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing);
      prismaService.availability.findMany.mockResolvedValue([]);
      prismaService.availability.create.mockResolvedValue({ id: 'avail-1' });

      await expect(
        service.createAvailability(dto, 'owner-123', 'USER')
      ).resolves.toBeDefined();
    });

    it('should allow admin to create availability for any listing', async () => {
      const dto = {
        propertyId: 'listing-123',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-15'),
        isAvailable: true,
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing);
      prismaService.availability.findMany.mockResolvedValue([]);
      prismaService.availability.create.mockResolvedValue({ id: 'avail-1' });

      await expect(
        service.createAvailability(dto, 'admin-123', 'ADMIN')
      ).resolves.toBeDefined();
    });

    it('should allow organization admin to create availability', async () => {
      const dto = {
        propertyId: 'listing-456',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-15'),
        isAvailable: true,
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListingWithOrg);
      prismaService.availability.findMany.mockResolvedValue([]);
      prismaService.availability.create.mockResolvedValue({ id: 'avail-1' });

      await expect(
        service.createAvailability(dto, 'member-123', 'USER')
      ).resolves.toBeDefined();
    });

    it('should forbid unauthorized user from creating availability', async () => {
      const dto = {
        propertyId: 'listing-123',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-15'),
        isAvailable: true,
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing);

      await expect(
        service.createAvailability(dto, 'unauthorized-123', 'USER')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forbid unauthenticated user from creating availability', async () => {
      const dto = {
        propertyId: 'listing-123',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-15'),
        isAvailable: true,
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing);

      await expect(
        service.createAvailability(dto, undefined, undefined)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow listing owner to update availability', async () => {
      prismaService.availability.findUnique.mockResolvedValue({
        id: 'avail-1',
        propertyId: 'listing-123',
      });
      prismaService.listing.findUnique.mockResolvedValue(mockListing);
      prismaService.availability.update.mockResolvedValue({ id: 'avail-1' });

      await expect(
        service.updateAvailability('avail-1', { isAvailable: false }, 'owner-123', 'USER')
      ).resolves.toBeDefined();
    });

    it('should allow listing owner to delete availability', async () => {
      prismaService.availability.findUnique.mockResolvedValue({
        id: 'avail-1',
        propertyId: 'listing-123',
      });
      prismaService.listing.findUnique.mockResolvedValue(mockListing);
      prismaService.availability.delete.mockResolvedValue(undefined);

      await expect(
        service.deleteAvailability('avail-1', 'owner-123', 'USER')
      ).resolves.toBeUndefined();
    });

    it('should allow listing owner to bulk update availability', async () => {
      const dates = [
        { date: new Date('2026-01-10'), isAvailable: true },
        { date: new Date('2026-01-11'), isAvailable: true },
      ];

      prismaService.listing.findUnique.mockResolvedValue(mockListing);
      prismaService.availability.findFirst.mockResolvedValue(null);
      prismaService.availability.create.mockResolvedValue({ id: 'avail-1' });

      await expect(
        service.bulkUpdateAvailability('listing-123', dates, 'owner-123', 'USER')
      ).resolves.toBe(2);
    });
  });
});
