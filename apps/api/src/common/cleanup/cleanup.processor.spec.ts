import { Test, TestingModule } from '@nestjs/testing';
import { CleanupProcessor } from './cleanup.processor';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('CleanupProcessor', () => {
  let processor: CleanupProcessor;
  let prisma: any;

  const mockPrismaService = {
    session: {
      deleteMany: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
    depositHold: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    bookingStateHistory: {
      create: jest.fn(),
    },
    payment: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    platformMetric: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    processor = module.get<CleanupProcessor>(CleanupProcessor);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  const makeJob = (data: any = {}): any => ({ data });

  describe('expire-sessions', () => {
    it('should delete expired sessions', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 5 });

      const result = await processor.handleExpireSessions(makeJob());

      expect(result).toEqual({ deleted: 5 });
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('should return 0 when no expired sessions', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 0 });

      const result = await processor.handleExpireSessions(makeJob());

      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe('cleanup-audit-logs', () => {
    it('should count audit logs older than default 90 days', async () => {
      mockPrismaService.auditLog.count.mockResolvedValue(42);

      const result = await processor.handleCleanupAuditLogs(makeJob({}));

      expect(result).toEqual({ archived: 42 });
      expect(mockPrismaService.auditLog.count).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      });
    });

    it('should use custom olderThanDays', async () => {
      mockPrismaService.auditLog.count.mockResolvedValue(10);

      const result = await processor.handleCleanupAuditLogs(makeJob({ olderThanDays: 30 }));

      expect(result).toEqual({ archived: 10 });
    });
  });

  describe('expire-deposits', () => {
    it('should release expired deposit holds', async () => {
      const expiredHolds = [
        { id: 'hold-1', status: 'PENDING', expiresAt: new Date('2020-01-01') },
        { id: 'hold-2', status: 'AUTHORIZED', expiresAt: new Date('2020-01-01') },
      ];
      mockPrismaService.depositHold.findMany.mockResolvedValue(expiredHolds);
      mockPrismaService.depositHold.update.mockResolvedValue({});

      const result = await processor.handleExpireDeposits(makeJob());

      expect(result).toEqual({ released: 2 });
      expect(mockPrismaService.depositHold.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.depositHold.update).toHaveBeenCalledWith({
        where: { id: 'hold-1' },
        data: { status: 'RELEASED', releasedAt: expect.any(Date) },
      });
    });

    it('should continue on individual hold release failure', async () => {
      mockPrismaService.depositHold.findMany.mockResolvedValue([
        { id: 'hold-fail', status: 'PENDING', expiresAt: new Date('2020-01-01') },
        { id: 'hold-ok', status: 'PENDING', expiresAt: new Date('2020-01-01') },
      ]);
      mockPrismaService.depositHold.update
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({});

      const result = await processor.handleExpireDeposits(makeJob());

      expect(result).toEqual({ released: 1 });
    });

    it('should return 0 when no expired holds', async () => {
      mockPrismaService.depositHold.findMany.mockResolvedValue([]);

      const result = await processor.handleExpireDeposits(makeJob());

      expect(result).toEqual({ released: 0 });
    });
  });

  describe('cleanup-stale-bookings', () => {
    it('should cancel stale DRAFT/PENDING bookings', async () => {
      const stale = [
        { id: 'bk-1', status: 'DRAFT', createdAt: new Date('2020-01-01') },
      ];
      mockPrismaService.booking.findMany.mockResolvedValue(stale);
      mockPrismaService.$transaction.mockResolvedValue(undefined);

      const result = await processor.handleCleanupStaleBookings(makeJob());

      expect(result).toEqual({ cancelled: 1 });
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should continue when a transaction fails for one booking', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        { id: 'bk-1', status: 'PENDING', createdAt: new Date('2020-01-01') },
        { id: 'bk-2', status: 'DRAFT', createdAt: new Date('2020-01-01') },
      ]);
      mockPrismaService.$transaction
        .mockRejectedValueOnce(new Error('TX error'))
        .mockResolvedValueOnce(undefined);

      const result = await processor.handleCleanupStaleBookings(makeJob());

      expect(result).toEqual({ cancelled: 1 });
    });

    it('should return 0 when no stale bookings', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await processor.handleCleanupStaleBookings(makeJob());

      expect(result).toEqual({ cancelled: 0 });
    });
  });

  describe('recalculate-metrics', () => {
    it('should create hourly metrics for bookings, payments, users', async () => {
      mockPrismaService.booking.count.mockResolvedValue(5);
      mockPrismaService.payment.count.mockResolvedValue(3);
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.platformMetric.create.mockResolvedValue({});

      const result = await processor.handleRecalculateMetrics(makeJob());

      expect(result).toEqual({ processed: 3 });
      expect(mockPrismaService.platformMetric.create).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.platformMetric.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'bookings.created',
            value: 5,
            period: 'hour',
          }),
        }),
      );
    });
  });
});
