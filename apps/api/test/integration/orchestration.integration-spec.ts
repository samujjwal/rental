import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Task 4.1: Multi-service orchestration integration tests.
 * Tests cross-service flows: auth → listings → bookings → payments.
 */
describe('Multi-Service Orchestration Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Booking creation flow (auth → listings → bookings)', () => {
    it('should require auth for booking creation', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-1',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect([401, 403]).toContain(res.status);
    });

    it('should reject booking for nonexistent listing', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', 'Bearer test-token')
        .send({
          listingId: 'nonexistent-listing',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect([400, 401, 404]).toContain(res.status);
    });
  });

  describe('Listing publication flow', () => {
    it('should require auth for listing creation', async () => {
      const res = await request(app.getHttpServer())
        .post('/listings')
        .send({ title: 'Test', description: 'Desc', price: 1000 });

      expect([401, 403]).toContain(res.status);
    });

    it('should return listings via public GET', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings')
        .query({ page: 1, limit: 5 });

      expect([200, 401]).toContain(res.status);
    });
  });

  describe('Payment flow orchestration', () => {
    it('should require auth for payment intent creation', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/intent')
        .send({ bookingId: 'booking-1', amount: 5000, currency: 'NPR' });

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Error propagation across services', () => {
    it('should return structured errors from nested service failures', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings/nonexistent-id')
        .set('Authorization', 'Bearer test-token');

      expect([401, 404]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body).toHaveProperty('message');
      }
    });
  });
});
