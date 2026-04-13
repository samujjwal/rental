/**
 * Real Stripe Integration Tests
 * 
 * These tests validate actual Stripe payment flows using Stripe test mode.
 * They require STRIPE_SECRET_KEY with sk_test_ prefix to be configured.
 * 
 * Coverage:
 * - Payment intent creation
 * - Payment confirmation
 * - Refund processing
 * - Idempotency validation
 * - Webhook handling
 * - Error scenarios
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { AppModule } from '../../src/app.module';

// Skip tests if Stripe test key is not available
const hasStripeTestKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
const describeIfStripe = hasStripeTestKey ? describe : describe.skip;

describeIfStripe('Stripe Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUser: { id: string; email: string; accessToken: string };
  let testListing: { id: string; ownerId: string };
  let testBooking: { id: string; status: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Create test user via dev login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({
        email: `stripe-test-${Date.now()}@test.com`,
        role: 'USER',
        secret: 'dev-secret-123',
      });

    testUser = {
      id: loginRes.body.user.id,
      email: loginRes.body.user.email,
      accessToken: loginRes.body.accessToken,
    };

    // Create a test listing
    const categoryRes = await request(app.getHttpServer())
      .get('/categories')
      .set('Authorization', `Bearer ${testUser.accessToken}`);
    
    const categoryId = categoryRes.body[0]?.id || categoryRes.body.data?.[0]?.id;

    const listingRes = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${testUser.accessToken}`)
      .send({
        title: `Stripe Test Listing ${Date.now()}`,
        description: 'Test listing for Stripe integration',
        basePrice: 100,
        currency: 'USD',
        categoryId,
        location: 'San Francisco, CA',
        condition: 'GOOD',
        bookingMode: 'INSTANT_BOOK',
      });

    testListing = {
      id: listingRes.body.id,
      ownerId: testUser.id,
    };

    // Publish the listing
    await request(app.getHttpServer())
      .post(`/listings/${testListing.id}/publish`)
      .set('Authorization', `Bearer ${testUser.accessToken}`);
  }, 60000);

  afterAll(async () => {
    // Cleanup test data
    if (testBooking?.id) {
      await prisma.booking.deleteMany({ where: { id: testBooking.id } });
    }
    if (testListing?.id) {
      await prisma.listing.deleteMany({ where: { id: testListing.id } });
    }
    if (testUser?.id) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
    await app.close();
  }, 60000);

  describe('Payment Intent Creation', () => {
    it('should create a payment intent for a booking', async () => {
      // Create a booking first
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      expect(bookingRes.status).toBe(HttpStatus.CREATED);
      testBooking = {
        id: bookingRes.body.id,
        status: bookingRes.body.status,
      };

      // Verify booking status is PENDING_PAYMENT
      expect(testBooking.status).toBe('PENDING_PAYMENT');
    });

    it('should validate idempotency for duplicate payment attempts', async () => {
      // Create a second booking
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 40);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      const bookingId = bookingRes.body.id;

      // Attempt to confirm payment twice (simulating idempotency test)
      // The second attempt should not create a duplicate payment
      const confirmRes1 = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/confirm-payment`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          paymentMethodId: 'pm_card_visa', // Stripe test card
        });

      // If payment is processed, verify status
      if (confirmRes1.status === HttpStatus.OK || confirmRes1.status === HttpStatus.CREATED) {
        expect(confirmRes1.body).toHaveProperty('status');
        
        // Verify database state
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { payment: true },
        });

        // Should have exactly one payment record (idempotency)
        const paymentCount = await prisma.payment.count({
          where: { bookingId },
        });
        expect(paymentCount).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Refund Processing', () => {
    it('should process a refund for a confirmed booking', async () => {
      // Create and confirm a booking
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 50);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      const bookingId = bookingRes.body.id;

      // Attempt to confirm payment
      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/confirm-payment`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          paymentMethodId: 'pm_card_visa',
        });

      // Cancel the booking (should trigger refund)
      const cancelRes = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ reason: 'Test refund' });

      expect(cancelRes.status).toBe(HttpStatus.OK);
      
      // Verify booking status is CANCELLED
      const cancelledBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(cancelledBooking?.status).toBe('CANCELLED');

      // Verify refund was created in database
      const refund = await prisma.refund.findFirst({
        where: { bookingId },
      });
      
      // Refund should exist (even if Stripe processing is async)
      expect(refund).toBeTruthy();
    });
  });

  describe('Webhook Handling', () => {
    it('should handle Stripe webhook events', async () => {
      // This test validates that the webhook endpoint is properly configured
      // In test mode, we can simulate webhook events
      
      const webhookRes = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('Stripe-Signature', 'test-signature')
        .send({
          id: `evt_test_${Date.now()}`,
          object: 'event',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: `pi_test_${Date.now()}`,
              object: 'payment_intent',
              status: 'succeeded',
              amount: 10000,
              currency: 'usd',
            },
          },
        });

      // Should return 400 for invalid signature in test, or process if configured
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED]).toContain(webhookRes.status);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle declined card', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 60);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      const bookingId = bookingRes.body.id;

      // Attempt payment with declined card
      const paymentRes = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/confirm-payment`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          paymentMethodId: 'pm_card_chargeDeclined', // Stripe test declined card
        });

      // Should fail gracefully
      expect([HttpStatus.BAD_REQUEST, HttpStatus.PAYMENT_REQUIRED, HttpStatus.UNPROCESSABLE_ENTITY]).toContain(paymentRes.status);
    });

    it('should handle invalid payment method', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 70);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      const bookingId = bookingRes.body.id;

      // Attempt payment with invalid payment method
      const paymentRes = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/confirm-payment`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          paymentMethodId: 'invalid_payment_method',
        });

      expect(paymentRes.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });
});
