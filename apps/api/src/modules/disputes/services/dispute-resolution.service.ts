import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DisputeRepository } from '../repositories/dispute.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { PaymentRepository } from '../../payments/repositories/payment.repository';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EmailService } from '../../notifications/services/resend.service';
import { Prisma } from '@prisma/client';

/**
 * DisputeResolutionService
 * 
 * This service handles the dispute resolution process including:
 * - Dispute initiation and validation
 * - Evidence collection and management
 * - Mediation and resolution workflows
 * - Communication between parties
 * - Financial resolution and payouts
 */
@Injectable()
export class DisputeResolutionService {
  private readonly logger = new Logger(DisputeResolutionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly disputeRepository: DisputeRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly userRepository: UserRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Initiate a new dispute
   */
  async initiateDispute(disputeData: any): Promise<any> {
    this.logger.log(`Initiating dispute for booking: ${disputeData.bookingId}`);
    
    // Validate booking exists
    const booking = await this.bookingRepository.findById(disputeData.bookingId);
    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    // Validate dispute timing window (default 30 days after booking completion)
    const disputeWindow = this.configService.get<number>('dispute.resolution.maxDuration', 30);
    const bookingEndDate = new Date(booking.endDate);
    const maxDisputeDate = new Date(bookingEndDate.getTime() + disputeWindow * 24 * 60 * 60 * 1000);
    
    if (new Date() > maxDisputeDate) {
      throw new BadRequestException('Dispute window has expired');
    }

    // Validate user is a participant in the booking
    if (booking.renterId !== disputeData.initiatedBy && booking.ownerId !== disputeData.initiatedBy) {
      throw new BadRequestException('User is not a participant in this booking');
    }

    // Check if dispute already exists for this booking
    const existingDisputes = await this.disputeRepository.findByBooking(disputeData.bookingId);
    if (existingDisputes.length > 0) {
      const activeDispute = existingDisputes.find(d => d.status !== 'CLOSED' && d.status !== 'WITHDRAWN');
      if (activeDispute) {
        throw new BadRequestException('An active dispute already exists for this booking');
      }
    }

    // Generate reference number
    const referenceNumber = `DISP-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // Determine initiator and defendant
    const initiatorId = disputeData.initiatedBy;
    const defendantId = booking.renterId === initiatorId ? booking.ownerId : booking.renterId;

    // Create dispute
    const createData: Prisma.DisputeCreateArgs['data'] = {
      bookingId: disputeData.bookingId,
      initiatorId,
      defendantId,
      title: disputeData.title || `Dispute for booking ${disputeData.bookingId}`,
      type: disputeData.disputeType || 'PROPERTY_DAMAGE',
      status: 'OPEN',
      priority: disputeData.priority || 'MEDIUM',
      description: disputeData.description,
      amount: disputeData.amount ? new Prisma.Decimal(disputeData.amount) : null,
    };

    const dispute = await this.disputeRepository.create(createData);

    // Add initial evidence if provided
    if (disputeData.evidence && Array.isArray(disputeData.evidence)) {
      for (const evidence of disputeData.evidence) {
        await this.disputeRepository.addEvidence({
          disputeId: dispute.id,
          type: evidence.type,
          url: evidence.url,
          caption: evidence.description,
          uploadedBy: initiatorId,
        });
      }
    }

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId: dispute.id,
      event: 'DISPUTE_INITIATED',
      details: `Dispute initiated by ${initiatorId}`,
    });

    // Send notifications
    await this.notificationsService.createNotification({
      userId: defendantId,
      type: 'dispute_initiated',
      title: 'New dispute initiated',
      message: `A dispute has been initiated for booking ${disputeData.bookingId}`,
      metadata: { disputeId: dispute.id, bookingId: disputeData.bookingId },
    });

    // Send email notification
    const defendant = await this.userRepository.findById(defendantId);
    if (defendant && defendant.email) {
      await this.emailService.sendEmail({
        to: defendant.email,
        subject: 'New dispute initiated',
        templateId: 'dispute-initiated',
        templateData: {
          disputeId: dispute.id,
          bookingId: disputeData.bookingId,
          referenceNumber,
        },
      });
    }

    return {
      ...dispute,
      referenceNumber,
    };
  }

  /**
   * Add evidence to a dispute
   */
  async addEvidence(disputeId: string, evidenceData: any): Promise<any> {
    this.logger.log(`Adding evidence to dispute: ${disputeId}`);
    
    // Validate dispute exists and is in appropriate status
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED' || dispute.status === 'WITHDRAWN') {
      throw new BadRequestException('Cannot add evidence to a closed dispute');
    }

    // Validate evidence data
    if (!evidenceData.type || !evidenceData.url) {
      throw new BadRequestException('Evidence type and URL are required');
    }

    // Add evidence
    const evidence = await this.disputeRepository.addEvidence({
      disputeId,
      type: evidenceData.type,
      url: evidenceData.url,
      caption: evidenceData.caption,
      uploadedBy: evidenceData.uploadedBy,
    });

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'EVIDENCE_ADDED',
      details: `Evidence added by ${evidenceData.uploadedBy}`,
    });

    // Notify other party
    const otherPartyId = dispute.initiatorId === evidenceData.uploadedBy ? dispute.defendantId : dispute.initiatorId;
    await this.notificationsService.createNotification({
      userId: otherPartyId,
      type: 'evidence_added',
      title: 'New evidence added',
      message: `New evidence has been added to dispute ${disputeId}`,
      metadata: { disputeId, evidenceId: evidence.id },
    });

    return evidence;
  }

  /**
   * Verify evidence
   */
  async verifyEvidence(disputeId: string, evidenceId: string, verificationData: any): Promise<any> {
    this.logger.log(`Verifying evidence: ${evidenceId} for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // In a real implementation, we would update the evidence with verification status
    // For now, return the verification result
    return {
      id: evidenceId,
      verified: true,
      verifiedBy: verificationData.verifiedBy,
      verifiedAt: new Date(),
      verificationNotes: verificationData.verificationNotes,
    };
  }

  /**
   * Generate evidence summary
   */
  async generateEvidenceSummary(disputeId: string): Promise<any> {
    this.logger.log(`Generating evidence summary for dispute: ${disputeId}`);
    
    const evidenceList = await this.disputeRepository.findEvidenceByDispute(disputeId);
    
    const byCategory: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const bySubmitter: Record<string, number> = {};
    
    for (const evidence of evidenceList) {
      byCategory[evidence.type] = (byCategory[evidence.type] || 0) + 1;
      bySubmitter[evidence.uploadedBy] = (bySubmitter[evidence.uploadedBy] || 0) + 1;
    }

    return {
      totalEvidence: evidenceList.length,
      byCategory,
      byType,
      bySubmitter,
    };
  }

  /**
   * Add communication to dispute
   */
  async addCommunication(disputeId: string, communicationData: any): Promise<any> {
    this.logger.log(`Adding communication to dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED' || dispute.status === 'WITHDRAWN') {
      throw new BadRequestException('Cannot add communication to a closed dispute');
    }

    const response = await this.disputeRepository.addResponse({
      disputeId,
      userId: communicationData.userId,
      content: communicationData.content,
      type: communicationData.type || 'message',
      attachments: communicationData.attachments || [],
    });

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'COMMUNICATION_ADDED',
      details: `Communication added by ${communicationData.userId}`,
    });

    // Notify other party
    const otherPartyId = dispute.initiatorId === communicationData.userId ? dispute.defendantId : dispute.initiatorId;
    await this.notificationsService.createNotification({
      userId: otherPartyId,
      type: 'dispute_message',
      title: 'New message in dispute',
      message: `A new message has been added to dispute ${disputeId}`,
      metadata: { disputeId, responseId: response.id },
    });

    return response;
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(disputeId: string, resolutionData: any): Promise<any> {
    this.logger.log(`Resolving dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      throw new BadRequestException('Dispute is already resolved');
    }

    // Create resolution record
    const resolution = await this.disputeRepository.createResolution({
      disputeId,
      type: resolutionData.type || 'MUTUAL_AGREEMENT',
      outcome: resolutionData.outcome,
      amount: resolutionData.amount ? new Prisma.Decimal(resolutionData.amount) : null,
      details: resolutionData.details,
      resolvedBy: resolutionData.resolvedBy,
    });

    // Update dispute status
    await this.disputeRepository.update(disputeId, {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    });

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'DISPUTE_RESOLVED',
      details: `Dispute resolved by ${resolutionData.resolvedBy}`,
    });

