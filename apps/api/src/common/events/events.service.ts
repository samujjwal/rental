import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, PayoutStatus, ListingStatus } from '@rental-portal/database';

// Event payloads
export interface BookingCreatedEvent {
  bookingId: string;
  renterId: string;
  ownerId: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
}

export interface BookingStatusChangedEvent {
  bookingId: string;
  previousStatus: BookingStatus;
  newStatus: BookingStatus;
  renterId: string;
  ownerId: string;
  changedBy?: string;
  reason?: string;
}

export interface PaymentProcessedEvent {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency?: string;
  status: PayoutStatus;
  renterId: string;
  ownerId: string;
  reason?: string;
  refundId?: string;
}

/**
 * Emitted by both EventsService.emitPaymentRefunded() (full context)
 * and PaymentOrchestrationService.refund() (partial — no user context).
 * All user-context fields are optional to support both call sites.
 */
export interface PaymentRefundedEvent {
  /** Provider transaction ID (set by PaymentOrchestrationService) */
  transactionId?: string;
  /** Payment record ID (alias for transactionId when using EventsService) */
  paymentId?: string;
  bookingId?: string;
  amount: number;
  currency?: string;
  renterId?: string;
  ownerId?: string;
  reason?: string;
  refundId?: string;
}

export interface ListingCreatedEvent {
  listingId: string;
  ownerId: string;
  categoryId: string;
  title: string;
  status: ListingStatus;
}

export interface ListingUpdatedEvent {
  listingId: string;
  ownerId: string;
  changes: Record<string, any>;
}

export interface ListingStatusChangedEvent {
  listingId: string;
  ownerId: string;
  previousStatus: ListingStatus;
  newStatus: ListingStatus;
}

export interface ReviewCreatedEvent {
  reviewId: string;
  reviewerId: string;
  revieweeId: string;
  listingId?: string;
  bookingId: string;
  rating: number;
}

export interface DisputeCreatedEvent {
  disputeId: string;
  bookingId: string;
  reportedBy: string;
  type: string;
}

export interface DisputeResolvedEvent {
  disputeId: string;
  bookingId: string;
  resolution: string;
  resolvedBy: string;
}

export interface MessageSentEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientIds: string[];
}

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  role: string;
}

export interface UserVerifiedEvent {
  userId: string;
  verificationType: 'EMAIL' | 'PHONE' | 'IDENTITY';
}

// ──────── V4 Extended Event Payloads ────────

export interface AvailabilityUpdatedEvent {
  listingId: string;
  ownerId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  inventoryUnitId?: string;
}

export interface ReservationRequestedEvent {
  bookingId: string;
  listingId: string;
  renterId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  currency: string;
}

export interface PaymentAuthorizedEvent {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  providerId: string;
}

export interface PaymentCapturedEvent {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  providerId: string;
}

export interface PayoutReleasedEvent {
  payoutId: string;
  ownerId: string;
  amount: number;
  currency: string;
  bookingIds: string[];
}

export interface FraudAlertEvent {
  entityType: 'USER' | 'BOOKING' | 'PAYMENT' | 'LISTING';
  entityId: string;
  riskLevel: string;
  riskScore: number;
  flags: Array<{ type: string; severity: string; description: string }>;
}

export interface EscrowFundedEvent {
  escrowId: string;
  bookingId: string;
  amount: number;
  currency: string;
}

export interface EscrowReleasedEvent {
  escrowId: string;
  bookingId: string;
  amount: number;
  currency: string;
  releasedTo: string;
}

export interface TrustScoreUpdatedEvent {
  userId: string;
  scoreType: string;
  oldScore: number;
  newScore: number;
  tier: string;
}

export interface ComplianceCheckEvent {
  entityType: string;
  entityId: string;
  country: string;
  checkType: string;
  status: string;
  violations?: string[];
}

export interface DisputeEscalatedEvent {
  disputeId: string;
  bookingId: string;
  fromLevel: string;
  toLevel: string;
  reason: string;
  assignedTo?: string;
}

export interface PricingUpdatedEvent {
  listingId: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
  strategy: string;
}

@Injectable()
export class EventsService {
  constructor(private eventEmitter: EventEmitter2) {}

  // Booking events
  emitBookingCreated(payload: BookingCreatedEvent) {
    this.eventEmitter.emit('booking.created', payload);
  }

  emitBookingStatusChanged(payload: BookingStatusChangedEvent) {
    this.eventEmitter.emit('booking.status.changed', payload);
    this.eventEmitter.emit(`booking.status.${payload.newStatus.toLowerCase()}`, payload);
  }

  emitBookingConfirmed(payload: BookingStatusChangedEvent) {
    this.eventEmitter.emit('booking.confirmed', payload);
  }

