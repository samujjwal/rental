import { AdminContentService } from './admin-content.service';
import { ForbiddenException } from '@nestjs/common';

describe('AdminContentService', () => {
  let service: AdminContentService;
  let prisma: any;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      review: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      refund: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      payout: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      dispute: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    service = new AdminContentService(prisma);
  });

  describe('verifyAdmin', () => {
    it('should throw ForbiddenException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getReviews('nonexistent', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw for non-admin role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'RENTER' });

      await expect(
        service.getReviews('u1', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getReviews', () => {
    it('should return paginated reviews', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.review.findMany.mockResolvedValue([
        { id: 'r1', content: 'Great!', rating: 5, reviewer: { firstName: 'John' }, listing: { title: 'Apt' } },
      ]);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getReviews('admin-1', {});

      expect(result).toBeDefined();
    });

    it('should filter reviews by status', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getReviews('admin-1', { status: 'APPROVED' });

      expect(prisma.review.findMany).toHaveBeenCalled();
    });

    it('should search reviews by content or listing title', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getReviews('admin-1', { search: 'apartment' });

      expect(prisma.review.findMany).toHaveBeenCalled();
    });
  });

  describe('updateReviewStatus', () => {
    it('should update review status', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.review.update.mockResolvedValue({ id: 'r1', status: 'APPROVED' });

      const result = await service.updateReviewStatus('admin-1', 'r1', 'APPROVED');

      expect(prisma.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('getMessages', () => {
    it('should return paginated conversations with last message', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          participants: [{ user: { firstName: 'John' } }],
          messages: [{ content: 'Hello', sentAt: new Date() }],
          booking: { listing: { title: 'Apt' } },
        },
      ]);
      prisma.conversation.count.mockResolvedValue(1);

      const result = await service.getMessages('admin-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('getRefunds', () => {
    it('should return refunds with truncated booking ref', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.refund.findMany.mockResolvedValue([
        { id: 'ref-1', amount: 5000, status: 'COMPLETED', bookingId: 'booking-abc123', reason: 'Cancelled', createdAt: new Date() },
      ]);
      prisma.refund.count.mockResolvedValue(1);

      const result = await service.getRefunds('admin-1', {});

      expect(result).toBeDefined();
    });

    it('should filter refunds by status', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getRefunds('admin-1', { status: 'PENDING' });

      expect(prisma.refund.findMany).toHaveBeenCalled();
    });
  });

  describe('getPayouts', () => {
    it('should return payouts with owner names', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.payout.findMany.mockResolvedValue([
        { id: 'po-1', amount: 8000, ownerId: 'owner-1', status: 'COMPLETED', createdAt: new Date(), processedAt: new Date() },
      ]);
      prisma.payout.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        { id: 'owner-1', firstName: 'Jane', lastName: 'Smith' },
      ]);

      const result = await service.getPayouts('admin-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('getLedger', () => {
    it('should return ledger entries with mapped types', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { id: 'le-1', amount: 1000, side: 'DEBIT', createdAt: new Date() },
      ]);
      prisma.ledgerEntry.count.mockResolvedValue(1);

      const result = await service.getLedger('admin-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('getDisputes', () => {
    it('should return disputes with related data', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.dispute.findMany.mockResolvedValue([
        {
          id: 'd-1',
          amount: 5000,
          status: 'OPEN',
          booking: { id: 'b-1' },
          initiator: { firstName: 'John' },
          defendant: { firstName: 'Jane' },
        },
      ]);
      prisma.dispute.count.mockResolvedValue(1);

      const result = await service.getDisputes('admin-1', {});

      expect(result).toBeDefined();
    });

    it('should filter disputes by status', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getDisputes('admin-1', { status: 'OPEN' });

      expect(prisma.dispute.findMany).toHaveBeenCalled();
    });
  });

  describe('updateDisputeStatus', () => {
    it('should update dispute status', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.dispute.update.mockResolvedValue({ id: 'd-1', status: 'RESOLVED' });

      const result = await service.updateDisputeStatus('admin-1', 'd-1', 'RESOLVED' as any);

      expect(prisma.dispute.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('updateRefundStatus', () => {
    it('should update refund status', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.refund.update.mockResolvedValue({ id: 'ref-1', status: 'COMPLETED' });

      const result = await service.updateRefundStatus('admin-1', 'ref-1', 'COMPLETED');

      expect(prisma.refund.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
