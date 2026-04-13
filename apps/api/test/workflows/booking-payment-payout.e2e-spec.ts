/**
 * Comprehensive API E2E Tests - Booking, Payment, Payout Workflows
 * 
 * Tests the complete end-to-end workflows for:
 * 1. Booking creation and lifecycle
 * 2. Payment processing and confirmation
 * 3. Payout processing and settlement
 * 4. Refund handling
 * 5. State transitions
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('API E2E - Booking, Payment, Payout Workflows', () => {
  let app: INestApplication;
  let renterToken: string;
  let ownerToken: string;
  let testListingId: string;
  let testBookingId: string;
  let testPaymentIntentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Setup test users
    const renterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'e2e-renter@example.com',
        username: 'e2e-renter',
        password: 'Password123!',
        firstName: 'E2E',
        lastName: 'Renter',
      });

    renterToken = renterResponse.body.token;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'e2e-owner@example.com',
        username: 'e2e-owner',
        password: 'Password123!',
        firstName: 'E2E',
        lastName: 'Owner',
      });

    ownerToken = ownerResponse.body.token;

    // Upgrade to host
    await request(app.getHttpServer())
      .post('/users/upgrade-to-host')
      .set('Authorization', `Bearer ${ownerToken}`);

    // Create test listing
    const listingResponse = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'E2E Test Listing',
        description: 'Testing complete booking workflow',
        address: '123 E2E St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'USA',
        latitude: 40.7128,
        longitude: -74.0060,
        type: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        basePrice: 100,
        currency: 'USD',
        amenities: ['wifi', 'parking'],
        photos: ['https://example.com/photo.jpg'],
      })
      .expect(201);

    testListingId = listingResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Booking Workflow', () => {
    it('should create a booking request', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: testListingId,
          startDate: '2026-10-01',
          endDate: '2026-10-03',
          guestCount: 2,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'PENDING_OWNER_APPROVAL');
      expect(response.body).toHaveProperty('listingId', testListingId);
      expect(response.body).toHaveProperty('totalPrice');

      testBookingId = response.body.id;
    });

    it('should get booking details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body.id).toBe(testBookingId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('totalPrice');
    });

    it('owner should approve the booking', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe('PENDING_PAYMENT');
    });

    it('should get available state transitions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/bookings/${testBookingId}/available-transitions`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('availableTransitions');
      expect(Array.isArray(response.body.availableTransitions)).toBe(true);
    });
  });

  describe('Payment Workflow', () => {
    it('should create payment intent', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/create-intent')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      expect(response.body).toHaveProperty('paymentIntentId');
      expect(response.body).toHaveProperty('clientSecret');
      expect(response.body).toHaveProperty('amount', 200);
      expect(response.body).toHaveProperty('currency', 'USD');

      testPaymentIntentId = response.body.paymentIntentId;
    });

    it('should get payment details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/payments/${testPaymentIntentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testPaymentIntentId);
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('status');
    });

    it('should handle payment confirmation webhook', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: testPaymentIntentId,
              status: 'succeeded',
              amount: 20000,
              currency: 'usd',
              metadata: { bookingId: testBookingId },
            },
          },
        })
        .expect(200);

      // Verify booking status updated
      const booking = await request(app.getHttpServer())
        .get(`/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(booking.body.status).toBe('CONFIRMED');
    });
  });

  describe('Payout Workflow', () => {
    it('should create payout for owner after booking completion', async () => {
      // First, complete the booking (simulate time passing)
      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/start`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/complete`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      // Create payout
      const response = await request(app.getHttpServer())
        .post('/payouts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          bookingId: testBookingId,
          amount: 180, // Platform fee deducted
          currency: 'USD',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'PENDING');
      expect(response.body).toHaveProperty('amount', 180);
    });

    it('should get payout details', async () => {
      const payouts = await request(app.getHttpServer())
        .get('/payouts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(payouts.body) || Array.isArray(payouts.body.payouts)).toBe(true);
    });
  });

  describe('Refund Workflow', () => {
    it('should handle booking cancellation with refund', async () => {
      // Create a new booking for refund test
      const bookingResponse = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: testListingId,
          startDate: '2026-11-01',
          endDate: '2026-11-02',
          guestCount: 1,
        })
        .expect(201);

      const newBookingId = bookingResponse.body.id;

      // Approve booking
      await request(app.getHttpServer())
        .post(`/bookings/${newBookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Create payment intent
      const paymentResponse = await request(app.getHttpServer())
        .post('/payments/create-intent')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: newBookingId,
          amount: 100,
          currency: 'USD',
        })
        .expect(201);

      // Simulate payment success
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentResponse.body.paymentIntentId,
              status: 'succeeded',
              amount: 10000,
              currency: 'usd',
              metadata: { bookingId: newBookingId },
            },
          },
        })
        .expect(200);

      // Cancel booking with refund
      const cancelResponse = await request(app.getHttpServer())
        .post(`/bookings/${newBookingId}/cancel`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'Changed plans' })
        .expect(200);

      expect(cancelResponse.body.booking.status).toBe('CANCELLED');
      expect(cancelResponse.body).toHaveProperty('refund');
      expect(cancelResponse.body.refund).toHaveProperty('amount');
    });
  });

  describe('State Transition Validation', () => {
    it('should validate state machine transitions', async () => {
      // Test invalid state transition
      const response = await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Should fail because booking is already CONFIRMED
      expect([400, 409]).toContain(response.status);
    });

    it('should track booking history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/bookings/${testBookingId}/history`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(response.body) || Array.isArray(response.body.history)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate booking creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: testListingId,
          startDate: '2026-10-01',
          endDate: '2026-10-03',
          guestCount: 2,
        });

      expect([400, 409]).toContain(response.status);
    });

    it('should handle payment with invalid amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/create-intent')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          amount: -100,
          currency: 'USD',
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app.getHttpServer())
        .get(`/bookings/${testBookingId}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistency between booking and payment', async () => {
      const booking = await request(app.getHttpServer())
        .get(`/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      const payments = await request(app.getHttpServer())
        .get('/payments')
        .query({ bookingId: testBookingId })
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      // Verify payment exists for booking
      const paymentArray = Array.isArray(payments.body) ? payments.body : (payments.body.payments || []);
      const bookingPayment = paymentArray.find((p: any) => p.bookingId === testBookingId);

      expect(bookingPayment).toBeDefined();
      expect(bookingPayment.amount).toBe(booking.body.totalPrice);
    });

    it('should maintain ledger entries', async () => {
      const ledger = await request(app.getHttpServer())
        .get(`/bookings/${testBookingId}/ledger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(ledger.body) || Array.isArray(ledger.body.ledger)).toBe(true);
    });
  });
});