  emitBookingCancelled(payload: BookingStatusChangedEvent) {
    this.eventEmitter.emit('booking.cancelled', payload);
  }

  emitBookingCompleted(payload: BookingStatusChangedEvent) {
    this.eventEmitter.emit('booking.completed', payload);
  }

  // Payment events
  emitPaymentProcessed(payload: PaymentProcessedEvent) {
    this.eventEmitter.emit('payment.processed', payload);
    this.eventEmitter.emit(`payment.${payload.status.toLowerCase()}`, payload);
  }

  emitPaymentSucceeded(payload: PaymentProcessedEvent) {
    this.eventEmitter.emit('payment.succeeded', payload);
  }

  emitPaymentFailed(payload: PaymentProcessedEvent) {
    this.eventEmitter.emit('payment.failed', payload);
  }

  emitPaymentActionRequired(payload: PaymentProcessedEvent) {
    this.eventEmitter.emit('payment.action_required', payload);
  }

  emitPaymentRefunded(payload: PaymentRefundedEvent) {
    this.eventEmitter.emit('payment.refunded', payload);
  }

  // Listing events
  emitListingCreated(payload: ListingCreatedEvent) {
    this.eventEmitter.emit('listing.created', payload);
  }

  emitListingUpdated(payload: ListingUpdatedEvent) {
    this.eventEmitter.emit('listing.updated', payload);
  }

  emitListingStatusChanged(payload: ListingStatusChangedEvent) {
    this.eventEmitter.emit('listing.status.changed', payload);
    this.eventEmitter.emit(`listing.status.${payload.newStatus.toLowerCase()}`, payload);
  }

  emitListingDeleted(payload: { listingId: string; ownerId: string }) {
    this.eventEmitter.emit('listing.deleted', payload);
  }

  // Review events
  emitReviewCreated(payload: ReviewCreatedEvent) {
    this.eventEmitter.emit('review.created', payload);
  }

  // Dispute events
  emitDisputeCreated(payload: DisputeCreatedEvent) {
    this.eventEmitter.emit('dispute.created', payload);
  }

  emitDisputeResolved(payload: DisputeResolvedEvent) {
    this.eventEmitter.emit('dispute.resolved', payload);
  }

  // Message events
  emitMessageSent(payload: MessageSentEvent) {
    this.eventEmitter.emit('message.sent', payload);
  }

  // User events
  emitUserRegistered(payload: UserRegisteredEvent) {
    this.eventEmitter.emit('user.registered', payload);
  }

  emitUserVerified(payload: UserVerifiedEvent) {
    this.eventEmitter.emit('user.verified', payload);
    this.eventEmitter.emit(`user.verified.${payload.verificationType.toLowerCase()}`, payload);
  }

  // ──────── V4 Extended Events ────────

  emitAvailabilityUpdated(payload: AvailabilityUpdatedEvent) {
    this.eventEmitter.emit('availability.updated', payload);
  }

  emitReservationRequested(payload: ReservationRequestedEvent) {
    this.eventEmitter.emit('reservation.requested', payload);
  }

  emitPaymentAuthorized(payload: PaymentAuthorizedEvent) {
    this.eventEmitter.emit('payment.authorized', payload);
  }

  emitPaymentCaptured(payload: PaymentCapturedEvent) {
    this.eventEmitter.emit('payment.captured', payload);
  }

  emitPayoutReleased(payload: PayoutReleasedEvent) {
    this.eventEmitter.emit('payout.released', payload);
  }

  emitFraudAlert(payload: FraudAlertEvent) {
    this.eventEmitter.emit('fraud.alert', payload);
    this.eventEmitter.emit(`fraud.alert.${payload.riskLevel.toLowerCase()}`, payload);
  }

  emitEscrowFunded(payload: EscrowFundedEvent) {
    this.eventEmitter.emit('escrow.funded', payload);
  }

  emitEscrowReleased(payload: EscrowReleasedEvent) {
    this.eventEmitter.emit('escrow.released', payload);
  }

  emitTrustScoreUpdated(payload: TrustScoreUpdatedEvent) {
    this.eventEmitter.emit('trust.score.updated', payload);
  }

  emitComplianceCheck(payload: ComplianceCheckEvent) {
    this.eventEmitter.emit('compliance.check', payload);
    this.eventEmitter.emit(`compliance.check.${payload.status.toLowerCase()}`, payload);
  }

  emitDisputeEscalated(payload: DisputeEscalatedEvent) {
    this.eventEmitter.emit('dispute.escalated', payload);
  }

  emitPricingUpdated(payload: PricingUpdatedEvent) {
    this.eventEmitter.emit('pricing.updated', payload);
  }
}
