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
    findMany: jest.fn(),
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
  describe('canTransition', () => {
    it('should return allowed=true for valid transition', async () => {
      const bookingId = 'booking-1';
      const booking = {
        id: bookingId,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.canTransition(bookingId, 'OWNER_APPROVE', 'OWNER');

      expect(result.allowed).toBe(true);
    });

    it('should return allowed=false for invalid transition', async () => {
      const bookingId = 'booking-1';
      const booking = {
        id: bookingId,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.canTransition(bookingId, 'OWNER_APPROVE', 'RENTER');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('should return allowed=false for non-existent booking', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      const result = await service.canTransition('non-existent', 'OWNER_APPROVE', 'OWNER');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Booking not found');
    });
  });

  describe('isTerminalState', () => {
    it('should return true for terminal states', () => {
      expect(service.isTerminalState(BookingStatus.SETTLED)).toBe(true);
      expect(service.isTerminalState(BookingStatus.REFUNDED)).toBe(true);
      expect(service.isTerminalState(BookingStatus.CANCELLED)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(service.isTerminalState(BookingStatus.PENDING_OWNER_APPROVAL)).toBe(false);
      expect(service.isTerminalState(BookingStatus.IN_PROGRESS)).toBe(false);
      expect(service.isTerminalState(BookingStatus.CONFIRMED)).toBe(false);
    });
  });

  describe('getStateHistory', () => {
    it('should return state history for a booking', async () => {
      const bookingId = 'booking-1';
      const history = [
        {
          id: 'history-1',
          bookingId,
          toState: BookingStatus.PENDING_OWNER_APPROVAL,
          changedBy: 'user-1',
          createdAt: new Date(),
        },
        {
          id: 'history-2',
          bookingId,
          toState: BookingStatus.CONFIRMED,
          changedBy: 'user-1',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.bookingStateHistory.findMany.mockResolvedValue(history);

      const result = await service.getStateHistory(bookingId);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.bookingStateHistory.findMany).toHaveBeenCalledWith({
        where: { bookingId },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('all state transitions', () => {
    const stateTransitions = [
      {
        from: BookingStatus.DRAFT,
        transition: 'SUBMIT_REQUEST',
        to: BookingStatus.PENDING_OWNER_APPROVAL,
        role: 'RENTER',
      },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        transition: 'OWNER_APPROVE',
        to: BookingStatus.PENDING_PAYMENT,
        role: 'OWNER',
      },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        transition: 'OWNER_REJECT',
        to: BookingStatus.CANCELLED,
        role: 'OWNER',
      },
      {
        from: BookingStatus.PENDING_PAYMENT,
        transition: 'COMPLETE_PAYMENT',
        to: BookingStatus.CONFIRMED,
        role: 'RENTER',
      },
      {
        from: BookingStatus.PENDING_PAYMENT,
        transition: 'EXPIRE',
        to: BookingStatus.CANCELLED,
        role: 'SYSTEM',
      },
      {
        from: BookingStatus.CONFIRMED,
        transition: 'START_RENTAL',
        to: BookingStatus.IN_PROGRESS,
        role: 'OWNER',
      },
      {
        from: BookingStatus.CONFIRMED,
        transition: 'CANCEL',
        to: BookingStatus.CANCELLED,
        role: 'RENTER',
      },
      {
        from: BookingStatus.IN_PROGRESS,
        transition: 'REQUEST_RETURN',
        to: BookingStatus.AWAITING_RETURN_INSPECTION,
        role: 'RENTER',
      },
      {
        from: BookingStatus.IN_PROGRESS,
        transition: 'INITIATE_DISPUTE',
        to: BookingStatus.DISPUTED,
        role: 'RENTER',
      },
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        transition: 'APPROVE_RETURN',
        to: BookingStatus.COMPLETED,
        role: 'OWNER',
      },
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        transition: 'REJECT_RETURN',
        to: BookingStatus.DISPUTED,
        role: 'OWNER',
      },
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        transition: 'EXPIRE',
        to: BookingStatus.COMPLETED,
        role: 'SYSTEM',
      },
      {
        from: BookingStatus.COMPLETED,
        transition: 'SETTLE',
        to: BookingStatus.SETTLED,
        role: 'SYSTEM',
      },
      {
        from: BookingStatus.CANCELLED,
        transition: 'REFUND',
        to: BookingStatus.REFUNDED,
        role: 'SYSTEM',
      },
    ];

    stateTransitions.forEach(({ from, transition, to, role }) => {
      it(`should allow ${transition} from ${from} to ${to} for ${role}`, () => {
        const availableTransitions = service.getAvailableTransitions(from, role as any);
        expect(availableTransitions).toContain(transition);
      });
    });
  });
});
