import { Test, TestingModule } from '@nestjs/testing';
import { EscrowService } from './escrow.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { CacheService } from '@/common/cache/cache.service';
import { BadRequestException } from '@nestjs/common';

describe('EscrowService', () => {
  let module: TestingModule;
  let service: EscrowService;
  let prisma: any;
  let events: any;
  let cache: any;

  const mockBooking = {
    id: 'booking-1',
    startDate: new Date('2025-08-01'),
    endDate: new Date('2025-08-05'),
    renterId: 'user-1',
    listing: { ownerId: 'user-2' },
  };

  const mockEscrow = {
    id: 'escrow-1',
    bookingId: 'booking-1',
    amount: 50000,
    currency: 'NPR',
    status: 'PENDING',
    holdUntil: new Date('2025-08-07'),
    releasedAt: null,
    capturedAt: null,
    externalId: null,
    releaseCondition: 'checkout_confirmed',
    providerId: null,
    metadata: {},
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) =>
        callback({
          escrowTransaction: prisma.escrowTransaction,
          ledgerEntry: prisma.ledgerEntry,
        }),
      ),
      booking: { findUnique: jest.fn() },
      escrowTransaction: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
    };

    events = {
      emitEscrowFunded: jest.fn(),
      emitEscrowReleased: jest.fn(),
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    module = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: events },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEscrow', () => {
    it('should create an escrow for a valid booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.escrowTransaction.findFirst.mockResolvedValue(null);
      prisma.escrowTransaction.create.mockResolvedValue(mockEscrow);

      const result = await service.createEscrow({
        bookingId: 'booking-1',
        amount: 50000,
        currency: 'NPR',
      });

      expect(result.bookingId).toBe('booking-1');
      expect(result.amount).toBe(50000);
      expect(result.status).toBe('PENDING');
      expect(prisma.escrowTransaction.create).toHaveBeenCalled();
    });

    it('should throw if booking not found', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.createEscrow({ bookingId: 'bad-id', amount: 100, currency: 'NPR' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if active escrow already exists', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.escrowTransaction.findFirst.mockResolvedValue(mockEscrow);

      await expect(
        service.createEscrow({ bookingId: 'booking-1', amount: 100, currency: 'NPR' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('fundEscrow', () => {
    it('should transition escrow to FUNDED and emit event', async () => {
      const funded = { ...mockEscrow, status: 'FUNDED', capturedAt: new Date() };
      prisma.escrowTransaction.update.mockResolvedValue(funded);

      const result = await service.fundEscrow('escrow-1', 'stripe-pi-123');

      expect(result.status).toBe('FUNDED');
      expect(events.emitEscrowFunded).toHaveBeenCalledWith(
        expect.objectContaining({ escrowId: 'escrow-1', amount: 50000 }),
      );
    });

    it('should succeed even if event emission fails', async () => {
      const funded = { ...mockEscrow, status: 'FUNDED', capturedAt: new Date() };
      prisma.escrowTransaction.update.mockResolvedValue(funded);
      events.emitEscrowFunded.mockRejectedValueOnce(new Error('Event bus down'));

      const result = await service.fundEscrow('escrow-1', 'stripe-pi-123');

      expect(result.status).toBe('FUNDED');
      // Event failed but operation succeeded
    });
  });

  describe('releaseEscrow', () => {
    it('should fully release a funded escrow', async () => {
      const funded = { ...mockEscrow, status: 'FUNDED', holdUntil: new Date('2020-01-01') };
      prisma.escrowTransaction.findUnique.mockResolvedValue(funded);
      prisma.escrowTransaction.update.mockResolvedValue({ ...funded, status: 'RELEASED' });

      const result = await service.releaseEscrow('escrow-1');

      expect(result.success).toBe(true);
      expect(result.releasedAmount).toBe(50000);
      expect(result.remainingAmount).toBe(0);
    });

    it('should partially release an escrow', async () => {
      const funded = { ...mockEscrow, status: 'FUNDED', holdUntil: new Date('2020-01-01') };
      prisma.escrowTransaction.findUnique.mockResolvedValue(funded);
      prisma.escrowTransaction.update.mockResolvedValue({ ...funded, status: 'PARTIALLY_RELEASED' });

      const result = await service.releaseEscrow('escrow-1', 30000);

      expect(result.releasedAmount).toBe(30000);
      expect(result.remainingAmount).toBe(20000);
    });

    it('should throw if hold period not expired', async () => {
      const funded = {
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date(Date.now() + 86400000),
      };
      prisma.escrowTransaction.findUnique.mockResolvedValue(funded);

      await expect(service.releaseEscrow('escrow-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if escrow not in releasable state', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
      });

      await expect(service.releaseEscrow('escrow-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('freezeEscrow', () => {
    it('should freeze escrow for dispute', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
      });
      prisma.escrowTransaction.update.mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      const result = await service.freezeEscrow('escrow-1', 'dispute-1');
      expect(result.status).toBe('DISPUTED');
    });
  });

  describe('refundEscrow', () => {
    it('should refund and emit event', async () => {
      prisma.escrowTransaction.update.mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
        releasedAt: new Date(),
      });

      const result = await service.refundEscrow('escrow-1', 'Guest cancelled');
      expect(result.status).toBe('REFUNDED');
      expect(events.emitEscrowReleased).toHaveBeenCalledWith(
        expect.objectContaining({ releasedTo: 'renter' }),
      );
    });

    it('should succeed even if event emission fails', async () => {
      prisma.escrowTransaction.update.mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
        releasedAt: new Date(),
      });
      events.emitEscrowReleased.mockRejectedValueOnce(new Error('Event bus down'));

      const result = await service.refundEscrow('escrow-1', 'Guest cancelled');
      expect(result.status).toBe('REFUNDED');
    });
  });

  describe('findReleasableEscrows', () => {
    it('should find escrows past their hold date', async () => {
      prisma.escrowTransaction.findMany.mockResolvedValue([
        { ...mockEscrow, status: 'FUNDED', holdUntil: new Date('2020-01-01') },
      ]);

      const results = await service.findReleasableEscrows();
      expect(results).toHaveLength(1);
    });

    it('should respect custom limit', async () => {
      prisma.escrowTransaction.findMany.mockResolvedValue([]);
      await service.findReleasableEscrows(10);
      expect(prisma.escrowTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('should order by holdUntil ascending', async () => {
      prisma.escrowTransaction.findMany.mockResolvedValue([]);
      await service.findReleasableEscrows();
      expect(prisma.escrowTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { holdUntil: 'asc' } }),
      );
    });
  });

  describe('fundEscrow — ledger and event assertions', () => {
    it('should create LIABILITY ledger entry when funding', async () => {
      const funded = { ...mockEscrow, status: 'FUNDED', capturedAt: new Date() };
      prisma.escrowTransaction.update.mockResolvedValue(funded);
      await service.fundEscrow('escrow-1');
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          accountId: 'escrow-1',
          accountType: 'LIABILITY',
          side: 'CREDIT',
          transactionType: 'DEPOSIT_HOLD',
          amount: 50000,
          status: 'POSTED',
        }),
      });
    });

    it('should emit escrow funded event with correct payload', async () => {
      const funded = { ...mockEscrow, status: 'FUNDED', capturedAt: new Date() };
      prisma.escrowTransaction.update.mockResolvedValue(funded);
      await service.fundEscrow('escrow-1', 'pi_stripe_123');
      expect(events.emitEscrowFunded).toHaveBeenCalledWith(
        expect.objectContaining({ escrowId: 'escrow-1', bookingId: 'booking-1', amount: 50000 }),
      );
    });
  });

  describe('releaseEscrow — edge cases', () => {
    it('should throw if escrow not found', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue(null);
      await expect(service.releaseEscrow('non-existent')).rejects.toThrow(BadRequestException);
    });

    it('should throw if amount exceeds escrow amount', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date('2020-01-01'),
      });
      await expect(service.releaseEscrow('escrow-1', 999999)).rejects.toThrow(BadRequestException);
    });

    it('should create DEBIT ledger entry on release', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        holdUntil: new Date('2020-01-01'),
      });
      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'RELEASED' });
      await service.releaseEscrow('escrow-1', 50000);
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          side: 'DEBIT',
          transactionType: 'DEPOSIT_RELEASE',
          amount: 50000,
        }),
      });
    });
  });

  describe('freezeEscrow — state guards', () => {
    it('should freeze from PARTIALLY_RELEASED state', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'PARTIALLY_RELEASED',
      });
      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'DISPUTED' });
      const result = await service.freezeEscrow('escrow-1', 'dispute-1');
      expect(result.status).toBe('DISPUTED');
    });

    it('should throw if escrow not found', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue(null);
      await expect(service.freezeEscrow('bad-id', 'dispute-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if escrow in PENDING state', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({ ...mockEscrow, status: 'PENDING' });
      await expect(service.freezeEscrow('escrow-1', 'dispute-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if escrow in RELEASED state', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({ ...mockEscrow, status: 'RELEASED' });
      await expect(service.freezeEscrow('escrow-1', 'dispute-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if escrow in REFUNDED state', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({ ...mockEscrow, status: 'REFUNDED' });
      await expect(service.freezeEscrow('escrow-1', 'dispute-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundEscrow — ledger and event assertions', () => {
    it('should create DEBIT REFUND ledger entry', async () => {
      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'REFUNDED', releasedAt: new Date() });
      await service.refundEscrow('escrow-1');
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          side: 'DEBIT',
          transactionType: 'REFUND',
          amount: 50000,
        }),
      });
    });

    it('should emit release event with releasedTo=renter', async () => {
      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'REFUNDED', releasedAt: new Date() });
      await service.refundEscrow('escrow-1', 'dispute resolved');
      expect(events.emitEscrowReleased).toHaveBeenCalledWith(
        expect.objectContaining({ releasedTo: 'renter' }),
      );
    });

    it('should succeed without reason argument', async () => {
      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'REFUNDED', releasedAt: new Date() });
      const result = await service.refundEscrow('escrow-1');
      expect(result.status).toBe('REFUNDED');
    });
  });

  describe('getEscrowForBooking', () => {
    it('should return most recent escrow ordered by createdAt desc', async () => {
      const newest = { ...mockEscrow, id: 'escrow-new', createdAt: new Date('2025-06-01') };
      prisma.escrowTransaction.findFirst.mockResolvedValue(newest);
      const result = await service.getEscrowForBooking('booking-1');
      expect(result?.id).toBe('escrow-new');
      expect(prisma.escrowTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should return null when no escrow exists', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue(null);
      const result = await service.getEscrowForBooking('booking-1');
      expect(result).toBeNull();
    });
  });

  describe('Full Escrow Lifecycle', () => {
    it('PENDING → FUNDED → RELEASED', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.escrowTransaction.findFirst.mockResolvedValue(null);
      prisma.escrowTransaction.create.mockResolvedValue(mockEscrow);
      const created = await service.createEscrow({ bookingId: 'booking-1', amount: 50000, currency: 'NPR' });
      expect(created.status).toBe('PENDING');

      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'FUNDED', capturedAt: new Date() });
      const funded = await service.fundEscrow(created.id, 'pi_123');
      expect(funded.status).toBe('FUNDED');

      prisma.escrowTransaction.findUnique.mockResolvedValue({ ...mockEscrow, status: 'FUNDED', holdUntil: new Date('2020-01-01') });
      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'RELEASED', releasedAt: new Date() });
      const released = await service.releaseEscrow(created.id);
      expect(released.success).toBe(true);
      expect(released.releasedAmount).toBe(50000);
    });

    it('FUNDED → DISPUTED → REFUNDED', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({ ...mockEscrow, status: 'FUNDED' });
      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'DISPUTED' });
      const frozen = await service.freezeEscrow('escrow-1', 'dispute-1');
      expect(frozen.status).toBe('DISPUTED');

      prisma.escrowTransaction.update.mockResolvedValue({ ...mockEscrow, status: 'REFUNDED', releasedAt: new Date() });
      const refunded = await service.refundEscrow('escrow-1', 'dispute resolved');
      expect(refunded.status).toBe('REFUNDED');
    });
  });
});
