import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '@/common/email/email.service';
import { CacheService } from '@/common/cache/cache.service';
import { escapeHtml } from '@/common/utils/sanitize';
import { Dispute, DisputeStatus, UserRole, NotificationType } from '@rental-portal/database';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { BookingStateMachineService } from '@/modules/bookings/services/booking-state-machine.service';

/** Valid forward transitions for each dispute status */
const DISPUTE_VALID_TRANSITIONS: Record<string, DisputeStatus[]> = {
  [DisputeStatus.OPEN]:         [DisputeStatus.UNDER_REVIEW, DisputeStatus.WITHDRAWN, DisputeStatus.CLOSED, DisputeStatus.RESOLVED, DisputeStatus.DISMISSED],
  [DisputeStatus.UNDER_REVIEW]: [DisputeStatus.INVESTIGATING, DisputeStatus.RESOLVED, DisputeStatus.DISMISSED],
  [DisputeStatus.INVESTIGATING]:[DisputeStatus.RESOLVED, DisputeStatus.DISMISSED],
  [DisputeStatus.RESOLVED]:     [DisputeStatus.CLOSED],
  [DisputeStatus.CLOSED]:       [],
  [DisputeStatus.DISMISSED]:    [],
  [DisputeStatus.WITHDRAWN]:    [],
};

export interface CreateDisputeDto {
  bookingId: string;
  title: string;
  type:
    | 'PROPERTY_DAMAGE'
    | 'MISSING_ITEMS'
    | 'CONDITION_MISMATCH'
    | 'REFUND_REQUEST'
    | 'PAYMENT_ISSUE'
    | 'OTHER';
  description: string;
  evidence?: string[];
  amount?: number;
}

export interface UpdateDisputeDto {
  status?: DisputeStatus;
  resolution?: string;
  resolvedAmount?: number;
  adminNotes?: string;
}

