import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { ClaimStatus, NotificationType, toNumber } from '@rental-portal/database';
import { CreateClaimDto } from '../dto/insurance.dto';

export interface ReviewClaimDto {
  status: 'APPROVED' | 'REJECTED';
  approvedAmount?: number;
  rejectionReason?: string;
  notes?: string;
}

@Injectable()
export class InsuranceClaimsService {
  private readonly logger = new Logger(InsuranceClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Generate a unique claim number: CLM-YYYYMMDD-XXXX
   */
  private generateClaimNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CLM-${dateStr}-${random}`;
  }

  /**
   * File a new insurance claim
   */
  async fileClaim(userId: string, dto: CreateClaimDto) {
    // Validate policy exists and belongs to user
    const policy = await this.prisma.insurancePolicy.findUnique({
      where: { id: dto.policyId },
      include: { property: true },
    });

    if (!policy) {
      throw new NotFoundException('Insurance policy not found');
    }

    if (policy.userId !== userId) {
      throw new ForbiddenException('You can only file claims on your own policies');
    }

    // Validate policy is active
    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot file claim on inactive policy');
    }

    // Validate policy hasn't expired
    if (policy.endDate && new Date(policy.endDate) < new Date()) {
      throw new BadRequestException('Cannot file claim on expired policy');
    }

    // Validate incident date falls within policy period
    const incidentDate = new Date(dto.incidentDate);
    if (policy.startDate && incidentDate < new Date(policy.startDate)) {
      throw new BadRequestException('Incident date is before policy effective date');
    }
    if (policy.endDate && incidentDate > new Date(policy.endDate)) {
      throw new BadRequestException('Incident date is after policy expiration date');
    }

    // Validate claim amount doesn't exceed coverage
    const coverageAmount = toNumber(policy.coverageAmount);
    if (dto.claimAmount > coverageAmount) {
      throw new BadRequestException(
        `Claim amount (${dto.claimAmount}) exceeds policy coverage (${coverageAmount})`,
      );
    }

    // Validate booking if provided
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
    }

    const claim = await this.prisma.insuranceClaim.create({
      data: {
        policyId: dto.policyId,
        bookingId: dto.bookingId,
        propertyId: policy.propertyId,
        claimNumber: this.generateClaimNumber(),
        claimAmount: dto.claimAmount,
        description: dto.description,
        incidentDate,
        status: ClaimStatus.PENDING,
        documents: dto.documents || [],
        notes: dto.notes,
        submittedAt: new Date(),
      },
      include: {
        policy: true,
        booking: true,
      },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'INSURANCE_CLAIM_FILED',
        entityType: 'InsuranceClaim',
        entityId: claim.id,
        metadata: JSON.stringify({
          claimNumber: claim.claimNumber,
          claimAmount: dto.claimAmount,
          policyId: dto.policyId,
        }),
      },
    });

    // Notify admins about new claim
    this.notificationsService
      .sendNotification({
        userId: 'admin', // Admin notification channel
        type: NotificationType.SYSTEM_UPDATE,
        title: 'New Insurance Claim Filed',
        message: `Claim ${claim.claimNumber} filed for amount ${dto.claimAmount}`,
        data: { claimId: claim.id, claimNumber: claim.claimNumber },
        channels: ['IN_APP'],
      })
      .catch((err) => this.logger.warn('Failed to notify admin about claim', err));

    this.logger.log(`Claim ${claim.claimNumber} filed by user ${userId}`);
    return claim;
  }

  /**
   * Get a claim by ID
   */
  async getClaim(claimId: string, userId?: string) {
    const claim = await this.prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: {
        policy: { include: { property: true } },
        booking: true,
      },
    });

    if (!claim) {
      throw new NotFoundException('Insurance claim not found');
    }

    // Non-admin users can only see their own claims
    if (userId && claim.policy.userId !== userId) {
      throw new ForbiddenException('You can only view your own claims');
    }

    return claim;
  }

  /**
   * List claims for a user
   */
  async getUserClaims(userId: string, status?: ClaimStatus) {
    return this.prisma.insuranceClaim.findMany({
      where: {
        policy: { userId: userId },
        ...(status && { status }),
      },
      include: {
        policy: { select: { policyNumber: true, provider: true, coverageAmount: true } },
        booking: { select: { id: true, startDate: true, endDate: true, status: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * List all claims (admin)
   */
  async getAllClaims(status?: ClaimStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [claims, total] = await Promise.all([
      this.prisma.insuranceClaim.findMany({
        where: status ? { status } : undefined,
        include: {
          policy: { include: { property: { select: { title: true } } } },
          booking: { select: { id: true, startDate: true, endDate: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.insuranceClaim.count({
        where: status ? { status } : undefined,
      }),
    ]);

    return { claims, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Admin review: approve or reject a claim
   */
  async reviewClaim(claimId: string, adminId: string, dto: ReviewClaimDto) {
    const claim = await this.prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: { policy: true },
    });

    if (!claim) {
      throw new NotFoundException('Insurance claim not found');
    }

    if (claim.status !== ClaimStatus.PENDING) {
      throw new BadRequestException(`Cannot review claim in ${claim.status} status`);
    }

    if (dto.status === 'APPROVED') {
      const approvedAmount = dto.approvedAmount ?? toNumber(claim.claimAmount);
      const coverageAmount = toNumber(claim.policy.coverageAmount);
      if (approvedAmount > coverageAmount) {
        throw new BadRequestException('Approved amount exceeds policy coverage');
      }

      const updated = await this.prisma.insuranceClaim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.APPROVED,
          approvedAmount,
          notes: dto.notes,
          reviewedAt: new Date(),
        },
      });

      // Notify claimant
      await this.notificationsService.sendNotification({
        userId: claim.policy.userId,
        type: NotificationType.SYSTEM_UPDATE,
        title: 'Insurance Claim Approved',
        message: `Your claim ${claim.claimNumber} has been approved for ${approvedAmount}`,
        data: { claimId: claim.id, approvedAmount },
        channels: ['EMAIL', 'IN_APP'],
      });

      this.logger.log(`Claim ${claim.claimNumber} approved by admin ${adminId}, amount: ${approvedAmount}`);
      return updated;
    } else {
      if (!dto.rejectionReason) {
        throw new BadRequestException('Rejection reason is required');
      }

      const updated = await this.prisma.insuranceClaim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.REJECTED,
          rejectionReason: dto.rejectionReason,
          notes: dto.notes,
          reviewedAt: new Date(),
        },
      });

      // Notify claimant
      await this.notificationsService.sendNotification({
        userId: claim.policy.userId,
        type: NotificationType.SYSTEM_UPDATE,
        title: 'Insurance Claim Rejected',
        message: `Your claim ${claim.claimNumber} has been rejected: ${dto.rejectionReason}`,
        data: { claimId: claim.id, reason: dto.rejectionReason },
        channels: ['EMAIL', 'IN_APP'],
      });

      this.logger.log(`Claim ${claim.claimNumber} rejected by admin ${adminId}`);
      return updated;
    }
  }

  /**
   * Process payout for an approved claim
   */
  async processPayout(claimId: string, adminId: string) {
    const claim = await this.prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: { policy: true },
    });

    if (!claim) {
      throw new NotFoundException('Insurance claim not found');
    }

    if (claim.status !== ClaimStatus.APPROVED) {
      throw new BadRequestException('Only approved claims can be processed for payout');
    }

    // Move to PROCESSING
    await this.prisma.insuranceClaim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.PROCESSING },
    });

    // Mark as PAID (in a real system, this would integrate with payment processor)
    const updated = await this.prisma.insuranceClaim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.PAID },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'INSURANCE_CLAIM_PAID',
        entityType: 'InsuranceClaim',
        entityId: claim.id,
        metadata: JSON.stringify({
          claimNumber: claim.claimNumber,
          approvedAmount: toNumber(claim.approvedAmount),
        }),
      },
    });

    // Notify owner
    await this.notificationsService.sendNotification({
      userId: claim.policy.userId,
      type: NotificationType.SYSTEM_UPDATE,
      title: 'Insurance Claim Paid',
      message: `Payout for claim ${claim.claimNumber} has been processed`,
      data: { claimId: claim.id },
      channels: ['EMAIL', 'IN_APP', 'PUSH'],
    });

    this.logger.log(`Claim ${claim.claimNumber} paid, processed by admin ${adminId}`);
    return updated;
  }

  /**
   * Cancel a pending claim (by the claimant)
   */
  async cancelClaim(claimId: string, userId: string) {
    const claim = await this.prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: { policy: true },
    });

    if (!claim) {
      throw new NotFoundException('Insurance claim not found');
    }

    if (claim.policy.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own claims');
    }

    if (claim.status !== ClaimStatus.PENDING) {
      throw new BadRequestException('Only pending claims can be cancelled');
    }

    return this.prisma.insuranceClaim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.CANCELLED },
    });
  }

  /**
   * Get claim statistics (admin dashboard)
   */
  async getClaimStats() {
    const [statusCounts, totalAmount, avgProcessingTime] = await Promise.all([
      this.prisma.insuranceClaim.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.insuranceClaim.aggregate({
        where: { status: ClaimStatus.PAID },
        _sum: { approvedAmount: true },
      }),
      this.prisma.insuranceClaim.aggregate({
        where: {
          status: { in: [ClaimStatus.APPROVED, ClaimStatus.PAID] },
          reviewedAt: { not: null },
        },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count.id]),
      ),
      totalPaidAmount: totalAmount._sum.approvedAmount
        ? toNumber(totalAmount._sum.approvedAmount)
        : 0,
      totalReviewedClaims: avgProcessingTime._count.id,
    };
  }
}
