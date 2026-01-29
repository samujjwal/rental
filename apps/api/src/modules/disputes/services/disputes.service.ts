import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '@/common/email/email.service';
import { Dispute, DisputeStatus, UserRole } from '@rental-portal/database';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
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
      throw new NotFoundException('Booking not found');
    }

    // Verify authorization (renter or owner)
    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to create dispute for this booking');
    }

    // Check if there's already an active dispute
    const activeDispute = booking.disputes.find(
      (d) =>
        d.status === DisputeStatus.OPEN ||
        d.status === DisputeStatus.UNDER_REVIEW ||
        d.status === DisputeStatus.INVESTIGATING,
    );

    if (activeDispute) {
      throw new BadRequestException('An active dispute already exists for this booking');
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
        `New Dispute Created: ${title}`,
        `<p>A dispute has been opened for booking #${booking.id}. ${description}. Please log in to view details.</p>`,
      );
    }

    // Notify Admin (hardcoded or configured email)
    // await this.emailService.sendEmail('admin@rentals.com', 'New Dispute Created', ...);

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
      throw new NotFoundException('Dispute not found');
    }

    // Verify authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isAdmin = user?.role === UserRole.ADMIN;
    const isParty = dispute.initiatorId === userId || dispute.defendantId === userId;

    if (!isAdmin && !isParty) {
      throw new ForbiddenException('Not authorized to view this dispute');
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
      throw new NotFoundException('Dispute not found');
    }

    // Verify authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isAdmin = user?.role === UserRole.ADMIN;
    const isParty = dispute.initiatorId === userId || dispute.defendantId === userId;

    if (!isAdmin && !isParty) {
      throw new ForbiddenException('Not authorized to respond to this dispute');
    }

    // Create response
    const disputeResponse = await this.prisma.disputeResponse.create({
      data: {
        disputeId,
        userId, // Use the authenticated user's ID
        content: response.message,
        type: 'statement', // Default type
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
      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.UNDER_REVIEW },
      });
    }

    // TODO: Send notification to other parties

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

    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update dispute status');
    }

    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const updateData: any = {};

    if (dto.status) updateData.status = dto.status;
    // Note: resolution is a relation, not a string field - use adminNotes for text notes
    if (dto.resolvedAmount !== undefined) updateData.amount = dto.resolvedAmount;
    if (dto.adminNotes) {
      // Store admin notes in description or create a DisputeTimelineEvent
      updateData.description = `${dispute.description}\n\n[Admin Note]: ${dto.adminNotes}`;
    }

    // If resolving dispute
    if (dto.status && ['RESOLVED', 'CLOSED'].includes(dto.status)) {
      updateData.assignedTo = userId;
      updateData.resolvedAt = new Date();
    }

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });
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
      throw new NotFoundException('Dispute not found');
    }

    // Can be closed by initiator or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isAdmin = user?.role === UserRole.ADMIN;
    const isInitiator = dispute.initiatorId === userId;

    if (!isAdmin && !isInitiator) {
      throw new ForbiddenException('Not authorized to close this dispute');
    }

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.CLOSED,
        description: `${dispute.description}\n\n[Closed]: ${reason}`,
        assignedTo: userId,
        resolvedAt: new Date(),
      },
    });
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

    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    const { status, reason, page = 1, limit = 20 } = options;

    const where: any = {};
    if (status) where.status = status;
    // Note: 'reason' parameter is for display - the schema uses 'type'
    // if (reason) where.type = reason;

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
   * Get dispute statistics (admin only)
   */
  async getDisputeStats(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
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
