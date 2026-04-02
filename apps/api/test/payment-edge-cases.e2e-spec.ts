import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Comprehensive E2E tests for payment edge cases
 * Tests 3D Secure flows, payment retries, webhook scenarios
 */
describe('Payment Edge Cases E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [/* AppModule */],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('3D Secure Authentication', () => {
    it('should handle 3DS required flow', async () => {
      const booking = await createTestBooking();

      const response = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({
          paymentMethodId: 'pm_card_threeDSecureRequired',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        requiresAction: true,
        clientSecret: expect.any(String),
        nextAction: {
          type: 'redirect_to_url',
        },
      });
    });

    it('should complete payment after 3DS authentication', async () => {
      const booking = await createTestBooking();

      // Initial payment attempt
      const paymentResponse = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_threeDSecureRequired' });

      const paymentIntentId = paymentResponse.body.paymentIntentId;

      // Simulate 3DS completion webhook
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentIntentId,
              status: 'succeeded',
              amount: 5000000,
            },
          },
        })
        .expect(200);

      // Verify booking confirmed
      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.status).toBe('CONFIRMED');
    });

    it('should handle 3DS authentication failure', async () => {
      const booking = await createTestBooking();

      const paymentResponse = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_threeDSecureRequired' });

      const paymentIntentId = paymentResponse.body.paymentIntentId;

      // Simulate 3DS failure webhook
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: paymentIntentId,
              status: 'requires_payment_method',
              last_payment_error: {
                code: 'authentication_failed',
                message: '3D Secure authentication failed',
              },
            },
          },
        })
        .expect(200);

      // Verify booking in failed state
      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.status).toBe('PAYMENT_FAILED');
    });

    it('should handle 3DS timeout', async () => {
      const booking = await createTestBooking();

      const paymentResponse = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_threeDSecureRequired' });

      // Wait for timeout (simulate)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate timeout webhook
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: paymentResponse.body.paymentIntentId,
              status: 'requires_payment_method',
              last_payment_error: {
                code: 'payment_intent_authentication_failure',
                message: 'Authentication timed out',
              },
            },
          },
        });

      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.status).toBe('PAYMENT_FAILED');
    });
  });

  describe('Payment Method Failures', () => {
    it('should handle insufficient funds', async () => {
      const booking = await createTestBooking();

      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_chargeDeclinedInsufficientFunds' })
        .expect(400);

      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.status).toBe('PAYMENT_FAILED');
    });

    it('should handle card declined', async () => {
      const booking = await createTestBooking();

      const response = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_chargeDeclined' })
        .expect(400);

      expect(response.body.message).toContain('declined');
    });

    it('should handle expired card', async () => {
      const booking = await createTestBooking();

      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_expiredCard' })
        .expect(400);
    });

    it('should handle incorrect CVC', async () => {
      const booking = await createTestBooking();

      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_incorrectCvc' })
        .expect(400);
    });

    it('should handle processing error', async () => {
      const booking = await createTestBooking();

      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_processingError' })
        .expect(500);
    });
  });

  describe('Payment Retry Logic', () => {
    it('should allow retry after card declined', async () => {
      const booking = await createTestBooking();

      // First attempt fails
      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_chargeDeclined' })
        .expect(400);

      // Retry with valid card
      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/retry`)
        .send({ paymentMethodId: 'pm_card_visa' })
        .expect(200);

      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.status).toBe('CONFIRMED');
    });

    it('should track retry attempts', async () => {
      const booking = await createTestBooking();

      // Multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(`/payments/${booking.id}/retry`)
          .send({ paymentMethodId: 'pm_card_chargeDeclined' })
          .catch(() => {});
      }

      const paymentResponse = await request(app.getHttpServer())
        .get(`/payments?bookingId=${booking.id}`)
        .expect(200);

      expect(paymentResponse.body[0].retryCount).toBe(3);
    });

    it('should limit retry attempts', async () => {
      const booking = await createTestBooking();

      // Exceed retry limit
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post(`/payments/${booking.id}/retry`)
          .send({ paymentMethodId: 'pm_card_chargeDeclined' })
          .catch(() => {});
      }

      const response = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/retry`)
        .send({ paymentMethodId: 'pm_card_visa' })
        .expect(400);

      expect(response.body.message).toContain('retry limit');
    });

    it('should transition to CANCELLED after retry expiration', async () => {
      const booking = await createTestBooking();

      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_chargeDeclined' })
        .catch(() => {});

      // Simulate time passing (24 hours)
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      });

      // Run expiration job
      await request(app.getHttpServer())
        .post('/admin/jobs/expire-failed-payments')
        .expect(200);

      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.status).toBe('CANCELLED');
    });
  });

  describe('Webhook Retry and Idempotency', () => {
    it('should handle duplicate webhook events', async () => {
      const booking = await createTestBooking();
      const paymentIntentId = 'pi_test_duplicate';

      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            amount: 5000000,
          },
        },
      };

      // Send same webhook twice
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      // Verify only one payment record created
      const payments = await prisma.payment.findMany({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      expect(payments).toHaveLength(1);
    });

    it('should retry failed webhook processing', async () => {
      const booking = await createTestBooking();

      // Simulate webhook that fails initially
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_retry',
            status: 'succeeded',
            amount: 5000000,
          },
        },
      };

      // First attempt (simulate DB failure)
      await prisma.$disconnect();
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send(webhookPayload)
        .expect(500);

      // Reconnect and retry
      await prisma.$connect();
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      // Verify processed correctly
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: 'pi_test_retry' },
      });

      expect(payment).toBeDefined();
    });

    it('should handle out-of-order webhook delivery', async () => {
      const booking = await createTestBooking();
      const paymentIntentId = 'pi_test_order';

      // Receive succeeded webhook before processing webhook
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentIntentId,
              status: 'succeeded',
            },
          },
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.processing',
          data: {
            object: {
              id: paymentIntentId,
              status: 'processing',
            },
          },
        })
        .expect(200);

      // Verify final state is correct
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      expect(payment?.status).toBe('COMPLETED');
    });

    it('should implement exponential backoff for retries', async () => {
      const booking = await createTestBooking();
      const startTime = Date.now();

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(`/payments/${booking.id}/process`)
          .send({ paymentMethodId: 'pm_card_processingError' })
          .catch(() => {});
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify exponential backoff applied (should take longer than linear)
      expect(duration).toBeGreaterThan(1000); // At least 1 second with backoff
    });
  });

  describe('Concurrent Payment Attempts', () => {
    it('should prevent duplicate payment processing', async () => {
      const booking = await createTestBooking();

      // Attempt to process payment twice simultaneously
      const [result1, result2] = await Promise.allSettled([
        request(app.getHttpServer())
          .post(`/payments/${booking.id}/process`)
          .send({ paymentMethodId: 'pm_card_visa' }),
        request(app.getHttpServer())
          .post(`/payments/${booking.id}/process`)
          .send({ paymentMethodId: 'pm_card_visa' }),
      ]);

      // One should succeed, one should fail
      const succeeded = [result1, result2].filter((r) => r.status === 'fulfilled');
      const failed = [result1, result2].filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });

    it('should handle race condition with cancellation', async () => {
      const booking = await createTestBooking();

      // Start payment and cancellation simultaneously
      const [paymentResult, cancelResult] = await Promise.allSettled([
        request(app.getHttpServer())
          .post(`/payments/${booking.id}/process`)
          .send({ paymentMethodId: 'pm_card_visa' }),
        request(app.getHttpServer()).post(`/bookings/${booking.id}/cancel`),
      ]);

      // Either payment succeeds then cancels with refund, or cancellation prevents payment
      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(['CANCELLED', 'REFUNDED']).toContain(bookingResponse.body.status);
    });
  });

  describe('Partial Refund Sequences', () => {
    it('should handle multiple partial refunds', async () => {
      const booking = await createTestBooking({ totalPrice: 100000 });

      // Complete payment
      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_visa' })
        .expect(200);

      // First partial refund
      await request(app.getHttpServer())
        .post(`/refunds`)
        .send({
          bookingId: booking.id,
          amount: 30000,
          reason: 'Partial cancellation',
        })
        .expect(201);

      // Second partial refund
      await request(app.getHttpServer())
        .post(`/refunds`)
        .send({
          bookingId: booking.id,
          amount: 20000,
          reason: 'Additional adjustment',
        })
        .expect(201);

      // Verify total refunded
      const refunds = await prisma.refund.findMany({
        where: { bookingId: booking.id },
      });

      const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
      expect(totalRefunded).toBe(50000);
    });

    it('should prevent over-refunding', async () => {
      const booking = await createTestBooking({ totalPrice: 50000 });

      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_visa' })
        .expect(200);

      // Attempt to refund more than paid
      await request(app.getHttpServer())
        .post(`/refunds`)
        .send({
          bookingId: booking.id,
          amount: 60000,
          reason: 'Over-refund attempt',
        })
        .expect(400);
    });

    it('should track cumulative refund amount', async () => {
      const booking = await createTestBooking({ totalPrice: 100000 });

      await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({ paymentMethodId: 'pm_card_visa' })
        .expect(200);

      // Multiple partial refunds
      await request(app.getHttpServer())
        .post(`/refunds`)
        .send({ bookingId: booking.id, amount: 25000 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/refunds`)
        .send({ bookingId: booking.id, amount: 25000 })
        .expect(201);

      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.totalRefunded).toBe(50000);
    });
  });

  describe('Payment Method Edge Cases', () => {
    it('should handle ACH payment delays', async () => {
      const booking = await createTestBooking();

      const response = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({
          paymentMethodId: 'pm_usBankAccount',
          paymentMethodType: 'us_bank_account',
        })
        .expect(200);

      expect(response.body.status).toBe('PROCESSING');

      // Simulate ACH confirmation (takes days)
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: response.body.paymentIntentId,
              status: 'succeeded',
            },
          },
        });

      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(bookingResponse.body.status).toBe('CONFIRMED');
    });

    it('should handle international card fees', async () => {
      const booking = await createTestBooking();

      const response = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({
          paymentMethodId: 'pm_card_visa',
          billingCountry: 'US', // International card
        })
        .expect(200);

      // Verify international fee applied
      expect(response.body.fees.international).toBeGreaterThan(0);
    });

    it('should handle currency conversion', async () => {
      const booking = await createTestBooking({ currency: 'USD' });

      const response = await request(app.getHttpServer())
        .post(`/payments/${booking.id}/process`)
        .send({
          paymentMethodId: 'pm_card_visa',
          paymentCurrency: 'EUR',
        })
        .expect(200);

      expect(response.body.conversionRate).toBeDefined();
      expect(response.body.originalAmount).toBeDefined();
    });
  });

  // Helper function
  async function createTestBooking(overrides = {}) {
    return await prisma.booking.create({
      data: {
        renterId: 'test-renter',
        ownerId: 'test-owner',
        listingId: 'test-listing',
        status: 'PENDING_PAYMENT',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        totalPrice: 50000,
        currency: 'NPR',
        ...overrides,
      },
    });
  }
});
