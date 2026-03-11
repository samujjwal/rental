import { Test, TestingModule } from '@nestjs/testing';
import { BookingStateMachineService } from './booking-state-machine.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { BookingStatus } from '@rental-portal/database';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BookingCalculationService } from './booking-calculation.service';
import { getQueueToken } from '@nestjs/bull';

const mockPrismaService = {
  $transaction: jest.fn().mockImplementation((fn) => fn(mockPrismaService)),
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
  refund: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
  },
  payment: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
  },
  conditionReport: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'report-1' }),
  },
  dispute: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
  },
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  publish: jest.fn(),
};

// Default mock booking fields for transitions that trigger settlement/refund
const defaultBookingFields = {
  ownerEarnings: 100,
  currency: 'USD',
  paymentIntentId: null,
};

function mockBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    renterId: 'renter-1',
    listing: { ownerId: 'owner-1', owner: { stripeConnectId: 'acct_test' } },
    ...defaultBookingFields,
    ...overrides,
  };
}

describe('BookingStateMachineService - Edge Cases', () => {
  let service: BookingStateMachineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        {
          provide: NotificationsService,
          useValue: {
            sendNotification: jest.fn().mockResolvedValue(undefined),
            createNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BookingCalculationService,
          useValue: {
            calculatePrice: jest.fn().mockResolvedValue({ subtotal: 100 }),
            calculateRefund: jest.fn().mockResolvedValue({ refundAmount: 50 }),
          },
        },
        { provide: getQueueToken('payments'), useValue: { add: jest.fn().mockResolvedValue({}), process: jest.fn() } },
        { provide: getQueueToken('bookings'), useValue: { add: jest.fn().mockResolvedValue({}), process: jest.fn() } },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Case: Non-existent booking', () => {
    it('should throw BadRequestException when booking does not exist', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.transition('non-existent-id', 'OWNER_APPROVE', 'owner-1', 'OWNER'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Edge Case: Invalid state transitions', () => {
    it('should throw error when trying to approve from CONFIRMED state', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when trying to complete payment from DRAFT state', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.DRAFT,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when trying to settle from IN_PROGRESS state', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.IN_PROGRESS,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(service.transition('booking-1', 'SETTLE', 'system', 'SYSTEM')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Edge Case: Role authorization violations', () => {
    it('should throw ForbiddenException when renter tries to approve booking', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.transition('booking-1', 'OWNER_APPROVE', 'renter-1', 'RENTER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when owner tries to complete payment', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.transition('booking-1', 'COMPLETE_PAYMENT', 'owner-1', 'OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when wrong renter tries to cancel', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(service.transition('booking-1', 'CANCEL', 'renter-2', 'RENTER')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when wrong owner tries to approve return', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.transition('booking-1', 'APPROVE_RETURN', 'owner-2', 'OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Edge Case: Terminal states', () => {
    it('should not allow any transitions from SETTLED state', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.SETTLED,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(service.transition('booking-1', 'CANCEL', 'renter-1', 'RENTER')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not allow any transitions from REFUNDED state', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.REFUNDED,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.transition('booking-1', 'COMPLETE_PAYMENT', 'renter-1', 'RENTER'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Edge Case: Concurrent transitions', () => {
    it('should handle concurrent transition attempts gracefully', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      // Simulate two concurrent approvals
      const promise1 = service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER');
      const promise2 = service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER');

      const results = await Promise.allSettled([promise1, promise2]);

      // At least one should succeed
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Case: State history tracking', () => {
    it('should create state history entry on successful transition', async () => {
      const booking = mockBooking({
        status: BookingStatus.PENDING_OWNER_APPROVAL,
      });

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await service.transition('booking-1', 'OWNER_APPROVE', 'owner-1', 'OWNER', {
        reason: 'Approved by owner',
      });

      expect(mockPrismaService.bookingStateHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          toStatus: BookingStatus.PENDING_PAYMENT,
          changedBy: 'owner-1',
          metadata: JSON.stringify({ reason: 'Approved by owner' }),
        }),
      });
    });
  });

  describe('Edge Case: Dispute resolution paths', () => {
    it('should allow ADMIN to resolve dispute in owner favor (→ COMPLETED)', async () => {
      const booking = mockBooking({
        status: BookingStatus.DISPUTED,
      });

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.transition('booking-1', 'RESOLVE_DISPUTE_OWNER_FAVOR', 'admin-1', 'ADMIN');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.COMPLETED);
    });

    it('should allow ADMIN to resolve dispute in renter favor (→ REFUNDED)', async () => {
      const booking = mockBooking({
        status: BookingStatus.DISPUTED,
      });

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.transition('booking-1', 'RESOLVE_DISPUTE_RENTER_FAVOR', 'admin-1', 'ADMIN');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.REFUNDED);
    });
  });

  describe('Edge Case: System transitions', () => {
    it('should allow SYSTEM to expire pending payments', async () => {
      const booking = mockBooking({
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.transition('booking-1', 'EXPIRE', 'system', 'SYSTEM');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.CANCELLED);
    });

    it('should allow SYSTEM to auto-complete awaiting return inspection', async () => {
      const booking = mockBooking({
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
      });

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.transition('booking-1', 'EXPIRE', 'system', 'SYSTEM');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.COMPLETED);
    });

    it('should allow SYSTEM to settle completed bookings', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.transition('booking-1', 'SETTLE', 'system', 'SYSTEM');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.SETTLED);
    });

    it('should allow SYSTEM to refund cancelled bookings', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.CANCELLED,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.transition('booking-1', 'REFUND', 'system', 'SYSTEM');

      expect(result.success).toBe(true);
      expect(result.newState).toBe(BookingStatus.REFUNDED);
    });
  });

  describe('Edge Case: Multiple valid transitions from same state', () => {
    it('should handle both OWNER_APPROVE and OWNER_REJECT from PENDING_OWNER_APPROVAL', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const availableTransitions = service.getAvailableTransitions(
        BookingStatus.PENDING_OWNER_APPROVAL,
        'OWNER',
      );

      expect(availableTransitions).toContain('OWNER_APPROVE');
      expect(availableTransitions).toContain('OWNER_REJECT');
      expect(availableTransitions).toHaveLength(2);
    });

    it('should handle CANCEL and START_RENTAL from CONFIRMED', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const renterTransitions = service.getAvailableTransitions(BookingStatus.CONFIRMED, 'RENTER');
      const ownerTransitions = service.getAvailableTransitions(BookingStatus.CONFIRMED, 'OWNER');

      expect(renterTransitions).toContain('CANCEL');
      expect(ownerTransitions).toContain('START_RENTAL');
    });
  });

  describe('Edge Case: Metadata preservation', () => {
    it('should preserve metadata through state transitions', async () => {
      const booking = mockBooking({
        status: BookingStatus.AWAITING_RETURN_INSPECTION,
      });

      const metadata = {
        inspectionNotes: 'Item in good condition',
        photos: ['photo1.jpg', 'photo2.jpg'],
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      await service.transition('booking-1', 'APPROVE_RETURN', 'owner-1', 'OWNER', metadata);

      expect(mockPrismaService.bookingStateHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: JSON.stringify(metadata),
        }),
      });
    });
  });
});
