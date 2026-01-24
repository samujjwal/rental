import { Test, TestingModule } from '@nestjs/testing';
import { BookingStateMachineService } from './booking-state-machine.service';
import { PrismaService } from '@/common/database/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { AuditService } from '@/common/audit/audit.service';
import { BookingStatus } from '@rental-portal/database';

describe('BookingStateMachineService', () => {
  let service: BookingStateMachineService;
  let prisma: PrismaService;
  let eventsService: EventsService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bookingStateHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockEventsService = {
    emitBookingStatusChanged: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
    prisma = module.get<PrismaService>(PrismaService);
    eventsService = module.get<EventsService>(EventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transition', () => {
    it('should successfully transition from DRAFT to PENDING_OWNER_APPROVAL', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.DRAFT,
        listing: {
          bookingMode: 'REQUEST_TO_BOOK',
          ownerId: 'owner-1',
        },
        renterId: 'renter-1',
        startDate: new Date(Date.now() + 86400000), // Tomorrow
        endDate: new Date(Date.now() + 172800000), // Day after tomorrow
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaService);
      });
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });

      const result = await service.transition(
        'booking-1',
        BookingStatus.PENDING_OWNER_APPROVAL,
        { userId: 'renter-1', reason: 'Booking request submitted' },
      );

      expect(result.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
      expect(mockEventsService.emitBookingStatusChanged).toHaveBeenCalled();
    });

    it('should reject invalid state transition', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.DRAFT,
        listing: { bookingMode: 'INSTANT_BOOK' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.transition(
          'booking-1',
          BookingStatus.COMPLETED, // Invalid transition from DRAFT
          { userId: 'user-1' },
        ),
      ).rejects.toThrow();
    });

    it('should enforce invariants for CONFIRMED state', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        paymentStatus: null, // Missing payment
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.transition('booking-1', BookingStatus.CONFIRMED, {
          userId: 'user-1',
        }),
      ).rejects.toThrow('Payment must be completed');
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return correct available transitions for DRAFT state', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        status: BookingStatus.DRAFT,
      });

      const transitions = await service.getAvailableTransitions('booking-1');

      expect(transitions).toContain(BookingStatus.PENDING_OWNER_APPROVAL);
      expect(transitions).toContain(BookingStatus.PENDING_PAYMENT);
      expect(transitions).toContain(BookingStatus.CANCELLED);
    });

    it('should return correct available transitions for CONFIRMED state', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        status: BookingStatus.CONFIRMED,
      });

      const transitions = await service.getAvailableTransitions('booking-1');

      expect(transitions).toContain(BookingStatus.IN_PROGRESS);
      expect(transitions).toContain(BookingStatus.CANCELLED);
    });
  });

  describe('getStateHistory', () => {
    it('should return booking state history', async () => {
      const mockHistory = [
        {
          id: '1',
          bookingId: 'booking-1',
          fromState: BookingStatus.DRAFT,
          toState: BookingStatus.PENDING_PAYMENT,
          triggeredBy: 'user-1',
          createdAt: new Date(),
        },
        {
          id: '2',
          bookingId: 'booking-1',
          fromState: BookingStatus.PENDING_PAYMENT,
          toState: BookingStatus.CONFIRMED,
          triggeredBy: 'system',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.bookingStateHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getStateHistory('booking-1');

      expect(result).toHaveLength(2);
      expect(result[0].toState).toBe(BookingStatus.PENDING_PAYMENT);
      expect(result[1].toState).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('checkAndTransitionExpiredBookings', () => {
    it('should cancel bookings with expired payment', async () => {
      const expiredBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: new Date(Date.now() - 1800000 * 2), // 60 minutes ago (expired)
      };

      mockPrismaService.booking.findMany = jest.fn().mockResolvedValue([expiredBooking]);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaService);
      });

      await service.checkAndTransitionExpiredBookings();

      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
      // Verify transition was attempted
    });
  });

  describe('autoCompleteAfterInspection', () => {
    it('should auto-complete bookings after inspection period', async () => {
      const bookingForCompletion = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
        endDate: new Date(Date.now() - 172800000 - 3600000), // More than 48 hours ago
        conditionReports: [
          {
            type: 'CHECK_OUT',
            status: 'APPROVED',
            damages: [],
          },
        ],
      };

      mockPrismaService.booking.findMany = jest.fn().mockResolvedValue([bookingForCompletion]);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaService);
      });

      await service.autoCompleteAfterInspection();

      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
      // Verify auto-completion was attempted
    });
  });
});
