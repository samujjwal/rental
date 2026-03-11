/**
 * Dispute Escalation Service
 *
 * Manages automatic and manual escalation of disputes through levels:
 * PEER → SUPPORT → MEDIATOR → SENIOR_MEDIATOR → LEGAL → EXECUTIVE
 *
 * Features:
 * - SLA-based auto-escalation (configurable per dispute type)
 * - Mediator assignment (round-robin among available mediators)
 * - Escalation deadline tracking
 * - Event-driven notifications on escalation
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { CacheService } from '@/common/cache/cache.service';
import { DisputeEscalation } from '@rental-portal/database';

export type EscalationLevel =
  | 'PEER'
  | 'SUPPORT'
  | 'MEDIATOR'
  | 'SENIOR_MEDIATOR'
  | 'LEGAL'
  | 'EXECUTIVE';

const ESCALATION_ORDER: EscalationLevel[] = [
  'PEER',
  'SUPPORT',
  'MEDIATOR',
  'SENIOR_MEDIATOR',
  'LEGAL',
  'EXECUTIVE',
];

/** SLA hours per escalation level before auto-escalation */
const DEFAULT_SLA_HOURS: Record<EscalationLevel, number> = {
  PEER: 48,           // 2 days for peer resolution
  SUPPORT: 24,        // 1 day for support review
  MEDIATOR: 72,       // 3 days for mediation
  SENIOR_MEDIATOR: 48,// 2 days for senior review
  LEGAL: 168,         // 7 days for legal review
  EXECUTIVE: 0,       // No auto-escalation from executive
};

export interface EscalationResult {
  escalationId: string;
  disputeId: string;
  level: EscalationLevel;
  previousLevel: EscalationLevel | null;
  assignedTo: string | null;
  deadline: Date | null;
}

@Injectable()
export class DisputeEscalationService {
  private readonly logger = new Logger(DisputeEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Escalate a dispute to the next level.
   */
  async escalateDispute(
    disputeId: string,
    reason: string,
    escalatedBy?: string,
  ): Promise<EscalationResult> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        escalations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!dispute) {
      throw new BadRequestException(`Dispute ${disputeId} not found`);
    }

    const currentEscalation = dispute.escalations[0];
    const currentLevel = (currentEscalation?.toLevel as EscalationLevel) || 'PEER';
    const currentIndex = ESCALATION_ORDER.indexOf(currentLevel);

    if (currentIndex >= ESCALATION_ORDER.length - 1) {
      throw new BadRequestException(`Dispute ${disputeId} is already at maximum escalation level`);
    }

    const nextLevel = ESCALATION_ORDER[currentIndex + 1];
    const slaHours = DEFAULT_SLA_HOURS[nextLevel];
    const deadline = slaHours > 0
      ? new Date(Date.now() + slaHours * 60 * 60 * 1000)
      : null;

    // Assign mediator for MEDIATOR+ levels
    const assignedTo = nextLevel === 'MEDIATOR' || nextLevel === 'SENIOR_MEDIATOR'
      ? await this.assignMediator(nextLevel)
      : null;

    const escalation: DisputeEscalation = (await this.prisma.$transaction(async (tx: any) => {
      const esc = await tx.disputeEscalation.create({
        data: {
          disputeId,
          fromLevel: currentLevel,
          toLevel: nextLevel,
          reason,
          escalatedBy,
          assignedTo,
          deadline,
          metadata: {},
        },
      });

      // Update dispute status
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: nextLevel === 'LEGAL' || nextLevel === 'EXECUTIVE'
            ? 'INVESTIGATING'
            : 'UNDER_REVIEW',
        },
      });

