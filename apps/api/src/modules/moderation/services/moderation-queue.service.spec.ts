import { Test, TestingModule } from '@nestjs/testing';
import { ModerationQueueService } from './moderation-queue.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('ModerationQueueService', () => {
  let service: ModerationQueueService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationQueueService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              create: jest.fn().mockResolvedValue({}),
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn(),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ModerationQueueService);
    prisma = module.get(PrismaService);
  });

  describe('addToQueue', () => {
    it('creates an audit log entry with correct metadata', async () => {
      await service.addToQueue({
        entityType: 'LISTING',
        entityId: 'listing-1',
        flags: [{ type: 'SPAM', confidence: 0.9 }] as any,
        priority: 'HIGH',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MODERATION_QUEUE_ADD',
          entityType: 'LISTING',
          entityId: 'listing-1',
          metadata: expect.stringContaining('"priority":"HIGH"'),
        }),
      });

      const metadataStr = (prisma.auditLog.create as jest.Mock).mock.calls[0][0].data.metadata;
      const metadata = JSON.parse(metadataStr);
      expect(metadata.status).toBe('PENDING');
      expect(metadata.flags).toHaveLength(1);
    });
  });

  describe('getQueue', () => {
    const makeItem = (id: string, meta: any) => ({
      id,
      entityType: 'LISTING',
      entityId: `listing-${id}`,
      metadata: JSON.stringify(meta),
      createdAt: new Date(),
    });

    it('returns empty array when no items', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getQueue();
      expect(result).toEqual([]);
    });

    it('returns all items without filters', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        makeItem('1', { status: 'PENDING', priority: 'HIGH', flags: [] }),
        makeItem('2', { status: 'APPROVED', priority: 'LOW', flags: [] }),
      ]);

      const result = await service.getQueue();
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('PENDING');
      expect(result[1].status).toBe('APPROVED');
    });

    it('filters by status', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        makeItem('1', { status: 'PENDING', priority: 'HIGH', flags: [] }),
        makeItem('2', { status: 'APPROVED', priority: 'LOW', flags: [] }),
      ]);

      const result = await service.getQueue({ status: 'PENDING' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });

    it('filters by priority', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        makeItem('1', { status: 'PENDING', priority: 'HIGH', flags: [] }),
        makeItem('2', { status: 'PENDING', priority: 'LOW', flags: [] }),
      ]);

      const result = await service.getQueue({ priority: 'HIGH' });
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('HIGH');
    });

    it('handles malformed metadata gracefully', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { id: '1', entityType: 'LISTING', entityId: 'l-1', metadata: 'invalid-json', createdAt: new Date() },
      ]);

      const result = await service.getQueue();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING'); // fallback
      expect(result[0].priority).toBe('LOW'); // fallback
    });
  });

  describe('resolveItem', () => {
    it('throws error when queue item not found', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resolveItem('nonexistent', 'APPROVED', 'admin-1'),
      ).rejects.toThrow('Queue item not found');
    });

    it('updates metadata with decision and creates resolution log', async () => {
      const queueItem = {
        id: 'log-1',
        entityType: 'LISTING',
        entityId: 'listing-1',
        metadata: JSON.stringify({ status: 'PENDING', priority: 'HIGH' }),
      };
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(queueItem);

      await service.resolveItem('listing-1', 'APPROVED', 'admin-1', 'Looks good');

      // Verify update call
      expect(prisma.auditLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          metadata: expect.any(String),
        },
      });

      const updatedMeta = JSON.parse(
        (prisma.auditLog.update as jest.Mock).mock.calls[0][0].data.metadata,
      );
      expect(updatedMeta.status).toBe('APPROVED');
      expect(updatedMeta.resolvedBy).toBe('admin-1');
      expect(updatedMeta.notes).toBe('Looks good');
      expect(updatedMeta.resolvedAt).toBeDefined();

      // Verify resolution log created
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MODERATION_APPROVED',
          entityType: 'LISTING',
          entityId: 'listing-1',
          userId: 'admin-1',
        }),
      });
    });

    it('creates REJECTED resolution log when rejected', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        id: 'log-2',
        entityType: 'REVIEW',
        entityId: 'review-1',
        metadata: JSON.stringify({ status: 'PENDING' }),
      });

      await service.resolveItem('review-1', 'REJECTED', 'admin-2', 'Inappropriate');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MODERATION_REJECTED',
        }),
      });
    });
  });

  describe('getQueueStats', () => {
    it('returns correct stats', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { metadata: JSON.stringify({ status: 'PENDING', priority: 'HIGH' }) },
        { metadata: JSON.stringify({ status: 'PENDING', priority: 'MEDIUM' }) },
        { metadata: JSON.stringify({ status: 'PENDING', priority: 'LOW' }) },
        { metadata: JSON.stringify({ status: 'APPROVED', priority: 'HIGH' }) },
        { metadata: JSON.stringify({ status: 'REJECTED', priority: 'LOW' }) },
      ]);

      const stats = await service.getQueueStats();
      expect(stats.pending).toBe(3);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.byPriority).toEqual({ high: 1, medium: 1, low: 1 });
    });

    it('returns zeros when queue is empty', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await service.getQueueStats();
      expect(stats).toEqual({
        pending: 0,
        approved: 0,
        rejected: 0,
        byPriority: { high: 0, medium: 0, low: 0 },
      });
    });
  });
});
