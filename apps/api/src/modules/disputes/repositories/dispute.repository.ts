import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * DisputeRepository
 * 
 * Repository for dispute data operations.
 * Provides a consistent interface for dispute-related database operations.
 */
@Injectable()
export class DisputeRepository {
  private readonly logger = new Logger(DisputeRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new dispute
   */
  async create(disputeData: Prisma.DisputeCreateArgs['data']) {
    return this.prisma.dispute.create({
      data: disputeData,
    });
  }

  /**
   * Find dispute by ID
   */
  async findById(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        evidence: true,
        responses: true,
        resolution: true,
        escalations: true,
        timelineEvents: true,
        booking: {
          include: {
            renter: true,
            listing: {
              include: {
                owner: true,
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    return dispute;
  }

  /**
   * Update dispute
   */
  async update(disputeId: string, updateData: Prisma.DisputeUpdateArgs['data']) {
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });
  }

  /**
   * Find disputes by booking
   */
  async findByBooking(bookingId: string) {
    return this.prisma.dispute.findMany({
      where: { bookingId },
      include: {
        evidence: true,
        responses: true,
      },
    });
  }

  /**
   * Find disputes by user
   */
  async findByUser(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { initiatorId: userId },
          { defendantId: userId },
        ],
      },
      include: {
        evidence: true,
        responses: true,
      },
    });
  }

  /**
   * Find disputes by status
   */
  async findByStatus(status: string) {
    return this.prisma.dispute.findMany({
      where: { status: status as any },
      include: {
        evidence: true,
        responses: true,
      },
    });
  }

  /**
   * Add evidence to dispute
   */
  async addEvidence(evidenceData: Prisma.DisputeEvidenceCreateArgs['data']) {
    return this.prisma.disputeEvidence.create({
      data: evidenceData,
    });
  }

  /**
   * Find evidence for a dispute
   */
  async findEvidenceByDispute(disputeId: string) {
    return this.prisma.disputeEvidence.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Add response to dispute
   */
  async addResponse(responseData: Prisma.DisputeResponseCreateArgs['data']) {
    return this.prisma.disputeResponse.create({
      data: responseData,
    });
  }

  /**
   * Find responses for a dispute
   */
  async findResponsesByDispute(disputeId: string) {
    return this.prisma.disputeResponse.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create dispute resolution
   */
  async createResolution(resolutionData: Prisma.DisputeResolutionCreateArgs['data']) {
    return this.prisma.disputeResolution.create({
      data: resolutionData,
    });
  }

  /**
   * Find resolution for a dispute
   */
  async findResolutionByDispute(disputeId: string) {
    return this.prisma.disputeResolution.findUnique({
      where: { disputeId },
    });
  }

  /**
   * Create timeline event
   */
  async addTimelineEvent(timelineData: Prisma.DisputeTimelineEventCreateArgs['data']) {
    return this.prisma.disputeTimelineEvent.create({
      data: timelineData,
    });
  }

  /**
   * Find timeline events for a dispute
   */
  async findTimelineEventsByDispute(disputeId: string) {
    return this.prisma.disputeTimelineEvent.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create escalation
   */
  async createEscalation(escalationData: Prisma.DisputeEscalationCreateArgs['data']) {
    return this.prisma.disputeEscalation.create({
      data: escalationData,
    });
  }

  /**
   * Find escalations for a dispute
   */
  async findEscalationsByDispute(disputeId: string) {
    return this.prisma.disputeEscalation.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get dispute statistics
   */
  async getDisputeStats() {
    const disputes = await this.prisma.dispute.findMany({
      select: {
        status: true,
        type: true,
        priority: true,
        createdAt: true,
      },
    });

    const byStatus = disputes.reduce((acc, dispute) => {
      acc[dispute.status] = (acc[dispute.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = disputes.reduce((acc, dispute) => {
      acc[dispute.type] = (acc[dispute.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPriority = disputes.reduce((acc, dispute) => {
      acc[dispute.priority] = (acc[dispute.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: disputes.length,
      byStatus,
      byType,
      byPriority,
    };
  }

  /**
   * Find disputes needing attention
   */
  async findDisputesNeedingAttention() {
    return this.prisma.dispute.findMany({
      where: {
        status: {
          in: ['OPEN', 'UNDER_REVIEW', 'INVESTIGATING'],
        },
      },
      include: {
        evidence: true,
        responses: true,
        booking: {
          include: {
            renter: true,
            listing: {
              include: {
                owner: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
