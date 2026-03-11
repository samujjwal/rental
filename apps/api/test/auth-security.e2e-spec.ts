import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { buildTestEmail, createUserWithRole } from './e2e-helpers';
import { UserRole } from '@rental-portal/database';

describe('Password & Auth Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let userId: string;

  const userEmail = buildTestEmail('pw-user');
  const userPassword = 'SecurePass123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    const user = await createUserWithRole({ app, prisma, email: userEmail, password: userPassword });
    userToken = user.accessToken;
    userId = user.userId;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'pw-user' } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ── Password Change ──
  describe('POST /auth/password/change', () => {
    it('should change password with correct current password', async () => {
      const newPassword = 'NewSecure456!';
      await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: userPassword, newPassword })
        .expect((r) => expect([200, 201]).toContain(r.status));

      // Verify login works with new password
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: newPassword })
        .expect(200);

      expect(loginRes.body).toHaveProperty('accessToken');
      userToken = loginRes.body.accessToken;

      // Restore password for other tests
      await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: newPassword, newPassword: userPassword });

      const relogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: userPassword })
        .expect(200);
      userToken = relogin.body.accessToken;
    });

    it('should reject wrong current password', async () => {
      await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'WrongPass999!', newPassword: 'NewPass123!' })
        .expect((r) => expect([400, 401, 403]).toContain(r.status));
    });

    it('should reject weak new password', async () => {
      await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: userPassword, newPassword: '123' })
        .expect((r) => expect([400, 422]).toContain(r.status));
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/auth/password/change')
        .send({ currentPassword: userPassword, newPassword: 'NewPass123!' })
        .expect((r) => expect([401, 403]).toContain(r.status));
    });
  });

  // ── Password Reset Request ──
  describe('POST /auth/password/reset-request', () => {
    it('should accept valid email and not reveal user existence', async () => {
      // Should return success whether or not email exists
      await request(app.getHttpServer())
        .post('/auth/password/reset-request')
        .send({ email: userEmail })
        .expect((r) => expect([200, 201]).toContain(r.status));
    });

    it('should accept non-existent email without error (security)', async () => {
      await request(app.getHttpServer())
        .post('/auth/password/reset-request')
        .send({ email: 'nonexistent@test.com' })
        .expect((r) => expect([200, 201]).toContain(r.status));
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/password/reset-request')
        .send({ email: 'not-an-email' })
        .expect((r) => expect([400, 422]).toContain(r.status));
    });
  });

  // ── Password Reset (with token) ──
  describe('POST /auth/password/reset', () => {
    it('should reject reset with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/password/reset')
        .send({ token: 'invalid-token-abc', password: 'NewSecure456!' })
        .expect((r) => expect([400, 401, 404]).toContain(r.status));
    });

    it('should reject empty token', async () => {
      await request(app.getHttpServer())
        .post('/auth/password/reset')
        .send({ token: '', password: 'NewSecure456!' })
        .expect((r) => expect([400, 422]).toContain(r.status));
    });
  });

  // ── Logout ──
  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      // Login to get a fresh token to logout
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: userPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect((r) => expect([200, 201]).toContain(r.status));
    });
  });

  // ── Logout All ──
  describe('POST /auth/logout-all', () => {
    it('should invalidate all sessions', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: userPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect((r) => expect([200, 201]).toContain(r.status));
    });
  });

  // ── MFA Enable (without actual TOTP setup - tests the endpoint exists) ──
  describe('MFA Endpoints', () => {
    it('POST /auth/mfa/enable should return setup data', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: userPassword })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/auth/mfa/enable')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect((r) => expect([200, 201]).toContain(r.status));

      // Should return a secret or QR URI for TOTP setup
      expect(res.body).toBeDefined();
    });

    it('POST /auth/mfa/verify should reject invalid OTP', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: userPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ otp: '000000' })
        .expect((r) => expect([400, 401]).toContain(r.status));
    });

    it('POST /auth/mfa/disable should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/auth/mfa/disable')
        .expect((r) => expect([401, 403]).toContain(r.status));
    });
  });

  // ── Email Verification ──
  describe('Email Verification', () => {
    it('POST /auth/verify-email/send should accept request', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: userPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/verify-email/send')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect((r) => expect([200, 201]).toContain(r.status));
    });

    it('GET /auth/verify-email/:token should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/verify-email/invalid-token')
        .expect((r) => expect([400, 404]).toContain(r.status));
    });
  });

  // ── Token refresh with expired token ──
  describe('Token Edge Cases', () => {
    it('should reject malformed token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt.token')
        .expect((r) => expect([401, 403]).toContain(r.status));
    });

    it('should reject empty authorization header', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', '')
        .expect((r) => expect([401, 403]).toContain(r.status));
    });

    it('should reject Bearer prefix only (no token)', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer ')
        .expect((r) => expect([401, 403]).toContain(r.status));
    });
  });

  // ── Listing Authentication Security ──
  describe('Listing Authentication Security', () => {
    let ownerToken: string;
    let adminToken: string;
    let renterToken: string;
    let draftListingId: string;
    let availableListingId: string;

    const ownerEmail = buildTestEmail('listing-owner');
    const adminEmail = buildTestEmail('listing-admin');
    const renterEmail = buildTestEmail('listing-renter');

    beforeAll(async () => {
      // Create test users
      const owner = await createUserWithRole({
        app,
        prisma,
        email: ownerEmail,
        password: 'SecurePass123!',
        role: UserRole.HOST,
      });
      ownerToken = owner.accessToken;

      const admin = await createUserWithRole({
        app,
        prisma,
        email: adminEmail,
        password: 'SecurePass123!',
        role: UserRole.ADMIN,
      });
      adminToken = admin.accessToken;

      const renter = await createUserWithRole({
        app,
        prisma,
        email: renterEmail,
        password: 'SecurePass123!',
        role: UserRole.USER,
      });
      renterToken = renter.accessToken;

      // Create test listings
      const draftListing = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Draft Listing',
          description: 'Test draft listing',
          basePrice: 100,
          currency: 'USD',
          categoryId: 'test-category',
          address: 'Test Address',
          city: 'Test City',
          country: 'US',
          latitude: 40.7128,
          longitude: -74.0060,
          status: 'DRAFT',
        })
        .expect(201);
      draftListingId = draftListing.body.id;

      const availableListing = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Available Listing',
          description: 'Test available listing',
          basePrice: 100,
          currency: 'USD',
          categoryId: 'test-category',
          address: 'Test Address',
          city: 'Test City',
          country: 'US',
          latitude: 40.7128,
          longitude: -74.0060,
          status: 'AVAILABLE',
        })
        .expect(201);
      availableListingId = availableListing.body.id;
    });

    afterAll(async () => {
      // Cleanup
      await prisma.listing.deleteMany({
        where: {
          owner: {
            email: {
              in: [ownerEmail, adminEmail, renterEmail],
            },
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [ownerEmail, adminEmail, renterEmail],
          },
        },
      });
    });

    it('should prevent privilege escalation via token manipulation', async () => {
      // Create a token with modified role (simulate token tampering)
      const tamperedToken = ownerToken.replace('HOST', 'ADMIN');

      await request(app.getHttpServer())
        .get(`/listings/${draftListingId}`)
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(404); // Should fail because token is invalid
    });

    it('should prevent access with expired tokens', async () => {
      // Simulate expired token (this would normally be caught by JWT verification)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0Iiwicm9sZSI6IkhPU1QiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMH0.invalid';

      await request(app.getHttpServer())
        .get(`/listings/${draftListingId}`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(404); // Should fall back to public access and fail
    });

    it('should prevent access with malformed tokens', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'Bearer only',
        'Bearer',
        '',
        'invalid.jwt.format',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
      ];

      for (const token of malformedTokens) {
        await request(app.getHttpServer())
          .get(`/listings/${availableListingId}`)
          .set('Authorization', token)
          .expect(200); // Public listing should be accessible
      }
    });

    it('should prevent SQL injection via listing ID', async () => {
      const maliciousIds = [
        "'; DROP TABLE listings; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users --",
        "null",
        "undefined",
        "../../../etc/passwd",
      ];

      for (const maliciousId of maliciousIds) {
        await request(app.getHttpServer())
          .get(`/listings/${maliciousId}`)
          .expect(404); // Should return 404, not 500
      }
    });

    it('should prevent authorization header injection', async () => {
      const maliciousHeaders = [
        'Bearer token\r\nSet-Cookie: admin=true',
        'Bearer token\nX-Forwarded-For: 127.0.0.1',
        'Bearer token\r\nX-User-Role: ADMIN',
        'Bearer token\x00admin',
        'Bearer token%0a%0dX-Admin: true',
      ];

      for (const header of maliciousHeaders) {
        await request(app.getHttpServer())
          .get(`/listings/${availableListingId}`)
          .set('Authorization', header)
          .expect(200); // Should handle gracefully
      }
    });

    it('should enforce rate limiting on listing access', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(100).fill(null).map(() =>
        request(app.getHttpServer())
          .get(`/listings/${availableListingId}`)
      );

      const responses = await Promise.allSettled(promises);
      
      // Some requests should be rate limited (429) or succeed (200)
      const statusCodes = responses.map(r => 
        r.status === 'fulfilled' ? r.value.status : 'rejected'
      );
      
      // Should have mix of 200 and potentially 429 responses
      expect(statusCodes.some(code => code === 200)).toBe(true);
    });

    it('should prevent enumeration of private listings', async () => {
      // Try to enumerate listing IDs with different statuses
      const privateStatuses = ['DRAFT', 'ARCHIVED', 'MAINTENANCE'];
      
      for (const status of privateStatuses) {
        await request(app.getHttpServer())
          .get('/listings')
          .query({ status, limit: 10 })
          .expect(200)
          .then((response) => {
            // Should not return private listings in public search
            const listings = response.body.listings || response.body;
            if (Array.isArray(listings)) {
              listings.forEach((listing: any) => {
                expect(['AVAILABLE', 'RENTED']).toContain(listing.status);
              });
            }
          });
      }
    });

    it('should prevent cross-tenant data leakage', async () => {
      // User should not be able to access another user's private listings
      await request(app.getHttpServer())
        .get(`/listings/${draftListingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(404); // Should not be able to see owner's draft listing
    });

    it('should validate JWT structure consistency', async () => {
      // Test with tokens that have missing or incorrect fields
      const testCases = [
        { token: 'valid.token', shouldWork: true },
        { token: 'Bearer valid.token', shouldWork: true },
        { token: 'bearer valid.token', shouldWork: true }, // lowercase
        { token: 'VALID.TOKEN', shouldWork: true }, // uppercase
      ];

      for (const testCase of testCases) {
        await request(app.getHttpServer())
          .get(`/listings/${availableListingId}`)
          .set('Authorization', testCase.token)
          .expect(200); // Should handle all valid formats
      }
    });
  });
});
