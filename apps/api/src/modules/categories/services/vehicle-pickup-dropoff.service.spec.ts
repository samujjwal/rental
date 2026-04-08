import { Test, TestingModule } from '@nestjs/testing';
import { VehiclePickupDropoffService } from './vehicle-pickup-dropoff.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Vehicle Pickup/Drop-off Service - Production-Grade Business Logic Tests
 * 
 * These tests validate exact business logic computations and invariants:
 * - Mileage tracking and calculations
 * - Fuel level validation and charge calculations
 * - Condition report creation
 * - Additional charge calculations
 * - State validation
 */
describe('VehiclePickupDropoffService - Business Logic Validation', () => {
  let service: VehiclePickupDropoffService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  const mockBooking = {
    id: 'booking-1',
    listingId: 'listing-1',
    renterId: 'renter-1',
    ownerId: 'owner-1',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-05'), // 4 days
    status: 'CONFIRMED',
    currency: 'USD',
    listing: {
      id: 'listing-1',
      title: 'Test Vehicle',
      category: {
        id: 'cat-1',
        slug: 'vehicles',
        name: 'Vehicles',
      },
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      booking: {
        findUnique: jest.fn(),
      },
      conditionReport: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclePickupDropoffService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<VehiclePickupDropoffService>(VehiclePickupDropoffService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    cache = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PICKUP VALIDATION', () => {
    it('should validate mileage range', async () => {
      const invalidMileages = [-1, -100, 1000001, 9999999];

      for (const mileage of invalidMileages) {
        (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
        
        await expect(
          service.recordPickup('booking-1', {
            mileage,
            fuelLevel: 50,
            photos: ['photo1.jpg'],
          }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('should accept valid mileage range', async () => {
      const validMileages = [0, 100, 50000, 100000, 500000, 1000000];

      for (const mileage of validMileages) {
        (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
        (prisma.conditionReport.create as jest.Mock).mockResolvedValue({ id: 'report-1' });

        const result = await service.recordPickup('booking-1', {
          mileage,
          fuelLevel: 50,
          photos: ['photo1.jpg'],
        });

        expect(result).toBeDefined();
      }
    });

    it('should validate fuel level range (0-100)', async () => {
      const invalidFuelLevels = [-1, -10, 101, 150, 200];

      for (const fuelLevel of invalidFuelLevels) {
        (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
        
        await expect(
          service.recordPickup('booking-1', {
            mileage: 1000,
            fuelLevel,
            photos: ['photo1.jpg'],
          }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('should accept valid fuel level range', async () => {
      const validFuelLevels = [0, 25, 50, 75, 100];

      for (const fuelLevel of validFuelLevels) {
        (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
        (prisma.conditionReport.create as jest.Mock).mockResolvedValue({ id: 'report-1' });

        const result = await service.recordPickup('booking-1', {
          mileage: 1000,
          fuelLevel,
          photos: ['photo1.jpg'],
        });

        expect(result).toBeDefined();
      }
    });

    it('should reject non-vehicle bookings', async () => {
      const nonVehicleBooking = {
        ...mockBooking,
        listing: {
          ...mockBooking.listing,
          category: {
            id: 'cat-2',
            slug: 'clothing',
            name: 'Clothing',
          },
        },
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(nonVehicleBooking);

      await expect(
        service.recordPickup('booking-1', {
          mileage: 1000,
          fuelLevel: 50,
          photos: ['photo1.jpg'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('DROPOFF VALIDATION', () => {
    it('should calculate mileage used correctly', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 1500,
        fuelLevel: 50,
        photos: ['photo1.jpg'],
      });

      // EXACT VALIDATION: 1500 - 1000 = 500 miles used
      const checklistData = JSON.parse(result.conditionReport.checklistData);
      expect(checklistData.mileageUsed).toBe(500);
      expect(checklistData.pickupMileage).toBe(1000);
    });

    it('should reject drop-off with lower mileage than pickup', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);

      await expect(
        service.recordDropoff('booking-1', {
          mileage: 900, // Less than pickup
          fuelLevel: 50,
          photos: ['photo1.jpg'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow same mileage at drop-off (no driving)', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 1000, // Same as pickup
        fuelLevel: 50,
        photos: ['photo1.jpg'],
      });

      const checklistData = JSON.parse(result.conditionReport.checklistData);
      expect(checklistData.mileageUsed).toBe(0);
    });

    it('should calculate fuel difference correctly', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 1500,
        fuelLevel: 50, // 25% less than pickup
        photos: ['photo1.jpg'],
      });

      const checklistData = JSON.parse(result.conditionReport.checklistData);
      // EXACT VALIDATION: 50 - 75 = -25 (fuel decreased)
      expect(checklistData.fuelDifference).toBe(-25);
    });

    it('should require pickup report before drop-off', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.recordDropoff('booking-1', {
          mileage: 1500,
          fuelLevel: 50,
          photos: ['photo1.jpg'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ADDITIONAL CHARGE CALCULATIONS', () => {
    it('should calculate excess mileage charge correctly', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      // 4-day booking, 200 miles/day = 800 miles allowed
      // Used 1200 miles = 400 excess
      // 400 × $0.50 = $200
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 2200, // 1200 miles used
        fuelLevel: 75, // Same fuel level
        photos: ['photo1.jpg'],
      });

      // EXACT VALIDATION: (1200 - 800) × 0.50 = $200
      expect(result.charges.excessMileageCharge).toBe(200);
    });

    it('should calculate fuel charge correctly', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      // Returned with 25% fuel (50% decrease)
      // 50% / 10% = 5 units
      // 5 × $5.00 = $25
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 1200,
        fuelLevel: 25, // 50% less than pickup
        photos: ['photo1.jpg'],
      });

      // EXACT VALIDATION: ceil(50 / 10) × 5 = $25
      expect(result.charges.fuelCharge).toBe(25);
    });

    it('should not charge for excess mileage within allowance', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      // Used 700 miles (within 800 mile allowance)
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 1700, // 700 miles used
        fuelLevel: 75,
        photos: ['photo1.jpg'],
      });

      // EXACT VALIDATION: No excess mileage charge
      expect(result.charges.excessMileageCharge).toBe(0);
    });

    it('should not charge for fuel if returned with same or more fuel', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 50,
        }),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 1200,
        fuelLevel: 75, // More fuel than pickup
        photos: ['photo1.jpg'],
      });

      // EXACT VALIDATION: No fuel charge
      expect(result.charges.fuelCharge).toBe(0);
    });

    it('should calculate total additional charge correctly', async () => {
      const pickupReport = {
        id: 'pickup-1',
        checklistData: JSON.stringify({
          mileage: 1000,
          fuelLevel: 75,
        }),
      };

      // 400 excess miles × $0.50 = $200
      // 25% fuel decrease = $25
      // Total = $225
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(pickupReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'dropoff-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordDropoff('booking-1', {
        mileage: 2200,
        fuelLevel: 25,
        photos: ['photo1.jpg'],
      });

      // EXACT VALIDATION: $200 + $25 = $225
      expect(result.charges.totalAdditionalCharge).toBe(225);
    });
  });

  describe('STATE VALIDATION', () => {
    it('should validate pickup requires CONFIRMED or IN_PROGRESS state', async () => {
      const invalidStates = ['PENDING', 'CANCELLED', 'COMPLETED', 'DISPUTED'];

      for (const status of invalidStates) {
        const invalidBooking = { ...mockBooking, status };
        (prisma.booking.findUnique as jest.Mock).mockResolvedValue(invalidBooking);

        await expect(
          service.validatePickupCondition('booking-1'),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('should allow pickup for CONFIRMED state', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.validatePickupCondition('booking-1');

      expect(result.valid).toBe(true);
    });

    it('should allow pickup for IN_PROGRESS state', async () => {
      const inProgressBooking = { ...mockBooking, status: 'IN_PROGRESS' };
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(inProgressBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.validatePickupCondition('booking-1');

      expect(result.valid).toBe(true);
    });

    it('should reject duplicate pickup', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue({
        id: 'pickup-1',
        checkIn: true,
        reportType: 'VEHICLE_PICKUP',
      });

      await expect(
        service.validatePickupCondition('booking-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('HISTORY RETRIEVAL', () => {
    it('should return pickup and drop-off reports in chronological order', async () => {
      const reports = [
        {
          id: 'pickup-1',
          checkIn: true,
          checkOut: false,
          reportType: 'VEHICLE_PICKUP',
          checklistData: JSON.stringify({ mileage: 1000 }),
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'dropoff-1',
          checkIn: false,
          checkOut: true,
          reportType: 'VEHICLE_DROPOFF',
          checklistData: JSON.stringify({ mileage: 1500 }),
          createdAt: new Date('2024-01-05T10:00:00Z'),
        },
      ];

      (prisma.conditionReport.findMany as jest.Mock).mockResolvedValue(reports);

      const result = await service.getVehicleHistory('booking-1');

      expect(result).toHaveLength(2);
      expect(result[0].reportType).toBe('VEHICLE_PICKUP');
      expect(result[1].reportType).toBe('VEHICLE_DROPOFF');
      expect(result[0].checklistData.mileage).toBe(1000);
      expect(result[1].checklistData.mileage).toBe(1500);
    });

    it('should return empty array for booking with no reports', async () => {
      (prisma.conditionReport.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getVehicleHistory('booking-1');

      expect(result).toEqual([]);
    });
  });

  describe('ERROR HANDLING', () => {
    it('should handle non-existent booking', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.recordPickup('non-existent', {
          mileage: 1000,
          fuelLevel: 50,
          photos: ['photo1.jpg'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors gracefully', async () => {
      (prisma.booking.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.recordPickup('booking-1', {
          mileage: 1000,
          fuelLevel: 50,
          photos: ['photo1.jpg'],
        }),
      ).rejects.toThrow();
    });
  });
});
