import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PaymentsModule } from './payments.module';
import { BookingsModule } from '../bookings/bookings.module';
import { EventsModule } from '@/common/events/events.module';
import { AiModule } from '../ai/ai.module';
import { OpenAiProviderAdapter } from '../ai/adapters/openai-provider.adapter';

/**
 * ULTRA-STRICT: Payment Processing Integration Tests
 *
 * These tests validate the complete payment flow including webhooks,
 * failure handling, retry logic, and reconciliation.
 *
 * ⚠️ These tests require Stripe test keys and webhook simulation
 */
describe('Payment Processing Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockStripe = {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    payouts: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PaymentsModule,
        BookingsModule,
        EventsModule,
        AiModule,
        BullModule.registerQueue({ name: 'payments' }),
        ConfigModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        booking: {
          findUnique: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
        },
        ledgerEntry: {
          create: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
        },
        payout: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        depositHold: {
          create: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
        $transaction: jest.fn(),
      })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string, defaultValue?: any) => defaultValue),
      })
      .overrideProvider(OpenAiProviderAdapter)
      .useValue({
        generateEmbedding: jest.fn(),
        generateText: jest.fn(),
      })
      .overrideProvider('StripeService')
      .useValue(mockStripe)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // PAYMENT INTENT LIFECYCLE
  // ============================================================================

  describe('Payment Intent Lifecycle', () => {
    test('successful payment creates confirmed booking', async () => {
      const bookingId = 'booking-test-1';
      const paymentIntentId = 'pi_test_123';

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: paymentIntentId,
        status: 'requires_confirmation',
        client_secret: 'secret_test',
        amount: 50000,
        currency: 'npr',
      });

      mockStripe.paymentIntents.confirm.mockResolvedValue({
        id: paymentIntentId,
        status: 'succeeded',
        charges: { data: [{ id: 'ch_test_1', status: 'succeeded' }] },
      });

      // Create payment intent
      const createResponse = await request(app.getHttpServer())
        .post(`/api/payments/intents/${bookingId}`)
        .send({ amount: 500, currency: 'NPR' })
        .expect(201);

      expect(createResponse.body.paymentIntentId).toBe(paymentIntentId);

      // Simulate webhook: payment_intent.succeeded
      const webhookPayload = {
        id: 'evt_test_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            status: 'succeeded',
            metadata: { bookingId },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      // Verify booking is confirmed
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('CONFIRMED');
    });

    test('failed payment transitions to PAYMENT_FAILED', async () => {
      const bookingId = 'booking-test-2';
      const paymentIntentId = 'pi_test_failed';

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: paymentIntentId,
        status: 'requires_payment_method',
        client_secret: 'secret_test',
      });

      // Simulate webhook: payment_intent.payment_failed
      const webhookPayload = {
        id: 'evt_test_2',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: paymentIntentId,
            status: 'requires_payment_method',
            metadata: { bookingId },
            last_payment_error: { message: 'Card was declined' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      // Verify booking is in PAYMENT_FAILED
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('PAYMENT_FAILED');
    });

    test('payment retry succeeds after failure', async () => {
      const bookingId = 'booking-test-3';
      const failedIntentId = 'pi_test_retry_old';
      const newIntentId = 'pi_test_retry_new';

      // First payment failed
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: failedIntentId,
        status: 'requires_payment_method',
        metadata: { bookingId },
      });

      // Retry creates new payment intent
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: newIntentId,
        status: 'requires_confirmation',
        client_secret: 'secret_retry',
      });

      mockStripe.paymentIntents.confirm.mockResolvedValue({
        id: newIntentId,
        status: 'succeeded',
      });

      const retryResponse = await request(app.getHttpServer())
        .post(`/api/payments/intents/${bookingId}`)
        .send({ amount: 500, currency: 'NPR' })
        .expect(201);

      expect(retryResponse.body.paymentIntentId).toBe(newIntentId);
    });
  });

  // ============================================================================
  // REFUND PROCESSING
  // ============================================================================

  describe('Refund Processing', () => {
    test('successful refund transitions to REFUNDED', async () => {
      const bookingId = 'booking-test-refund';
      const refundId = 're_test_refund';

      mockStripe.refunds.create.mockResolvedValue({
        id: refundId,
        status: 'pending',
        amount: 50000,
        payment_intent: 'pi_original',
      });

      // Simulate webhook: charge.refunded
      const webhookPayload = {
        id: 'evt_test_refund',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_original',
            refund: { id: refundId, status: 'succeeded' },
            metadata: { bookingId },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('REFUNDED');
    });

    test('partial refund handled correctly', async () => {
      const bookingId = 'booking-test-partial';
      const originalAmount = 50000;
      const partialRefundAmount = 20000;

      mockStripe.refunds.create.mockResolvedValue({
        id: 're_partial',
        status: 'succeeded',
        amount: partialRefundAmount,
        payment_intent: 'pi_original',
      });

      const webhookPayload = {
        id: 'evt_test_partial',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_original',
            amount_refunded: partialRefundAmount,
            amount: originalAmount,
            metadata: { bookingId },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      // Verify partial refund recorded
      const refund = await prisma.refund.findFirst({ where: { bookingId } });
      expect(refund?.amount).toBe(partialRefundAmount / 100); // cents to units
    });
  });

  // ============================================================================
  // PAYOUT PROCESSING
  // ============================================================================

  describe('Owner Payout Processing', () => {
    test('successful payout transitions to SETTLED', async () => {
      const bookingId = 'booking-test-settle';
      const payoutId = 'po_test_payout';

      mockStripe.payouts.create.mockResolvedValue({
        id: payoutId,
        status: 'paid',
        amount: 45000,
        currency: 'npr',
      });

      // Simulate webhook: payout.paid
      const webhookPayload = {
        id: 'evt_test_payout',
        type: 'payout.paid',
        data: {
          object: {
            id: payoutId,
            status: 'paid',
            metadata: { bookingId },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('SETTLED');
    });

    test('failed payout triggers retry', async () => {
      const bookingId = 'booking-test-payout-fail';
      const payoutId = 'po_test_failed';

      // Simulate webhook: payout.failed
      const webhookPayload = {
        id: 'evt_test_payout_fail',
        type: 'payout.failed',
        data: {
          object: {
            id: payoutId,
            status: 'failed',
            failure_code: 'account_closed',
            metadata: { bookingId },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      // Verify payout marked as failed and scheduled for retry
      const payout = await prisma.payout.findFirst({ where: { ownerId: 'owner-test' } });
      expect(payout?.status).toBe('FAILED');
    });
  });

  // ============================================================================
  // WEBHOOK SECURITY & ERROR HANDLING
  // ============================================================================

  describe('Webhook Security & Error Handling', () => {
    test('rejects webhook with invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send({ type: 'test' })
        .expect(400);
    });

    test('handles missing webhook signature', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send({ type: 'payment_intent.succeeded' })
        .expect(400);
    });

    test('handles unknown webhook event types gracefully', async () => {
      const unknownPayload = {
        id: 'evt_unknown',
        type: 'unknown.event.type',
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(unknownPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(unknownPayload)
        .expect(200); // Should acknowledge but not process
    });

    test('handles duplicate webhook events (idempotency)', async () => {
      const bookingId = 'booking-test-idempotent';
      const eventId = 'evt_duplicate';

      const webhookPayload = {
        id: eventId,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            status: 'succeeded',
            metadata: { bookingId },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      // First webhook
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      // Duplicate webhook should be handled gracefully
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      // Verify only one state transition recorded
      const transitions = await prisma.bookingStateHistory.count({
        where: { bookingId, toStatus: 'CONFIRMED' },
      });
      expect(transitions).toBe(1);
    });
  });

  // ============================================================================
  // DEPOSIT HOLD PROCESSING
  // ============================================================================

  describe('Security Deposit Holds', () => {
    test('authorizes deposit hold on booking confirmation', async () => {
      const bookingId = 'booking-test-deposit';
      const depositAmount = 5000;

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_deposit_hold',
        status: 'requires_capture',
        amount: depositAmount,
        capture_method: 'manual',
      });

      // Mock capture method
      (mockStripe.paymentIntents as any).capture = jest.fn().mockResolvedValue({
        id: 'pi_deposit_hold',
        status: 'succeeded',
        amount_captured: 25000,
      });

      // Booking confirmation triggers deposit hold
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/deposit/hold`)
        .send({ amount: depositAmount })
        .expect(201);

      const hold = await prisma.depositHold.findFirst({ where: { bookingId } });
      expect(hold?.status).toBe('HELD');
      expect(Number(hold?.amount)).toBe(depositAmount / 100);
    });

    test('releases deposit hold on successful return', async () => {
      const bookingId = 'booking-test-release';
      const holdId = 'hold_test_release';

      mockStripe.paymentIntents.cancel.mockResolvedValue({
        id: 'pi_deposit_hold',
        status: 'canceled',
      });

      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/deposit/release`)
        .expect(200);

      const hold = await prisma.depositHold.findFirst({ where: { bookingId } });
      expect(hold?.status).toBe('RELEASED');
    });

    test('captures deposit hold for damage claims', async () => {
      const bookingId = 'booking-test-capture';
      const damageAmount = 25000;

      // Mock capture method for deposit capture test
      (mockStripe.paymentIntents as any).capture = jest.fn().mockResolvedValue({
        id: 'pi_deposit_hold',
        status: 'succeeded',
        amount_captured: damageAmount,
      });

      (mockStripe.paymentIntents as any).capture.mockResolvedValue({
        id: 'pi_deposit_hold',
        status: 'succeeded',
        amount_captured: damageAmount,
      });

      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/deposit/capture`)
        .send({ amount: damageAmount, reason: 'Damage claim' })
        .expect(200);

      const hold = await prisma.depositHold.findFirst({ where: { bookingId } });
      expect(hold?.status).toBe('CAPTURED');
    });
  });

  // ============================================================================
  // RECONCILIATION & LEDGER INTEGRITY
  // ============================================================================

  describe('Financial Reconciliation', () => {
    test('ledger entry created for successful payment', async () => {
      const bookingId = 'booking-test-ledger';
      const amount = 50000;

      const webhookPayload = {
        id: 'evt_ledger_test',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_ledger_test',
            status: 'succeeded',
            amount,
            metadata: { bookingId },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(200);

      // Verify ledger entry created
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { bookingId, transactionType: 'PAYMENT' },
      });
      expect(ledgerEntry).toBeDefined();
      expect(Number(ledgerEntry?.amount)).toBe(amount / 100);
    });

    test('ledger entries balance for complete booking lifecycle', async () => {
      const bookingId = 'booking-test-balance';

      // Payment
      await prisma.ledgerEntry.create({
        data: {
          bookingId,
          accountId: 'acc-test',
          accountType: 'REVENUE',
          side: 'CREDIT',
          transactionType: 'PAYMENT',
          amount: 50000,
          currency: 'NPR',
          description: 'Payment for booking',
          status: 'POSTED',
        },
      });

      // Refund
      await prisma.ledgerEntry.create({
        data: {
          bookingId,
          accountId: 'acc-test',
          accountType: 'REVENUE',
          side: 'DEBIT',
          transactionType: 'REFUND',
          amount: -50000,
          currency: 'NPR',
          description: 'Refund for booking',
          status: 'POSTED',
        },
      });

      // Verify net balance is zero
      const entries = await prisma.ledgerEntry.findMany({ where: { bookingId } });
      const netBalance = entries.reduce((sum, e) => sum + Number(e.amount), 0);
      expect(netBalance).toBe(0);
    });
  });
});
