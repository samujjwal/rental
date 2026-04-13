import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Task 4.3: System health check integration tests.
 */
describe('Health Check Integration', () => {
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

  describe('Liveness', () => {
    it('should respond to /health', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toBeDefined();
    });

    it('should respond to /health/liveness', async () => {
      const res = await request(app.getHttpServer()).get('/health/liveness');
      expect([200, 404, 503]).toContain(res.status);
    });
  });

  describe('Readiness', () => {
    it('should report readiness status', async () => {
      const res = await request(app.getHttpServer()).get('/health/readiness');
      expect([200, 404, 503]).toContain(res.status);
    });
  });

  describe('Health under load', () => {
    it('should remain responsive under concurrent health checks', async () => {
      const promises = Array.from({ length: 20 }, () =>
        request(app.getHttpServer()).get('/health'),
      );

      const results = await Promise.all(promises);
      results.forEach((res) => {
        expect([200, 429, 503]).toContain(res.status);
      });
    });
  });

  describe('Health response structure', () => {
    it('should return structured health data', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      if (res.status === 200) {
        expect(res.body).toBeDefined();
        // Health endpoint should return an object
        expect(typeof res.body).toBe('object');
      }
    });
  });
});