export interface AddEvidenceDto {
  description: string;
  files: string[];
}

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly notificationsService: NotificationsService,
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Create a dispute
   */
  async createDispute(userId: string, dto: CreateDisputeDto): Promise<Dispute> {
    const { bookingId, title, type, description, evidence, amount } = dto;

    // Verify booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: true,
        disputes: true,
      },
    });

    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }

    // Only the renter can initiate a dispute
    if (booking.renterId !== userId) {
      throw i18nForbidden('dispute.unauthorized');
    }

    // Enforce 30-day dispute window from booking completion
    const completedAt = booking.completedAt ?? booking.endDate;
    if (completedAt) {
      const daysSinceCompletion = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCompletion > 30) {
        throw new BadRequestException('Dispute window has expired (30 days after completion)');
      }
    }

    // Check if there's already an active dispute
    const activeDispute = booking.disputes.find(
      (d) =>
        d.status === DisputeStatus.OPEN ||
        d.status === DisputeStatus.UNDER_REVIEW ||
        d.status === DisputeStatus.INVESTIGATING,
    );

    if (activeDispute) {
      throw i18nBadRequest('dispute.alreadyExists');
    }

    // Determine defendant (opposite party)
    const defendantId = userId === booking.renterId ? booking.listing.ownerId : booking.renterId;

    // Create dispute
    const dispute = await this.prisma.dispute.create({
      data: {
        bookingId,
        initiatorId: userId,
        defendantId,
        title,
        type,
        description,
        amount,
        status: DisputeStatus.OPEN,
        // Persist evidence files if provided
        ...(evidence && evidence.length > 0
          ? {
              evidence: {
                create: evidence.map((url) => ({
                  type: 'document',
                  url,
                  uploadedBy: userId,
                })),
              },
            }
          : {}),
      },
      include: {
        booking: {
          include: {
            listing: true,
            renter: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        initiator: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Send notifications
    const targetUserId = userId === booking.renterId ? booking.listing.ownerId : booking.renterId;
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true, firstName: true },
    });

    if (targetUser) {
      await this.emailService.sendEmail(
        targetUser.email,
        `New Dispute Created: ${escapeHtml(title)}`,
        `<p>A dispute has been opened for booking #${escapeHtml(booking.id)}. ${escapeHtml(description)}. Please log in to view details.</p>`,
      );
    }

    // Notify Admin (hardcoded or configured email)
    // await this.emailService.sendEmail('admin@rentals.com', 'New Dispute Created', ...);

    // Transition booking to DISPUTED state
    try {
      const role = booking.renterId === userId ? 'RENTER' : 'OWNER';
      await this.stateMachine.transition(
        booking.id,
        'INITIATE_DISPUTE',
        userId,
        role as 'RENTER' | 'OWNER',
        { disputeId: dispute.id },
      );
    } catch (err) {
      this.logger.warn(`Failed to transition booking ${booking.id} to DISPUTED`, err);
    }

    return dispute;
  }

  /**
   * Get dispute by ID
   */
  async getDispute(disputeId: string, userId: string): Promise<any> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            listing: {
              include: {
                owner: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            renter: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        initiator: {
          select: {
            id: true,
            email: true,
          },
        },
        defendant: {
          select: {
            id: true,
            email: true,
          },
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!dispute) {
      throw i18nNotFound('dispute.notFound');
    }

    // Verify authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const adminRoles = [UserRole.ADMIN, 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'] as string[];
    const isAdmin = adminRoles.includes(user?.role as string);
    const isParty = dispute.initiatorId === userId || dispute.defendantId === userId;

    if (!isAdmin && !isParty) {
      throw i18nForbidden('dispute.unauthorized');
    }

    return dispute;
  }

  /**
   * Get user's disputes
   */
  async getUserDisputes(
    userId: string,
    options: {
      status?: DisputeStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ disputes: any[]; total: number }> {
    const { status, page = 1, limit = 20 } = options;

    const where: any = {
      OR: [{ initiatorId: userId }, { defendantId: userId }],
    };

    if (status) {
      where.status = status;
    }

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          booking: {
            include: {
              listing: {
                select: {
                  id: true,
                  title: true,
                  ownerId: true,
                },
              },
              renter: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          initiator: {
            select: {
              id: true,
              email: true,
            },
          },
          defendant: {
            select: {
              id: true,
              email: true,
            },
          },
          _count: {
            select: {
              responses: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { disputes, total };
  }

  /**
   * Add response to dispute
   */
  async addResponse(
    disputeId: string,
    userId: string,
    response: { message: string; evidence?: string[] },
  ): Promise<any> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!dispute) {
      throw i18nNotFound('dispute.notFound');
    }

    // Verify authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isAdmin = user?.role === UserRole.ADMIN;
    const isParty = dispute.initiatorId === userId || dispute.defendantId === userId;

    if (!isAdmin && !isParty) {
      throw i18nForbidden('dispute.unauthorized');
    }

    // Create response and update status atomically in a transaction
    const disputeResponse = await this.prisma.$transaction(async (tx: any) => {
      const response_ = await tx.disputeResponse.create({
        data: {
          disputeId,
          userId, // Use the authenticated user's ID
          content: response.message,
          type: 'statement', // Default type
          attachments: response.evidence ?? [],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      // Update dispute status if it was OPEN
      if (dispute.status === DisputeStatus.OPEN) {
        await tx.dispute.update({
          where: { id: disputeId },
          data: { status: DisputeStatus.UNDER_REVIEW },
        });
      }

      return response_;
    });

    // Send notification to the other party
    const otherPartyId = dispute.initiatorId === userId ? dispute.defendantId : dispute.initiatorId;
    if (otherPartyId) {
      await this.notificationsService.sendNotification({
        userId: otherPartyId,
        type: NotificationType.DISPUTE_UPDATED,
        title: 'New message on your dispute',
        message: `A new message has been added to dispute: ${dispute.title}`,
        channels: ['IN_APP', 'EMAIL'],
        data: { disputeId },
      }).catch(err => this.logger.error('Failed to send dispute notification', err));
    }

    return disputeResponse;
  }

  /**
   * Update dispute (admin only)
   */
  async updateDispute(disputeId: string, userId: string, dto: UpdateDisputeDto): Promise<Dispute> {
    // Verify admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const adminRoles = [UserRole.ADMIN, 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'] as string[];
    if (!user || !adminRoles.includes(user.role as string)) {
      throw i18nForbidden('dispute.adminOnly');
    }

    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { booking: { select: { currency: true } } },
    });

    if (!dispute) {
      throw i18nNotFound('dispute.notFound');
    }

    const updateData: any = {};

    if (dto.status) {
      // Enforce valid state machine transition
      const allowedNext = DISPUTE_VALID_TRANSITIONS[dispute.status] ?? [];
      if (!allowedNext.includes(dto.status)) {
        throw i18nBadRequest('dispute.invalidTransition');
      }
      updateData.status = dto.status;
    }
    // Note: resolution is a relation, not a string field - use adminNotes for text notes
    if (dto.resolvedAmount !== undefined) updateData.amount = dto.resolvedAmount;

    // If resolving dispute
    if (dto.status && ['RESOLVED', 'CLOSED'].includes(dto.status)) {
      updateData.assignedTo = userId;
      updateData.resolvedAt = new Date();
    }

    // Wrap all DB writes in a transaction
    const updated: Dispute = await this.prisma.$transaction(async (tx: any) => {
      if (dto.adminNotes) {
        // Store admin notes as a response entry instead of appending to description
        await tx.disputeResponse.create({
          data: {
            disputeId,
            userId,
            content: dto.adminNotes,
            type: 'admin_note',
            attachments: [],
          },
        });
      }

      return tx.dispute.update({
        where: { id: disputeId },
        data: updateData,
      });
    }) as any;

    // Side effects (cache publish, state transitions) run after transaction commits
    if (dto.status && ['RESOLVED', 'CLOSED'].includes(dto.status)) {
      // If there's a resolved amount, trigger deposit capture
      if (dto.resolvedAmount && dto.resolvedAmount > 0) {
        await this.cacheService.publish('booking:deposit-capture', {
          bookingId: dispute.bookingId,
          amount: dto.resolvedAmount,
          currency: (dispute as any).booking?.currency || 'USD',
          timestamp: new Date().toISOString(),
        });
      } else if (dto.status === 'CLOSED' && !dto.resolvedAmount) {
        // If closed without amount, release deposit
        await this.cacheService.publish('booking:deposit-release', {
          bookingId: dispute.bookingId,
          currency: (dispute as any).booking?.currency || 'USD',
          timestamp: new Date().toISOString(),
        });
      }

      // Determine resolution direction: if there's a resolvedAmount > 0, the renter is being
      // compensated (renter favor → REFUNDED).  Otherwise owner keeps earnings (owner favor → COMPLETED).
      const transition = (dto.resolvedAmount && dto.resolvedAmount > 0)
        ? 'RESOLVE_DISPUTE_RENTER_FAVOR' as const
        : 'RESOLVE_DISPUTE_OWNER_FAVOR' as const;

      try {
        await this.stateMachine.transition(
          dispute.bookingId,
          transition,
          userId,
          'ADMIN',
          { disputeId, resolution: dto.status },
        );
      } catch (err) {
        this.logger.warn(`Failed to transition booking ${dispute.bookingId} after dispute resolution`, err);
      }
    }

    return updated;
  }

  /**
   * Close dispute
   */
  async closeDispute(disputeId: string, userId: string, reason: string): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!dispute) {
      throw i18nNotFound('dispute.notFound');
    }

    // Can be closed by initiator or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isAdmin = user?.role === UserRole.ADMIN;
    const isInitiator = dispute.initiatorId === userId;

    if (!isAdmin && !isInitiator) {
      throw i18nForbidden('dispute.unauthorized');
    }

    // Wrap DB writes in a transaction
    const closed: Dispute = await this.prisma.$transaction(async (tx: any) => {
      // Store close reason as a response instead of corrupting the description
      await tx.disputeResponse.create({
        data: {
          disputeId,
          userId,
          content: reason,
          type: 'closure',
          attachments: [],
        },
      });

      return tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.CLOSED,
          assignedTo: userId,
          resolvedAt: new Date(),
        },
      });
    }) as unknown as Dispute;

    // Side effects run after transaction commits

    // Only release deposit if dispute is still OPEN/UNDER_REVIEW (not already resolved)
    if (['OPEN', 'UNDER_REVIEW'].includes(dispute.status as string)) {
      await this.cacheService.publish('booking:deposit-release', {
        bookingId: dispute.bookingId,
        timestamp: new Date().toISOString(),
      });
    }

    // Transition booking back from DISPUTED.
    // If the initiator (non-admin) is closing/withdrawing, the dispute is effectively
    // withdrawn — transition to COMPLETED (owner keeps earnings).
    // If an admin closes it, they decide the outcome separately via updateDispute.
    if (isInitiator && !isAdmin) {
      try {
        await this.stateMachine.transition(
          dispute.bookingId,
          'RESOLVE_DISPUTE_OWNER_FAVOR',
          userId,
          'SYSTEM',
          { disputeId, reason, withdrawnByInitiator: true },
        );
      } catch (err) {
        this.logger.warn(`Failed to transition booking ${dispute.bookingId} after dispute withdrawal`, err);
      }
    } else if (isAdmin) {
      // Admin closure without explicit resolution defaults to owner favor
      try {
        await this.stateMachine.transition(
          dispute.bookingId,
          'RESOLVE_DISPUTE_OWNER_FAVOR',
          userId,
          'ADMIN',
          { disputeId, reason },
        );
      } catch (err) {
        this.logger.warn(`Failed to transition booking ${dispute.bookingId} after admin dispute closure`, err);
      }
    }

    return closed;
  }

  /**
   * Get all disputes (admin only)
   */
  async getAllDisputes(
    userId: string,
    options: {
      status?: DisputeStatus;
      reason?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ disputes: any[]; total: number }> {
    // Verify admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const adminRolesForList = [UserRole.ADMIN, 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'] as any[];
    if (!user || !adminRolesForList.includes(user.role)) {
      throw i18nForbidden('dispute.adminRequired');
    }

    const { status, reason, page = 1, limit = 20 } = options;

    const where: any = {};
    if (status) where.status = status;
    // Filter by dispute type (passed as 'reason' in the query)
    if (reason) where.type = reason;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          booking: {
            include: {
              listing: {
                select: {
                  id: true,
                  title: true,
                  ownerId: true,
                },
              },
              renter: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          initiator: {
            select: {
              id: true,
              email: true,
            },
          },
          defendant: {
            select: {
              id: true,
              email: true,
            },
          },
          _count: {
            select: {
              responses: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { disputes, total };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Evidence
  // ──────────────────────────────────────────────────────────────────────────

  async addEvidence(disputeId: string, userId: string, dto: { type: string; url: string; description?: string }) {
    return this.prisma.disputeEvidence.create({
      data: {
        disputeId,
        type: dto.type,
        url: dto.url,
        caption: dto.description,
        uploadedBy: userId,
      },
    });
  }

  async listEvidence(disputeId: string) {
    return this.prisma.disputeEvidence.findMany({ where: { disputeId } });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Messages (stored as DisputeResponse with type = 'message')
  // ──────────────────────────────────────────────────────────────────────────

  async sendMessage(disputeId: string, senderId: string, dto: { content: string; type?: string }) {
    const record = await this.prisma.disputeResponse.create({
      data: {
        disputeId,
        userId: senderId,
        content: dto.content,
        type: 'message',
        attachments: [],
      },
    });
    return { ...record, senderId: record.userId };
  }

  async getMessages(disputeId: string) {
    const records = await this.prisma.disputeResponse.findMany({
      where: { disputeId, type: 'message' },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => ({ ...r, senderId: r.userId }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Payout
  // ──────────────────────────────────────────────────────────────────────────

  async processDisputePayout(disputeId: string, _userId: string, dto: { amount: number; currency: string; method?: string }) {
    return {
      disputeId,
      amount: dto.amount,
      currency: dto.currency,
      method: dto.method,
      status: 'PROCESSING',
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin operations (assign / resolve / reject)
  // ──────────────────────────────────────────────────────────────────────────

  async assignDispute(disputeId: string, adminId: string) {
    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { assignedTo: adminId },
    });
    return { ...updated, assignedToId: updated.assignedTo };
  }

  async resolveDisputeAdmin(
    disputeId: string,
    adminId: string,
    dto: { decision: string; refundAmount?: number; reason?: string; notes?: string },
  ) {
    const allowedNext = DISPUTE_VALID_TRANSITIONS[DisputeStatus.OPEN] ?? [];
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const updated = await this.prisma.$transaction(async (tx: any) => {
      await tx.disputeResolution.upsert({
        where: { disputeId },
        create: {
          disputeId,
          type: dto.decision as any,
          outcome: dto.reason ?? 'Admin resolution',
          amount: dto.refundAmount,
          details: dto.notes,
          resolvedBy: adminId,
        },
        update: {
          type: dto.decision as any,
          outcome: dto.reason ?? 'Admin resolution',
          amount: dto.refundAmount,
          details: dto.notes,
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });
      return tx.dispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.RESOLVED, resolvedAt: new Date(), assignedTo: adminId },
        include: { resolution: true },
      });
    });
    return {
      ...updated,
      decision: dto.decision,
      refundAmount: dto.refundAmount,
    };
  }

  async rejectDispute(disputeId: string, _adminId: string, dto: { reason?: string; notes?: string }) {
    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.DISMISSED },
    });
    return { ...updated };
  }

  /**
   * Get dispute statistics (admin only)
   */
  async getDisputeStats(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const adminRolesForStats = [UserRole.ADMIN, 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'] as any[];
    if (!user || !adminRolesForStats.includes(user.role)) {
      throw i18nForbidden('dispute.adminRequired');
    }

    const [total, open, underReview, resolved, closed] = await Promise.all([
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.UNDER_REVIEW } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.CLOSED } }),
    ]);

    return {
      total,
      byStatus: {
        open,
        underReview,
        resolved,
        closed,
      },
    };
  }
}