      return esc;
    })) as unknown as DisputeEscalation;

    // Emit escalation event
    this.events.emitDisputeEscalated({
      disputeId,
      bookingId: dispute.bookingId,
      fromLevel: currentLevel,
      toLevel: nextLevel,
      assignedTo,
      reason,
    });

    this.logger.log(
      `Dispute ${disputeId} escalated: ${currentLevel} → ${nextLevel}` +
      (assignedTo ? ` (assigned to ${assignedTo})` : ''),
    );

    return {
      escalationId: escalation.id,
      disputeId,
      level: nextLevel,
      previousLevel: currentLevel,
      assignedTo,
      deadline,
    };
  }

  /**
   * Find disputes that have exceeded their SLA deadline and auto-escalate.
   * Intended to be called from a scheduled job (e.g., every 15 minutes).
   */
  async processAutoEscalations(): Promise<number> {
    const now = new Date();

    // Find escalations past their deadline
    const overdueEscalations = await this.prisma.disputeEscalation.findMany({
      where: {
        deadline: { lt: now },
        resolvedAt: null,
        toLevel: { not: 'EXECUTIVE' }, // Can't escalate beyond executive
      },
      include: {
        dispute: { select: { id: true, status: true } },
      },
      take: 50,
    });

    let escalated = 0;
    for (const esc of overdueEscalations) {
      // Skip if dispute is already resolved
      if (['RESOLVED', 'CLOSED', 'DISMISSED'].includes(esc.dispute.status)) {
        await this.prisma.disputeEscalation.update({
          where: { id: esc.id },
          data: { resolvedAt: now },
        });
        continue;
      }

      try {
        // Mark current escalation as resolved (timed out)
        await this.prisma.disputeEscalation.update({
          where: { id: esc.id },
          data: {
            resolvedAt: now,
            metadata: { ...(esc.metadata as object || {}), autoEscalated: true },
          },
        });

        await this.escalateDispute(
          esc.dispute.id,
          `Auto-escalated: SLA deadline exceeded at ${esc.toLevel} level`,
          'system',
        );
        escalated++;
      } catch (error) {
        this.logger.error(
          `Failed to auto-escalate dispute ${esc.dispute.id}: ${error}`,
        );
      }
    }

    if (escalated > 0) {
      this.logger.log(`Auto-escalated ${escalated} disputes`);
    }
    return escalated;
  }

  /**
   * Get escalation history for a dispute.
   */
  async getEscalationHistory(disputeId: string) {
    return this.prisma.disputeEscalation.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get the current escalation level of a dispute.
   */
  async getCurrentLevel(disputeId: string): Promise<EscalationLevel> {
    const latest = await this.prisma.disputeEscalation.findFirst({
      where: { disputeId },
      orderBy: { createdAt: 'desc' },
    });
    return (latest?.toLevel as EscalationLevel) || 'PEER';
  }

  /**
   * Resolve an escalation (dispute resolved at this level).
   */
  async resolveEscalation(
    disputeId: string,
    resolution: string,
    resolvedBy: string,
  ): Promise<void> {
    const latest = await this.prisma.disputeEscalation.findFirst({
      where: { disputeId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      await this.prisma.disputeEscalation.update({
        where: { id: latest.id },
        data: {
          resolvedAt: new Date(),
          metadata: {
            ...(latest.metadata as object || {}),
            resolution,
            resolvedBy,
          },
        },
      });
    }
  }

  /**
   * Round-robin mediator assignment.
   */
  private async assignMediator(level: EscalationLevel): Promise<string | null> {
    const role = level === 'SENIOR_MEDIATOR' ? 'ADMIN' : 'ADMIN';

    // Find admins with fewest active dispute assignments
    const admins = await this.prisma.user.findMany({
      where: {
        role,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        _count: {
          select: {
            // Count unresolved escalations assigned to this admin
            disputesAssigned: { where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'INVESTIGATING'] } } },
          },
        },
      },
      orderBy: {
        disputesAssigned: { _count: 'asc' },
      },
      take: 1,
    });

    if (admins.length === 0) {
      this.logger.warn(`No available mediators found for ${level} level`);
      return null;
    }

    return admins[0].id;
  }
}
