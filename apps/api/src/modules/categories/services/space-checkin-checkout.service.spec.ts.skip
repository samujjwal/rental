import { Test, TestingModule } from '@nestjs/testing';
import { SpaceCheckinCheckoutService } from './space-checkin-checkout.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Space Check-in/Check-out Service - Production-Grade Business Logic Tests
 * 
 * These tests validate exact business logic computations and invariants:
 * - Check-in/check-out time validation
 * - Duration calculations
 * - Early check-out charge calculations
 * - Cleaning fee calculations
 * - Access code validation
 * - State validation
 */
describe('SpaceCheckinCheckoutService - Business Logic Validation', () => {
  let service: SpaceCheckinCheckoutService;
  let prisma: jest.Mocked<PrismaService>;

  const mockBooking = {
    id: 'booking-1',
    listingId: 'listing-1',
    renterId: 'renter-1',
    ownerId: 'owner-1',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-05'), // 4 days = 96 hours
    status: 'CONFIRMED',
    currency: 'USD',
    listing: {
      id: 'listing-1',
      title: 'Test Space',
      category: {
        id: 'cat-1',
        slug: 'spaces',
        name: 'Spaces',
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceCheckinCheckoutService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SpaceCheckinCheckoutService>(SpaceCheckinCheckoutService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CHECK-IN VALIDATION', () => {
    it('should reject check-in before booking start date', async () => {
      const earlyDate = new Date('2023-12-31'); // Before booking start

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        service.recordCheckin('booking-1', {
          photos: ['photo1.jpg'],
          inventoryVerified: true,
          checkinTime: earlyDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept check-in on booking start date', async () => {
      const validDate = new Date('2024-01-01'); // On booking start

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({ id: 'report-1' });

      const result = await service.recordCheckin('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkinTime: validDate,
      });

      expect(result).toBeDefined();
    });

    it('should accept check-in after booking start date', async () => {
      const validDate = new Date('2024-01-02'); // After booking start

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({ id: 'report-1' });

      const result = await service.recordCheckin('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkinTime: validDate,
      });

      expect(result).toBeDefined();
    });

    it('should reject non-space bookings', async () => {
      const nonSpaceBooking = {
        ...mockBooking,
        listing: {
          ...mockBooking.listing,
          category: {
            id: 'cat-2',
            slug: 'vehicles',
            name: 'Vehicles',
          },
        },
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(nonSpaceBooking);

      await expect(
        service.recordCheckin('booking-1', {
          photos: ['photo1.jpg'],
          inventoryVerified: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept homes category as valid', async () => {
      const homeBooking = {
        ...mockBooking,
        listing: {
          ...mockBooking.listing,
          category: {
            id: 'cat-2',
            slug: 'homes',
            name: 'Homes',
          },
        },
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(homeBooking);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({ id: 'report-1' });

      const result = await service.recordCheckin('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe('CHECK-OUT VALIDATION', () => {
    it('should calculate duration correctly', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({
          checkinTime: '2024-01-01T10:00:00Z',
        }),
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const checkoutTime = new Date('2024-01-05T10:00:00Z'); // Exactly 96 hours later
      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkoutTime,
      });

      // EXACT VALIDATION: 96 hours duration
      const checklistData = JSON.parse(result.conditionReport.checklistData);
      expect(checklistData.durationHours).toBe(96);
    });

    it('should reject check-out after booking end date', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({}),
      };

      const lateDate = new Date('2024-01-06'); // After booking end

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);

      await expect(
        service.recordCheckout('booking-1', {
          photos: ['photo1.jpg'],
          inventoryVerified: true,
          checkoutTime: lateDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require check-in report before check-out', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.recordCheckout('booking-1', {
          photos: ['photo1.jpg'],
          inventoryVerified: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept check-out on booking end date', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({}),
      };

      const validDate = new Date('2024-01-05'); // On booking end

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkoutTime: validDate,
      });

      expect(result).toBeDefined();
    });
  });

  describe('EARLY CHECK-OUT CHARGES', () => {
    it('should charge for early check-out more than 2 hours', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({
          checkinTime: '2024-01-01T10:00:00Z',
        }),
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      // Expected 96 hours, checking out after 70 hours (26 hours early)
      const checkoutTime = new Date('2024-01-04T08:00:00Z');

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkoutTime,
      });

      // EXACT VALIDATION: (96 - 70 - 2) × $10 = $240
      expect(result.charges.earlyCheckoutCharge).toBe(240);
    });

    it('should not charge for early check-out less than 2 hours', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({
          checkinTime: '2024-01-01T10:00:00Z',
        }),
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      // Checking out 1 hour early
      const checkoutTime = new Date('2024-01-05T09:00:00Z');

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkoutTime,
      });

      // EXACT VALIDATION: No charge for < 2 hours early
      expect(result.charges.earlyCheckoutCharge).toBe(0);
    });

    it('should not charge for on-time check-out', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({
          checkinTime: '2024-01-01T10:00:00Z',
        }),
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const checkoutTime = new Date('2024-01-05T10:00:00Z'); // Exactly on time

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkoutTime,
      });

      expect(result.charges.earlyCheckoutCharge).toBe(0);
    });
  });

  describe('CLEANING FEE CALCULATIONS', () => {
    it('should charge $50 for dirty status', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({}),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        cleaningStatus: 'DIRTY',
      });

      // EXACT VALIDATION: $50 for dirty
      expect(result.charges.cleaningFee).toBe(50);
    });

    it('should charge $25 for partial cleaning status', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({}),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        cleaningStatus: 'PARTIAL',
      });

      // EXACT VALIDATION: $25 for partial
      expect(result.charges.cleaningFee).toBe(25);
    });

    it('should not charge for clean status', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({}),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        cleaningStatus: 'CLEAN',
      });

      expect(result.charges.cleaningFee).toBe(0);
    });

    it('should calculate total additional charge correctly', async () => {
      const checkinReport = {
        id: 'checkin-1',
        checklistData: JSON.stringify({
          checkinTime: '2024-01-01T10:00:00Z',
        }),
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      // Early check-out + dirty = $240 + $50 = $290
      const checkoutTime = new Date('2024-01-04T08:00:00Z');

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(checkinReport);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'checkout-1',
        checklistData: JSON.stringify({}),
      });

      const result = await service.recordCheckout('booking-1', {
        photos: ['photo1.jpg'],
        inventoryVerified: true,
        checkoutTime,
        cleaningStatus: 'DIRTY',
      });

      // EXACT VALIDATION: $240 + $50 = $290
      expect(result.charges.totalAdditionalCharge).toBe(290);
    });
  });

  describe('ACCESS CODE VALIDATION', () => {
    it('should validate correct access code', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.validateAccessCode('booking-1', '123456');

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Access code valid');
    });

    it('should reject incorrect access code', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.validateAccessCode('booking-1', 'wrong-code');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid access code');
    });

    it('should handle non-existent booking', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateAccessCode('non-existent', '123456');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Booking not found');
    });
  });

  describe('CHECK-IN ELIGIBILITY', () => {
    it('should allow check-in 24 hours before start', async () => {
      const bookingSoon = {
        ...mockBooking,
        startDate: new Date(Date.now() + 23 * 60 * 60 * 1000), // 23 hours from now
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(bookingSoon);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.validateCheckinEligibility('booking-1');

      expect(result.valid).toBe(true);
    });

    it('should reject check-in more than 24 hours before start', async () => {
      const bookingLate = {
        ...mockBooking,
        startDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(bookingLate);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validateCheckinEligibility('booking-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate check-in', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue({
        id: 'checkin-1',
        checkIn: true,
        reportType: 'SPACE_CHECKIN',
      });

      await expect(
        service.validateCheckinEligibility('booking-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require CONFIRMED or IN_PROGRESS state', async () => {
      const invalidStates = ['PENDING', 'CANCELLED', 'COMPLETED', 'DISPUTED'];

      for (const status of invalidStates) {
        const invalidBooking = { ...mockBooking, status };
        (prisma.booking.findUnique as jest.Mock).mockResolvedValue(invalidBooking);
        (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          service.validateCheckinEligibility('booking-1'),
        ).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe('HISTORY RETRIEVAL', () => {
    it('should return check-in and check-out reports in chronological order', async () => {
      const reports = [
        {
          id: 'checkin-1',
          checkIn: true,
          checkOut: false,
          reportType: 'SPACE_CHECKIN',
          checklistData: JSON.stringify({ checkinTime: '2024-01-01T10:00:00Z' }),
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'checkout-1',
          checkIn: false,
          checkOut: true,
          reportType: 'SPACE_CHECKOUT',
          checklistData: JSON.stringify({ checkoutTime: '2024-01-05T10:00:00Z' }),
          createdAt: new Date('2024-01-05T10:00:00Z'),
        },
      ];

      (prisma.conditionReport.findMany as jest.Mock).mockResolvedValue(reports);

      const result = await service.getSpaceHistory('booking-1');

      expect(result).toHaveLength(2);
      expect(result[0].reportType).toBe('SPACE_CHECKIN');
      expect(result[1].reportType).toBe('SPACE_CHECKOUT');
    });

    it('should return empty array for booking with no reports', async () => {
      (prisma.conditionReport.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSpaceHistory('booking-1');

      expect(result).toEqual([]);
    });
  });
});
