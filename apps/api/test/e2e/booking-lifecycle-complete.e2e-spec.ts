import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * COMPLETE BOOKING LIFECYCLE E2E TESTS
 * 
 * These tests validate the end-to-end booking workflow:
 * 1. Booking Creation → Payment → Confirmation → Completion
 * 2. State transitions through all booking states
 * 3. Payment processing with Stripe integration
 * 4. Owner actions (approve, reject, start rental)
 * 5. Renter actions (cancel, request return)
 * 6. Review and rating submission
 * 7. Dispute resolution
 * 
 * These tests use real API endpoints and validate the complete user journey.
 */
describe('Booking Lifecycle - Complete E2E Tests', () => {
  let app: INestApplication;
  let renterAccessToken: string;
  let ownerAccessToken: string;
  let adminAccessToken: string;
  let renterId: string;
  let ownerId: string;
  let listingId: string;
  let bookingId: string;
  let paymentIntentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Setup: User Registration and Authentication', () => {
    it('should register renter user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'renter-e2e@example.com',
          username: 'renter-e2e',
          password: 'SecurePassword123!',
          firstName: 'Jane',
          lastName: 'Renter',
        })
        .expect(201);

      const { user, token } = response.body;
      renterId = user.id;
      renterAccessToken = token;

      expect(user).toBeDefined();
      expect(user.email).toBe('renter-e2e@example.com');
      expect(user.role).toBe('CUSTOMER');
      expect(token).toBeDefined();
    });

    it('should register owner user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'owner-e2e@example.com',
          username: 'owner-e2e',
          password: 'SecurePassword123!',
          firstName: 'John',
          lastName: 'Owner',
        })
        .expect(201);

      const { user, token } = response.body;
      ownerId = user.id;
      ownerAccessToken = token;

      expect(user).toBeDefined();
      expect(user.email).toBe('owner-e2e@example.com');
      expect(token).toBeDefined();
    });

    it('should login as admin user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123', // Assuming admin user exists
        })
        .expect(200);

      const { token } = response.body;
      adminAccessToken = token;

      expect(token).toBeDefined();
    });

    it('should verify renter email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          token: 'verification-token', // In real test, this would be from email
        })
        .expect(200);
    });

    it('should verify owner email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          token: 'verification-token',
        })
        .expect(200);
    });
  });

  describe('Setup: Listing Creation by Owner', () => {
    it('should create a new listing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Modern Apartment in Kathmandu',
          description: 'Beautiful 2-bedroom apartment with city views',
          categoryId: 'vehicles', // Using existing category
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Thamel',
            city: 'Kathmandu',
            state: 'Bagmati',
            postalCode: '44600',
            country: 'Nepal',
            latitude: 27.7172,
            longitude: 85.3240,
          },
          amenities: ['wifi', 'parking', 'ac'],
          houseRules: ['No smoking', 'No pets'],
          checkInTime: '14:00',
          checkOutTime: '11:00',
          minimumNights: 1,
          maximumNights: 30,
        })
        .expect(201);

      const listing = response.body;
      listingId = listing.id;

      expect(listing).toBeDefined();
      expect(listing.id).toBeDefined();
      expect(listing.title).toBe('Modern Apartment in Kathmandu');
      expect(listing.status).toBe('DRAFT');
    });

    it('should upload listing images', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .attach('images', Buffer.from('fake-image-data-1'), 'image1.jpg')
        .attach('images', Buffer.from('fake-image-data-2'), 'image2.jpg')
        .attach('images', Buffer.from('fake-image-data-3'), 'image3.jpg')
        .expect(200);
    });

    it('should publish listing', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}/publish`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('AVAILABLE');
    });
  });

  describe('Booking Creation Flow', () => {
    it('should check availability for dates', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/availability`)
        .query({
          startDate: '2026-06-01',
          endDate: '2026-06-03',
        })
        .expect(200);

      expect(response.body.isAvailable).toBe(true);
      expect(response.body.availableSlots).toBeDefined();
    });

    it('should calculate booking price', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/calculate-price`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId,
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          guestCount: 2,
        })
        .expect(200);

      const pricing = response.body;
      expect(pricing).toBeDefined();
      expect(pricing.subtotal).toBeGreaterThan(0);
      expect(pricing.total).toBeGreaterThan(0);
      expect(pricing.breakdown).toBeDefined();
      expect(pricing.breakdown.duration).toBe(2); // 2 days
    });

    it('should create booking request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId,
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          guestCount: 2,
          specialRequests: 'Early check-in if possible, please',
        })
        .expect(201);

      const booking = response.body;
      bookingId = booking.id;

      expect(booking).toBeDefined();
      expect(booking.id).toBeDefined();
      expect(booking.status).toBe('PENDING_PAYMENT');
      expect(booking.listingId).toBe(listingId);
      expect(booking.renterId).toBe(renterId);
      expect(booking.totalPrice).toBeGreaterThan(0);
    });

    it('should retrieve booking details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(bookingId);
      expect(response.body.status).toBe('PENDING_PAYMENT');
    });
  });

  describe('Payment Processing Flow', () => {
    it('should create payment intent', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/payments/intents/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          amount: 30000, // $300.00 in cents
          currency: 'USD',
        })
        .expect(201);

      const { clientSecret, paymentIntentId: piId } = response.body;
      paymentIntentId = piId;

      expect(clientSecret).toBeDefined();
      expect(paymentIntentId).toBeDefined();
      expect(paymentIntentId).toMatch(/^pi_/);
    });

    it('should confirm payment (simulated webhook)', async () => {
      // Simulate Stripe payment_intent.succeeded webhook
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          id: 'evt_test_webhook',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentIntentId,
              status: 'succeeded',
              amount: 30000,
              currency: 'usd',
              metadata: {
                bookingId,
              },
            },
          },
        })
        .expect(200);
    });

    it('should verify booking status after payment', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');
    });

    it('should verify payment record', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/payments`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].status).toBe('COMPLETED');
    });
  });

  describe('Owner Actions Flow', () => {
    it('should approve booking (owner action)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.newState).toBe('CONFIRMED');
    });

    it('should start rental (owner action)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          notes: 'Keys handed over, condition noted',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.newState).toBe('IN_PROGRESS');
    });

    it('should verify booking is in progress', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('IN_PROGRESS');
    });
  });

  describe('Renter Actions Flow', () => {
    it('should request return (renter action)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/request-return`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          returnTime: '2026-06-03T10:00:00Z',
          notes: 'Returned on time, no issues',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should approve return (owner action)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/approve-return`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          conditionRating: 'EXCELLENT',
          notes: 'Property in excellent condition',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.newState).toBe('COMPLETED');
    });

    it('should verify booking is completed', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
    });
  });

  describe('Review and Rating Flow', () => {
    it('should submit renter review for owner', async () => {
      await request(app.getHttpServer())
        .post(`/api/reviews`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          bookingId,
          targetType: 'OWNER',
          targetId: ownerId,
          rating: 5,
          comment: 'Great host, very responsive and helpful!',
        })
        .expect(201);
    });

    it('should submit owner review for renter', async () => {
      await request(app.getHttpServer())
        .post(`/api/reviews`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          bookingId,
          targetType: 'RENTER',
          targetId: renterId,
          rating: 5,
          comment: 'Excellent guest, respectful and clean!',
        })
        .expect(201);
    });

    it('should submit listing review', async () => {
      await request(app.getHttpServer())
        .post(`/api/reviews`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          bookingId,
          targetType: 'LISTING',
          targetId: listingId,
          rating: 5,
          comment: 'Beautiful apartment, exactly as described!',
        })
        .expect(201);
    });

    it('should retrieve reviews for booking', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/reviews`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBe(3); // Owner, renter, listing reviews
    });
  });

  describe('Payout Flow', () => {
    it('should trigger payout for owner', async () => {
      // This would typically be automated, but we trigger it manually for testing
      const response = await request(app.getHttpServer())
        .post(`/api/payouts/create`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          ownerId,
          bookingId,
          amount: 27000, // 90% of $300 after platform fee
          currency: 'USD',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('PENDING');
    });

    it('should verify payout record', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payouts/owner/${ownerId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Cancellation Flow (New Booking)', () => {
    let cancellationBookingId: string;
    let cancellationPaymentIntentId: string;

    it('should create another booking for cancellation test', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId,
          startDate: '2026-07-01',
          endDate: '2026-07-05',
          guestCount: 2,
        })
        .expect(201);

      cancellationBookingId = response.body.id;
    });

    it('should create payment intent for cancellation booking', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/payments/intents/${cancellationBookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          amount: 40000,
          currency: 'USD',
        })
        .expect(201);

      cancellationPaymentIntentId = response.body.paymentIntentId;
    });

    it('should cancel booking by renter', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${cancellationBookingId}/cancel`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          reason: 'Change of plans',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.newState).toBe('CANCELLED');
    });

    it('should process refund for cancelled booking', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/payments/refund`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          paymentIntentId: cancellationPaymentIntentId,
          amount: 40000,
          reason: 'CANCELLED_BY_RENTER',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('SUCCEEDED');
    });

    it('should verify cancellation booking status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${cancellationBookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
      expect(response.body.cancellationReason).toBe('Change of plans');
    });
  });

  describe('Dispute Flow', () => {
    let disputeBookingId: string;

    it('should create booking for dispute test', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId,
          startDate: '2026-08-01',
          endDate: '2026-08-03',
          guestCount: 2,
        })
        .expect(201);

      disputeBookingId = response.body.id;
    });

    it('should complete booking through payment and state transitions', async () => {
      // Create payment intent
      const paymentResponse = await request(app.getHttpServer())
        .post(`/api/payments/intents/${disputeBookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          amount: 30000,
          currency: 'USD',
        })
        .expect(201);

      const piId = paymentResponse.paymentIntentId;

      // Simulate payment webhook
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          id: 'evt_test_dispute',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: piId,
              status: 'succeeded',
              amount: 30000,
              currency: 'usd',
              metadata: { bookingId: disputeBookingId },
            },
          },
        })
        .expect(200);

      // Start rental
      await request(app.getHttpServer())
        .post(`/api/bookings/${disputeBookingId}/start`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      // Request return
      await request(app.getHttpServer())
        .post(`/api/bookings/${disputeBookingId}/request-return`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      // Approve return with condition issue
      await request(app.getHttpServer())
        .post(`/api/bookings/${disputeBookingId}/approve-return`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          conditionRating: 'POOR',
          notes: 'Damage to furniture found',
        })
        .expect(200);
    });

    it('should create dispute by renter', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/disputes')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          bookingId: disputeBookingId,
          type: 'DAMAGE',
          description: 'Furniture was already damaged when I arrived',
          amount: 5000,
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('OPEN');
    });

    it('should add evidence to dispute', async () => {
      const disputeResponse = await request(app.getHttpServer())
        .get('/api/disputes')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      const disputeId = disputeResponse.body[0].id;

      await request(app.getHttpServer())
        .post(`/api/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .attach('photos', Buffer.from('evidence-photo'), 'photo.jpg')
        .send({
          description: 'Photo showing pre-existing damage',
        })
        .expect(200);
    });

    it('should escalate dispute to admin', async () => {
      const disputeResponse = await request(app.getHttpServer())
        .get('/api/disputes')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      const disputeId = disputeResponse.body[0].id;

      const response = await request(app.getHttpServer())
        .post(`/api/disputes/${disputeId}/escalate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          notes: 'Requires admin review',
        })
        .expect(200);

      expect(response.body.status).toBe('UNDER_REVIEW');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should reject booking for unavailable dates', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId,
          startDate: '2026-06-01',
          endDate: '2026-06-03', // Same dates as first booking
          guestCount: 2,
        })
        .expect(400);
    });

    it('should reject booking with invalid dates', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId,
          startDate: '2026-06-03',
          endDate: '2026-06-01', // End before start
          guestCount: 2,
        })
        .expect(400);
    });

    it('should reject payment for non-existent booking', async () => {
      await request(app.getHttpServer())
        .post(`/api/payments/intents/non-existent-booking`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          amount: 10000,
          currency: 'USD',
        })
        .expect(404);
    });

    it('should prevent duplicate reviews', async () => {
      // Try to submit another review for the same booking
      await request(app.getHttpServer())
        .post(`/api/reviews`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          bookingId,
          targetType: 'OWNER',
          targetId: ownerId,
          rating: 4,
          comment: 'Duplicate review attempt',
        })
        .expect(400); // Should reject duplicate
    });

    it('should prevent unauthorized booking access', async () => {
      // Try to access booking without auth
      await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .expect(401);
    });

    it('should prevent cross-user booking modification', async () => {
      // Renter trying to approve their own booking (owner action)
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(403); // Forbidden
    });
  });

  describe('State History and Audit Trail', () => {
    it('should retrieve booking state history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/history`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify state transitions
      const states = response.body.map(h => h.newState);
      expect(states).toContain('PENDING_PAYMENT');
      expect(states).toContain('CONFIRMED');
      expect(states).toContain('IN_PROGRESS');
      expect(states).toContain('COMPLETED');
    });

    it('should retrieve booking audit logs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/audit-logs`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Notification Flow', () => {
    it('should verify notifications were sent for booking events', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);

      // Verify booking-related notifications exist
      const bookingNotifications = response.body.filter(
        (n: any) => n.type === 'BOOKING' || n.type === 'PAYMENT'
      );
      expect(bookingNotifications.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should archive completed booking', async () => {
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/archive`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
    });

    it('should deactivate test listing', async () => {
      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}/deactivate`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
    });
  });
});
