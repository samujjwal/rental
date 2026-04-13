/**
 * Stripe Integration Tests (Test Mode)
 * 
 * Tests real Stripe integration using Stripe's test mode
 * Validates payment flows, idempotency, and error handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import Stripe from 'stripe';

describe('Stripe Integration - Real Payments (Test Mode)', () => {
  let app: INestApplication;
  let stripe: Stripe;
  let userToken: string;
  let hostToken: string;
  let testListingId: string;
  let testBookingId: string;
  let testPaymentIntentId: string;

  beforeAll(async () => {
    // Initialize Stripe with test mode secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY_TEST or STRIPE_SECRET_KEY must be set');
    }
    
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-01-28.clover',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup test users
    const userResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'stripe-test@example.com',
        username: 'stripe-test',
        password: 'Password123!',
        firstName: 'Stripe',
        lastName: 'Test',
      });

    userToken = userResponse.body.token;

    const hostResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'stripe-host@example.com',
        username: 'stripe-host',
        password: 'Password123!',
        firstName: 'Stripe',
        lastName: 'Host',
      });

    hostToken = hostResponse.body.token;

    // Upgrade to host
    await request(app.getHttpServer())
      .post('/api/users/upgrade-to-host')
      .set('Authorization', `Bearer ${hostToken}`);

    // Create test listing
    const listingResponse = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Stripe Test Listing',
        description: 'Testing real Stripe integration',
        address: '123 Stripe St',
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
      });

    testListingId = listingResponse.body.id;

    // Create test booking
    const bookingResponse = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        listingId: testListingId,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        guestCount: 2,
      });

    testBookingId = bookingResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup test data from Stripe
    if (testPaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(testPaymentIntentId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (app) {
      await app.close();
    }
  });

  describe('Payment Intent Creation', () => {
    it('should create payment intent with real Stripe', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200, // 2 nights * $100
          currency: 'USD',
        })
        .expect(201);

      expect(response.body).toHaveProperty('paymentIntentId');
      expect(response.body).toHaveProperty('clientSecret');
      expect(response.body).toHaveProperty('amount', 200);
      expect(response.body).toHaveProperty('currency', 'USD');

      testPaymentIntentId = response.body.paymentIntentId;

      // Verify with Stripe directly
      const paymentIntent = await stripe.paymentIntents.retrieve(testPaymentIntentId);
      expect(paymentIntent.amount).toBe(20000); // Stripe uses cents
      expect(paymentIntent.currency).toBe('usd');
      expect(paymentIntent.status).toBe('requires_payment_method');
    });

    it('should include booking metadata in payment intent', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      const paymentIntent = await stripe.paymentIntents.retrieve(response.body.paymentIntentId);
      expect(paymentIntent.metadata).toHaveProperty('bookingId', testBookingId);
      expect(paymentIntent.metadata).toHaveProperty('userId');
    });
  });

  describe('Payment Idempotency', () => {
    it('should prevent duplicate payments with idempotency key', async () => {
      const idempotencyKey = `payment-${testBookingId}-${Date.now()}`;
      
      // First payment attempt
      const response1 = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      // Second payment attempt with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      // Both should return the same payment intent
      expect(response1.body.paymentIntentId).toBe(response2.body.paymentIntentId);
    });

    it('should create different payment intents with different idempotency keys', async () => {
      const key1 = `payment-${testBookingId}-${Date.now()}-1`;
      const key2 = `payment-${testBookingId}-${Date.now()}-2`;
      
      const response1 = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', key1)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', key2)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      // Should create different payment intents
      expect(response1.body.paymentIntentId).not.toBe(response2.body.paymentIntentId);
    });
  });

  describe('Payment Confirmation', () => {
    it('should confirm payment with test card token', async () => {
      // Create payment intent
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      // Confirm payment with Stripe test card
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: 'tok_visa', // Stripe test card token
        },
      });

      const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod.id,
      });

      expect(confirmedIntent.status).toBe('succeeded');

      // Simulate webhook
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentIntentId,
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
        .get(`/api/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(booking.body.status).toBe('CONFIRMED');
    });
  });

  describe('Payment Error Handling', () => {
    it('should handle declined card payments', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      // Use a card that will decline
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: 'tok_chargeDeclined', // Stripe test card that declines
        },
      });

      const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod.id,
      });

      expect(confirmedIntent.status).toBe('requires_payment_method');
      expect(confirmedIntent.last_payment_error).toBeDefined();

      // Simulate webhook for failed payment
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: paymentIntentId,
              status: 'requires_payment_method',
              last_payment_error: {
                message: 'Your card was declined.',
              },
              metadata: { bookingId: testBookingId },
            },
          },
        })
        .expect(200);

      // Verify booking status reflects payment failure
      const booking = await request(app.getHttpServer())
        .get(`/api/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(booking.body.status).toBe('PAYMENT_FAILED');
    });

    it('should handle insufficient funds', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      // Use a card with insufficient funds
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: 'tok_insufficientFunds', // Stripe test card with insufficient funds
        },
      });

      const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod.id,
      });

      expect(confirmedIntent.status).toBe('requires_payment_method');
      expect(confirmedIntent.last_payment_error).toBeDefined();
    });
  });

  describe('Refund Processing', () => {
    it('should process refunds through Stripe', async () => {
      // First create and confirm a successful payment
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: 'tok_visa',
        },
      });

      await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod.id,
      });

      // Request refund
      const refundResponse = await request(app.getHttpServer())
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          paymentIntentId: paymentIntentId,
          amount: 200,
          reason: 'cancellation',
        })
        .expect(201);

      expect(refundResponse.body).toHaveProperty('refundId');
      expect(refundResponse.body).toHaveProperty('amount', 200);

      // Verify refund in Stripe
      const refund = await stripe.refunds.retrieve(refundResponse.body.refundId);
      expect(refund.amount).toBe(20000);
      expect(refund.status).toBe('succeeded');
    });

    it('should handle partial refunds', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: 200,
          currency: 'USD',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: 'tok_visa',
        },
      });

      await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod.id,
      });

      // Request partial refund
      const refundResponse = await request(app.getHttpServer())
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          paymentIntentId: paymentIntentId,
          amount: 100, // Partial refund
          reason: 'partial_cancellation',
        })
        .expect(201);

      expect(refundResponse.body.amount).toBe(100);

      const refund = await stripe.refunds.retrieve(refundResponse.body.refundId);
      expect(refund.amount).toBe(10000);
    });
  });

  describe('Webhook Security', () => {
    it('should reject webhook without signature', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test' } },
        })
        .expect(401);
    });

    it('should reject webhook with invalid signature', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test' } },
        })
        .expect(401);
    });
  });
});
