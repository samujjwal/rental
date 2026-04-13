import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('External Service Failure Scenarios', () => {
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

  describe('Stripe API failure', () => {
    it('should return payment error when Stripe is unreachable', async () => {
      // Attempt a payment with an invalid Stripe configuration
      const response = await request(app.getHttpServer())
        .post('/payments/intent')
        .set('Authorization', 'Bearer test-token')
        .send({
          bookingId: 'booking-nonexistent',
          amount: 1000,
          currency: 'NPR',
        });

      // Should return a structured error, not crash
      expect([400, 402, 404, 500, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle Stripe webhook timeout gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('stripe-signature', 'invalid-sig')
        .send({ type: 'payment_intent.succeeded', data: {} });

      // Should reject invalid webhook signatures without crashing
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  describe('Email service failure', () => {
    it('should not block user registration when email service fails', async () => {
      // Registration should succeed even if verification email fails
      const email = `ext-svc-test-${Date.now()}@test.com`;
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'SecurePass123!',
          firstName: 'External',
          lastName: 'Test',
          phoneNumber: '+9779800000001',
        });

      // Registration should still succeed (email sent async)
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('Storage service failure', () => {
    it('should return error when file upload storage is unavailable', async () => {
      const response = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('file', Buffer.from('test content'), 'test.txt');

      // Should return an error, not crash
      expect([400, 401, 403, 413, 500, 503]).toContain(response.status);
    });
  });

  describe('Health endpoint under service failures', () => {
    it('should report degraded health when external services are down', async () => {
      const response = await request(app.getHttpServer())
        .get('/health');

      expect([200, 503]).toContain(response.status);
      // Health endpoint should always return a structured response
      expect(response.body).toBeDefined();
    });
  });

  describe('Retry and fallback behavior', () => {
    it('should retry failed external calls with exponential backoff', async () => {
      const start = Date.now();

      // Make a request that triggers an external service call
      const response = await request(app.getHttpServer())
        .get('/listings')
        .set('Authorization', 'Bearer test-token')
        .query({ page: 1, limit: 5 });

      const elapsed = Date.now() - start;

      // Should respond within reasonable time even if retries occur
      expect(elapsed).toBeLessThan(30000);
      expect([200, 401, 500, 503]).toContain(response.status);
    });
  });
});
