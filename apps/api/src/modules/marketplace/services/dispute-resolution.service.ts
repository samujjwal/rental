import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentOrchestrationService } from '../sub-modules/marketplace-operations.index';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DisputeResolutionService {
  private readonly logger = new Logger(DisputeResolutionService.name);

  private readonly slaConfig = {
    initialResponse: 24 * 60 * 60 * 1000,    // 24h
    evidenceCollection: 72 * 60 * 60 * 1000,  // 72h
    mediationExpiry: 7 * 24 * 60 * 60 * 1000,  // 7d
    autoEscalation: 14 * 24 * 60 * 60 * 1000, // 14d
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => PaymentOrchestrationService))
    private readonly paymentService: PaymentOrchestrationService,
  ) {}

  async fileDispute(params: {
    bookingId: string;
    claimantId: string;
    respondentId: string;
    category: string;
    description: string;
    evidence?: string[];
    amount?: number;
  }) {
    const dispute = await this.prisma.dispute.create({
      data: {
        bookingId: params.bookingId,
        initiatorId: params.claimantId,
        defendantId: params.respondentId,
        title: params.description.substring(0, 100),
        type: params.category as any,
        description: params.description,
        amount: params.amount,
        status: 'OPEN',
      },
    });

    await this.prisma.disputeTimelineEvent.create({
      data: {
        disputeId: dispute.id,
        event: 'DISPUTE_FILED',
        details: JSON.stringify({ actor: params.claimantId }),
      },
    });

    if (params.evidence?.length) {
      for (const url of params.evidence) {
        await this.prisma.disputeEvidence.create({
          data: { disputeId: dispute.id, type: 'ATTACHMENT', url, uploadedBy: params.claimantId },
        });
      }
    }

    this.eventEmitter.emit('dispute.filed', {
      disputeId: dispute.id,
      bookingId: params.bookingId,
      claimantId: params.claimantId,
      respondentId: params.respondentId,
      category: params.category,
    });

    // ── Automatic escrow freeze on dispute filing ──
    try {
      await this.paymentService.freezeEscrow(
        params.bookingId,
        `Dispute filed: ${params.category} - ${dispute.id}`,
      );
      this.logger.log(`Escrow frozen for booking ${params.bookingId} due to dispute ${dispute.id}`);
    } catch (error) {
      this.logger.warn(`Failed to freeze escrow for booking ${params.bookingId}: ${error.message}`);
    }

    return { ...dispute, status: 'FILED' as any, category: params.category, metadata: { stage: 'FILED' } };
  }

  async submitEvidence(disputeId: string, userId: string, evidence: {
    type: string;
    description: string;
    urls?: string[];
  }) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new Error(`Dispute not found: ${disputeId}`);

    if (evidence.urls?.length) {
      for (const url of evidence.urls) {
        await this.prisma.disputeEvidence.create({
          data: { disputeId, type: evidence.type, url, caption: evidence.description, uploadedBy: userId },
        });
      }
    }

    await this.prisma.disputeTimelineEvent.create({
      data: { disputeId, event: 'EVIDENCE_SUBMITTED', details: JSON.stringify({ actor: userId }) },
    });

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'UNDER_REVIEW' },
    });
  }

  async analyzeDispute(disputeId: string): Promise<{
    recommendation: string;
    confidence: number;
    suggestedCompensation: number;
    reasoning: string;
  }> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { booking: true },
    });
    if (!dispute) throw new Error(`Dispute not found: ${disputeId}`);

    const category: string = dispute.type as string;
    const amount = Number(dispute.amount || 0);

    let recommendation: string;
    let confidence: number;
    let suggestedCompensation: number;
    let reasoning: string;

    switch (category) {
      case 'PROPERTY_MISREPRESENTATION':
      case 'CONDITION_MISMATCH':
        recommendation = 'PARTIAL_REFUND';
        confidence = 0.85;
        suggestedCompensation = amount * 0.5;
        reasoning = 'Property misrepresentation warrants partial compensation.';
        break;
      case 'SAFETY_ISSUE':
      case 'RULES_VIOLATION':
        recommendation = 'FULL_REFUND';
        confidence = 0.92;
        suggestedCompensation = amount;
        reasoning = 'Safety issues warrant full refund.';
        break;
      case 'CANCELLATION_DISPUTE':
      case 'CANCELLATION':
        recommendation = 'POLICY_BASED';
        confidence = 0.88;
        suggestedCompensation = amount * 0.25;
        reasoning = 'Apply cancellation policy terms.';
        break;
      default:
        recommendation = 'MEDIATION';
        confidence = 0.6;
        suggestedCompensation = amount * 0.3;
        reasoning = `Category "${category}" requires human mediation.`;
    }

    return { recommendation, confidence, suggestedCompensation, reasoning };
  }

  async startMediation(disputeId: string, mediatorId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new Error(`Dispute not found: ${disputeId}`);

    await this.prisma.disputeTimelineEvent.create({
      data: { disputeId, event: 'MEDIATION_STARTED', details: JSON.stringify({ actor: mediatorId }) },
    });

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'UNDER_REVIEW', assignedTo: mediatorId },
    });
  }

  async resolve(disputeId: string, params: {
    resolution: string;
    compensationAmount?: number;
    resolvedBy: string;
    notes?: string;
  }) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new Error(`Dispute not found: ${disputeId}`);

    await this.prisma.disputeTimelineEvent.create({
      data: {
        disputeId,
        event: 'RESOLVED',
        details: JSON.stringify({ actor: params.resolvedBy, resolution: params.resolution }),
      },
    });

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    this.eventEmitter.emit('dispute.resolved', {
      disputeId,
      resolution: params.resolution,
      compensation: params.compensationAmount,
    });

    return { ...updated, status: 'RESOLVED' as any };
  }

  async getDisputesWithSla(status?: string, limit: number = 50) {
    const disputes = await this.prisma.dispute.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        booking: { select: { id: true, listingId: true } },
        timelineEvents: { orderBy: { createdAt: 'asc' } },
      },
    });

    return disputes.map((d: any) => {
      const filedAt = d.createdAt;
      const elapsed = Date.now() - filedAt.getTime();
      const slaDeadline = new Date(filedAt.getTime() + this.slaConfig.initialResponse);
      const lastEvent = d.timelineEvents?.[d.timelineEvents.length - 1];
      const stage = lastEvent?.event || 'FILED';

      return {
        ...d,
        sla: { elapsed, stage, breached: Date.now() > slaDeadline.getTime(), deadline: slaDeadline },
      };
    });
  }

  /**
   * Resolve dispute with financial settlement.
   * Releases or redistributes escrow funds based on resolution.
   */
  async resolveWithSettlement(disputeId: string, params: {
    resolution: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_REFUND' | 'SPLIT';
    compensationAmount?: number;
    resolvedBy: string;
    notes?: string;
  }) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { booking: true },
    });
    if (!dispute) throw new Error(`Dispute not found: ${disputeId}`);

    // Execute financial settlement based on resolution
    const bookingId = dispute.bookingId;
    if (bookingId && params.resolution !== 'NO_REFUND') {
      try {
        const amount = params.compensationAmount || Number(dispute.amount || 0);
        if (amount > 0) {
          // Find the booking's payment transaction
          const ledgerEntries = await this.prisma.ledgerEntry.findMany({
            where: { bookingId, side: 'DEBIT' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          });

          if (ledgerEntries.length > 0 && ledgerEntries[0].referenceId) {
            const txId = ledgerEntries[0].referenceId;
            const provider = ledgerEntries[0].metadata ? JSON.parse(ledgerEntries[0].metadata as string)?.provider : null;
            if (provider) {
              await this.paymentService.refund(txId, amount, provider, `Dispute ${disputeId}: ${params.resolution}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Settlement refund failed for dispute ${disputeId}: ${error.message}`);
      }
    }

    // Update dispute status
    await this.prisma.disputeTimelineEvent.create({
      data: {
        disputeId,
        event: 'SETTLED',
        details: JSON.stringify({
          actor: params.resolvedBy,
          resolution: params.resolution,
          compensation: params.compensationAmount,
        }),
      },
    });

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    this.eventEmitter.emit('dispute.settled', {
      disputeId,
      resolution: params.resolution,
      compensation: params.compensationAmount,
    });

    return { ...updated, settlement: params.resolution };
  }

  /**
   * Cron: Auto-escalate disputes that breach SLA deadlines.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async enforceSlaCron() {
    const disputes = await this.prisma.dispute.findMany({
      where: {
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
        resolvedAt: null,
      },
      include: { timelineEvents: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    let escalated = 0;
    for (const dispute of disputes) {
      const elapsed = Date.now() - dispute.createdAt.getTime();

      // Auto-escalate if past mediation expiry (7 days)
      if (elapsed > this.slaConfig.mediationExpiry && dispute.status === 'UNDER_REVIEW') {
        await this.prisma.dispute.update({
          where: { id: dispute.id },
          data: { status: 'ESCALATED' as any },
        });
        await this.prisma.disputeTimelineEvent.create({
          data: {
            disputeId: dispute.id,
            event: 'AUTO_ESCALATED',
            details: JSON.stringify({ reason: 'SLA breach - mediation expired', elapsed }),
          },
        });
        this.eventEmitter.emit('dispute.escalated', { disputeId: dispute.id, reason: 'SLA_BREACH' });
        escalated++;
      }

      // Alert if approaching initial response deadline
      if (elapsed > this.slaConfig.initialResponse && dispute.status === 'OPEN') {
        this.eventEmitter.emit('dispute.sla_warning', {
          disputeId: dispute.id,
          type: 'INITIAL_RESPONSE_OVERDUE',
          elapsed,
        });
      }
    }

    if (escalated > 0) {
      this.logger.warn(`SLA enforcement: ${escalated} disputes auto-escalated`);
    }
  }
}
