/**
 * Real Stripe Integration E2E Tests
 *
 * These tests use the real Stripe Test Mode (sandbox) API to validate payment flows.
 * This ensures our integration works correctly with Stripe's actual infrastructure.
 *
 * === STRIPE TEST MODE SETUP ===
 *
 * 1. Get Stripe Test API Keys:
 *    - Log into Stripe Dashboard: https://dashboard.stripe.com/test/apikeys
 *    - Copy the "Secret key" (starts with sk_test_)
 *    - Set STRIPE_SECRET_KEY environment variable
 *
 * 2. Configure Webhook Secret (optional for basic tests):
 *    - In Stripe Dashboard, go to Developers > Webhooks
 *    - Add a webhook endpoint pointing to your test server
 *    - Copy the webhook signing secret (starts with whsec_)
 *    - Set STRIPE_WEBHOOK_SECRET environment variable
 *
 * 3. Environment Variables:
 *    - STRIPE_SECRET_KEY=sk_test_... (Required)
 *    - STRIPE_WEBHOOK_SECRET=whsec_... (Optional, for webhook tests)
 *    - NODE_ENV=test (Required to enable test bypass mode)
 *
 * === STRIPE TEST CARDS USED ===
 *
 * These tests use Stripe's official test payment methods:
 * - pm_card_visa: Successful payment
 * - pm_card_chargeDeclinedInsufficientFunds: Declined for insufficient funds
 * - pm_card_chargeDeclinedProcessingError: Processing error simulation
 *
 * See: https://stripe.com/docs/testing#cards
 *
 * === RUNNING THESE TESTS ===
 *
 * These tests will be skipped if STRIPE_SECRET_KEY is not set.
 * They are designed to run in CI/CD with test mode credentials.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { BookingStatus, UserRole, PropertyStatus } from '@rental-portal/database';
import {
  buildTestEmail,
  cleanupCoreRelationalData,
  createUserWithRole,
  loginUser,
} from './e2e-helpers';

describe('Stripe Real Integration E2E Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let renterToken: string;
  let renterId: string;
  let ownerId: string;
  let listingId: string;
  let stripeService: StripeService;

  const renterEmail = buildTestEmail('stripe-renter');
  const ownerEmail = buildTestEmail('stripe-owner');

  beforeAll(async () => {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('STRIPE_SECRET_KEY not set - skipping real Stripe integration tests');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    stripeService = app.get(StripeService);
  }, 30_000);

  afterAll(async () => {
    if (app) {
      await cleanupCoreRelationalData(prisma);
      await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
      await prisma.category.deleteMany({ where: { slug: 'test-cat-stripe' } });
      await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });
      await prisma.$disconnect();
      await app.close();
    }
  });

  beforeEach(async () => {
    if (!process.env.STRIPE_SECRET_KEY) return;

    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-stripe' } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });

    const owner = await createUserWithRole({ app, prisma, email: ownerEmail, firstName: 'Stripe', lastName: 'Owner', role: UserRole.HOST });
    ownerId = owner.userId;
    await prisma.user.update({ where: { id: ownerId }, data: { emailVerified: true } });

    const renter = await createUserWithRole({ app, prisma, email: renterEmail, firstName: 'Stripe', lastName: 'Renter', role: UserRole.USER });
    renterId = renter.userId;
    await prisma.user.update({ where: { id: renterId }, data: { emailVerified: true } });

    const loginRes = await loginUser(app, renterEmail);
    renterToken = loginRes.accessToken;

    const cat = await prisma.category.create({
      data: { name: 'Stripe Test Category', slug: 'test-cat-stripe', description: 'Test', icon: 'test', isActive: true, templateSchema: '{}', searchableFields: [], requiredFields: [] },
    });

    const listing = await prisma.listing.create({
      data: {
        ownerId,
        categoryId: cat.id,
        title: 'Stripe Test Listing',
        description: 'Test listing for Stripe integration',
        basePrice: 1000,
        currency: 'USD',
        status: PropertyStatus.AVAILABLE,
        address: '123 Test St',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        availability: {
          create: [
            {
              startDate: new Date('2026-04-01'),
              endDate: new Date('2026-04-30'),
              status: 'AVAILABLE',
            },
          ],
        },
      },
    });

    listingId = listing.id;
  });

  describe('Payment Intent Creation', () => {
    it('should create a real Stripe payment intent', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      const response = await request(app.getHttpServer())
        .post('/api/payments/intents')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: 'test-booking-id',
          amount: 1000,
          currency: 'usd',
        })
        .expect(201);

      expect(response.body).toHaveProperty('clientSecret');
      expect(response.body).toHaveProperty('paymentIntentId');
      expect(response.body.clientSecret).toMatch(/^pi_/);
    });

    it('should handle payment intent with different currencies', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      const currencies = ['usd', 'eur', 'gbp'];
      
      for (const currency of currencies) {
        const response = await request(app.getHttpServer())
          .post('/api/payments/intents')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId: `test-booking-${currency}`,
            amount: 1000,
            currency: currency,
          })
          .expect(201);

        expect(response.body).toHaveProperty('clientSecret');
        expect(response.body.clientSecret).toMatch(/^pi_/);
      }
    });
  });

  describe('Payment Capture', () => {
    it('should capture a payment intent successfully', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      // First create a payment intent
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/intents')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: 'test-booking-capture',
          amount: 1000,
          currency: 'usd',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      // Simulate successful payment by confirming the intent
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_visa',
      });

      // Capture the payment
      const captureResponse = await request(app.getHttpServer())
        .post(`/api/payments/capture/${paymentIntentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(captureResponse.body).toHaveProperty('status', 'succeeded');
    });

    it('should handle card decline scenarios', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      // Test with a declined card
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/intents')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: 'test-booking-decline',
          amount: 1000,
          currency: 'usd',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      
      // Simulate card decline using Stripe's test card
      await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_chargeDeclinedInsufficientFunds',
      }).catch(() => {
        // Expected to fail
      });

      // Verify the payment intent status reflects the decline
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      expect(['requires_payment_method', 'canceled']).toContain(intent.status);
    });

    it('should handle processing errors', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/intents')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: 'test-booking-processing',
          amount: 1000,
          currency: 'usd',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      
      // Simulate processing error
      await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_chargeDeclinedProcessingError',
      }).catch(() => {
        // Expected to fail
      });

      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      expect(['requires_payment_method', 'canceled']).toContain(intent.status);
    });
  });

  describe('Payment Refund', () => {
    it('should refund a payment successfully', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      // Create and capture a payment
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/intents')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: 'test-booking-refund',
          amount: 1000,
          currency: 'usd',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.paymentIntents.update(paymentIntentId, {
        status: 'succeeded',
      });

      await request(app.getHttpServer())
        .post(`/api/payments/capture/${paymentIntentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      // Refund the payment
      const refundResponse = await request(app.getHttpServer())
        .post(`/api/payments/refund/${paymentIntentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          amount: 1000,
          reason: 'requested_by_customer',
        })
        .expect(200);

      expect(refundResponse.body).toHaveProperty('id');
      expect(refundResponse.body).toHaveProperty('status', 'succeeded');
      expect(refundResponse.body.id).toMatch(/^re_/);
    });

    it('should handle partial refund', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      // Create and capture a payment
      const createResponse = await request(app.getHttpServer())
        .post('/api/payments/intents')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: 'test-booking-partial-refund',
          amount: 1000,
          currency: 'usd',
        })
        .expect(201);

      const paymentIntentId = createResponse.body.paymentIntentId;

      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.paymentIntents.update(paymentIntentId, {
        status: 'succeeded',
      });

      await request(app.getHttpServer())
        .post(`/api/payments/capture/${paymentIntentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      // Partial refund
      const refundResponse = await request(app.getHttpServer())
        .post(`/api/payments/refund/${paymentIntentId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          amount: 500,
          reason: 'requested_by_customer',
        })
        .expect(200);

      expect(refundResponse.body).toHaveProperty('amount', 500);
      expect(refundResponse.body).toHaveProperty('status', 'succeeded');
    });
  });

  describe('Webhook Handling', () => {
    it('should handle payment_intent.succeeded webhook', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_webhook',
            status: 'succeeded',
            amount: 1000,
            currency: 'usd',
            metadata: {
              bookingId: 'test-booking-webhook',
            },
          },
        },
      };

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';

      // Sign the webhook payload
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });

    it('should handle payment_intent.payment_failed webhook', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      const webhookPayload = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_failed',
            status: 'requires_payment_method',
            amount: 1000,
            currency: 'usd',
            last_payment_error: {
              message: 'Your card was declined.',
              code: 'card_declined',
            },
            metadata: {
              bookingId: 'test-booking-failed',
            },
          },
        },
      };

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });

    it('should handle charge.refund.updated webhook', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      const webhookPayload = {
        type: 'charge.refund.updated',
        data: {
          object: {
            id: 're_test_refund',
            amount: 500,
            currency: 'usd',
            status: 'succeeded',
            charge: 'ch_test_charge',
            metadata: {
              paymentIntentId: 'pi_test_refund',
            },
          },
        },
      };

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid payment intent', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      await request(app.getHttpServer())
        .post('/api/payments/capture/invalid_intent_id')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(400);
    });

    it('should handle refund on non-existent payment', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      await request(app.getHttpServer())
        .post('/api/payments/refund/pi_nonexistent')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ amount: 1000, reason: 'requested_by_customer' })
        .expect(400);
    });

    it('should handle invalid webhook signature', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return;

      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test', status: 'succeeded' } },
      };

      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send(webhookPayload)
        .expect(400);
    });
  });
});