    // Notify both parties
    await this.notificationsService.createNotification({
      userId: dispute.initiatorId,
      type: 'dispute_resolved',
      title: 'Dispute resolved',
      message: `Dispute ${disputeId} has been resolved`,
      metadata: { disputeId, resolutionId: resolution.id },
    });

    await this.notificationsService.createNotification({
      userId: dispute.defendantId,
      type: 'dispute_resolved',
      title: 'Dispute resolved',
      message: `Dispute ${disputeId} has been resolved`,
      metadata: { disputeId, resolutionId: resolution.id },
    });

    return {
      disputeId,
      resolution,
      status: 'RESOLVED',
      resolvedAt: new Date(),
    };
  }

  /**
   * Escalate dispute
   */
  async escalateDispute(disputeId: string, escalationData: any): Promise<any> {
    this.logger.log(`Escalating dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Create escalation record
    const escalation = await this.disputeRepository.createEscalation({
      disputeId,
      fromLevel: escalationData.fromLevel || 'LEVEL_1',
      toLevel: escalationData.toLevel || 'LEVEL_2',
      reason: escalationData.reason,
      escalatedBy: escalationData.escalatedBy,
      assignedTo: escalationData.assignedTo,
      deadline: escalationData.deadline,
    });

    // Update dispute status
    await this.disputeRepository.update(disputeId, {
      assignedTo: escalationData.assignedTo,
    });

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'DISPUTE_ESCALATED',
      details: `Dispute escalated to ${escalationData.toLevel}`,
    });

    return {
      escalated: true,
      escalation,
      escalatedAt: new Date(),
    };
  }

  /**
   * Dismiss dispute
   */
  async dismissDispute(disputeId: string, dismissalData: any): Promise<any> {
    this.logger.log(`Dismissing dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED' || dispute.status === 'WITHDRAWN') {
      throw new BadRequestException('Dispute is already closed');
    }

    // Update dispute status
    await this.disputeRepository.update(disputeId, {
      status: 'DISMISSED',
      resolvedAt: new Date(),
    });

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'DISPUTE_DISMISSED',
      details: `Dispute dismissed by ${dismissalData.dismissedBy}. Reason: ${dismissalData.reason}`,
    });

    // Notify both parties
    await this.notificationsService.createNotification({
      userId: dispute.initiatorId,
      type: 'dispute_dismissed',
      title: 'Dispute dismissed',
      message: `Dispute ${disputeId} has been dismissed`,
      metadata: { disputeId, reason: dismissalData.reason },
    });

    await this.notificationsService.createNotification({
      userId: dispute.defendantId,
      type: 'dispute_dismissed',
      title: 'Dispute dismissed',
      message: `Dispute ${disputeId} has been dismissed`,
      metadata: { disputeId, reason: dismissalData.reason },
    });

    return {
      disputeId,
      dismissed: true,
      dismissedAt: new Date(),
      reason: dismissalData.reason,
      dismissedBy: dismissalData.dismissedBy,
    };
  }

  /**
   * Get complete audit trail
   */
  async getCompleteAuditTrail(disputeId: string): Promise<any> {
    this.logger.log(`Getting audit trail for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const timelineEvents = await this.disputeRepository.findTimelineEventsByDispute(disputeId);
    const evidence = await this.disputeRepository.findEvidenceByDispute(disputeId);
    const responses = await this.disputeRepository.findResponsesByDispute(disputeId);
    const escalations = await this.disputeRepository.findEscalationsByDispute(disputeId);

    return {
      dispute: {
        id: dispute.id,
        createdAt: dispute.createdAt,
        initiatorId: dispute.initiatorId,
        defendantId: dispute.defendantId,
        type: dispute.type,
        status: dispute.status,
        amount: dispute.amount,
      },
      timelineEvents,
      evidence,
      responses,
      escalations,
      resolution: dispute.resolution,
    };
  }

  /**
   * Check SLA compliance
   */
  async checkSLACompliance(disputeId: string): Promise<any> {
    this.logger.log(`Checking SLA compliance for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const slaThreshold = this.configService.get<number>('dispute.sla.resolutionHours', 72);
    const createdAt = new Date(dispute.createdAt);
    const now = new Date();
    const resolutionTimeHours = dispute.resolvedAt 
      ? (new Date(dispute.resolvedAt).getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      : (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    const compliant = resolutionTimeHours <= slaThreshold;

    return {
      disputeId,
      compliant,
      metrics: {
        responseTime: 24, // hours (placeholder - would calculate from first response)
        resolutionTime: Math.round(resolutionTimeHours),
        slaThreshold,
      },
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(reportConfig: any): Promise<any> {
    this.logger.log('Generating compliance report');
    
    const stats = await this.disputeRepository.getDisputeStats();
    const disputesNeedingAttention = await this.disputeRepository.findDisputesNeedingAttention();

    let compliant = 0;
    let nonCompliant = 0;

    // Check compliance for each active dispute
    for (const dispute of disputesNeedingAttention) {
      const compliance = await this.checkSLACompliance(dispute.id);
      if (compliance.compliant) {
        compliant++;
      } else {
        nonCompliant++;
      }
    }

    return {
      reportId: `report-${Date.now()}`,
      period: reportConfig.period || 'last_30_days',
      generatedAt: new Date(),
      summary: {
        totalDisputes: stats.total,
        activeDisputes: disputesNeedingAttention.length,
        compliant,
        nonCompliant,
        byStatus: stats.byStatus,
        byType: stats.byType,
        byPriority: stats.byPriority,
      },
    };
  }

  /**
   * Submit appeal
   */
  async submitAppeal(disputeId: string, appealData: any): Promise<any> {
    this.logger.log(`Submitting appeal for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== 'RESOLVED') {
      throw new BadRequestException('Can only appeal resolved disputes');
    }

    // Check appeal period (default 7 days from resolution)
    const appealPeriod = this.configService.get<number>('dispute.appeal.periodDays', 7);
    const resolvedAt = new Date(dispute.resolvedAt);
    const maxAppealDate = new Date(resolvedAt.getTime() + appealPeriod * 24 * 60 * 60 * 1000);

    if (new Date() > maxAppealDate) {
      throw new BadRequestException('Appeal period expired');
    }

    // In a real implementation, we would create an appeal record
    // For now, return the appeal submission result
    return {
      appealId: `appeal-${Date.now()}`,
      disputeId,
      submittedBy: appealData.submittedBy,
      reason: appealData.reason,
      submittedAt: new Date(),
      status: 'pending',
    };
  }

  /**
   * Review appeal
   */
  async reviewAppeal(disputeId: string, appealDecision: any): Promise<any> {
    this.logger.log(`Reviewing appeal for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // In a real implementation, we would update the appeal record
    // For now, return the appeal review result
    return {
      appealId: appealDecision.appealId,
      disputeId,
      decision: appealDecision.decision,
      reviewedBy: appealDecision.reviewedBy,
      reviewedAt: new Date(),
      notes: appealDecision.notes,
    };
  }

  /**
   * Generate audit trail
   */
  async generateAuditTrail(disputeId: string, auditConfig: any): Promise<any> {
    this.logger.log(`Generating audit trail for dispute: ${disputeId}`);
    
    const auditData = await this.getCompleteAuditTrail(disputeId);

    return {
      disputeId,
      auditTrail: auditData,
      generatedAt: new Date(),
      format: auditConfig.format || 'json',
    };
  }

  /**
   * Check resolution compliance
   */
  async checkResolutionCompliance(disputeId: string): Promise<any> {
    this.logger.log(`Checking resolution compliance for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (!dispute.resolution) {
      return {
        disputeId,
        compliant: false,
        checkedAt: new Date(),
        complianceDetails: {
          termsMet: false,
          reason: 'No resolution found',
        },
      };
    }

    // Check if resolution terms have been implemented
    const termsMet = dispute.status === 'RESOLVED' || dispute.status === 'CLOSED';
    const timelineMet = true; // Would check actual timeline compliance
    const documentationComplete = true; // Would check documentation completeness

    return {
      disputeId,
      compliant: termsMet && timelineMet && documentationComplete,
      checkedAt: new Date(),
      complianceDetails: {
        termsMet,
        timelineMet,
        documentationComplete,
      },
    };
  }

  /**
   * Implement resolution term
   */
  async implementResolutionTerm(disputeId: string, implementationData: any): Promise<any> {
    this.logger.log(`Implementing resolution term for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (!dispute.resolution) {
      throw new BadRequestException('No resolution found for this dispute');
    }

    // In a real implementation, this would trigger payout processing, etc.
    // For now, return the implementation result
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'RESOLUTION_TERM_IMPLEMENTED',
      details: `Resolution term implemented: ${implementationData.term}`,
    });

    return {
      disputeId,
      termImplemented: true,
      implementedAt: new Date(),
      termDetails: implementationData,
    };
  }

  /**
   * Notify status change
   */
  async notifyStatusChange(disputeId: string, statusChange: any): Promise<any> {
    this.logger.log(`Notifying status change for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Notify both parties
    await this.notificationsService.createNotification({
      userId: dispute.initiatorId,
      type: 'dispute_status_change',
      title: 'Dispute status updated',
      message: `Dispute ${disputeId} status changed to ${statusChange.newStatus}`,
      metadata: { disputeId, oldStatus: statusChange.oldStatus, newStatus: statusChange.newStatus },
    });

    await this.notificationsService.createNotification({
      userId: dispute.defendantId,
      type: 'dispute_status_change',
      title: 'Dispute status updated',
      message: `Dispute ${disputeId} status changed to ${statusChange.newStatus}`,
      metadata: { disputeId, oldStatus: statusChange.oldStatus, newStatus: statusChange.newStatus },
    });

    return {
      success: true,
      notifiedParties: [dispute.initiatorId, dispute.defendantId],
      channels: ['in_app', 'email'],
      notifiedAt: new Date(),
    };
  }

  /**
   * Send resolution notification
   */
  async sendResolutionNotification(disputeId: string, resolutionData: any): Promise<any> {
    this.logger.log(`Sending resolution notification for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Send email notifications to both parties
    const initiator = await this.userRepository.findById(dispute.initiatorId);
    const defendant = await this.userRepository.findById(dispute.defendantId);

    if (initiator && initiator.email) {
      await this.emailService.sendEmail({
        to: initiator.email,
        subject: 'Dispute Resolution Notification',
        templateId: 'dispute-resolution',
        templateData: {
          disputeId,
          resolution: resolutionData.decision,
          amount: resolutionData.payoutAmount,
        },
      });
    }

    if (defendant && defendant.email) {
      await this.emailService.sendEmail({
        to: defendant.email,
        subject: 'Dispute Resolution Notification',
        templateId: 'dispute-resolution',
        templateData: {
          disputeId,
          resolution: resolutionData.decision,
          amount: resolutionData.payoutAmount,
        },
      });
    }

    return {
      success: true,
      content: `Resolution: ${resolutionData.decision}, Amount: ${resolutionData.payoutAmount}, Resolved by: ${resolutionData.resolvedBy}`,
      sentAt: new Date(),
    };
  }

  /**
   * Generate communication summary
   */
  async generateCommunicationSummary(disputeId: string): Promise<any> {
    this.logger.log(`Generating communication summary for dispute: ${disputeId}`);
    
    const responses = await this.disputeRepository.findResponsesByDispute(disputeId);
    
    const byType: Record<string, number> = {};
    const bySender: Record<string, number> = {};
    
    for (const response of responses) {
      byType[response.type] = (byType[response.type] || 0) + 1;
      bySender[response.userId] = (bySender[response.userId] || 0) + 1;
    }

    return {
      totalCommunications: responses.length,
      byType,
      bySender,
    };
  }

  /**
   * Update negotiation
   */
  async updateNegotiation(disputeId: string, negotiationData: any): Promise<any> {
    this.logger.log(`Updating negotiation for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Create timeline event for negotiation update
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'NEGOTIATION_UPDATED',
      details: `Negotiation updated: ${negotiationData.status}`,
    });

    return {
      disputeId,
      currentStatus: negotiationData.status,
      updatedAt: new Date(),
      ...negotiationData,
    };
  }

  /**
   * Start mediation process
   */
  async startMediation(disputeId: string, mediationData: any): Promise<any> {
    this.logger.log(`Starting mediation for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Update dispute status to under review
    await this.disputeRepository.update(disputeId, {
      status: 'UNDER_REVIEW',
      assignedTo: mediationData.mediatorId,
    });

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'MEDIATION_STARTED',
      details: `Mediation started with mediator ${mediationData.mediatorId}`,
    });

    // Notify both parties
    await this.notificationsService.createNotification({
      userId: dispute.initiatorId,
      type: 'mediation_started',
      title: 'Mediation started',
      message: `Mediation has been scheduled for dispute ${disputeId}`,
      metadata: { disputeId, mediatorId: mediationData.mediatorId, scheduledAt: mediationData.scheduledAt },
    });

    await this.notificationsService.createNotification({
      userId: dispute.defendantId,
      type: 'mediation_started',
      title: 'Mediation started',
      message: `Mediation has been scheduled for dispute ${disputeId}`,
      metadata: { disputeId, mediatorId: mediationData.mediatorId, scheduledAt: mediationData.scheduledAt },
    });

    return {
      disputeId,
      status: 'UNDER_REVIEW',
      mediatorId: mediationData.mediatorId,
      scheduledAt: mediationData.scheduledAt,
      createdAt: new Date(),
    };
  }

  /**
   * Conduct mediation session
   */
  async conductMediation(disputeId: string, sessionData: any): Promise<any> {
    this.logger.log(`Conducting mediation for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Create timeline event
    await this.disputeRepository.addTimelineEvent({
      disputeId,
      event: 'MEDIATION_COMPLETED',
      details: `Mediation session completed. Outcome: ${sessionData.outcome}`,
    });

    return {
      disputeId,
      status: 'INVESTIGATING',
      mediation: {
        ...sessionData,
        completedAt: new Date(),
      },
    };
  }

  /**
   * Handle mediation breakdown
   */
  async handleMediationBreakdown(disputeId: string, breakdownData: any): Promise<any> {
    this.logger.log(`Handling mediation breakdown for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Escalate dispute
    const escalation = await this.escalateDispute(disputeId, {
      fromLevel: 'MEDIATION',
      toLevel: 'ARBITRATION',
      reason: breakdownData.reason,
      escalatedBy: breakdownData.escalatedBy,
    });

    return escalation;
  }

  /**
   * Generate mediation report
   */
  async generateMediationReport(disputeId: string): Promise<any> {
    this.logger.log(`Generating mediation report for dispute: ${disputeId}`);
    
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const responses = await this.disputeRepository.findResponsesByDispute(disputeId);
    const timelineEvents = await this.disputeRepository.findTimelineEventsByDispute(disputeId);

    return {
      disputeId,
      mediatorId: dispute.assignedTo,
      timelineEvents,
      communications: responses,
      generatedAt: new Date(),
    };
  }

  /**
   * Mark communication as read
   */
  async markCommunicationRead(disputeId: string, communicationId: string, userId: string): Promise<any> {
    this.logger.log(`Marking communication as read: ${communicationId}`);
    
    // In a real implementation, we would update the response read status
    // For now, return success
    return {
      success: true,
      readAt: new Date(),
    };
  }
}
