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
  });
});
