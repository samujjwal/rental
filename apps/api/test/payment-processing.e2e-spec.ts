/**
 * Comprehensive Payment Processing E2E Tests
 * 
 * These tests verify the complete payment workflow:
 * 1. Payment intent creation
 * 2. Payment confirmation
 * 3. Payment failures and retries
 * 4. Refunds and chargebacks
 * 5. Webhook handling
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { PaymentStatus, BookingStatus } from '@rental-portal/database';

describe('💳 Payment Processing E2E Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAccessToken: string;
  let testBooking: any;
  let testPaymentIntent: any;

  // Test data
  const testUser = {
    email: `payment-user-${Date.now()}@test.com`,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await setupTestUser();
    testBooking = await createTestBooking();
  });

  afterEach(async () => {
    if (testPaymentIntent) {
      await cleanupPaymentIntent();
      testPaymentIntent = null;
    }
  });

  describe('Payment Intent Creation', () => {
    it('POST /payments/intent → 201 (Create payment intent)', async () => {
      const paymentData = {
        bookingId: testBooking.id,
        amount: testBooking.totalPrice,
        currency: 'USD',
        paymentMethodId: 'pm_test_visa', // Test payment method
      };

      const response = await request(app.getHttpServer())
        .post('/payments/intent')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(paymentData)
        .expect(201);

      testPaymentIntent = response.body;

      expect(testPaymentIntent).toMatchObject({
        bookingId: testBooking.id,
        amount: testBooking.totalPrice,
        currency: 'USD',
        status: 'REQUIRES_PAYMENT_METHOD',
      });

      expect(testPaymentIntent.clientSecret).toBeDefined();
    });

    it('POST /payments/intent → 400 (Invalid booking)', async () => {
      const paymentData = {
        bookingId: 'invalid-booking-id',
        amount: 10000,
        currency: 'USD',
      };

      await request(app.getHttpServer())
        .post('/payments/intent')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(paymentData)
        .expect(400);
    });

    it('POST /payments/intent → 403 (Unauthorized booking)', async () => {
      // Create a booking for another user
      const otherBooking = await createOtherUserBooking();

      const paymentData = {
        bookingId: otherBooking.id,
        amount: otherBooking.totalPrice,
        currency: 'USD',
      };

      await request(app.getHttpServer())
        .post('/payments/intent')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(paymentData)
        .expect(403);
    });
  });

  describe('Payment Confirmation', () => {
    beforeEach(async () => {
      testPaymentIntent = await createPaymentIntent();
    });

    it('POST /payments/confirm → 200 (Confirm payment)', async () => {
      const confirmData = {
        paymentIntentId: testPaymentIntent.id,
        paymentMethodId: 'pm_test_visa',
      };

      const response = await request(app.getHttpServer())
        .post('/payments/confirm')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(confirmData)
        .expect(200);

      expect(response.body.status).toBe('SUCCEEDED');

      // Verify booking status is updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: testBooking.id },
      });
      expect(updatedBooking.status).toBe(BookingStatus.CONFIRMED);
    });

    it('POST /payments/confirm → 400 (Payment failed)', async () => {
      const confirmData = {
        paymentIntentId: testPaymentIntent.id,
        paymentMethodId: 'pm_test_cardDeclined', // Declined card
      };

      const response = await request(app.getHttpServer())
        .post('/payments/confirm')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(confirmData)
        .expect(400);

      expect(response.body.error).toContain('declined');
    });

    it('POST /payments/confirm → 400 (Insufficient funds)', async () => {
      const confirmData = {
        paymentIntentId: testPaymentIntent.id,
        paymentMethodId: 'pm_test_insufficientFunds',
      };

      const response = await request(app.getHttpServer())
        .post('/payments/confirm')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(confirmData)
        .expect(400);

      expect(response.body.error).toContain('insufficient');
    });
  });

  describe('Payment Failure Handling', () => {
    beforeEach(async () => {
      testPaymentIntent = await createPaymentIntent();
    });

    it('POST /payments/retry → 200 (Retry failed payment)', async () => {
      // First, fail a payment
      await request(app.getHttpServer())
        .post('/payments/confirm')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          paymentIntentId: testPaymentIntent.id,
          paymentMethodId: 'pm_test_cardDeclined',
        });

      // Then retry with a different payment method
      const retryData = {
        paymentIntentId: testPaymentIntent.id,
        newPaymentMethodId: 'pm_test_visa',
      };

      const response = await request(app.getHttpServer())
        .post('/payments/retry')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(retryData)
        .expect(200);

      expect(response.body.status).toBe('SUCCEEDED');
    });

    it('POST /payments/cancel → 200 (Cancel payment intent)', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/cancel')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ paymentIntentId: testPaymentIntent.id })
        .expect(200);

      expect(response.body.status).toBe('CANCELED');
    });
  });

  describe('Refund Processing', () => {
    beforeEach(async () => {
      // Create and confirm a payment for refund tests
      testPaymentIntent = await createPaymentIntent();
      await confirmPaymentIntent(testPaymentIntent.id);
    });

    it('POST /payments/refund → 200 (Process refund)', async () => {
      const refundData = {
        paymentId: testPaymentIntent.id,
        amount: Math.floor(testBooking.totalPrice / 2), // Partial refund
        reason: 'Customer requested partial refund',
      };

      const response = await request(app.getHttpServer())
        .post('/payments/refund')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(refundData)
        .expect(200);

      expect(response.body.status).toBe('SUCCEEDED');
      expect(response.body.amount).toBe(refundData.amount);
    });

    it('POST /payments/refund → 400 (Refund amount exceeds payment)', async () => {
      const refundData = {
        paymentId: testPaymentIntent.id,
        amount: testBooking.totalPrice + 10000, // More than original payment
        reason: 'Test over-refund',
      };

      await request(app.getHttpServer())
        .post('/payments/refund')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(refundData)
        .expect(400);
    });

    it('POST /payments/refund → 400 (Refund window expired)', async () => {
      // Simulate expired refund window by updating payment date
      await prisma.payment.update({
        where: { id: testPaymentIntent.id },
        data: { createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) }, // 91 days ago
      });

      const refundData = {
        paymentId: testPaymentIntent.id,
        amount: 1000,
        reason: 'Test expired refund',
      };

      await request(app.getHttpServer())
        .post('/payments/refund')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(refundData)
        .expect(400);
    });
  });

  describe('Webhook Handling', () => {
    beforeEach(async () => {
      testPaymentIntent = await createPaymentIntent();
    });

    it('POST /webhooks/stripe → 200 (Payment succeeded webhook)', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: testPaymentIntent.id,
            status: 'succeeded',
            amount: testBooking.totalPrice,
            currency: 'USD',
          },
        },
      };

      // Mock Stripe signature
      const signature = 'stripe_test_signature';

      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('POST /webhooks/stripe → 400 (Invalid signature)', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: { object: { id: testPaymentIntent.id } },
      };

      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(webhookPayload)
        .expect(400);
    });

    it('POST /webhooks/stripe → 200 (Chargeback webhook)', async () => {
      const webhookPayload = {
        type: 'charge.created',
        data: {
          object: {
            id: 'ch_test_chargeback',
            payment_intent: testPaymentIntent.id,
            amount: testBooking.totalPrice,
            currency: 'USD',
          },
        },
      };

      const signature = 'stripe_test_signature';

      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });
  });

  describe('Payment History and Analytics', () => {
    beforeEach(async () => {
      testPaymentIntent = await createPaymentIntent();
      await confirmPaymentIntent(testPaymentIntent.id);
    });

    it('GET /payments/history → 200 (Get payment history)', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/history')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body.payments)).toBe(true);
      expect(response.body.payments.length).toBeGreaterThan(0);
      expect(response.body.payments[0]).toMatchObject({
        id: testPaymentIntent.id,
        amount: testBooking.totalPrice,
        currency: 'USD',
      });
    });

    it('GET /payments/:id → 200 (Get payment details)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/payments/${testPaymentIntent.id}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testPaymentIntent.id,
        amount: testBooking.totalPrice,
        currency: 'USD',
        status: 'SUCCEEDED',
      });
    });
  });

  // Helper functions
  async function setupTestUser() {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    userAccessToken = login.body.accessToken;
  }

  async function createTestBooking() {
    // Create a test listing
    const listing = await prisma.listing.create({
      data: {
        title: 'Test Listing for Payment',
        slug: `payment-listing-${Date.now()}`,
        address: '123 Payment St',
        city: 'Payment City',
        state: 'PS',
        zipCode: '12345',
        country: 'US',
        ownerId: testUser.id,
        status: 'AVAILABLE',
        pricePerNight: 10000, // $100.00 in cents
      },
    });

    // Create a booking pending payment
    const booking = await prisma.booking.create({
      data: {
        listingId: listing.id,
        renterId: testUser.id,
        ownerId: testUser.id,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), // 9 days from now
        totalPrice: 30000, // $300.00
        status: BookingStatus.PENDING_PAYMENT,
      },
    });

    return booking;
  }

  async function createOtherUserBooking() {
    // Create another user
    const otherUser = await prisma.user.create({
      data: {
        email: `other-user-${Date.now()}@test.com`,
        username: `otheruser${Date.now()}`,
        passwordHash: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User',
      },
    });

    // Create listing for other user
    const listing = await prisma.listing.create({
      data: {
        title: 'Other User Listing',
        slug: `other-listing-${Date.now()}`,
        address: '456 Other St',
        city: 'Other City',
        state: 'OS',
        zipCode: '67890',
        country: 'US',
        ownerId: otherUser.id,
        status: 'AVAILABLE',
        pricePerNight: 15000,
      },
    });

    // Create booking for other user
    return await prisma.booking.create({
      data: {
        listingId: listing.id,
        renterId: otherUser.id,
        ownerId: otherUser.id,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        totalPrice: 45000,
        status: BookingStatus.PENDING_PAYMENT,
      },
    });
  }

  async function createPaymentIntent() {
    const paymentData = {
      bookingId: testBooking.id,
      amount: testBooking.totalPrice,
      currency: 'USD',
      paymentMethodId: 'pm_test_visa',
    };

    const response = await request(app.getHttpServer())
      .post('/payments/intent')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send(paymentData);

    return response.body;
  }

  async function confirmPaymentIntent(paymentIntentId: string) {
    await request(app.getHttpServer())
      .post('/payments/confirm')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        paymentIntentId,
        paymentMethodId: 'pm_test_visa',
      });
  }

  async function cleanupPaymentIntent() {
    if (testPaymentIntent?.id) {
      await prisma.payment.deleteMany({
        where: { id: testPaymentIntent.id },
      });
    }
  }

  async function cleanupTestData() {
    await prisma.payment.deleteMany({
      where: {
        booking: {
          renter: { email: testUser.email },
        },
      },
    });

    await prisma.booking.deleteMany({
      where: {
        renter: { email: testUser.email },
      },
    });

    await prisma.listing.deleteMany({
      where: {
        owner: { email: testUser.email },
      },
    });

    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  }
});
