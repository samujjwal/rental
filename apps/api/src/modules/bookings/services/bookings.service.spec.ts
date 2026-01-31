import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService, CreateBookingDto } from './bookings.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { AvailabilityService } from '../../listings/services/availability.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { BookingCalculationService } from './booking-calculation.service';
import { BookingMode, BookingStatus } from '@rental-portal/database';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;
  let cache: CacheService;
  let availability: AvailabilityService;
  let stateMachine: BookingStateMachineService;
  let calculation: BookingCalculationService;

  const mockPrismaService = {
    listing: {
      findUnique: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    publish: jest.fn(),
  };

  const mockAvailabilityService = {
    checkAvailability: jest.fn(),
  };

  const mockStateMachine = {
    transition: jest.fn(),
  };

  const mockCalculationService = {
    calculatePrice: jest.fn(),
    calculateRefund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AvailabilityService,
          useValue: mockAvailabilityService,
        },
        {
          provide: BookingStateMachineService,
          useValue: mockStateMachine,
        },
        {
          provide: BookingCalculationService,
          useValue: mockCalculationService,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    availability = module.get<AvailabilityService>(AvailabilityService);
    stateMachine = module.get<BookingStateMachineService>(BookingStateMachineService);
    calculation = module.get<BookingCalculationService>(BookingCalculationService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateBookingDto = {
      listingId: 'listing-1',
      startDate: new Date(),
      endDate: new Date(),
      guestCount: 2,
    };

    const mockListing = {
      id: 'listing-1',
      status: 'AVAILABLE',
      ownerId: 'owner-1',
      bookingMode: BookingMode.REQUEST,
      currency: 'USD',
    };

    const mockPricing = {
      subtotal: 100,
      platformFee: 10,
      serviceFee: 5,
      depositAmount: 0,
      total: 115,
      ownerEarnings: 90,
      breakdown: {},
    };

    it('should create a booking successfully', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        ...createDto,
      });

      const result = await service.create('renter-1', createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.PENDING_OWNER_APPROVAL,
            renterId: 'renter-1',
          }),
        }),
      );
      expect(mockCacheService.publish).toHaveBeenCalledWith('booking:created', expect.any(Object));
    });

    it('should set status to PENDING_PAYMENT for INSTANT_BOOK', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        ...mockListing,
        bookingMode: BookingMode.INSTANT_BOOK,
      });
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      await service.create('renter-1', createDto);

      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.PENDING_PAYMENT,
          }),
        }),
      );
    });

    it('should throw BadRequest if listing is not ACTIVE', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({ ...mockListing, status: 'DRAFT' });
      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest if booking own listing', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        ...mockListing,
        ownerId: 'renter-1',
      });
      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest if dates unavailable', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        isAvailable: false,
        conflicts: [],
      });
      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveBooking', () => {
    it('should transition state if owner approves', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        listing: { ownerId: 'owner-1' },
      });

      await service.approveBooking('booking-1', 'owner-1');

      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        'booking-1',
        'OWNER_APPROVE',
        'owner-1',
        'OWNER',
      );
    });

    it('should throw Forbidden if not owner', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        listing: { ownerId: 'owner-1' },
      });

      await expect(service.approveBooking('booking-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancelBooking', () => {
    it('should calculate refund and transition state', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
        status: BookingStatus.CONFIRMED, // Ensure status is valid for cancellation if logic checks it (Service doesn't check status explicitly before transition call, state machine does)
      });
      mockCalculationService.calculateRefund.mockResolvedValue({ amount: 50 });

      await service.cancelBooking('booking-1', 'renter-1', 'Changed mind');

      expect(mockCalculationService.calculateRefund).toHaveBeenCalled();
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        'booking-1',
        'CANCEL',
        'renter-1',
        'RENTER',
        expect.objectContaining({ reason: 'Changed mind', refund: { amount: 50 } }),
      );
    });
  });
});
