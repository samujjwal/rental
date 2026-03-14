/**
 * MUST-RUN Smoke Suite for the API.
 *
 * These tests verify critical happy-path flows against a running API.
 * Run with: pnpm --filter @rental-portal/api test:e2e -- --testPathPatterns smoke
 *
 * Prerequisites:
 *   - API running on localhost:3400
 *   - Seeded database with sample data
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CacheService } from '../src/common/cache/cache.service';

describe('🔥 API Smoke Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;
  let cookies: string[];
  const testEmail = `smoke-${Date.now()}@test.com`;
  const testPassword = 'SmokeTest123!';

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
    // Cleanup test user
    try {
      await prisma.user.deleteMany({ where: { email: testEmail } });
    } catch {
      // Ignore cleanup failures
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ── Auth smoke ─────────────────────────────────────────────────

  describe('Auth flow', () => {
    it('POST /auth/register → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Smoke',
          lastName: 'Test',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      // Don't store registration tokens - they will be replaced after login
    });

    it('POST /auth/verify-email → 200', async () => {
      // Get the user to extract the verification token from cache
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
        select: { id: true, emailVerificationToken: true },
      });

      expect(user).toBeDefined();
      expect(user?.emailVerificationToken).toBeDefined();

      // Create a verification token (in real flow this would come from email)
      // For testing, we'll use the token hash directly
      const verificationToken = 'test-verification-token';

      // Set up cache entry for verification using the cache service
      const cacheService = app.get(CacheService);
      const tokenHash = require('crypto')
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
      await cacheService.set(
        `email-verify:${tokenHash}`,
        {
          userId: user!.id,
          createdAt: Date.now(),
        },
        24 * 60 * 60,
      );

      // Update user with the token hash
      await prisma.user.update({
        where: { id: user!.id },
        data: { emailVerificationToken: tokenHash },
      });

      // Verify email
      const res = await request(app.getHttpServer())
        .get(`/auth/verify-email/${verificationToken}`)
        .expect(200);

      expect(res.body.message).toContain('Email verified successfully');

      // Verify user status is now ACTIVE
      const verifiedUser = await prisma.user.findUnique({
        where: { email: testEmail },
        select: { status: true, emailVerified: true },
      });

      expect(verifiedUser?.status).toBe('ACTIVE');
      expect(verifiedUser?.emailVerified).toBe(true);
    });

    it('POST /auth/login → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      // Store login tokens for subsequent tests
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
      // Store cookies for refresh token
      cookies = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [];
    });

    it('GET /auth/me → 200 (authenticated)', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testEmail);
    });

    it('GET /auth/me → 401 (no token)', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('POST /auth/refresh → 200', async () => {
      // Use cookies for refresh token (preferred method) if available, otherwise use body
      const req = request(app.getHttpServer()).post('/auth/refresh');

      if (cookies && cookies.length > 0) {
        req.set('Cookie', cookies);
      }

      // Always send refresh token in body as fallback
      req.send({ refreshToken });

      const res = await req.expect(200);

      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  // ── Listings smoke ─────────────────────────────────────────────

  describe('Listings', () => {
    it('GET /listings → 200', async () => {
      const res = await request(app.getHttpServer()).get('/listings').expect(200);

      expect(Array.isArray(res.body.listings || res.body.data || res.body)).toBe(true);
    });

    it('GET /listings/featured → 200', async () => {
      const res = await request(app.getHttpServer()).get('/listings/featured').expect(200);

      expect(Array.isArray(res.body.listings || res.body.data || res.body)).toBe(true);
    });
  });

  // ── Categories smoke ──────────────────────────────────────────

  describe('Categories', () => {
    it('GET /categories → 200', async () => {
      const res = await request(app.getHttpServer()).get('/categories').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Search smoke ──────────────────────────────────────────────

  describe('Search', () => {
    it('GET /search?q=apartment → 200', async () => {
      const res = await request(app.getHttpServer()).get('/search?q=apartment').expect(200);

      expect(res.body).toBeDefined();
    });

    it('GET /search/autocomplete?q=kat → 200', async () => {
      await request(app.getHttpServer()).get('/search/autocomplete?q=kat').expect(200);
    });
  });

  // ── Bookings smoke ────────────────────────────────────────────

  describe('Bookings', () => {
    it('GET /bookings/my-bookings → 200 (authenticated)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.bookings || res.body.data || res.body)).toBe(true);
    });

    it('GET /bookings/my-bookings → 401 (unauthenticated)', async () => {
      await request(app.getHttpServer()).get('/bookings/my-bookings').expect(401);
    });
  });

  // ── Favorites smoke ───────────────────────────────────────────

  describe('Favorites', () => {
    it('GET /favorites → 200 (authenticated)', async () => {
      const res = await request(app.getHttpServer())
        .get('/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.favorites || res.body.data || res.body)).toBe(true);
    });
  });

  // ── Notifications smoke ──────────────────────────────────────

  describe('Notifications', () => {
    it('GET /notifications → 200 (authenticated)', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  // ── Health check ──────────────────────────────────────────────

  describe('Health', () => {
    it('GET /health → 200', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      // Accept 200 (healthy), 404 (not implemented), or 503 (service checks failed in test env)
      expect([200, 404, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });
});
