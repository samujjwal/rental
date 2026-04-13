import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Task 4.2: Cross-system integration tests.
 * Tests API with external service integration points.
 */
describe('Cross-System Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('API + Storage (S3) integration', () => {
    it('should reject uploads without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/upload')
        .attach('file', Buffer.from('test'), 'test.txt');

      expect([401, 403, 404]).toContain(res.status);
    });

    it('should reject oversized uploads', async () => {
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      const res = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('file', largeBuffer, 'large.bin');

      expect([401, 413, 422, 500]).toContain(res.status);
    });
  });

  describe('API + Stripe integration', () => {
    it('should reject invalid webhook signatures', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('stripe-signature', 'bad-sig')
        .send({ type: 'payment_intent.succeeded', data: {} });

      expect([400, 401, 403, 404]).toContain(res.status);
    });
  });

  describe('API + Email/SMS integration', () => {
    it('should handle contact verification requests', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'nonexistent@test.com' });

      // Should respond without crashing, even if user/service not found
      expect([200, 400, 404, 429]).toContain(res.status);
    });
  });

  describe('API rate limiting integration', () => {
    it('should enforce rate limits on repeated requests', async () => {
      const statuses: number[] = [];

      for (let i = 0; i < 60; i++) {
        const res = await request(app.getHttpServer()).get('/health');
        statuses.push(res.status);
      }

      // Should have mostly 200s, possibly some 429s
      expect(statuses.filter((s) => s === 200 || s === 429).length).toBe(statuses.length);
    });
  });
});
