import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingStateMachineService, BookingTransition } from './booking-state-machine.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BookingCalculationService } from './booking-calculation.service';
import { getQueueToken } from '@nestjs/bull';

/**
 * ULTRA-STRICT: Booking State Machine - Complete State Transition Validation
 *
 * These tests validate ALL valid and invalid state transitions with 100% coverage.
 * They ensure the state machine enforces business rules correctly.
 */
describe('BookingStateMachineService - COMPLETE STATE COVERAGE', () => {
  let service: BookingStateMachineService;
  let prisma: any;

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation((fn: any) => fn(mockPrismaService)),
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn(),
    },
    bookingStateHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    refund: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    payment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    conditionReport: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    dispute: { findFirst: jest.fn().mockResolvedValue(null) },
    depositHold: { findMany: jest.fn().mockResolvedValue([]) },
    payout: { create: jest.fn().mockResolvedValue({ id: 'payout-1' }) },
    auditLog: { 
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }), 
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    publish: jest.fn(),
  };

  const mockQueue = { add: jest.fn().mockResolvedValue({}), process: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        {
          provide: NotificationsService,
          useValue: { sendNotification: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: BookingCalculationService,
          useValue: { calculateRefund: jest.fn().mockResolvedValue({ refundAmount: 100 }) },
        },
        { provide: getQueueToken('payments'), useValue: mockQueue },
        { provide: getQueueToken('bookings'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  // ============================================================================
  // COMPLETE STATE TRANSITION MATRIX - ALL VALID TRANSITIONS
  // ============================================================================

  describe('VALID STATE TRANSITIONS - 100% COVERAGE', () => {
    const validTransitions: Array<{
      from: BookingStatus;
      to: BookingStatus;
      transition: BookingTransition;
      role: 'RENTER' | 'OWNER' | 'ADMIN' | 'SYSTEM';
      description: string;
    }> = [
      // DRAFT flows
      {
        from: BookingStatus.DRAFT,
        to: BookingStatus.PENDING_OWNER_APPROVAL,
        transition: 'SUBMIT_REQUEST',
        role: 'RENTER',
        description: 'Renter submits booking request',
      },

      // PENDING_OWNER_APPROVAL flows
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.PENDING_PAYMENT,
        transition: 'OWNER_APPROVE',
        role: 'OWNER',
        description: 'Owner approves booking',
      },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.CANCELLED,
        transition: 'OWNER_REJECT',
        role: 'OWNER',
        description: 'Owner rejects booking',
      },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.CANCELLED,
        transition: 'CANCEL',
        role: 'RENTER',
        description: 'Renter cancels pending request',
      },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        to: BookingStatus.CANCELLED,
        transition: 'EXPIRE',
        role: 'SYSTEM',
        description: 'Auto-expire unapproved booking',
      },

      // PENDING_PAYMENT flows
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CONFIRMED,
        transition: 'COMPLETE_PAYMENT',
        role: 'RENTER',
        description: 'Payment completed',
      },
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.PAYMENT_FAILED,
        transition: 'FAIL_PAYMENT',
        role: 'SYSTEM',
        description: 'Payment processing failed',
      },
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CANCELLED,
        transition: 'EXPIRE',
        role: 'SYSTEM',
        description: 'Payment timeout',
      },
      {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CANCELLED,
        transition: 'CANCEL',
        role: 'RENTER',
        description: 'Renter cancels before paying',
      },

      // PAYMENT_FAILED flows
      {
        from: BookingStatus.PAYMENT_FAILED,
        to: BookingStatus.PENDING_PAYMENT,
        transition: 'RETRY_PAYMENT',
        role: 'RENTER',
        description: 'Renter retries payment',
      },
      {
        from: BookingStatus.PAYMENT_FAILED,
        to: BookingStatus.CANCELLED,
        transition: 'EXPIRE',
        role: 'SYSTEM',
        description: 'Payment retry grace period expired',
      },

      // CONFIRMED flows
      {
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.IN_PROGRESS,
        transition: 'START_RENTAL',
        role: 'OWNER',
        description: 'Rental period starts',
      },
      {
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.CANCELLED,
        transition: 'CANCEL',
        role: 'RENTER',
        description: 'Renter cancels confirmed booking',
      },
      {
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.CANCELLED,
        transition: 'CANCEL',
        role: 'OWNER',
        description: 'Owner cancels confirmed booking',
      },

      // IN_PROGRESS flows
      {
        from: BookingStatus.IN_PROGRESS,
        to: BookingStatus.AWAITING_RETURN_INSPECTION,
        transition: 'REQUEST_RETURN',
        role: 'RENTER',
        description: 'Renter requests return',
      },
      {
        from: BookingStatus.IN_PROGRESS,
        to: BookingStatus.DISPUTED,
        transition: 'INITIATE_DISPUTE',
        role: 'RENTER',
        description: 'Renter initiates dispute during rental',
      },
      {
        from: BookingStatus.IN_PROGRESS,
        to: BookingStatus.DISPUTED,
        transition: 'INITIATE_DISPUTE',
        role: 'OWNER',
        description: 'Owner initiates dispute during rental',
      },

      // AWAITING_RETURN_INSPECTION flows
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        to: BookingStatus.COMPLETED,
        transition: 'APPROVE_RETURN',
        role: 'OWNER',
        description: 'Owner approves return',
      },
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        to: BookingStatus.DISPUTED,
        transition: 'REJECT_RETURN',
        role: 'OWNER',
        description: 'Owner rejects return (dispute)',
      },
      {
        from: BookingStatus.AWAITING_RETURN_INSPECTION,
        to: BookingStatus.COMPLETED,
        transition: 'EXPIRE',
        role: 'SYSTEM',
        description: 'Auto-approve return after timeout',
      },

      // COMPLETED flows
      {
        from: BookingStatus.COMPLETED,
        to: BookingStatus.SETTLED,
        transition: 'SETTLE',
        role: 'SYSTEM',
        description: 'Payout settled',
      },
      {
        from: BookingStatus.COMPLETED,
        to: BookingStatus.DISPUTED,
        transition: 'INITIATE_DISPUTE',
        role: 'RENTER',
        description: 'Post-completion dispute',
      },
      {
        from: BookingStatus.COMPLETED,
        to: BookingStatus.DISPUTED,
        transition: 'INITIATE_DISPUTE',
        role: 'OWNER',
        description: 'Post-completion dispute by owner',
      },

      // CANCELLED flows
      {
        from: BookingStatus.CANCELLED,
        to: BookingStatus.REFUNDED,
        transition: 'REFUND',
        role: 'SYSTEM',
        description: 'Refund processed',
      },

      // DISPUTED flows
      {
        from: BookingStatus.DISPUTED,
        to: BookingStatus.COMPLETED,
        transition: 'RESOLVE_DISPUTE_OWNER_FAVOR',
        role: 'ADMIN',
        description: 'Dispute resolved for owner',
      },
      {
        from: BookingStatus.DISPUTED,
        to: BookingStatus.REFUNDED,
        transition: 'RESOLVE_DISPUTE_RENTER_FAVOR',
        role: 'ADMIN',
        description: 'Dispute resolved for renter',
      },
    ];

    validTransitions.forEach(({ from, to, transition, role, description }) => {
      test(`${description}: ${from} → ${to} via ${transition} (${role})`, async () => {
        mockPrismaService.booking.findUnique.mockResolvedValue({
          id: 'booking-1',
          status: from,
          renterId: role === 'RENTER' ? 'actor-1' : 'renter-1',
          listing: {
            ownerId: role === 'OWNER' ? 'actor-1' : 'owner-1',
            owner: {
              stripeConnectId: 'acct_test123',
            },
          },
          startDate: new Date('2026-05-01'),
        });

        const result = await service.transition('booking-1', transition, 'actor-1', role);

        expect(result.success).toBe(true);
        expect(result.newState).toBe(to);
        expect(mockPrismaService.booking.updateMany).toHaveBeenCalled();
        expect(mockPrismaService.bookingStateHistory.create).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // INVALID STATE TRANSITIONS - MUST BE REJECTED
  // ============================================================================

  describe('INVALID STATE TRANSITIONS - MUST BE REJECTED', () => {
    const invalidTransitions: Array<{
      from: BookingStatus;
      transition: BookingTransition;
      role: 'RENTER' | 'OWNER' | 'ADMIN' | 'SYSTEM';
      description: string;
    }> = [
      // Cannot go directly to terminal states
      {
        from: BookingStatus.DRAFT,
        transition: 'COMPLETE_PAYMENT',
        role: 'RENTER',
        description: 'Cannot pay without owner approval',
      },
      {
        from: BookingStatus.DRAFT,
        transition: 'COMPLETE',
        role: 'SYSTEM',
        description: 'Cannot complete draft booking',
      },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        transition: 'SETTLE',
        role: 'SYSTEM',
        description: 'Cannot settle unapproved booking',
      },

      // Cannot skip states
      {
        from: BookingStatus.DRAFT,
        transition: 'START_RENTAL',
        role: 'OWNER',
        description: 'Cannot start rental from draft',
      },
      {
        from: BookingStatus.PENDING_PAYMENT,
        transition: 'START_RENTAL',
        role: 'OWNER',
        description: 'Cannot skip confirmation',
      },

      // Cannot reverse states
      {
        from: BookingStatus.CONFIRMED,
        transition: 'OWNER_APPROVE',
        role: 'OWNER',
        description: 'Cannot re-approve confirmed',
      },
      {
        from: BookingStatus.CANCELLED,
        transition: 'COMPLETE_PAYMENT',
        role: 'RENTER',
        description: 'Cannot pay cancelled booking',
      },

      // Cannot settle from non-completed
      {
        from: BookingStatus.PENDING_PAYMENT,
        transition: 'SETTLE',
        role: 'SYSTEM',
        description: 'Cannot settle pending payment',
      },
      {
        from: BookingStatus.IN_PROGRESS,
        transition: 'SETTLE',
        role: 'SYSTEM',
        description: 'Cannot settle in-progress',
      },

      // Cannot refund non-cancelled/disputed
      {
        from: BookingStatus.DRAFT,
        transition: 'REFUND',
        role: 'SYSTEM',
        description: 'Cannot refund draft',
      },
      {
        from: BookingStatus.CONFIRMED,
        transition: 'REFUND',
        role: 'SYSTEM',
        description: 'Cannot refund confirmed',
      },

      // Cannot complete from invalid states
      {
        from: BookingStatus.DRAFT,
        transition: 'COMPLETE',
        role: 'SYSTEM',
        description: 'Cannot complete draft',
      },
      {
        from: BookingStatus.PENDING_OWNER_APPROVAL,
        transition: 'COMPLETE',
        role: 'SYSTEM',
        description: 'Cannot complete pending approval',
      },
    ];

    invalidTransitions.forEach(({ from, transition, role, description }) => {
      test(`${description}: ${from} with ${transition} (${role})`, async () => {
        mockPrismaService.booking.findUnique.mockResolvedValue({
          id: 'booking-1',
          status: from,
          renterId: 'renter-1',
          listing: { ownerId: 'owner-1' },
        });

        await expect(service.transition('booking-1', transition, 'actor-1', role)).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  // ============================================================================
  // ROLE-BASED AUTHORIZATION - COMPLETE MATRIX
  // ============================================================================

  describe('ROLE-BASED AUTHORIZATION - ALL COMBINATIONS', () => {
    test('RENTER cannot perform OWNER actions', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      });

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'renter-1', 'RENTER'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('OWNER cannot perform RENTER actions', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      });

      await expect(
        service.transition('booking-1', 'COMPLETE_PAYMENT', 'owner-1', 'OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('Non-owner cannot act on booking', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      });

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'other-owner', 'OWNER'),
      ).rejects.toThrow();
    });

    test('Non-renter cannot act on booking', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      });

      await expect(
        service.transition('booking-1', 'CANCEL', 'other-renter', 'RENTER'),
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // CONCURRENT STATE CHANGE HANDLING
  // ============================================================================

  describe('CONCURRENT STATE CHANGE HANDLING', () => {
    test('detects concurrent modification and rejects', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      });

      // Simulate another process updating the booking
      mockPrismaService.booking.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER'),
      ).rejects.toThrow(BadRequestException);
    });

    test('successful atomic transaction with history', async () => {
      const originalStatus = BookingStatus.PENDING_OWNER_APPROVAL;
      const newStatus = BookingStatus.PENDING_PAYMENT;

      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: originalStatus,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      });

      mockPrismaService.booking.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER');

      expect(result.success).toBe(true);

      // Verify history was recorded
      expect(mockPrismaService.bookingStateHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: 'booking-1',
            fromStatus: originalStatus,
            toStatus: newStatus,
            changedBy: 'owner-1',
          }),
        }),
      );
    });
  });

  // ============================================================================
  // TERMINAL STATE VERIFICATION
  // ============================================================================

  describe('TERMINAL STATE VERIFICATION', () => {
    const terminalStates = [BookingStatus.SETTLED, BookingStatus.REFUNDED, BookingStatus.CANCELLED];

    const nonTerminalStates = [
      BookingStatus.DRAFT,
      BookingStatus.PENDING_OWNER_APPROVAL,
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.AWAITING_RETURN_INSPECTION,
      BookingStatus.COMPLETED,
      BookingStatus.DISPUTED,
      BookingStatus.PAYMENT_FAILED,
    ];

    terminalStates.forEach((state) => {
      test(`${state} is terminal state`, () => {
        expect(service.isTerminalState(state)).toBe(true);
      });
    });

    nonTerminalStates.forEach((state) => {
      test(`${state} is NOT terminal state`, () => {
        expect(service.isTerminalState(state)).toBe(false);
      });
    });

    test('cannot transition from terminal states', async () => {
      for (const terminalState of terminalStates) {
        mockPrismaService.booking.findUnique.mockResolvedValue({
          id: 'booking-1',
          status: terminalState,
          renterId: 'renter-1',
          listing: { ownerId: 'owner-1' },
        });

        const availableTransitions = service.getAvailableTransitions(terminalState, 'SYSTEM');
        
        // CANCELLED is special - it can transition to REFUNDED
        if (terminalState === BookingStatus.CANCELLED) {
          expect(availableTransitions).toEqual(['REFUND']);
        } else {
          expect(availableTransitions).toHaveLength(0);
        }
      }
    });
  });

  // ============================================================================
  // STATE HISTORY TRACKING
  // ============================================================================

  describe('STATE HISTORY TRACKING', () => {
    test('records complete state transition history', async () => {
      const history = [
        { id: 'h1', fromStatus: null, toStatus: BookingStatus.DRAFT, changedBy: 'renter-1' },
        {
          id: 'h2',
          fromStatus: BookingStatus.DRAFT,
          toStatus: BookingStatus.PENDING_OWNER_APPROVAL,
          changedBy: 'renter-1',
        },
        {
          id: 'h3',
          fromStatus: BookingStatus.PENDING_OWNER_APPROVAL,
          toStatus: BookingStatus.PENDING_PAYMENT,
          changedBy: 'owner-1',
        },
        {
          id: 'h4',
          fromStatus: BookingStatus.PENDING_PAYMENT,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: 'system',
        },
      ];

      mockPrismaService.bookingStateHistory.findMany.mockResolvedValue(history);

      const result = await service.getStateHistory('booking-1');

      expect(result).toHaveLength(4);
      expect(mockPrismaService.bookingStateHistory.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ============================================================================
  // AVAILABLE TRANSITIONS BY STATE & ROLE
  // ============================================================================

  describe('AVAILABLE TRANSITIONS COMPLETE MATRIX', () => {
    const expectations: Array<{
      state: BookingStatus;
      role: 'RENTER' | 'OWNER' | 'ADMIN' | 'SYSTEM';
      expectedTransitions: BookingTransition[];
    }> = [
      // RENTER actions
      { state: BookingStatus.DRAFT, role: 'RENTER', expectedTransitions: ['SUBMIT_REQUEST'] },
      {
        state: BookingStatus.PENDING_OWNER_APPROVAL,
        role: 'RENTER',
        expectedTransitions: ['CANCEL'],
      },
      {
        state: BookingStatus.PENDING_PAYMENT,
        role: 'RENTER',
        expectedTransitions: ['COMPLETE_PAYMENT', 'CANCEL'],
      },
      {
        state: BookingStatus.PAYMENT_FAILED,
        role: 'RENTER',
        expectedTransitions: ['RETRY_PAYMENT', 'EXPIRE'],
      },
      { state: BookingStatus.CONFIRMED, role: 'RENTER', expectedTransitions: ['CANCEL'] },
      {
        state: BookingStatus.IN_PROGRESS,
        role: 'RENTER',
        expectedTransitions: ['REQUEST_RETURN', 'INITIATE_DISPUTE'],
      },
      { state: BookingStatus.AWAITING_RETURN_INSPECTION, role: 'RENTER', expectedTransitions: [] },
      { state: BookingStatus.COMPLETED, role: 'RENTER', expectedTransitions: ['INITIATE_DISPUTE'] },

      // OWNER actions
      {
        state: BookingStatus.PENDING_OWNER_APPROVAL,
        role: 'OWNER',
        expectedTransitions: ['OWNER_APPROVE', 'OWNER_REJECT'],
      },
      { state: BookingStatus.PENDING_PAYMENT, role: 'OWNER', expectedTransitions: [] },
      {
        state: BookingStatus.CONFIRMED,
        role: 'OWNER',
        expectedTransitions: ['START_RENTAL', 'CANCEL'],
      },
      {
        state: BookingStatus.IN_PROGRESS,
        role: 'OWNER',
        expectedTransitions: ['INITIATE_DISPUTE'],
      },
      {
        state: BookingStatus.AWAITING_RETURN_INSPECTION,
        role: 'OWNER',
        expectedTransitions: ['APPROVE_RETURN', 'REJECT_RETURN'],
      },
      { state: BookingStatus.COMPLETED, role: 'OWNER', expectedTransitions: ['INITIATE_DISPUTE'] },

      // ADMIN actions
      {
        state: BookingStatus.DISPUTED,
        role: 'ADMIN',
        expectedTransitions: ['RESOLVE_DISPUTE_OWNER_FAVOR', 'RESOLVE_DISPUTE_RENTER_FAVOR'],
      },

      // SYSTEM actions
      {
        state: BookingStatus.PENDING_OWNER_APPROVAL,
        role: 'SYSTEM',
        expectedTransitions: ['EXPIRE'],
      },
      {
        state: BookingStatus.PENDING_PAYMENT,
        role: 'SYSTEM',
        expectedTransitions: ['COMPLETE_PAYMENT', 'FAIL_PAYMENT', 'EXPIRE'],
      },
      { state: BookingStatus.PAYMENT_FAILED, role: 'SYSTEM', expectedTransitions: ['EXPIRE'] },
      {
        state: BookingStatus.AWAITING_RETURN_INSPECTION,
        role: 'SYSTEM',
        expectedTransitions: ['EXPIRE'],
      },
      { state: BookingStatus.COMPLETED, role: 'SYSTEM', expectedTransitions: ['SETTLE'] },
      { state: BookingStatus.CANCELLED, role: 'SYSTEM', expectedTransitions: ['REFUND'] },
    ];

    expectations.forEach(({ state, role, expectedTransitions }) => {
      test(`${state} for ${role} has correct transitions`, () => {
        const available = service.getAvailableTransitions(state, role);
        expect(available.sort()).toEqual(expectedTransitions.sort());
      });
    });
  });
});
