/**
 * Security-focused tests for the API.
 *
 * Tests OWASP Top 10 vectors, auth bypass, injection, IDOR, etc.
 * Run with: pnpm --filter @rental-portal/api test:e2e -- --testPathPattern security
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('🔒 Security Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let otherUserToken: string;
  const userEmail = `sec-user-${Date.now()}@test.com`;
  const otherEmail = `sec-other-${Date.now()}@test.com`;
  const password = 'SecurePass123!';

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

    // Register two test users
    const res1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password, firstName: 'SecUser', lastName: 'One' });
    userToken = res1.body.accessToken;

    const res2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password, firstName: 'SecUser', lastName: 'Two' });
    otherUserToken = res2.body.accessToken;
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: { in: [userEmail, otherEmail] } } });
    } catch {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ── A01: Broken Access Control ────────────────────────────────

  describe('A01 – Broken Access Control', () => {
    it('rejects admin endpoints for non-admin users', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects admin endpoint without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users');

      expect(res.status).toBe(401);
    });

    it('cannot access another user profile write endpoints', async () => {
      // Try to update another user's profile
      await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ firstName: 'HACKED' })
        .expect((res) => {
          // Should update own profile, NOT the first user's
          if (res.status === 200) {
            expect(res.body.email).not.toBe(userEmail);
          }
        });
    });
  });

  // ── A02: Cryptographic Failures ────────────────────────────────

  describe('A02 – Cryptographic Failures', () => {
    it('does NOT return password hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.password).toBeUndefined();
      expect(res.body.mfaSecret).toBeUndefined();
    });

    it('does NOT return tokens in listing/search responses', async () => {
      const res = await request(app.getHttpServer()).get('/listings').expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('mfaSecret');
    });
  });

  // ── A03: Injection ─────────────────────────────────────────────

  describe('A03 – Injection', () => {
    it('rejects SQL injection in search query', async () => {
      const res = await request(app.getHttpServer())
        .get('/search')
        .query({ q: "'; DROP TABLE users; --" });

      // Must return 200 (safe result) or 400 (rejected input), never 500
      expect([200, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);

      // App must still work after injection attempt
      await request(app.getHttpServer()).get('/listings').expect(200);
    });

    it('rejects NoSQL injection in filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings')
        .query({ '$gt': '' });

      // Must not crash the server (no 500)
      expect(res.status).not.toBe(500);
      expect([200, 400]).toContain(res.status);
    });

    it('sanitizes XSS in registration', async () => {
      const xssEmail = `xss-${Date.now()}@test.com`;
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: xssEmail,
          password: 'SafePass123!',
          firstName: '<script>alert("xss")</script>',
          lastName: 'Normal',
        });

      if (res.status === 201) {
        // If registration succeeds, the name should be sanitized or stored safely
        const profile = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${res.body.accessToken}`);

        // Check it's not executable (either sanitized or escaped)
        if (profile.body.firstName) {
          expect(profile.body.firstName).not.toContain('<script>');
        }

        // Cleanup
        await prisma.user.deleteMany({ where: { email: xssEmail } });
      }
    });
  });

  // ── A04: Insecure Design ──────────────────────────────────────

  describe('A04 – Insecure Design', () => {
    it('rate-limits login attempts (or returns consistent error)', async () => {
      // Attempt many logins with wrong password
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: userEmail, password: 'WrongPassword!' }),
      );

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);

      // Should either rate-limit (429) or consistently return 401
      expect(
        statuses.every((s) => s === 401) || statuses.some((s) => s === 429),
      ).toBe(true);
    });
  });

  // ── A05: Security Misconfiguration ────────────────────────────

  describe('A05 – Security Misconfiguration', () => {
    it('does NOT expose stack traces in errors', async () => {
      const res = await request(app.getHttpServer()).get('/nonexistent-path');

      if (res.body) {
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('node_modules');
      }
    });

    it('returns proper CORS/security headers in responses', async () => {
      const res = await request(app.getHttpServer()).get('/listings').expect(200);

      // Must not leak server info
      expect(res.headers['x-powered-by']).toBeUndefined();

      // Helmet security headers should be present
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('responds to CORS preflight requests', async () => {
      const res = await request(app.getHttpServer())
        .options('/listings')
        .set('Origin', 'http://localhost:3401')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

      // Preflight must not return 500
      expect(res.status).not.toBe(500);
      // Should return CORS headers for allowed origin
      if (res.status === 204 || res.status === 200) {
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3401');
        expect(res.headers['access-control-allow-methods']).toBeDefined();
      }
    });

    it('rejects CORS requests from disallowed origins', async () => {
      const res = await request(app.getHttpServer())
        .options('/listings')
        .set('Origin', 'http://evil-site.com')
        .set('Access-Control-Request-Method', 'GET');

      // Should not return the evil origin in CORS headers
      if (res.headers['access-control-allow-origin']) {
        expect(res.headers['access-control-allow-origin']).not.toBe('http://evil-site.com');
      }
    });
  });

  // ── A07: Auth failures ────────────────────────────────────────

  describe('A07 – Identification and Authentication Failures', () => {
    it('rejects expired/malformed tokens', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    it('rejects tokens without Bearer prefix', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', userToken)
        .expect(401);
    });

    it('rejects registration with weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `weak-${Date.now()}@test.com`,
          password: '123',
          firstName: 'Weak',
          lastName: 'Pass',
        });

      expect(res.status).toBe(400);
    });

    it('rejects duplicate email registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: userEmail,
          password: 'AnotherPass123!',
          firstName: 'Dupe',
          lastName: 'User',
        });

      expect(res.status).toBe(409);
    });
  });

  // ── Input validation ──────────────────────────────────────────

  describe('Input Validation', () => {
    it('rejects empty body on POST /auth/register', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects extra unknown fields (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: userEmail,
          password,
          isAdmin: true,   // Extra field
          role: 'ADMIN',   // Extra field
        });

      // Whitelist pipe should strip extra fields; login should succeed or reject
      if (res.status === 200) {
        // Even if login succeeds, the extra fields must be ignored
        const me = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${res.body.accessToken}`);

        expect(me.body.role).not.toBe('ADMIN');
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('rejects invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password,
          firstName: 'Bad',
          lastName: 'Email',
        });

      expect(res.status).toBe(400);
    });
  });
});
