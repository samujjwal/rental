import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  BookingCreatedEvent,
  BookingStatusChangedEvent,
  PaymentProcessedEvent,
  ListingCreatedEvent,
  ListingUpdatedEvent,
  ReviewCreatedEvent,
  DisputeCreatedEvent,
  MessageSentEvent,
  UserRegisteredEvent,
} from './events.service';
import { NotificationType } from '@rental-portal/database';

/**
 * Event listeners that handle cross-module communication
 * These listeners react to events and trigger appropriate actions
 */
@Injectable()
export class EventListeners {
  private readonly logger = new Logger(EventListeners.name);

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('search-indexing') private searchQueue: Queue,
    @InjectQueue('bookings') private bookingsQueue: Queue,
  ) {}

  // ==================== Booking Events ====================

  @OnEvent('booking.created')
  async handleBookingCreated(payload: BookingCreatedEvent) {
    this.logger.log(`Booking created: ${payload.bookingId}`);

    // Send notification to owner
    await this.notificationsQueue.add('send', {
      userId: payload.ownerId,
      type: NotificationType.BOOKING_REQUEST,
      title: 'New Booking Request',
      message: `You have a new booking request for your listing.`,
      data: { bookingId: payload.bookingId },
      channels: ['EMAIL', 'PUSH', 'IN_APP'],
    });

    // Schedule expiration check
    await this.bookingsQueue.add(
      'check-expiration',
      {
        bookingId: payload.bookingId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
      {
        delay: 30 * 60 * 1000,
      },
    );
  }

  @OnEvent('booking.confirmed')
  async handleBookingConfirmed(payload: BookingStatusChangedEvent) {
    this.logger.log(`Booking confirmed: ${payload.bookingId}`);

    // Notify renter
    await this.notificationsQueue.add('send', {
      userId: payload.renterId,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed!',
      data: { bookingId: payload.bookingId },
      channels: ['EMAIL', 'PUSH', 'IN_APP'],
      priority: 'HIGH',
    });

    // Schedule reminder 24 hours before start
    await this.bookingsQueue.add(
      'send-reminder',
      {
        bookingId: payload.bookingId,
        type: 'UPCOMING',
      },
      {
        delay: 24 * 60 * 60 * 1000, // 24 hours
      },
    );
  }

  @OnEvent('booking.cancelled')
  async handleBookingCancelled(payload: BookingStatusChangedEvent) {
    this.logger.log(`Booking cancelled: ${payload.bookingId}`);

    // Notify both parties
    const notifications = [
      {
        userId: payload.renterId,
        message: 'Your booking has been cancelled.',
      },
      {
        userId: payload.ownerId,
        message: 'A booking for your listing has been cancelled.',
      },
    ];

    for (const notif of notifications) {
      await this.notificationsQueue.add('send', {
        userId: notif.userId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Booking Cancelled',
        message: notif.message,
        data: {
          bookingId: payload.bookingId,
          reason: payload.reason,
        },
        channels: ['EMAIL', 'IN_APP'],
      });
    }
  }

  @OnEvent('booking.completed')
  async handleBookingCompleted(payload: BookingStatusChangedEvent) {
    this.logger.log(`Booking completed: ${payload.bookingId}`);

    // Prompt for reviews
    const reviewPrompts = [
      {
        userId: payload.renterId,
        message: 'How was your rental experience? Leave a review!',
      },
      {
        userId: payload.ownerId,
        message: 'Rate your renter to help the community.',
      },
    ];

    for (const prompt of reviewPrompts) {
      await this.notificationsQueue.add('send', {
        userId: prompt.userId,
        type: NotificationType.REVIEW_RECEIVED,
        title: 'Review Request',
        message: prompt.message,
        data: { bookingId: payload.bookingId },
        channels: ['EMAIL', 'IN_APP'],
      });
    }
  }

  // ==================== Payment Events ====================

  @OnEvent('payment.succeeded')
  async handlePaymentSucceeded(payload: PaymentProcessedEvent) {
    this.logger.log(`Payment succeeded: ${payload.paymentId}`);

    // Notify both parties
    await this.notificationsQueue.add('send-batch', {
      notifications: [
        {
          userId: payload.renterId,
          type: NotificationType.PAYOUT_PROCESSED,
          title: 'Payment Successful',
          message: `Your payment of $${payload.amount} has been processed.`,
          data: { paymentId: payload.paymentId },
          channels: ['EMAIL', 'IN_APP'],
        },
        {
          userId: payload.ownerId,
          type: NotificationType.PAYOUT_PROCESSED,
          title: 'Payment Received',
          message: `You received a payment of $${payload.amount}.`,
          data: { paymentId: payload.paymentId },
          channels: ['EMAIL', 'IN_APP'],
        },
      ],
    });
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(payload: PaymentProcessedEvent) {
    this.logger.log(`Payment failed: ${payload.paymentId}`);

    await this.notificationsQueue.add('send', {
      userId: payload.renterId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please update your payment method.',
      data: {
        paymentId: payload.paymentId,
        bookingId: payload.bookingId,
      },
      channels: ['EMAIL', 'PUSH', 'IN_APP'],
      priority: 'HIGH',
    });
  }

  @OnEvent('payment.refunded')
  async handlePaymentRefunded(payload: PaymentProcessedEvent) {
    this.logger.log(`Payment refunded: ${payload.paymentId}`);

    await this.notificationsQueue.add('send', {
      userId: payload.renterId,
      type: NotificationType.PAYOUT_PROCESSED,
      title: 'Refund Processed',
      message: `A refund of $${payload.amount} has been issued to your account.`,
      data: { paymentId: payload.paymentId },
      channels: ['EMAIL', 'IN_APP'],
    });
  }

  // ==================== Listing Events ====================

  @OnEvent('listing.created')
  async handleListingCreated(payload: ListingCreatedEvent) {
    this.logger.log(`Listing created: ${payload.listingId}`);

    // Index in Elasticsearch
    await this.searchQueue.add('index-listing', {
      listingId: payload.listingId,
      operation: 'index',
    });

    // Notify owner
    await this.notificationsQueue.add('send', {
      userId: payload.ownerId,
      type: NotificationType.LISTING_APPROVED,
      title: 'Listing Created',
      message: 'Your listing has been created and is pending review.',
      data: { listingId: payload.listingId },
      channels: ['IN_APP'],
    });
  }

  @OnEvent('listing.updated')
  async handleListingUpdated(payload: ListingUpdatedEvent) {
    this.logger.log(`Listing updated: ${payload.listingId}`);

    // Reindex in Elasticsearch
    await this.searchQueue.add('index-listing', {
      listingId: payload.listingId,
      operation: 'update',
    });
  }

  @OnEvent('listing.deleted')
  async handleListingDeleted(payload: { listingId: string; ownerId: string }) {
    this.logger.log(`Listing deleted: ${payload.listingId}`);

    // Remove from Elasticsearch
    await this.searchQueue.add('index-listing', {
      listingId: payload.listingId,
      operation: 'delete',
    });
  }

  @OnEvent('listing.status.active')
  async handleListingActivated(payload: any) {
    this.logger.log(`Listing activated: ${payload.listingId}`);

    await this.notificationsQueue.add('send', {
      userId: payload.ownerId,
      type: NotificationType.LISTING_APPROVED,
      title: 'Listing Approved',
      message: 'Your listing is now live and visible to renters!',
      data: { listingId: payload.listingId },
      channels: ['EMAIL', 'PUSH', 'IN_APP'],
    });
  }

  // ==================== Review Events ====================

  @OnEvent('review.created')
  async handleReviewCreated(payload: ReviewCreatedEvent) {
    this.logger.log(`Review created: ${payload.reviewId}`);

    // Notify reviewee
    await this.notificationsQueue.add('send', {
      userId: payload.revieweeId,
      type: NotificationType.REVIEW_RECEIVED,
      title: 'New Review',
      message: 'You received a new review!',
      data: {
        reviewId: payload.reviewId,
        bookingId: payload.bookingId,
      },
      channels: ['EMAIL', 'IN_APP'],
    });

    // Update search index if listing review
    if (payload.listingId) {
      await this.searchQueue.add('index-listing', {
        listingId: payload.listingId,
        operation: 'update',
      });
    }
  }

  // ==================== Dispute Events ====================

  @OnEvent('dispute.created')
  async handleDisputeCreated(payload: DisputeCreatedEvent) {
    this.logger.log(`Dispute created: ${payload.disputeId}`);

    // Notify admin team
    await this.notificationsQueue.add('send', {
      userId: 'admin', // Would need to fetch admin users
      type: NotificationType.DISPUTE_OPENED,
      title: 'New Dispute',
      message: `A new ${payload.type} dispute has been created.`,
      data: {
        disputeId: payload.disputeId,
        bookingId: payload.bookingId,
      },
      channels: ['EMAIL', 'IN_APP'],
      priority: 'HIGH',
    });
  }

  // ==================== Message Events ====================

  @OnEvent('message.sent')
  async handleMessageSent(payload: MessageSentEvent) {
    // Send push notifications to offline recipients
    for (const recipientId of payload.recipientIds) {
      await this.notificationsQueue.add('send', {
        userId: recipientId,
        type: NotificationType.MESSAGE_RECEIVED,
        title: 'New Message',
        message: 'You have a new message',
        data: {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
        },
        channels: ['PUSH'],
      });
    }
  }

  // ==================== User Events ====================

  @OnEvent('user.registered')
  async handleUserRegistered(payload: UserRegisteredEvent) {
    this.logger.log(`User registered: ${payload.userId}`);

    // Send welcome email
    await this.notificationsQueue.add('send', {
      userId: payload.userId,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: 'Welcome to Rental Portal!',
      message: 'Thank you for joining our community.',
      data: {},
      channels: ['EMAIL'],
    });
  }

  @OnEvent('user.verified.email')
  async handleEmailVerified(payload: { userId: string }) {
    this.logger.log(`Email verified: ${payload.userId}`);

    await this.notificationsQueue.add('send', {
      userId: payload.userId,
      type: NotificationType.VERIFICATION_COMPLETE,
      title: 'Email Verified',
      message: 'Your email has been successfully verified!',
      data: {},
      channels: ['IN_APP'],
    });
  }
}
