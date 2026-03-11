import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole, DisputeStatus } from '@rental-portal/database';

/**
 * Extracted from admin.service.ts — handles content moderation
 * (reviews, messages, disputes) and real finance queries (refunds, payouts, ledger).
 */
@Injectable()
export class AdminContentService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nForbidden('auth.userNotFound');
    }

    const adminRoles: string[] = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.OPERATIONS_ADMIN,
      UserRole.FINANCE_ADMIN,
      UserRole.SUPPORT_ADMIN,
    ];

    if (!adminRoles.includes(user.role)) {
      throw i18nForbidden('admin.accessRequired');
    }
  }

  // =================================================================================================
  // ===================================  CONTENT MANAGEMENT  ========================================
  // =================================================================================================

  async getReviews(
    adminId: string,
    params: { page?: number; limit?: number; status?: string; search?: string },
  ): Promise<any> {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { listing: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
          },
          listing: { select: { id: true, title: true, photos: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateReviewStatus(adminId: string, reviewId: string, status: any): Promise<any> {
    await this.verifyAdmin(adminId);
    const old = await this.prisma.review.findUnique({ where: { id: reviewId }, select: { status: true } });
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_REVIEW_STATUS_UPDATED',
        entityType: 'Review',
        entityId: reviewId,
        oldValues: JSON.stringify({ status: old?.status }),
        newValues: JSON.stringify({ status }),
      },
    });

    return updated;
  }

  async getMessages(adminId: string, params: { page?: number; limit?: number }) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
              },
            },
          },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
          booking: { include: { listing: { select: { title: true } } } },
        },
      }),
      this.prisma.conversation.count(),
    ]);

    return {
      conversations: conversations.map((c: any) => ({
        id: c.id,
        participants: c.participants.map((p: any) => `${p.user.firstName} ${p.user.lastName}`),
        lastMessage: c.messages[0]?.content || '',
        sentAt: c.lastMessageAt || c.createdAt,
        listing: c.booking?.listing?.title || 'General Inquiry',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =================================================================================================
  // ===================================  FINANCE & LEDGER  ==========================================
  // =================================================================================================

  async getRefunds(adminId: string, params: { page?: number; limit?: number; status?: string }): Promise<any> {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      refunds: refunds.map((r) => ({
        id: r.id,
        bookingRef: r.bookingId.substring(0, 8).toUpperCase(),
        amount: r.amount,
        user: 'Unknown User',
        reason: r.reason,
        status: r.status.toLowerCase(),
        date: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPayouts(adminId: string, params: { page?: number; limit?: number; status?: string }): Promise<any> {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payout.count({ where }),
    ]);

    const ownerIds = [...new Set(payouts.map((p) => p.ownerId))];
    const owners = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const ownerMap = new Map(owners.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return {
      payouts: payouts.map((p) => ({
        id: p.id,
        host: ownerMap.get(p.ownerId) || 'Unknown Host',
        amount: p.amount,
        status: p.status.toLowerCase(),
        scheduledDate: p.createdAt,
        processedDate: p.processedAt,
        method: 'stripe_transfer',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLedger(adminId: string, params: { page?: number; limit?: number }): Promise<any> {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ledgerEntry.count(),
    ]);

    return {
      transactions: entries.map((e) => ({
        id: e.id,
        type: e.side.toLowerCase(),
        amount: e.amount,
        description: e.description,
        reference: e.referenceId || e.bookingId,
        date: e.createdAt,
        balanceAfter: 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =================================================================================================
  // ===================================  MODERATION & DISPUTES  =====================================
  // =================================================================================================

  async getDisputes(adminId: string, params: { page?: number; limit?: number; status?: string }) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              listing: { select: { title: true } },
            },
          },
          initiator: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          defendant: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      disputes: disputes.map((d) => ({
        id: d.id,
        type: d.type,
        status: d.status,
        priority: d.priority,
        reason: d.title || d.description,
        amount: d.amount ? Number(d.amount) : null,
        description: d.description,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        booking: d.booking,
        initiator: d.initiator,
        defendant: d.defendant,
      })),
      total,
      page,
      limit,
    };
  }

  async updateDisputeStatus(adminId: string, disputeId: string, status: DisputeStatus): Promise<any> {
    await this.verifyAdmin(adminId);
    const old = await this.prisma.dispute.findUnique({ where: { id: disputeId }, select: { status: true } });
    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_DISPUTE_STATUS_UPDATED',
        entityType: 'Dispute',
        entityId: disputeId,
        oldValues: JSON.stringify({ status: old?.status }),
        newValues: JSON.stringify({ status }),
      },
    });

    return updated;
  }

  async updateRefundStatus(adminId: string, refundId: string, status: any): Promise<any> {
    await this.verifyAdmin(adminId);
    const old = await this.prisma.refund.findUnique({ where: { id: refundId }, select: { status: true } });
    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_REFUND_STATUS_UPDATED',
        entityType: 'Refund',
        entityId: refundId,
        oldValues: JSON.stringify({ status: old?.status }),
        newValues: JSON.stringify({ status }),
      },
    });

    return updated;
  }
}
