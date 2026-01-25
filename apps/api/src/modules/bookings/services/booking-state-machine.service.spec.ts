import { Test, TestingModule } from '@nestjs/testing';
import { BookingStateMachineService } from './booking-state-machine.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';

const mockPrismaService = {
  booking: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  bookingStateHistory: {
    create: jest.fn(),
  },
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  publish: jest.fn(),
};

describe('BookingStateMachineService', () => {
  let service: BookingStateMachineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transition', () => {
    it('should transition a booking from PENDING_OWNER_APPROVAL to PENDING_PAYMENT (Owner Approve)', async () => {
      const bookingId = 'booking-1';
      const ownerId = 'owner-1';
      const booking = {
        id: bookingId,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: ownerId },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);
      mockPrismaService.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.PENDING_PAYMENT,
      });

      const result = await service.transition(bookingId, 'OWNER_APPROVE', ownerId, 'OWNER');

      expect(result.success).toBe(true);
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bookingId },
          data: expect.objectContaining({
            status: BookingStatus.PENDING_PAYMENT,
          }),
        }),
      );
    });

    it('should throw error for unauthorized transition', async () => {
      const bookingId = 'booking-1';
      const renterId = 'renter-1';
      const booking = {
        id: bookingId,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: renterId,
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.transition(bookingId, 'OWNER_APPROVE', renterId, 'RENTER'),
      ).rejects.toThrow();
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return available transitions for OWNER', () => {
      const transitions = service.getAvailableTransitions(
        BookingStatus.PENDING_OWNER_APPROVAL,
        'OWNER',
      );

      expect(transitions).toContain('OWNER_APPROVE');
      expect(transitions).toContain('OWNER_REJECT');
    });
  });

  describe('autoTransitionExpiredBookings', () => {
    it('should expire pending payments', async () => {
      const expiredBooking = {
        id: 'booking-expired',
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      // Mock findMany to return expired booking first, then empty for second call
      mockPrismaService.booking.findMany
        .mockResolvedValueOnce([expiredBooking])
        .mockResolvedValueOnce([]);
      mockPrismaService.booking.findUnique.mockResolvedValue(expiredBooking);
      mockPrismaService.booking.update.mockResolvedValue(expiredBooking);

      await service.autoTransitionExpiredBookings();

      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
    });
  });
});
