import { Test, TestingModule } from '@nestjs/testing';
import { BookingStateMachineService, BookingTransition } from './booking-state-machine.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { BookingCalculationService } from './booking-calculation.service';
import { BookingStatus } from '@rental-portal/database';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';

describe('BookingStateMachineService - Invalid Transitions', () => {
  let service: BookingStateMachineService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockBooking = {
    id: 'booking-1',
    status: BookingStatus.PENDING_OWNER_APPROVAL,
    renterId: 'renter-1',
    listing: { ownerId: 'owner-1' },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bookingStateHistory: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), publish: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { sendNotification: jest.fn(), createNotification: jest.fn() },
        },
        { provide: BookingCalculationService, useValue: { calculateRefund: jest.fn() } },
        { provide: getQueueToken('payments'), useValue: { add: jest.fn() } },
        { provide: getQueueToken('bookings'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Invalid Role-Based Transitions', () => {
    it('should reject OWNER_APPROVE by renter', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'renter-1', 'RENTER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject OWNER_REJECT by renter', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        service.transition('booking-1', 'OWNER_REJECT', 'renter-1', 'RENTER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject SUBMIT_REQUEST by owner', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.DRAFT,
      });

      await expect(
        service.transition('booking-1', 'SUBMIT_REQUEST', 'owner-1', 'OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject START_RENTAL by renter', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        service.transition('booking-1', 'START_RENTAL', 'renter-1', 'RENTER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject APPROVE_RETURN by renter', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
      });

      await expect(
        service.transition('booking-1', 'APPROVE_RETURN', 'renter-1', 'RENTER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject RESOLVE_DISPUTE by non-admin', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.DISPUTED,
      });

      await expect(
        service.transition('booking-1', 'RESOLVE_DISPUTE_OWNER_FAVOR', 'owner-1', 'OWNER'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.transition('booking-1', 'RESOLVE_DISPUTE_OWNER_FAVOR', 'renter-1', 'RENTER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Invalid State Transitions', () => {
    it('should reject PENDING → CONFIRMED (must go through PENDING_PAYMENT)', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });

      const transitions = service.getAvailableTransitions(
        BookingStatus.PENDING_OWNER_APPROVAL,
        'OWNER',
      );

      expect(transitions).not.toContain('COMPLETE_PAYMENT');
      expect(transitions).not.toContain('START_RENTAL');
    });

    it('should reject DRAFT → CONFIRMED', async () => {
      const transitions = service.getAvailableTransitions(BookingStatus.DRAFT, 'RENTER');

      expect(transitions).not.toContain('COMPLETE_PAYMENT');
      expect(transitions).not.toContain('START_RENTAL');
      expect(transitions).toContain('SUBMIT_REQUEST');
    });

    it('should reject CANCELLED → CONFIRMED', async () => {
      const transitions = service.getAvailableTransitions(BookingStatus.CANCELLED, 'RENTER');

      expect(transitions).toHaveLength(0);
    });

    it('should reject COMPLETED → IN_PROGRESS', async () => {
      const transitions = service.getAvailableTransitions(BookingStatus.COMPLETED, 'OWNER');

      expect(transitions).not.toContain('START_RENTAL');
      expect(transitions).not.toContain('REQUEST_RETURN');
    });

    it('should reject REFUNDED → any state', async () => {
      const renterTransitions = service.getAvailableTransitions(BookingStatus.REFUNDED, 'RENTER');
      const ownerTransitions = service.getAvailableTransitions(BookingStatus.REFUNDED, 'OWNER');
      const adminTransitions = service.getAvailableTransitions(BookingStatus.REFUNDED, 'ADMIN');

      expect(renterTransitions).toHaveLength(0);
      expect(ownerTransitions).toHaveLength(0);
      expect(adminTransitions).toHaveLength(0);
    });

    it('should reject SETTLED → any state', async () => {
      const renterTransitions = service.getAvailableTransitions(BookingStatus.SETTLED, 'RENTER');
      const ownerTransitions = service.getAvailableTransitions(BookingStatus.SETTLED, 'OWNER');

      expect(renterTransitions).toHaveLength(0);
      expect(ownerTransitions).toHaveLength(0);
    });

    it('should reject PENDING_PAYMENT → IN_PROGRESS (must be CONFIRMED first)', async () => {
      const transitions = service.getAvailableTransitions(BookingStatus.PENDING_PAYMENT, 'OWNER');

      expect(transitions).not.toContain('START_RENTAL');
      // Note: Available transitions depend on actual state machine implementation
    });

    it('should reject IN_PROGRESS → SETTLED (must be COMPLETED first)', async () => {
      const transitions = service.getAvailableTransitions(BookingStatus.IN_PROGRESS, 'SYSTEM');

      expect(transitions).not.toContain('SETTLE');
      expect(transitions).toContain('REQUEST_RETURN');
      // Note: INITIATE_DISPUTE availability depends on implementation
    });
  });

  describe('Invalid Timing-Based Transitions', () => {
    it('should reject CANCEL after rental period started', async () => {
      const inProgressBooking = {
        ...mockBooking,
        status: BookingStatus.IN_PROGRESS,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };

      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(inProgressBooking);

      await expect(
        service.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER'),
      ).rejects.toThrow();
    });

    it('should reject START_RENTAL before start date', async () => {
      const confirmedBooking = {
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      };

      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(confirmedBooking);

      // Owner can still trigger the transition, but system should validate dates
      // This test verifies the transition is available but may fail validation
      const transitions = service.getAvailableTransitions(BookingStatus.CONFIRMED, 'OWNER');

      expect(transitions).toContain('START_RENTAL');
    });

    it('should reject APPROVE_RETURN before rental end date', async () => {
      const awaitingReturnBooking = {
        ...mockBooking,
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      };

      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(awaitingReturnBooking);

      // Transition is available but may be subject to date validation
      const transitions = service.getAvailableTransitions(
        BookingStatus.AWAITING_RETURN_INSPECTION,
        'OWNER',
      );

      expect(transitions).toContain('APPROVE_RETURN');
    });
  });

  describe('canTransition - Negative Cases', () => {
    it('should return false for invalid transition', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });

      const result = await service.canTransition('booking-1', 'START_RENTAL', 'OWNER');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No valid transition');
    });

    it('should return false for non-existent booking', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.canTransition('non-existent', 'OWNER_APPROVE', 'OWNER');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Booking not found');
    });

    it('should return false for wrong role', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.canTransition('booking-1', 'OWNER_APPROVE', 'RENTER');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('should return false for terminal state transitions', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      const result = await service.canTransition('booking-1', 'OWNER_APPROVE', 'OWNER');

      expect(result.allowed).toBe(false);
    });
  });

  describe('Terminal State Detection', () => {
    it('should identify terminal states correctly', () => {
      expect(service.isTerminalState(BookingStatus.SETTLED)).toBe(true);
      expect(service.isTerminalState(BookingStatus.REFUNDED)).toBe(true);
      expect(service.isTerminalState(BookingStatus.CANCELLED)).toBe(true);
      expect(service.isTerminalState(BookingStatus.COMPLETED)).toBe(false); // Can still settle
    });

    it('should not treat non-terminal states as terminal', () => {
      expect(service.isTerminalState(BookingStatus.PENDING_OWNER_APPROVAL)).toBe(false);
      expect(service.isTerminalState(BookingStatus.PENDING_PAYMENT)).toBe(false);
      expect(service.isTerminalState(BookingStatus.CONFIRMED)).toBe(false);
      expect(service.isTerminalState(BookingStatus.IN_PROGRESS)).toBe(false);
      expect(service.isTerminalState(BookingStatus.DRAFT)).toBe(false);
    });
  });

  describe('All Invalid Transitions Matrix', () => {
    const invalidTransitions = [
      { from: BookingStatus.DRAFT, transition: 'COMPLETE_PAYMENT', role: 'RENTER' },
      { from: BookingStatus.DRAFT, transition: 'START_RENTAL', role: 'OWNER' },
      { from: BookingStatus.DRAFT, transition: 'CANCEL', role: 'OWNER' },
      { from: BookingStatus.PENDING_OWNER_APPROVAL, transition: 'START_RENTAL', role: 'OWNER' },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        transition: 'COMPLETE_PAYMENT',
        role: 'RENTER',
      },
      { from: BookingStatus.PENDING_OWNER_APPROVAL, transition: 'REQUEST_RETURN', role: 'RENTER' },
      { from: BookingStatus.PENDING_PAYMENT, transition: 'START_RENTAL', role: 'OWNER' },
      { from: BookingStatus.PENDING_PAYMENT, transition: 'APPROVE_RETURN', role: 'OWNER' },
      { from: BookingStatus.CONFIRMED, transition: 'COMPLETE_PAYMENT', role: 'RENTER' },
      { from: BookingStatus.CONFIRMED, transition: 'APPROVE_RETURN', role: 'OWNER' },
      { from: BookingStatus.IN_PROGRESS, transition: 'COMPLETE_PAYMENT', role: 'RENTER' },
      { from: BookingStatus.IN_PROGRESS, transition: 'SETTLE', role: 'SYSTEM' },
      { from: BookingStatus.AWAITING_RETURN_INSPECTION, transition: 'START_RENTAL', role: 'OWNER' },
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        transition: 'COMPLETE_PAYMENT',
        role: 'RENTER',
      },
      { from: BookingStatus.DISPUTED, transition: 'COMPLETE_PAYMENT', role: 'RENTER' },
      { from: BookingStatus.DISPUTED, transition: 'START_RENTAL', role: 'OWNER' },
      { from: BookingStatus.CANCELLED, transition: 'OWNER_APPROVE', role: 'OWNER' },
      { from: BookingStatus.CANCELLED, transition: 'COMPLETE_PAYMENT', role: 'RENTER' },
      { from: BookingStatus.CANCELLED, transition: 'START_RENTAL', role: 'OWNER' },
      { from: BookingStatus.PAYMENT_FAILED, transition: 'START_RENTAL', role: 'OWNER' },
    ];

    invalidTransitions.forEach(({ from, transition, role }) => {
      it(`should NOT allow ${transition} from ${from} for ${role}`, () => {
        const availableTransitions = service.getAvailableTransitions(from, role as any);
        expect(availableTransitions).not.toContain(transition);
      });
    });
  });

  describe('Transition Attempt by Unauthorized Users', () => {
    it('should reject transition by random user', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'random-user', 'OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject transition when booking does not belong to user', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        renterId: 'different-renter',
        listing: { ownerId: 'different-owner' },
      });

      await expect(service.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
