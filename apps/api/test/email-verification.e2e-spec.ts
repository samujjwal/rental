/**
 * Email & Phone Verification E2E Test
 *
 * Tests the full verification token lifecycle:
 * 1. Register user (emailVerified = false)
 * 2. Send verification email → token stored in DB (hashed)
 * 3. Verify email with correct token → emailVerified = true
 * 4. Verify email with wrong/expired token → rejected
 * 5. Verify already-verified user → rejected
 *
 * Covers the gap identified in the Deep Flow Verification Report (Section 10.1):
 * "Email/phone verification E2E — No API E2E test for email verification token flow"
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CacheService } from '../src/common/cache/cache.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { WebhookService } from '../src/modules/payments/webhook.service';
import { buildTestEmail, registerUser, loginUser } from './e2e-helpers';

const mockStripeService = {
  providerId: 'stripe',
  providerConfig: {
    providerId: 'stripe',
    name: 'Stripe',
    supportedCountries: ['US', 'NP'],
    supportedCurrencies: ['USD', 'NPR'],
  },
  get config() {
    return this.providerConfig;
  },
  createPaymentIntent: jest.fn().mockResolvedValue({
    clientSecret: 'pi_test_secret_mock',
    paymentIntentId: 'pi_mock_verify',
    providerId: 'stripe',
  }),
  createConnectAccount: jest.fn().mockResolvedValue('acct_mock'),
  createAccountLink: jest
    .fn()
    .mockResolvedValue('https://mock-onboard.example.com'),
  getAccountStatus: jest.fn().mockResolvedValue({
    detailsSubmitted: true,
    chargesEnabled: true,
    payoutsEnabled: true,
  }),
};

const mockWebhookService = {
  handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

describe('Email Verification Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cache: CacheService;
  const testEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeService)
      .useValue(mockStripeService)
      .overrideProvider(WebhookService)
      .useValue(mockWebhookService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    cache = app.get<CacheService>(CacheService);
    await app.init();
  });

  afterAll(async () => {
    // Clean up all test users
    if (testEmails.length > 0) {
      await prisma.session.deleteMany({
        where: { user: { email: { in: testEmails } } },
      });
      await prisma.auditLog.deleteMany({
        where: { user: { email: { in: testEmails } } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: testEmails } },
      });
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('Full email verification token lifecycle', () => {
    let userEmail: string;
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      userEmail = buildTestEmail('verify-flow');
      testEmails.push(userEmail);

      // Register a new user (emailVerified starts as false by default)
      const registered = await registerUser(app, {
        email: userEmail,
        firstName: 'Verify',
        lastName: 'User',
      });
      accessToken = registered.accessToken;

      // Get the user ID
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, emailVerified: true },
      });
      userId = user!.id;

      // Activate account (status ACTIVE) but keep emailVerified:false so verification tests work
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' as any, emailVerified: false },
      });
    });

    it('should send verification email and store token hash in DB', async () => {
      // Ensure email is not yet verified
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: false },
      });

      // Re-login to get fresh token
      const loginRes = await loginUser(app, userEmail);

      await request(app.getHttpServer())
        .post('/auth/verify-email/send')
        .set('Authorization', `Bearer ${loginRes.accessToken}`)
        .expect((res) => {
          expect([200, 201, 204]).toContain(res.status);
        });

      // Verify token hash was stored in the user record
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerificationToken: true },
      });
      expect(user?.emailVerificationToken).toBeTruthy();
      expect(user?.emailVerificationToken).toHaveLength(64); // SHA-256 hex
    });

    it('should verify email with correct token', async () => {
      // Set email as unverified
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: false },
      });

      const loginRes = await loginUser(app, userEmail);

      // Send verification email
      await request(app.getHttpServer())
        .post('/auth/verify-email/send')
        .set('Authorization', `Bearer ${loginRes.accessToken}`);

      // Extract token hash from DB and reverse-engineer the raw token
      // Since we can't get the raw token from email, we'll set a known token directly
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      // Set the token hash in DB and cache (mimicking what sendVerificationEmail does)
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerificationToken: tokenHash },
      });
      await cache.set(
        `email-verify:${tokenHash}`,
        { userId, createdAt: Date.now() },
        24 * 60 * 60,
      );

      // Verify with the raw token
      const verifyRes = await request(app.getHttpServer())
        .get(`/auth/verify-email/${rawToken}`)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(verifyRes.body.message).toBeDefined();

      // Confirm the user is now verified
      const verifiedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true, emailVerificationToken: true },
      });
      expect(verifiedUser?.emailVerified).toBe(true);
      expect(verifiedUser?.emailVerificationToken).toBeNull();
    });

    it('should reject verification with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/verify-email/totally-invalid-token-12345')
        .expect((res) => {
          expect([400, 404]).toContain(res.status);
        });
    });

    it('should reject verification with expired/missing cache entry', async () => {
      // Create a token that exists in DB but NOT in cache (simulates expiry)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      await prisma.user.update({
        where: { id: userId },
        data: { emailVerificationToken: tokenHash },
      });
      // Do NOT set the cache entry — simulates expired token

      await request(app.getHttpServer())
        .get(`/auth/verify-email/${rawToken}`)
        .expect((res) => {
          expect([400, 404]).toContain(res.status);
        });

      // User should still NOT be verified
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true },
      });
      expect(user?.emailVerified).toBe(false);
    });

    it('should reject send-verification when already verified', async () => {
      // Mark user as already verified
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      const loginRes = await loginUser(app, userEmail);

      await request(app.getHttpServer())
        .post('/auth/verify-email/send')
        .set('Authorization', `Bearer ${loginRes.accessToken}`)
        .expect((res) => {
          expect([400, 409]).toContain(res.status);
        });
    });

    it('should protect booking creation for unverified users', async () => {
      // Ensure emailVerified is false
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: false },
      });

      const loginRes = await loginUser(app, userEmail);

      // Attempt to create a booking — should be blocked by EmailVerifiedGuard
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${loginRes.accessToken}`)
        .send({
          listingId: 'any-listing-id',
          startDate: '2030-01-01',
          endDate: '2030-01-05',
          guestCount: 1,
        })
        .expect((res) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
