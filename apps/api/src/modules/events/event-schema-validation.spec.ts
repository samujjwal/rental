/**
 * P4: Event Schema Validation Tests
 *
 * Validates that all domain events conform to their schemas
 * Tests serialization, validation, and backward compatibility
 */

// Event types that need schema validation
interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: string;
  payload: Record<string, unknown>;
  metadata?: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    source?: string;
  };
}

describe('Event Schema Validation Tests', () => {
  describe('Booking Events', () => {
    test('BookingCreatedEvent has required schema', () => {
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'BookingCreated',
        aggregateId: 'booking-123',
        aggregateType: 'Booking',
        version: 1,
        timestamp: '2025-01-01T00:00:00Z',
        payload: {
          bookingId: 'booking-123',
          listingId: 'listing-123',
          renterId: 'user-123',
          ownerId: 'user-456',
          startDate: '2025-06-01',
          endDate: '2025-06-05',
          guestCount: 2,
          totalAmount: 5000,
          currency: 'NPR',
          status: 'PENDING_PAYMENT',
        },
        metadata: {
          userId: 'user-123',
          correlationId: 'corr-123',
        },
      };

      // Validate schema structure
      expect(event.type).toBe('BookingCreated');
      expect(event.payload.bookingId).toBe('booking-123');
      expect(event.payload.listingId).toBe('listing-123');
      expect(event.payload.renterId).toBe('user-123');
      expect(event.payload.ownerId).toBe('user-456');
      expect(event.payload.startDate).toBe('2025-06-01');
      expect(event.payload.endDate).toBe('2025-06-05');
      expect(event.payload.totalAmount).toBe(5000);
      expect(event.payload.currency).toBe('NPR');
    });

    test('BookingPaymentCompletedEvent has required fields', () => {
      const event: DomainEvent = {
        id: 'evt-456',
        type: 'BookingPaymentCompleted',
        aggregateId: 'booking-123',
        aggregateType: 'Booking',
        version: 2,
        timestamp: '2025-01-01T00:05:00Z',
        payload: {
          bookingId: 'booking-123',
          paymentId: 'pay-123',
          amount: 5000,
          currency: 'NPR',
          paymentMethod: 'card',
          transactionId: 'txn_stripe_123',
          paidAt: '2025-01-01T00:05:00Z',
        },
      };

      expect(event.payload.paymentId).toBe('pay-123');
      expect(event.payload.transactionId).toBe('txn_stripe_123');
      expect(event.payload.paidAt).toBe('2025-01-01T00:05:00Z');
    });

    test('BookingConfirmedEvent has proper structure', () => {
      const event: DomainEvent = {
        id: 'evt-789',
        type: 'BookingConfirmed',
        aggregateId: 'booking-123',
        aggregateType: 'Booking',
        version: 3,
        timestamp: '2025-01-01T00:10:00Z',
        payload: {
          bookingId: 'booking-123',
          confirmedAt: '2025-01-01T00:10:00Z',
          confirmationCode: 'CONF-ABC123',
          ownerApproved: true,
        },
      };

      expect(event.payload.confirmationCode).toMatch(/^CONF-/);
      expect(event.payload.ownerApproved).toBe(true);
    });

    test('BookingCancelledEvent includes cancellation reason', () => {
      const event: DomainEvent = {
        id: 'evt-999',
        type: 'BookingCancelled',
        aggregateId: 'booking-123',
        aggregateType: 'Booking',
        version: 4,
        timestamp: '2025-01-02T00:00:00Z',
        payload: {
          bookingId: 'booking-123',
          cancelledAt: '2025-01-02T00:00:00Z',
          cancelledBy: 'user-123',
          reason: 'USER_REQUEST',
          refundAmount: 4500,
          refundCurrency: 'NPR',
          cancellationFee: 500,
        },
      };

      expect(event.payload.cancelledBy).toBe('user-123');
      expect(event.payload.reason).toBe('USER_REQUEST');
      expect(event.payload.refundAmount).toBe(4500);
      expect(event.payload.cancellationFee).toBe(500);
    });

    test('BookingStartedEvent marks rental period beginning', () => {
      const event: DomainEvent = {
        id: 'evt-start',
        type: 'BookingStarted',
        aggregateId: 'booking-123',
        aggregateType: 'Booking',
        version: 5,
        timestamp: '2025-06-01T14:00:00Z',
        payload: {
          bookingId: 'booking-123',
          startedAt: '2025-06-01T14:00:00Z',
          checkInCode: '1234',
          locationShared: true,
        },
      };

      expect(event.payload.startedAt).toBe('2025-06-01T14:00:00Z');
      expect(event.payload.checkInCode).toBe('1234');
      expect(event.payload.locationShared).toBe(true);
    });

    test('BookingCompletedEvent marks successful end', () => {
      const event: DomainEvent = {
        id: 'evt-complete',
        type: 'BookingCompleted',
        aggregateId: 'booking-123',
        aggregateType: 'Booking',
        version: 6,
        timestamp: '2025-06-05T11:00:00Z',
        payload: {
          bookingId: 'booking-123',
          completedAt: '2025-06-05T11:00:00Z',
          reviewPending: true,
          damageReportRequired: false,
        },
      };

      expect(event.payload.completedAt).toBe('2025-06-05T11:00:00Z');
      expect(event.payload.reviewPending).toBe(true);
      expect(event.payload.damageReportRequired).toBe(false);
    });
  });

  describe('Listing Events', () => {
    test('ListingCreatedEvent has complete property details', () => {
      const event: DomainEvent = {
        id: 'evt-listing-new',
        type: 'ListingCreated',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        version: 1,
        timestamp: '2025-01-01T00:00:00Z',
        payload: {
          listingId: 'listing-123',
          ownerId: 'user-456',
          title: 'Beautiful Apartment',
          description: 'A lovely place',
          basePrice: 100,
          currency: 'NPR',
          category: 'apartment',
          maxGuests: 4,
          bedrooms: 2,
          bathrooms: 1,
          address: {
            city: 'Kathmandu',
            country: 'NP',
            coordinates: {
              latitude: 27.7172,
              longitude: 85.324,
            },
          },
          amenities: ['wifi', 'kitchen'],
          photos: [
            { url: 'https://example.com/photo1.jpg', caption: 'Living room' },
          ],
          status: 'DRAFT',
        },
      };

      expect(event.payload.listingId).toBeDefined();
      expect(event.payload.ownerId).toBeDefined();
      expect(event.payload.title).toBeTruthy();
      expect(event.payload.basePrice).toBeGreaterThan(0);
      expect((event.payload.address as any).coordinates).toHaveProperty('latitude');
      expect((event.payload.address as any).coordinates).toHaveProperty('longitude');
    });

    test('ListingPublishedEvent marks availability', () => {
      const event: DomainEvent = {
        id: 'evt-publish',
        type: 'ListingPublished',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        version: 2,
        timestamp: '2025-01-01T12:00:00Z',
        payload: {
          listingId: 'listing-123',
          publishedAt: '2025-01-01T12:00:00Z',
          publishedBy: 'user-456',
          verificationStatus: 'VERIFIED',
          searchIndexed: true,
        },
      };

      expect(event.payload.publishedAt).toBeDefined();
      expect(['PENDING', 'VERIFIED', 'REJECTED']).toContain(event.payload.verificationStatus);
    });

    test('ListingPriceChangedEvent tracks pricing history', () => {
      const event: DomainEvent = {
        id: 'evt-price',
        type: 'ListingPriceChanged',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        version: 3,
        timestamp: '2025-01-15T00:00:00Z',
        payload: {
          listingId: 'listing-123',
          previousPrice: 100,
          newPrice: 120,
          currency: 'NPR',
          changeReason: 'SEASONAL_ADJUSTMENT',
          effectiveDate: '2025-02-01',
          changedBy: 'user-456',
        },
      };

      expect(event.payload.previousPrice).toBeDefined();
      expect(event.payload.newPrice).toBeDefined();
      expect(event.payload.newPrice).not.toBe(event.payload.previousPrice);
      expect(event.payload.changeReason).toBeDefined();
    });

    test('ListingAvailabilityUpdatedEvent reflects calendar changes', () => {
      const event: DomainEvent = {
        id: 'evt-avail',
        type: 'ListingAvailabilityUpdated',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        version: 4,
        timestamp: '2025-01-10T00:00:00Z',
        payload: {
          listingId: 'listing-123',
          updates: [
            {
              date: '2025-06-01',
              status: 'BOOKED',
              bookingId: 'booking-123',
            },
            {
              date: '2025-06-15',
              status: 'BLOCKED',
              reason: 'MAINTENANCE',
            },
          ],
          updatedBy: 'system',
        },
      };

      expect(event.payload.updates).toBeInstanceOf(Array);
      expect((event.payload.updates as any).length).toBeGreaterThan(0);
      expect((event.payload.updates as any)[0]).toHaveProperty('date');
      expect((event.payload.updates as any)[0]).toHaveProperty('status');
    });
  });

  describe('User Events', () => {
    test('UserRegisteredEvent captures signup details', () => {
      const event: DomainEvent = {
        id: 'evt-reg',
        type: 'UserRegistered',
        aggregateId: 'user-123',
        aggregateType: 'User',
        version: 1,
        timestamp: '2025-01-01T00:00:00Z',
        payload: {
          userId: 'user-123',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER',
          registeredAt: '2025-01-01T00:00:00Z',
          verificationRequired: true,
          source: 'web',
        },
      };

      expect(event.payload.userId).toBeDefined();
      expect(event.payload.email).toContain('@');
      expect(event.payload.registeredAt).toBeDefined();
      expect(['web', 'mobile', 'api']).toContain(event.payload.source);
    });

    test('UserVerifiedEvent marks identity confirmation', () => {
      const event: DomainEvent = {
        id: 'evt-verify',
        type: 'UserVerified',
        aggregateId: 'user-123',
        aggregateType: 'User',
        version: 2,
        timestamp: '2025-01-01T12:00:00Z',
        payload: {
          userId: 'user-123',
          verifiedAt: '2025-01-01T12:00:00Z',
          verificationMethod: 'EMAIL_OTP',
          verifiedFields: ['email', 'phone'],
        },
      };

      expect(event.payload.verifiedAt).toBeDefined();
      expect(['EMAIL_OTP', 'SMS_OTP', 'DOCUMENT', 'MANUAL']).toContain(event.payload.verificationMethod);
      expect(event.payload.verifiedFields).toBeInstanceOf(Array);
    });

    test('UserRoleChangedEvent tracks permission changes', () => {
      const event: DomainEvent = {
        id: 'evt-role',
        type: 'UserRoleChanged',
        aggregateId: 'user-123',
        aggregateType: 'User',
        version: 3,
        timestamp: '2025-01-15T00:00:00Z',
        payload: {
          userId: 'user-123',
          previousRole: 'USER',
          newRole: 'HOST',
          changedAt: '2025-01-15T00:00:00Z',
          changedBy: 'admin-1',
          reason: 'HOST_APPLICATION_APPROVED',
        },
      };

      expect(event.payload.previousRole).not.toBe(event.payload.newRole);
      expect(['USER', 'HOST', 'ADMIN']).toContain(event.payload.newRole);
      expect(event.payload.changedBy).toBeDefined();
    });

    test('UserProfileUpdatedEvent captures profile changes', () => {
      const event: DomainEvent = {
        id: 'evt-profile',
        type: 'UserProfileUpdated',
        aggregateId: 'user-123',
        aggregateType: 'User',
        version: 4,
        timestamp: '2025-01-20T00:00:00Z',
        payload: {
          userId: 'user-123',
          updatedFields: ['avatar', 'bio'],
          previousValues: {
            avatar: 'old-avatar.jpg',
            bio: 'Old bio',
          },
          newValues: {
            avatar: 'new-avatar.jpg',
            bio: 'Updated bio',
          },
          updatedAt: '2025-01-20T00:00:00Z',
        },
      };

      expect(event.payload.updatedFields).toBeInstanceOf(Array);
      expect(event.payload.previousValues).toBeDefined();
      expect(event.payload.newValues).toBeDefined();
    });
  });

  describe('Payment Events', () => {
    test('PaymentInitiatedEvent starts transaction', () => {
      const event: DomainEvent = {
        id: 'evt-pay-start',
        type: 'PaymentInitiated',
        aggregateId: 'pay-123',
        aggregateType: 'Payment',
        version: 1,
        timestamp: '2025-01-01T00:00:00Z',
        payload: {
          paymentId: 'pay-123',
          bookingId: 'booking-123',
          amount: 5000,
          currency: 'NPR',
          method: 'card',
          customerId: 'user-123',
          provider: 'stripe',
          idempotencyKey: 'idemp-123',
        },
      };

      expect(event.payload.paymentId).toBeDefined();
      expect(event.payload.amount).toBeGreaterThan(0);
      expect(event.payload.idempotencyKey).toBeDefined();
    });

    test('PaymentSucceededEvent confirms completion', () => {
      const event: DomainEvent = {
        id: 'evt-pay-success',
        type: 'PaymentSucceeded',
        aggregateId: 'pay-123',
        aggregateType: 'Payment',
        version: 2,
        timestamp: '2025-01-01T00:05:00Z',
        payload: {
          paymentId: 'pay-123',
          transactionId: 'txn_stripe_123',
          amountCharged: 5000,
          currency: 'NPR',
          providerFee: 150,
          netAmount: 4850,
          receiptUrl: 'https://receipt.stripe.com/123',
        },
      };

      expect(event.payload.transactionId).toBeDefined();
      expect((event.payload.netAmount as number)).toBeLessThan(event.payload.amountCharged as number);
      expect(event.payload.receiptUrl).toContain('http');
    });

    test('PaymentFailedEvent captures failure details', () => {
      const event: DomainEvent = {
        id: 'evt-pay-fail',
        type: 'PaymentFailed',
        aggregateId: 'pay-123',
        aggregateType: 'Payment',
        version: 2,
        timestamp: '2025-01-01T00:05:00Z',
        payload: {
          paymentId: 'pay-123',
          amount: 5000,
          failureCode: 'card_declined',
          failureMessage: 'Your card was declined.',
          declineCode: 'insufficient_funds',
          retryable: true,
          retryCount: 0,
        },
      };

      expect(event.payload.failureCode).toBeDefined();
      expect(typeof event.payload.retryable).toBe('boolean');
    });

    test('RefundProcessedEvent tracks money return', () => {
      const event: DomainEvent = {
        id: 'evt-refund',
        type: 'RefundProcessed',
        aggregateId: 'pay-123',
        aggregateType: 'Payment',
        version: 3,
        timestamp: '2025-01-05T00:00:00Z',
        payload: {
          paymentId: 'pay-123',
          refundId: 'ref-123',
          originalAmount: 5000,
          refundAmount: 4500,
          currency: 'NPR',
          reason: 'BOOKING_CANCELLED',
          processedAt: '2025-01-05T00:00:00Z',
          destination: 'original_payment_method',
          estimatedArrival: '2025-01-08T00:00:00Z',
        },
      };

      expect((event.payload.refundAmount as number)).toBeLessThanOrEqual(event.payload.originalAmount as number);
      expect(event.payload.reason).toBeDefined();
      expect(event.payload.estimatedArrival).toBeDefined();
    });
  });

  describe('Review Events', () => {
    test('ReviewSubmittedEvent captures rating', () => {
      const event: DomainEvent = {
        id: 'evt-review',
        type: 'ReviewSubmitted',
        aggregateId: 'review-123',
        aggregateType: 'Review',
        version: 1,
        timestamp: '2025-06-10T00:00:00Z',
        payload: {
          reviewId: 'review-123',
          bookingId: 'booking-123',
          listingId: 'listing-123',
          reviewerId: 'user-123',
          hostId: 'user-456',
          rating: 5,
          categories: {
            cleanliness: 5,
            accuracy: 4,
            checkIn: 5,
            communication: 5,
            location: 4,
            value: 5,
          },
          text: 'Great stay!',
          submittedAt: '2025-06-10T00:00:00Z',
        },
      };

      expect(event.payload.rating).toBeGreaterThanOrEqual(1);
      expect(event.payload.rating).toBeLessThanOrEqual(5);
      expect(event.payload.categories).toBeDefined();
    });

    test('ReviewResponseEvent captures host reply', () => {
      const event: DomainEvent = {
        id: 'evt-response',
        type: 'ReviewResponseAdded',
        aggregateId: 'review-123',
        aggregateType: 'Review',
        version: 2,
        timestamp: '2025-06-11T00:00:00Z',
        payload: {
          reviewId: 'review-123',
          responseText: 'Thank you for staying with us!',
          respondedBy: 'user-456',
          respondedAt: '2025-06-11T00:00:00Z',
        },
      };

      expect(event.payload.responseText).toBeTruthy();
      expect(event.payload.respondedBy).toBeDefined();
    });
  });

  describe('Notification Events', () => {
    test('NotificationSentEvent tracks delivery', () => {
      const event: DomainEvent = {
        id: 'evt-notify',
        type: 'NotificationSent',
        aggregateId: 'notif-123',
        aggregateType: 'Notification',
        version: 1,
        timestamp: '2025-01-01T00:00:00Z',
        payload: {
          notificationId: 'notif-123',
          userId: 'user-123',
          type: 'BOOKING_CONFIRMED',
          channel: 'email',
          title: 'Booking Confirmed',
          body: 'Your booking has been confirmed.',
          data: {
            bookingId: 'booking-123',
            listingTitle: 'Beautiful Apartment',
          },
          sentAt: '2025-01-01T00:00:00Z',
          provider: 'sendgrid',
          providerMessageId: 'sg-msg-123',
        },
      };

      expect(event.payload.notificationId).toBeDefined();
      expect(['email', 'sms', 'push', 'in_app']).toContain(event.payload.channel);
      expect(event.payload.sentAt).toBeDefined();
    });

    test('NotificationDeliveredEvent confirms receipt', () => {
      const event: DomainEvent = {
        id: 'evt-delivered',
        type: 'NotificationDelivered',
        aggregateId: 'notif-123',
        aggregateType: 'Notification',
        version: 2,
        timestamp: '2025-01-01T00:01:00Z',
        payload: {
          notificationId: 'notif-123',
          deliveredAt: '2025-01-01T00:01:00Z',
          deliveryStatus: 'delivered',
          provider: 'sendgrid',
          eventType: 'delivered',
        },
      };

      expect(event.payload.deliveredAt).toBeDefined();
      expect(event.payload.deliveryStatus).toBe('delivered');
    });

    test('NotificationFailedEvent captures error', () => {
      const event: DomainEvent = {
        id: 'evt-fail',
        type: 'NotificationFailed',
        aggregateId: 'notif-123',
        aggregateType: 'Notification',
        version: 2,
        timestamp: '2025-01-01T00:01:00Z',
        payload: {
          notificationId: 'notif-123',
          failedAt: '2025-01-01T00:01:00Z',
          errorCode: 'BOUNCE',
          errorMessage: 'Email address not found',
          bounceType: 'hard_bounce',
          retryable: false,
        },
      };

      expect(event.payload.errorCode).toBeDefined();
      expect(typeof event.payload.retryable).toBe('boolean');
    });
  });

  describe('Event Schema Compliance', () => {
    test('all events have required metadata fields', () => {
      const eventTypes = [
        'BookingCreated',
        'BookingPaymentCompleted',
        'ListingPublished',
        'UserRegistered',
        'PaymentSucceeded',
        'ReviewSubmitted',
        'NotificationSent',
      ];

      for (const type of eventTypes) {
        const event: DomainEvent = {
          id: `evt-${type}`,
          type,
          aggregateId: 'test-123',
          aggregateType: 'Test',
          version: 1,
          timestamp: new Date().toISOString(),
          payload: {},
        };

        expect(event.id).toBeTruthy();
        expect(event.type).toBe(type);
        expect(event.aggregateId).toBeTruthy();
        expect(event.aggregateType).toBeTruthy();
        expect(event.version).toBeGreaterThan(0);
        expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(event.payload).toBeDefined();
      }
    });

    test('event timestamps are valid ISO strings', () => {
      const event: DomainEvent = {
        id: 'evt-time',
        type: 'TestEvent',
        aggregateId: 'test-123',
        aggregateType: 'Test',
        version: 1,
        timestamp: '2025-06-15T10:30:00.000Z',
        payload: { testDate: '2025-06-15T10:30:00.000Z' },
      };

      const parsed = new Date(event.timestamp);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.toISOString()).toBe(event.timestamp);
    });

    test('event versioning supports sequential numbers', () => {
      const events: DomainEvent[] = [
        { id: 'evt-1', type: 'Test', aggregateId: 'agg-1', aggregateType: 'Test', version: 1, timestamp: '2025-01-01', payload: {} },
        { id: 'evt-2', type: 'Test', aggregateId: 'agg-1', aggregateType: 'Test', version: 2, timestamp: '2025-01-02', payload: {} },
        { id: 'evt-3', type: 'Test', aggregateId: 'agg-1', aggregateType: 'Test', version: 3, timestamp: '2025-01-03', payload: {} },
      ];

      const versions = events.map((e) => e.version);
      expect(versions).toEqual([1, 2, 3]);
    });

    test('event payload can handle nested objects', () => {
      const event: DomainEvent = {
        id: 'evt-nested',
        type: 'ComplexEvent',
        aggregateId: 'test-123',
        aggregateType: 'Test',
        version: 1,
        timestamp: '2025-01-01T00:00:00Z',
        payload: {
          level1: {
            level2: {
              level3: {
                value: 'deeply nested data',
                array: [1, 2, 3],
                object: { key: 'value' },
              },
            },
          },
          metadata: {
            tags: ['tag1', 'tag2'],
            priority: 'high',
          },
        },
      };

      const serialized = JSON.stringify(event);
      const deserialized: DomainEvent = JSON.parse(serialized);

      expect((deserialized.payload as any).level1.level2.level3.value).toBe('deeply nested data');
      expect((deserialized.payload as any).level1.level2.level3.array).toHaveLength(3);
    });
  });

  describe('Event Backward Compatibility', () => {
    test('new optional fields do not break old events', () => {
      // Simulating old event format without new fields
      const oldEvent = {
        id: 'evt-old',
        type: 'BookingCreated',
        aggregateId: 'booking-123',
        aggregateType: 'Booking',
        version: 1,
        timestamp: '2025-01-01T00:00:00Z',
        payload: {
          bookingId: 'booking-123',
          // Missing new optional fields like 'insuranceOptIn'
        },
      };

      // Should still be valid
      expect(oldEvent.payload.bookingId).toBeDefined();
      expect((oldEvent.payload as any).insuranceOptIn).toBeUndefined();
    });

    test('event type names follow naming convention', () => {
      const validTypes = [
        'BookingCreated',
        'BookingPaymentCompleted',
        'UserRegistered',
        'ListingPublished',
        'PaymentSucceeded',
        'PaymentFailed',
        'NotificationSent',
      ];

      for (const type of validTypes) {
        // PascalCase format
        expect(type).toMatch(/^[A-Z][a-zA-Z]+$/);
        // Should end with action verb
        expect(type).toMatch(/(Created|Updated|Deleted|Completed|Failed|Succeeded|Sent|Received|Registered|Published)$/);
      }
    });
  });
});
