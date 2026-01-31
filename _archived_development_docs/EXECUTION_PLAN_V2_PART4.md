# Universal Rental Portal — Execution Plan Part 4: Disputes, Mobile & Admin

**Document:** Part 4 of 5 - Features 8-10 Detailed Implementation  
**Related:** Parts 1-3  
**Last Updated:** January 23, 2026

---

## 📋 Table of Contents

- [Feature 8: Dispute Resolution System](#feature-8-dispute-resolution-system)
- [Feature 9: Mobile App Architecture](#feature-9-mobile-app-architecture)
- [Feature 10: Admin Portal Implementation](#feature-10-admin-portal-implementation)

---

## Feature 8: Dispute Resolution System

### 8.1 Dispute Management Service

```typescript
// apps/api/src/modules/disputes/services/dispute.service.ts

@Injectable()
export class DisputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly ledgerService: LedgerService,
    private readonly storageService: StorageService,
  ) {}

  // Create dispute
  async createDispute(data: CreateDisputeDto): Promise<Dispute> {
    return await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: {
          renter: true,
          owner: true,
          listing: true,
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Validate dispute can be created
      this.validateDisputeCreation(booking, data.initiatedBy);

      // Create dispute
      const dispute = await tx.dispute.create({
        data: {
          bookingId: data.bookingId,
          initiatedBy: data.initiatedBy,
          respondent: data.initiatedBy === booking.renterId ? booking.ownerId : booking.renterId,
          type: data.type,
          category: data.category,
          description: data.description,
          claimedAmount: data.claimedAmount,
          evidence: data.evidence || [],
          status: 'open',
          priority: this.calculatePriority(data.type, data.claimedAmount),
          slaDeadline: this.calculateSLADeadline(data.type),
          createdAt: new Date(),
        },
      });

      // Transition booking to DISPUTED state
      await this.bookingStateMachine.transition(booking.id, BookingStatus.DISPUTED, {
        triggeredBy: data.initiatedBy,
        reason: `Dispute opened: ${data.type}`,
        metadata: { disputeId: dispute.id },
      });

      // Pause any scheduled payouts
      await this.pauseBookingPayouts(booking.id);

      // Notify respondent
      await this.notificationService.send({
        userId: dispute.respondent,
        type: 'dispute_opened',
        priority: 'high',
        data: {
          disputeId: dispute.id,
          bookingId: booking.id,
          type: data.type,
          description: data.description,
        },
      });

      // Notify admin team
      await this.notificationService.send({
        channel: 'admin',
        type: 'new_dispute',
        priority: dispute.priority,
        data: {
          disputeId: dispute.id,
          bookingId: booking.id,
          type: data.type,
          claimedAmount: data.claimedAmount,
        },
      });

      return dispute;
    });
  }

  // Add evidence to dispute
  async addEvidence(disputeId: string, evidence: DisputeEvidenceDto): Promise<DisputeEvidence> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      throw new BadRequestException('Cannot add evidence to closed dispute');
    }

    // Upload files
    const uploadedFiles = await Promise.all(
      evidence.files.map(async (file) => {
        const path = `disputes/${disputeId}/${Date.now()}-${file.originalname}`;
        const uploaded = await this.storageService.upload({
          file: file.buffer,
          path,
          contentType: file.mimetype,
          metadata: {
            disputeId,
            uploadedBy: evidence.uploadedBy,
            evidenceType: evidence.type,
          },
        });

        return {
          url: uploaded.url,
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
        };
      }),
    );

    // Create evidence record
    const evidenceRecord = await this.prisma.disputeEvidence.create({
      data: {
        disputeId,
        uploadedBy: evidence.uploadedBy,
        type: evidence.type,
        description: evidence.description,
        files: uploadedFiles,
        metadata: evidence.metadata,
        createdAt: new Date(),
      },
    });

    // Update dispute timeline
    await this.addTimelineEvent(disputeId, {
      type: 'evidence_added',
      actor: evidence.uploadedBy,
      description: `Added ${evidence.type} evidence`,
      metadata: {
        evidenceId: evidenceRecord.id,
        fileCount: uploadedFiles.length,
      },
    });

    return evidenceRecord;
  }

  // Respond to dispute
  async respondToDispute(disputeId: string, response: DisputeResponseDto): Promise<Dispute> {
    return await this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
        include: { booking: true },
      });

      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if (dispute.status !== 'open' && dispute.status !== 'under_review') {
        throw new BadRequestException('Dispute is not open for responses');
      }

      // Create response
      await tx.disputeResponse.create({
        data: {
          disputeId,
          respondedBy: response.respondedBy,
          response: response.response,
          counterOffer: response.counterOffer,
          evidence: response.evidence || [],
        },
      });

      // Update dispute status
      const updated = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'under_review',
          respondedAt: new Date(),
        },
      });

      // Add timeline event
      await this.addTimelineEvent(disputeId, {
        type: 'response_submitted',
        actor: response.respondedBy,
        description: 'Submitted response to dispute',
      });

      // Notify initiator
      await this.notificationService.send({
        userId: dispute.initiatedBy,
        type: 'dispute_response_received',
        data: {
          disputeId,
          respondedBy: response.respondedBy,
        },
      });

      return updated;
    });
  }

  // Admin assigns dispute to moderator
  async assignToModerator(
    disputeId: string,
    moderatorId: string,
    assignedBy: string,
  ): Promise<Dispute> {
    const dispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        assignedTo: moderatorId,
        assignedAt: new Date(),
        status: 'in_review',
      },
    });

    await this.addTimelineEvent(disputeId, {
      type: 'assigned',
      actor: assignedBy,
      description: `Assigned to moderator`,
      metadata: { moderatorId },
    });

    // Notify moderator
    await this.notificationService.send({
      userId: moderatorId,
      type: 'dispute_assigned',
      data: {
        disputeId,
        priority: dispute.priority,
      },
    });

    return dispute;
  }

  // Moderator requests additional information
  async requestInformation(disputeId: string, request: InformationRequestDto): Promise<void> {
    await this.addTimelineEvent(disputeId, {
      type: 'information_requested',
      actor: request.requestedBy,
      description: request.message,
      metadata: {
        requestedFrom: request.requestedFrom,
        dueDate: addDays(new Date(), 3), // 3 days to respond
      },
    });

    // Notify requested party
    await this.notificationService.send({
      userId: request.requestedFrom,
      type: 'dispute_info_requested',
      priority: 'high',
      data: {
        disputeId,
        message: request.message,
        dueDate: addDays(new Date(), 3),
      },
    });

    // Update dispute
    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'pending_information',
        informationRequestedAt: new Date(),
      },
    });
  }

  // Admin resolves dispute
  async resolveDispute(disputeId: string, resolution: DisputeResolutionDto): Promise<Dispute> {
    return await this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
        include: { booking: true },
      });

      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      // Create resolution record
      const resolutionRecord = await tx.disputeResolution.create({
        data: {
          disputeId,
          resolvedBy: resolution.resolvedBy,
          outcome: resolution.outcome,
          reasoning: resolution.reasoning,
          financialAdjustment: resolution.financialAdjustment,
          refundAmount: resolution.refundAmount,
          penaltyAmount: resolution.penaltyAmount,
          notes: resolution.notes,
          resolvedAt: new Date(),
        },
      });

      // Update dispute
      const updated = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'resolved',
          resolution: resolution.outcome,
          resolvedAt: new Date(),
          resolvedBy: resolution.resolvedBy,
        },
      });

      // Execute financial adjustments
      if (resolution.financialAdjustment) {
        await this.executeFinancialResolution(dispute, resolution);
      }

      // Update booking status based on resolution
      await this.updateBookingAfterResolution(dispute.booking, resolution);

      // Add timeline event
      await this.addTimelineEvent(disputeId, {
        type: 'resolved',
        actor: resolution.resolvedBy,
        description: `Dispute resolved: ${resolution.outcome}`,
        metadata: {
          resolutionId: resolutionRecord.id,
          outcome: resolution.outcome,
        },
      });

      // Notify all parties
      await this.notifyResolution(dispute, resolution);

      return updated;
    });
  }

  // Execute financial resolution
  private async executeFinancialResolution(
    dispute: Dispute,
    resolution: DisputeResolutionDto,
  ): Promise<void> {
    const booking = dispute.booking;

    // Process refund if applicable
    if (resolution.refundAmount && resolution.refundAmount > 0) {
      await this.paymentService.createRefund({
        paymentIntentId: booking.paymentIntentId,
        amount: resolution.refundAmount,
        reason: 'Dispute resolution',
        metadata: {
          disputeId: dispute.id,
          resolutionOutcome: resolution.outcome,
        },
      });

      await this.ledgerService.recordRefund({
        bookingId: booking.id,
        refundId: crypto.randomUUID(),
        amount: resolution.refundAmount,
        description: `Dispute resolution refund - ${dispute.type}`,
      });
    }

    // Capture deposit if applicable
    if (resolution.penaltyAmount && resolution.penaltyAmount > 0) {
      if (booking.depositHoldId) {
        await this.paymentService.captureDeposit(booking.depositHoldId, resolution.penaltyAmount);

        await this.ledgerService.recordDepositCapture({
          bookingId: booking.id,
          depositHoldId: booking.depositHoldId,
          amount: resolution.penaltyAmount,
          reason: `Dispute resolution penalty - ${dispute.type}`,
        });
      }
    }

    // Adjust payout to owner
    if (resolution.outcome === 'favor_owner') {
      // Ensure owner receives full payment
      await this.processOwnerPayout(booking, booking.quoteSnapshot.ownerAmount);
    } else if (resolution.outcome === 'favor_renter') {
      // Reduce or cancel owner payout
      const adjustedAmount = booking.quoteSnapshot.ownerAmount - (resolution.refundAmount || 0);
      if (adjustedAmount > 0) {
        await this.processOwnerPayout(booking, adjustedAmount);
      }
    } else if (resolution.outcome === 'partial_refund') {
      // Split difference
      const ownerAmount = booking.quoteSnapshot.ownerAmount - (resolution.refundAmount || 0);
      await this.processOwnerPayout(booking, ownerAmount);
    }
  }

  // Update booking after resolution
  private async updateBookingAfterResolution(
    booking: Booking,
    resolution: DisputeResolutionDto,
  ): Promise<void> {
    let newStatus: BookingStatus;

    switch (resolution.outcome) {
      case 'favor_owner':
      case 'favor_renter':
      case 'partial_refund':
        newStatus = BookingStatus.COMPLETED;
        break;
      case 'cancelled':
        newStatus = BookingStatus.CANCELLED;
        break;
      default:
        newStatus = BookingStatus.COMPLETED;
    }

    await this.bookingStateMachine.transition(booking.id, newStatus, {
      triggeredBy: 'system',
      reason: `Dispute resolved: ${resolution.outcome}`,
    });
  }

  // Calculate dispute priority
  private calculatePriority(
    type: string,
    claimedAmount?: number,
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (type === 'safety_concern') return 'critical';

    if (claimedAmount) {
      if (claimedAmount > 1000) return 'high';
      if (claimedAmount > 500) return 'medium';
    }

    if (type === 'property_damage' || type === 'payment_issue') return 'high';
    if (type === 'cancellation_dispute') return 'medium';

    return 'low';
  }

  // Calculate SLA deadline based on priority
  private calculateSLADeadline(type: string): Date {
    const slaHours = {
      safety_concern: 24, // 24 hours
      payment_issue: 48, // 2 days
      property_damage: 72, // 3 days
      cancellation_dispute: 120, // 5 days
      service_quality: 120, // 5 days
      other: 168, // 7 days
    };

    return addHours(new Date(), slaHours[type] || 168);
  }

  // Validate dispute creation
  private validateDisputeCreation(booking: Booking, initiatedBy: string): void {
    // Check user is part of booking
    if (booking.renterId !== initiatedBy && booking.ownerId !== initiatedBy) {
      throw new ForbiddenException('Not authorized to create dispute for this booking');
    }

    // Check booking is in valid state
    const validStatuses = [
      BookingStatus.IN_PROGRESS,
      BookingStatus.AWAITING_RETURN_INSPECTION,
      BookingStatus.COMPLETED,
    ];

    if (!validStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot create dispute for booking in ${booking.status} status`,
      );
    }

    // Check dispute window (e.g., within 30 days of completion)
    if (booking.status === BookingStatus.COMPLETED) {
      const daysSinceCompletion = differenceInDays(new Date(), booking.completedAt);
      if (daysSinceCompletion > 30) {
        throw new BadRequestException('Dispute window has expired (30 days)');
      }
    }
  }

  // Add event to dispute timeline
  private async addTimelineEvent(disputeId: string, event: TimelineEventDto): Promise<void> {
    await this.prisma.disputeTimelineEvent.create({
      data: {
        disputeId,
        type: event.type,
        actor: event.actor,
        description: event.description,
        metadata: event.metadata,
        timestamp: new Date(),
      },
    });
  }

  // Notify parties of resolution
  private async notifyResolution(
    dispute: Dispute,
    resolution: DisputeResolutionDto,
  ): Promise<void> {
    const parties = [dispute.initiatedBy, dispute.respondent];

    await Promise.all(
      parties.map((userId) =>
        this.notificationService.send({
          userId,
          type: 'dispute_resolved',
          priority: 'high',
          data: {
            disputeId: dispute.id,
            outcome: resolution.outcome,
            reasoning: resolution.reasoning,
            refundAmount: resolution.refundAmount,
            penaltyAmount: resolution.penaltyAmount,
          },
        }),
      ),
    );
  }

  // Get dispute metrics for admin dashboard
  async getDisputeMetrics(dateRange: { start: Date; end: Date }): Promise<DisputeMetrics> {
    const disputes = await this.prisma.dispute.findMany({
      where: {
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
    });

    const totalDisputes = disputes.length;
    const openDisputes = disputes.filter((d) => d.status === 'open').length;
    const resolvedDisputes = disputes.filter((d) => d.status === 'resolved').length;

    const avgResolutionTime =
      disputes
        .filter((d) => d.resolvedAt)
        .reduce((sum, d) => {
          const duration = differenceInHours(d.resolvedAt, d.createdAt);
          return sum + duration;
        }, 0) / resolvedDisputes;

    const resolutionRate = (resolvedDisputes / totalDisputes) * 100;

    const byType = disputes.reduce(
      (acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byOutcome = disputes
      .filter((d) => d.resolution)
      .reduce(
        (acc, d) => {
          acc[d.resolution] = (acc[d.resolution] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    return {
      totalDisputes,
      openDisputes,
      resolvedDisputes,
      avgResolutionTimeHours: avgResolutionTime,
      resolutionRate,
      byType,
      byOutcome,
      totalClaimedAmount: disputes.reduce((sum, d) => sum + (d.claimedAmount || 0), 0),
      totalResolvedAmount: disputes
        .filter((d) => d.resolvedAt)
        .reduce((sum, d) => sum + (d.resolution?.refundAmount || 0), 0),
    };
  }
}
```

### 8.2 React Router v7 Admin Dispute Interface

```typescript
// apps/web/app/routes/admin.disputes.$id.tsx

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form, useNavigation } from '@remix-run/react';

export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const dispute = await apiClient.disputes.getById(params.id);
  const timeline = await apiClient.disputes.getTimeline(params.id);
  const evidence = await apiClient.disputes.getEvidence(params.id);

  return json({ dispute, timeline, evidence });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const action = formData.get('_action');

  switch (action) {
    case 'resolve':
      await apiClient.disputes.resolve(params.id, {
        outcome: formData.get('outcome'),
        reasoning: formData.get('reasoning'),
        refundAmount: parseInt(formData.get('refundAmount') || '0'),
        penaltyAmount: parseInt(formData.get('penaltyAmount') || '0'),
        notes: formData.get('notes')
      });
      return json({ success: true });

    case 'request_info':
      await apiClient.disputes.requestInformation(params.id, {
        requestedFrom: formData.get('requestedFrom'),
        message: formData.get('message')
      });
      return json({ success: true });

    default:
      return json({ error: 'Invalid action' }, { status: 400 });
  }
}

export default function AdminDisputeDetail() {
  const { dispute, timeline, evidence } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">
                Dispute #{dispute.id.slice(0, 8)}
              </h1>
              <StatusBadge status={dispute.status} />
              <PriorityBadge priority={dispute.priority} />
            </div>
            <p className="text-gray-600">{dispute.type.replace('_', ' ')}</p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">{formatDate(dispute.createdAt)}</p>
            <p className="text-sm text-gray-500 mt-2">SLA Deadline</p>
            <p className={`font-medium ${isPast(dispute.slaDeadline) ? 'text-red-600' : ''}`}>
              {formatDate(dispute.slaDeadline)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Details</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="mt-1">{dispute.description}</p>
              </div>

              {dispute.claimedAmount && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Claimed Amount</label>
                  <p className="mt-1 text-xl font-bold">
                    ${dispute.claimedAmount.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Initiated By</label>
                  <UserCard userId={dispute.initiatedBy} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Respondent</label>
                  <UserCard userId={dispute.respondent} />
                </div>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Evidence</h2>

            <div className="space-y-4">
              {evidence.map(item => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{item.type.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-500">
                        Submitted by {item.uploadedByName} on {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-3">{item.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {item.files.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border rounded-lg p-2 hover:bg-gray-50"
                      >
                        {file.type.startsWith('image/') ? (
                          <img src={file.url} alt={file.name} className="w-full h-24 object-cover rounded" />
                        ) : (
                          <div className="h-24 flex items-center justify-center bg-gray-100 rounded">
                            <DocumentIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <p className="text-xs mt-1 truncate">{file.name}</p>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Timeline</h2>

            <div className="space-y-4">
              {timeline.map((event, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      {getEventIcon(event.type)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{event.description}</p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(event.timestamp)} • {event.actorName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-4">
            <h2 className="text-lg font-bold mb-4">Actions</h2>

            {dispute.status === 'open' || dispute.status === 'under_review' ? (
              <>
                {/* Assign to moderator */}
                <button className="w-full bg-blue-600 text-white py-2 rounded-lg mb-3">
                  Assign to Me
                </button>

                {/* Request information */}
                <Form method="post" className="mb-6">
                  <input type="hidden" name="_action" value="request_info" />
                  <button
                    type="submit"
                    className="w-full bg-gray-600 text-white py-2 rounded-lg"
                    disabled={isSubmitting}
                  >
                    Request More Info
                  </button>
                </Form>

                {/* Resolution form */}
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="_action" value="resolve" />

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Resolution Outcome
                    </label>
                    <select
                      name="outcome"
                      required
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select outcome...</option>
                      <option value="favor_renter">Favor Renter</option>
                      <option value="favor_owner">Favor Owner</option>
                      <option value="partial_refund">Partial Refund</option>
                      <option value="no_action">No Action Required</option>
                      <option value="cancelled">Cancel Booking</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Refund Amount ($)
                    </label>
                    <input
                      type="number"
                      name="refundAmount"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Penalty Amount ($)
                    </label>
                    <input
                      type="number"
                      name="penaltyAmount"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Reasoning
                    </label>
                    <textarea
                      name="reasoning"
                      required
                      rows={4}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Explain the resolution decision..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Internal Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Optional internal notes..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
                  >
                    {isSubmitting ? 'Resolving...' : 'Resolve Dispute'}
                  </button>
                </Form>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  Dispute has been {dispute.status}
                </p>
                {dispute.resolution && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                    <p className="font-medium mb-2">Resolution:</p>
                    <p className="text-sm">{dispute.resolution.reasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Feature 9: Mobile App Architecture

### 9.1 React Native Project Structure

```
apps/mobile/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── listings/
│   │   │   ├── ListingCard.tsx
│   │   │   ├── ListingGallery.tsx
│   │   │   └── PriceDisplay.tsx
│   │   ├── booking/
│   │   │   ├── BookingCard.tsx
│   │   │   ├── BookingTimeline.tsx
│   │   │   └── QuoteBreakdown.tsx
│   │   └── messaging/
│   │       ├── MessageBubble.tsx
│   │       ├── ConversationList.tsx
│   │       └── ChatInput.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignupScreen.tsx
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── home/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── SearchScreen.tsx
│   │   │   └── CategoriesScreen.tsx
│   │   ├── listings/
│   │   │   ├── ListingDetailScreen.tsx
│   │   │   ├── CreateListingScreen.tsx
│   │   │   └── MyListingsScreen.tsx
│   │   ├── bookings/
│   │   │   ├── BookingDetailScreen.tsx
│   │   │   ├── CreateBookingScreen.tsx
│   │   │   ├── MyBookingsScreen.tsx
│   │   │   └── ConditionReportScreen.tsx
│   │   ├── messaging/
│   │   │   ├── ConversationsScreen.tsx
│   │   │   └── ChatScreen.tsx
│   │   ├── profile/
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── EditProfileScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── payments/
│   │       ├── PaymentMethodsScreen.tsx
│   │       └── PayoutSettingsScreen.tsx
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   └── types.ts
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── listings.ts
│   │   │   ├── bookings.ts
│   │   │   └── messaging.ts
│   │   ├── storage/
│   │   │   └── SecureStore.ts
│   │   ├── notifications/
│   │   │   └── PushNotifications.ts
│   │   └── location/
│   │       └── LocationService.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useBooking.ts
│   │   ├── useSocket.ts
│   │   └── useCamera.ts
│   ├── store/
│   │   ├── index.ts
│   │   ├── authSlice.ts
│   │   ├── bookingsSlice.ts
│   │   └── messagesSlice.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   └── App.tsx
├── app.json
├── package.json
└── tsconfig.json
```

### 9.2 Navigation Setup

```typescript
// apps/mobile/src/navigation/RootNavigator.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { LoadingScreen } from '../screens/LoadingScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

```typescript
// apps/mobile/src/navigation/MainNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';

import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/home/SearchScreen';
import BookingsScreen from '../screens/bookings/MyBookingsScreen';
import MessagesScreen from '../screens/messaging/ConversationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

import ListingDetailScreen from '../screens/listings/ListingDetailScreen';
import BookingDetailScreen from '../screens/bookings/BookingDetailScreen';
import ChatScreen from '../screens/messaging/ChatScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: 'Explore' }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Stack.Screen
        name="ListingDetail"
        component={ListingDetailScreen}
        options={{ title: 'Listing Details' }}
      />
    </Stack.Navigator>
  );
}

function BookingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BookingsList"
        component={BookingsScreen}
        options={{ title: 'My Bookings' }}
      />
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking Details' }}
      />
    </Stack.Navigator>
  );
}

function MessagesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MessagesList"
        component={MessagesScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Bookings':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Messages':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Bookings" component={BookingsStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
```

### 9.3 Socket.io Integration for Mobile

```typescript
// apps/mobile/src/hooks/useSocket.ts

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { useAppDispatch } from '../store';
import { addMessage, updateTypingStatus } from '../store/messagesSlice';

export function useSocket() {
  const { token } = useAuth();
  const dispatch = useAppDispatch();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Connect to socket server
    const newSocket = io(process.env.EXPO_PUBLIC_API_URL + '/messaging', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Message events
    newSocket.on('new_message', ({ conversationId, message }) => {
      dispatch(addMessage({ conversationId, message }));
    });

    newSocket.on('user_typing', ({ conversationId, userId, userName }) => {
      dispatch(
        updateTypingStatus({
          conversationId,
          userId,
          isTyping: true,
          userName,
        }),
      );
    });

    newSocket.on('user_stopped_typing', ({ conversationId, userId }) => {
      dispatch(updateTypingStatus({ conversationId, userId, isTyping: false }));
    });

    newSocket.on('message_read', ({ conversationId, messageId, readBy }) => {
      // Handle read receipt
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const sendMessage = useCallback(
    (conversationId: string, content: string, type = 'text') => {
      if (!socket || !connected) {
        throw new Error('Socket not connected');
      }

      return new Promise((resolve, reject) => {
        socket.emit('send_message', { conversationId, content, type }, (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error));
          }
        });
      });
    },
    [socket, connected],
  );

  const startTyping = useCallback(
    (conversationId: string) => {
      if (!socket || !connected) return;
      socket.emit('typing_start', { conversationId });
    },
    [socket, connected],
  );

  const stopTyping = useCallback(
    (conversationId: string) => {
      if (!socket || !connected) return;
      socket.emit('typing_stop', { conversationId });
    },
    [socket, connected],
  );

  const markAsRead = useCallback(
    (conversationId: string, messageId: string) => {
      if (!socket || !connected) return;
      socket.emit('mark_as_read', { conversationId, messageId });
    },
    [socket, connected],
  );

  return {
    socket,
    connected,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  };
}
```

### 9.4 Push Notifications Setup

```typescript
// apps/mobile/src/services/notifications/PushNotifications.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import apiClient from '../api/client';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  static async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token');
      return null;
    }

    // Get push token
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      })
    ).data;

    // Android specific configuration
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      });
    }

    // Register token with backend
    await apiClient.users.registerPushToken(token);

    return token;
  }

  static async setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void,
  ) {
    // Foreground notification listener
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      onNotificationReceived?.(notification);
    });

    // Notification tapped listener
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response);
        onNotificationTapped?.(response);
      },
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }

  static async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    trigger?: Notifications.NotificationTriggerInput,
  ) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: trigger || null, // null = immediate
    });
  }

  static async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  static async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }

  static async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }
}
```

### 9.5 Offline Support with Redux Persist

```typescript
// apps/mobile/src/store/index.ts

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import authReducer from './authSlice';
import bookingsReducer from './bookingsSlice';
import messagesReducer from './messagesSlice';
import listingsReducer from './listingsSlice';

const persistConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['auth', 'bookings'], // Only persist auth and bookings
  blacklist: ['messages'], // Don't persist real-time messages
};

const rootReducer = combineReducers({
  auth: authReducer,
  bookings: bookingsReducer,
  messages: messagesReducer,
  listings: listingsReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

---

## Feature 10: Admin Portal Implementation

### 10.1 React Router v7 Admin Dashboard

```typescript
// apps/web/app/routes/admin._index.tsx

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireAdmin } from '~/utils/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const [stats, recentActivity, alerts] = await Promise.all([
    apiClient.admin.getStats(),
    apiClient.admin.getRecentActivity(),
    apiClient.admin.getAlerts()
  ]);

  return json({ stats, recentActivity, alerts });
}

export default function AdminDashboard() {
  const { stats, recentActivity, alerts } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-bold text-red-900 mb-2">⚠️ Urgent Alerts</h3>
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="text-sm text-red-800">
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Bookings"
          value={stats.activeBookings}
          change={stats.bookingsChange}
          icon="📅"
        />
        <StatCard
          title="Open Disputes"
          value={stats.openDisputes}
          change={stats.disputesChange}
          icon="⚖️"
          alert={stats.openDisputes > 10}
        />
        <StatCard
          title="Pending Verifications"
          value={stats.pendingVerifications}
          icon="✓"
        />
        <StatCard
          title="Revenue (30d)"
          value={`$${stats.revenue30d.toLocaleString()}`}
          change={stats.revenueChange}
          icon="💰"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Bookings Over Time</h3>
          <BookingsChart data={stats.bookingsTimeSeries} />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Revenue by Category</h3>
          <CategoryRevenueChart data={stats.revenueByCategory} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold">Recent Activity</h3>
        </div>
        <div className="divide-y">
          {recentActivity.map(activity => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 10.2 Admin Moderation Queue

```typescript
// apps/web/app/routes/admin.moderation.tsx

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form } from '@remix-run/react';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') || 'listings';

  let items;
  switch (tab) {
    case 'listings':
      items = await apiClient.admin.moderation.getPendingListings();
      break;
    case 'users':
      items = await apiClient.admin.moderation.getPendingUsers();
      break;
    case 'reviews':
      items = await apiClient.admin.moderation.getFlaggedReviews();
      break;
    case 'photos':
      items = await apiClient.admin.moderation.getFlaggedPhotos();
      break;
  }

  return json({ items, tab });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const action = formData.get('_action');
  const itemId = formData.get('itemId') as string;
  const itemType = formData.get('itemType') as string;

  if (action === 'approve') {
    await apiClient.admin.moderation.approve(itemType, itemId);
  } else if (action === 'reject') {
    const reason = formData.get('reason') as string;
    await apiClient.admin.moderation.reject(itemType, itemId, reason);
  }

  return redirect(request.url);
}

