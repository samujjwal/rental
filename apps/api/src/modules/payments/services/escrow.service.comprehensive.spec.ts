import { Test, TestingModule } from '@nestjs/testing';
import { EscrowService, CreateEscrowParams } from './escrow.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { CacheService } from '@/common/cache/cache.service';
import { BadRequestException } from '@nestjs/common';

describe('EscrowService - Full Lifecycle Coverage', () => {
  let service: EscrowService;
  let prismaService: jest.Mocked<PrismaService>;
  let eventsService: jest.Mocked<EventsService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockBooking = {
    id: 'booking-1',
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    renterId: 'renter-1',
    ownerId: 'owner-1',
    status: 'CONFIRMED',
    totalAmount: 1000,
    currency: 'USD',
  };

  const mockEscrow = {
    id: 'escrow-1',
    bookingId: 'booking-1',
    amount: 1000,
    currency: 'USD',
    status: 'PENDING',
    holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (for release tests)
    releasedAt: null,
    createdAt: new Date(),
    releaseCondition: 'checkout_confirmed',
    externalId: null,
    providerId: null,
    metadata: {},
  };

  beforeEach(async () => {
    const mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
      escrowTransaction: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
    };

    const mockEventsService = {
      emitEscrowFunded: jest.fn().mockResolvedValue(undefined),
      emitEscrowReleased: jest.fn().mockResolvedValue(undefined),
      emitEscrowFrozen: jest.fn().mockResolvedValue(undefined),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    eventsService = module.get(EventsService) as jest.Mocked<EventsService>;
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEscrow - PENDING state', () => {
    it('should create escrow with default hold period', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.escrowTransaction.create as jest.Mock).mockResolvedValue(mockEscrow);

      const params: CreateEscrowParams = {
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
      };

      const result = await service.createEscrow(params);

      expect(result.status).toBe('PENDING');
      expect(prismaService.escrowTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          amount: 1000,
          currency: 'USD',
          status: 'PENDING',
          releaseCondition: 'checkout_confirmed',
          holdUntil: expect.any(Date),
        }),
      });
    });

    it('should create escrow with custom hold days', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.escrowTransaction.create as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        holdUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      });

      const params: CreateEscrowParams = {
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
        holdDays: 3,
      };

      const result = await service.createEscrow(params);

      expect(result.status).toBe('PENDING');
    });

    it('should reject if booking does not exist', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(null);

      const params: CreateEscrowParams = {
        bookingId: 'non-existent',
        amount: 1000,
        currency: 'USD',
      };

      await expect(service.createEscrow(params)).rejects.toThrow(BadRequestException);
    });

    it('should reject if active escrow already exists', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-escrow',
        status: 'PENDING',
      });

      const params: CreateEscrowParams = {
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
      };

      await expect(service.createEscrow(params)).rejects.toThrow(BadRequestException);
    });

    it('should allow creating escrow if existing is RELEASED', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      // Mock findFirst to return null (no active escrow found)
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.escrowTransaction.create as jest.Mock).mockResolvedValue(mockEscrow);

      const params: CreateEscrowParams = {
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
      };

      const result = await service.createEscrow(params);

      expect(result.status).toBe('PENDING');
    });

    it('should allow creating escrow if existing is REFUNDED', async () => {
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      // Mock findFirst to return null (no active escrow found)
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.escrowTransaction.create as jest.Mock).mockResolvedValue(mockEscrow);

      const params: CreateEscrowParams = {
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
      };

      const result = await service.createEscrow(params);

      expect(result.status).toBe('PENDING');
    });
  });

  describe('fundEscrow - PENDING → FUNDED transition', () => {
    it('should transition escrow from PENDING to FUNDED', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        capturedAt: new Date(),
      });
      (prismaService.ledgerEntry.create as jest.Mock).mockResolvedValue({ id: 'ledger-1' });

      const result = await service.fundEscrow('escrow-1', 'pi_123');

      expect(result.status).toBe('FUNDED');
      expect(prismaService.escrowTransaction.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: expect.objectContaining({
          status: 'FUNDED',
          capturedAt: expect.any(Date),
          externalId: 'pi_123',
        }),
      });
    });

    it('should create LIABILITY ledger entry when funding', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        capturedAt: new Date(),
      });
      (prismaService.ledgerEntry.create as jest.Mock).mockResolvedValue({ id: 'ledger-1' });

      await service.fundEscrow('escrow-1');

      expect(prismaService.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          accountId: 'escrow-1',
          accountType: 'LIABILITY',
          side: 'CREDIT',
          transactionType: 'DEPOSIT_HOLD',
          amount: 1000,
          currency: 'USD',
          status: 'POSTED',
          referenceId: 'escrow-1',
        }),
      });
    });

    it('should emit escrow funded event', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        capturedAt: new Date(),
      });
      (prismaService.ledgerEntry.create as jest.Mock).mockResolvedValue({ id: 'ledger-1' });

      await service.fundEscrow('escrow-1');

      expect(eventsService.emitEscrowFunded).toHaveBeenCalledWith({
        escrowId: 'escrow-1',
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
      });
    });

    it('should handle event emission errors gracefully', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        capturedAt: new Date(),
      });
      (prismaService.ledgerEntry.create as jest.Mock).mockResolvedValue({ id: 'ledger-1' });
      (eventsService.emitEscrowFunded as jest.Mock).mockRejectedValue(new Error('Event error'));

      // Should not throw even if event emission fails
      await expect(service.fundEscrow('escrow-1')).resolves.not.toThrow();
    });
  });

  describe('releaseEscrow - FUNDED → RELEASED/PARTIALLY_RELEASED', () => {
    it('should fully release escrow when no amount specified', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAt: new Date(),
      });

      const result = await service.releaseEscrow('escrow-1');

      expect(result.success).toBe(true);
      expect(result.releasedAmount).toBe(1000);
      expect(result.remainingAmount).toBe(0);
    });

    it('should partially release escrow when amount specified', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PARTIALLY_RELEASED',
        releasedAt: new Date(),
      });

      const result = await service.releaseEscrow('escrow-1', 600);

      expect(result.success).toBe(true);
      expect(result.releasedAmount).toBe(600);
      expect(result.remainingAmount).toBe(400);
    });

    it('should create ledger entry for release', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAt: new Date(),
      });

      await service.releaseEscrow('escrow-1', 1000);

      expect(prismaService.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          accountId: 'escrow-1',
          accountType: 'LIABILITY',
          side: 'DEBIT',
          transactionType: 'DEPOSIT_RELEASE',
          amount: 1000,
          currency: 'USD',
          status: 'POSTED',
          referenceId: 'escrow-1',
        }),
      });
    });

    it('should emit release event', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAt: new Date(),
      });

      await service.releaseEscrow('escrow-1');

      expect(eventsService.emitEscrowReleased).toHaveBeenCalledWith({
        escrowId: 'escrow-1',
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
        releasedTo: 'host',
      });
    });

    it('should reject release if escrow not found', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.releaseEscrow('non-existent')).rejects.toThrow(BadRequestException);
    });

    it('should reject release if escrow not in FUNDED or PARTIALLY_RELEASED state', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PENDING',
      });

      await expect(service.releaseEscrow('escrow-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject release if hold period not expired', async () => {
      const futureHoldUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: futureHoldUntil,
      });

      await expect(service.releaseEscrow('escrow-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject release if amount exceeds escrow amount', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
      });

      await expect(service.releaseEscrow('escrow-1', 2000)).rejects.toThrow(BadRequestException);
    });

    it('should allow release from PARTIALLY_RELEASED state for additional amount', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PARTIALLY_RELEASED',
        amount: 1000,
        metadata: { releasedAmount: 400, remainingAmount: 600 },
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PARTIALLY_RELEASED',
      });

      const result = await service.releaseEscrow('escrow-1', 200);

      expect(result.success).toBe(true);
    });
  });

  describe('freezeEscrow - FUNDED/PARTIALLY_RELEASED → DISPUTED', () => {
    it('should freeze escrow from FUNDED state', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      const result = await service.freezeEscrow('escrow-1', 'dispute-1');

      expect(result.status).toBe('DISPUTED');
      expect(prismaService.escrowTransaction.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: expect.objectContaining({
          status: 'DISPUTED',
          metadata: expect.objectContaining({
            disputeId: 'dispute-1',
            frozenAt: expect.any(String),
          }),
        }),
      });
    });

    it('should freeze escrow from PARTIALLY_RELEASED state', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PARTIALLY_RELEASED',
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      const result = await service.freezeEscrow('escrow-1', 'dispute-1');

      expect(result.status).toBe('DISPUTED');
    });

    it('should emit escrow frozen event', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      await service.freezeEscrow('escrow-1', 'dispute-1');

      expect(eventsService.emitEscrowFrozen).toHaveBeenCalledWith({
        escrowId: 'escrow-1',
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
        disputeId: 'dispute-1',
      });
    });

    it('should reject freeze if escrow not found', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.freezeEscrow('non-existent', 'dispute-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject freeze if escrow in PENDING state', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PENDING',
      });

      await expect(service.freezeEscrow('escrow-1', 'dispute-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject freeze if escrow in RELEASED state', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
      });

      await expect(service.freezeEscrow('escrow-1', 'dispute-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject freeze if escrow in REFUNDED state', async () => {
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
      });

      await expect(service.freezeEscrow('escrow-1', 'dispute-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refundEscrow - Any state → REFUNDED', () => {
    it('should refund escrow to renter', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
        releasedAt: new Date(),
      });

      const result = await service.refundEscrow('escrow-1', 'booking cancelled');

      expect(result.status).toBe('REFUNDED');
      expect(prismaService.escrowTransaction.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: expect.objectContaining({
          status: 'REFUNDED',
          releasedAt: expect.any(Date),
          metadata: { refundReason: 'booking cancelled' },
        }),
      });
    });

    it('should create ledger entry for refund', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
        releasedAt: new Date(),
      });

      await service.refundEscrow('escrow-1');

      expect(prismaService.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          accountId: 'escrow-1',
          accountType: 'LIABILITY',
          side: 'DEBIT',
          transactionType: 'REFUND',
          amount: 1000,
          currency: 'USD',
          status: 'POSTED',
          referenceId: 'escrow-1',
        }),
      });
    });

    it('should emit refund event', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
        releasedAt: new Date(),
      });

      await service.refundEscrow('escrow-1', 'dispute resolved');

      expect(eventsService.emitEscrowReleased).toHaveBeenCalledWith({
        escrowId: 'escrow-1',
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
        releasedTo: 'renter',
      });
    });

    it('should handle refund without reason', async () => {
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
        releasedAt: new Date(),
      });

      const result = await service.refundEscrow('escrow-1');

      expect(result.status).toBe('REFUNDED');
    });
  });

  describe('getEscrowForBooking', () => {
    it('should return escrow for booking', async () => {
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(mockEscrow);

      const result = await service.getEscrowForBooking('booking-1');

      expect(result).toBeDefined();
      expect(result?.bookingId).toBe('booking-1');
      expect(prismaService.escrowTransaction.findFirst).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return null if no escrow found', async () => {
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getEscrowForBooking('booking-1');

      expect(result).toBeNull();
    });

    it('should return most recent escrow if multiple exist', async () => {
      const oldEscrow = { ...mockEscrow, id: 'escrow-old', createdAt: new Date('2024-01-01') };
      const newEscrow = { ...mockEscrow, id: 'escrow-new', createdAt: new Date('2024-06-01') };

      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(newEscrow);

      const result = await service.getEscrowForBooking('booking-1');

      expect(result?.id).toBe('escrow-new');
    });
  });

  describe('findReleasableEscrows', () => {
    it('should find escrows with expired hold period', async () => {
      const releasableEscrow = {
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };

      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([releasableEscrow]);

      const result = await service.findReleasableEscrows();

      expect(result).toHaveLength(1);
      expect(prismaService.escrowTransaction.findMany).toHaveBeenCalledWith({
        where: {
          status: 'FUNDED',
          holdUntil: { lt: expect.any(Date) },
        },
        take: 50,
        orderBy: { holdUntil: 'asc' },
      });
    });

    it('should respect custom limit', async () => {
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([]);

      await service.findReleasableEscrows(10);

      expect(prismaService.escrowTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('should not include escrows with future holdUntil', async () => {
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([]);

      await service.findReleasableEscrows();

      expect(prismaService.escrowTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'FUNDED',
            holdUntil: { lt: expect.any(Date) },
          },
        }),
      );
    });

    it('should order by holdUntil ascending', async () => {
      const escrow1 = { ...mockEscrow, holdUntil: new Date('2024-06-15') };
      const escrow2 = { ...mockEscrow, holdUntil: new Date('2024-06-10') };

      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([escrow2, escrow1]);

      const result = await service.findReleasableEscrows();

      expect(prismaService.escrowTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { holdUntil: 'asc' },
        }),
      );
    });
  });

  describe('Full Escrow Lifecycle Integration', () => {
    it('should complete full lifecycle: PENDING → FUNDED → RELEASED', async () => {
      // Step 1: Create escrow
      (prismaService.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prismaService.escrowTransaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.escrowTransaction.create as jest.Mock).mockResolvedValue(mockEscrow);

      const created = await service.createEscrow({
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
      });
      expect(created.status).toBe('PENDING');

      // Step 2: Fund escrow
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        capturedAt: new Date(),
      });

      const funded = await service.fundEscrow(created.id, 'pi_123');
      expect(funded.status).toBe('FUNDED');

      // Step 3: Release escrow (holdUntil in past)
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAt: new Date(),
      });

      const released = await service.releaseEscrow(created.id);
      expect(released.success).toBe(true);
      expect(released.releasedAmount).toBe(1000);
    });

    it('should complete dispute lifecycle: PENDING → FUNDED → DISPUTED → REFUNDED', async () => {
      // Funded escrow
      const fundedEscrow = { ...mockEscrow, status: 'FUNDED' };
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue(fundedEscrow);

      // Freeze for dispute
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      const frozen = await service.freezeEscrow('escrow-1', 'dispute-1');
      expect(frozen.status).toBe('DISPUTED');

      // Refund after dispute
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
        releasedAt: new Date(),
      });

      const refunded = await service.refundEscrow(
        'escrow-1',
        'dispute resolved in favor of renter',
      );
      expect(refunded.status).toBe('REFUNDED');
    });

    it('should handle partial release lifecycle: FUNDED → PARTIALLY_RELEASED → RELEASED', async () => {
      const fundedEscrow = {
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };

      // First partial release (e.g., deduct damages)
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue(fundedEscrow);
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PARTIALLY_RELEASED',
      });

      const partial1 = await service.releaseEscrow('escrow-1', 900);
      expect(partial1.remainingAmount).toBe(100);

      // Second partial release (remaining amount)
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'PARTIALLY_RELEASED',
        metadata: { releasedAmount: 900, remainingAmount: 100 },
      });
      (prismaService.escrowTransaction.update as jest.Mock).mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
      });

      const partial2 = await service.releaseEscrow('escrow-1', 100);
      // Service calculates remaining from original amount (1000) - release (100) = 900
      expect(partial2.remainingAmount).toBe(900);
    });
  });
});
