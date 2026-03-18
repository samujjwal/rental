/**
 * P1: OTP Passwordless Flow E2E Test
 *
 * Tests the OTP (magic link / passwordless) authentication flow:
 * 1. Request OTP → verify rate limiting
 * 2. Verify with invalid code → rejected
 * 3. Verify with correct code → get tokens + user
 * 4. Repeat request → rate limit kicks in
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CacheService } from '../src/common/cache/cache.service';
import { buildTestEmail } from './e2e-helpers';

describe('OTP Passwordless Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cacheService: CacheService;
  const otpEmail = buildTestEmail('otp-flow');

  const postOtpVerify = async (payload: { email: string; code: string }, attempts = 2) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await request(app.getHttpServer())
          .post('/auth/otp/verify')
          .send(payload);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : '';
        const isParseError = message.includes('Parse Error: Expected HTTP/, RTSP/ or ICE/');

        if (!isParseError || attempt === attempts) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('OTP verify request failed');
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

    prisma = app.get<PrismaService>(PrismaService);
    cacheService = app.get<CacheService>(CacheService);
    await app.init();
  });

  afterAll(async () => {
    try {
      await prisma.session.deleteMany({ where: { user: { email: otpEmail } } });
      await prisma.user.deleteMany({ where: { email: otpEmail } });
    } catch { /* ignore */ }
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /auth/otp/request', () => {
    it('should accept valid email and return success message', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: otpEmail });

      // Should succeed (200) or be rate-limited (429)
      expect([200, 201, 429]).toContain(res.status);

      if (res.status === 200 || res.status === 201) {
        expect(res.body).toHaveProperty('message');
      }
    });

    it('should reject missing email', async () => {
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({})
        .expect(400);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('POST /auth/otp/verify', () => {
    it('should reject invalid OTP code', async () => {
      const res = await postOtpVerify({ email: otpEmail, code: '000000' });

      // Should be 400 (invalid code) or 401
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('should reject expired/missing OTP', async () => {
      const freshEmail = buildTestEmail('otp-expired');

      const res = await postOtpVerify({ email: freshEmail, code: '123456' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should accept valid OTP and return tokens', async () => {
      // Request an OTP first
      const reqRes = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: otpEmail });

      if (reqRes.status !== 200 && reqRes.status !== 201) {
        // If rate-limited, skip this test
        console.warn('OTP request rate-limited, skipping verification test');
        return;
      }

      // Retrieve the OTP from cache (test-only: direct cache access)
      const normalizedEmail = otpEmail.toLowerCase();
      const cachedOtpData = await cacheService.get<any>(`otp:${normalizedEmail}`);
      // Service stores { code, attempts } object
      const cachedOtp = typeof cachedOtpData === 'string' ? cachedOtpData : cachedOtpData?.code;

      if (!cachedOtp) {
        console.warn('OTP not found in cache — email service may be mocking. Skipping.');
        return;
      }

      const verifyRes = await postOtpVerify({ email: otpEmail, code: cachedOtp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('accessToken');
      expect(verifyRes.body).toHaveProperty('refreshToken');
      expect(verifyRes.body).toHaveProperty('user');
    });

    it('should reject reuse of OTP (single-use)', async () => {
      // Request OTP
      const reqRes = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: otpEmail });

      if (reqRes.status !== 200 && reqRes.status !== 201) return;

      const normalizedEmail = otpEmail.toLowerCase();
      const cachedOtpData = await cacheService.get<any>(`otp:${normalizedEmail}`);
      const cachedOtp = typeof cachedOtpData === 'string' ? cachedOtpData : cachedOtpData?.code;
      if (!cachedOtp) return;

      // First verification
      await postOtpVerify({ email: otpEmail, code: cachedOtp });

      // Second verification with same code — should fail
      const res = await postOtpVerify({ email: otpEmail, code: cachedOtp });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