export default function ModerationQueue() {
  const { items, tab } = useLoaderData<typeof loader>();

  return (
    <div>
      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex space-x-8">
          <TabLink to="?tab=listings" active={tab === 'listings'}>
            Listings ({items.length})
          </TabLink>
          <TabLink to="?tab=users" active={tab === 'users'}>
            Users
          </TabLink>
          <TabLink to="?tab=reviews" active={tab === 'reviews'}>
            Reviews
          </TabLink>
          <TabLink to="?tab=photos" active={tab === 'photos'}>
            Photos
          </TabLink>
        </nav>
      </div>

      {/* Queue Items */}
      <div className="space-y-4">
        {items.map(item => (
          <ModerationCard key={item.id} item={item} type={tab} />
        ))}
      </div>
    </div>
  );
}

function ModerationCard({ item, type }: { item: any; type: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex gap-6">
        <div className="flex-shrink-0">
          {type === 'listings' && (
            <img
              src={item.images[0]}
              alt={item.title}
              className="w-32 h-32 object-cover rounded-lg"
            />
          )}
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold mb-2">{item.title || item.name}</h3>
          <p className="text-gray-600 mb-4">{item.description}</p>

          <div className="flex gap-4 text-sm text-gray-500 mb-4">
            <span>Submitted: {formatDate(item.createdAt)}</span>
            <span>By: {item.ownerName || item.userName}</span>
          </div>

          {item.flagReason && (
            <div className="bg-red-50 border border-red-200 p-3 rounded mb-4">
              <p className="text-sm text-red-800">
                <strong>Flagged:</strong> {item.flagReason}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Form method="post">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="itemType" value={type} />
            <button
              name="_action"
              value="approve"
              className="px-6 py-2 bg-green-600 text-white rounded-lg"
            >
              ✓ Approve
            </button>
          </Form>

          <Form method="post">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="itemType" value={type} />
            <button
              name="_action"
              value="reject"
              className="px-6 py-2 bg-red-600 text-white rounded-lg"
            >
              ✕ Reject
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
```

---

**Status:** Part 4 completed with Features 8-10 (Disputes, Mobile App, Admin Portal). Ready to create Part 5 with infrastructure, testing, and deployment details. Continue?
