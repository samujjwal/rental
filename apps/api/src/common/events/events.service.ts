import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, PaymentStatus, ListingStatus } from '@rental-portal/database';

// Event payloads
export interface BookingCreatedEvent {
  bookingId: string;
  renterId: string;
  ownerId: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
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
  status: PaymentStatus;
  renterId: string;
  ownerId: string;
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

  emitPaymentRefunded(payload: PaymentProcessedEvent) {
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
}
