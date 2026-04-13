/**
 * Performance Regression Detection Tests
 * 
 * Tests for detecting performance regressions by comparing current performance
 * against established baselines:
 * 1. Response time regression
 * 2. Throughput regression
 * 3. Memory usage regression
 * 4. Database query regression
 * 5. API latency regression
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Performance Regression Detection', () => {
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

  // Performance baselines (in milliseconds)
  const BASELINES = {
    healthCheck: 100,
    categories: 200,
    listings: 300,
    bookings: 400,
    authLogin: 500,
  };

  // Threshold for regression detection (percentage)
  const REGRESSION_THRESHOLD = 0.5; // 50% slower than baseline

  describe('Response Time Regression', () => {
    it('should not regress health check response time', async () => {
      const samples = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/health');
        const end = Date.now();
        responseTimes.push(end - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxAllowedTime = BASELINES.healthCheck * (1 + REGRESSION_THRESHOLD);

      expect(avgResponseTime).toBeLessThan(maxAllowedTime);
    });

    it('should not regress categories endpoint response time', async () => {
      const samples = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/categories');
        const end = Date.now();
        responseTimes.push(end - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxAllowedTime = BASELINES.categories * (1 + REGRESSION_THRESHOLD);

      expect(avgResponseTime).toBeLessThan(maxAllowedTime);
    });

    it('should not regress listings endpoint response time', async () => {
      const samples = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/listings');
        const end = Date.now();
        responseTimes.push(end - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxAllowedTime = BASELINES.listings * (1 + REGRESSION_THRESHOLD);

      expect(avgResponseTime).toBeLessThan(maxAllowedTime);
    });
  });

  describe('Memory Usage Regression', () => {
    it('should not leak memory over repeated requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await request(app.getHttpServer()).get('/health');
        await request(app.getHttpServer()).get('/categories');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercentage = (memoryGrowth / initialMemory) * 100;

      // Memory growth should be less than 30%
      expect(growthPercentage).toBeLessThan(30);
    });
  });

  describe('Throughput Regression', () => {
    it('should maintain requests per second throughput', async () => {
      const duration = 5000; // 5 seconds
      const targetRPS = 10; // Target 10 requests per second
      const startTime = Date.now();
      let requestCount = 0;
      let successCount = 0;

      while (Date.now() - startTime < duration) {
        try {
          const res = await request(app.getHttpServer()).get('/health');
          requestCount++;
          if ([200, 404].includes(res.status)) {
            successCount++;
          }
        } catch (error) {
          requestCount++;
        }
      }

      const actualRPS = requestCount / (duration / 1000);
      const successRate = successCount / requestCount;

      // Should achieve at least 80% of target RPS
      expect(actualRPS).toBeGreaterThan(targetRPS * 0.8);
      
      // Success rate should be above 95%
      expect(successRate).toBeGreaterThan(0.95);
    });
  });

  describe('API Latency Regression', () => {
    it('should not have increasing latency percentiles', async () => {
      const samples = 20;
      const latencies: number[] = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/health');
        const end = Date.now();
        latencies.push(end - start);
      }

      // Calculate percentiles
      const sorted = latencies.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      // P95 should not be more than 3x P50
      expect(p95 / p50).toBeLessThan(3);
      
      // P99 should not be more than 5x P50
      expect(p99 / p50).toBeLessThan(5);
    });
  });

  describe('Database Query Performance Regression', () => {
    it('should not regress database query performance', async () => {
      const samples = 15;
      const responseTimes: number[] = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/categories');
        const end = Date.now();
        responseTimes.push(end - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const baseline = BASELINES.categories;
      const maxAllowedTime = baseline * (1 + REGRESSION_THRESHOLD);

      expect(avgResponseTime).toBeLessThan(maxAllowedTime);
    });
  });

  describe('Concurrent Request Performance Regression', () => {
    it('should not regress under concurrent load', async () => {
      const concurrency = 20;
      const requests = Array(concurrency).fill(null).map(() =>
        request(app.getHttpServer()).get('/health')
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const end = Date.now();
      const totalTime = end - start;

      const successCount = responses.filter(r => [200, 404].includes(r.status)).length;
      const avgLatency = totalTime / concurrency;

      // Average latency should be reasonable
      expect(avgLatency).toBeLessThan(BASELINES.healthCheck * 2);
      
      // Success rate should be high
      expect(successCount / concurrency).toBeGreaterThan(0.9);
    });
  });

  describe('Cold Start Performance Regression', () => {
    it('should not regress on first request after inactivity', async () => {
      // Simulate cold start by waiting
      await new Promise(resolve => setTimeout(resolve, 2000));

      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/health');
      const end = Date.now();

      const responseTime = end - start;
      const maxAllowedTime = BASELINES.healthCheck * 3; // Allow 3x for cold start

      expect([200, 404]).toContain(res.status);
      expect(responseTime).toBeLessThan(maxAllowedTime);
    });
  });

  describe('Performance Baseline Validation', () => {
    it('should establish performance baselines for critical endpoints', async () => {
      const endpoints = [
        { path: '/health', baseline: BASELINES.healthCheck },
        { path: '/categories', baseline: BASELINES.categories },
      ];

      for (const endpoint of endpoints) {
        const samples = 5;
        const responseTimes: number[] = [];

        for (let i = 0; i < samples; i++) {
          const start = Date.now();
          await request(app.getHttpServer()).get(endpoint.path);
          const end = Date.now();
          responseTimes.push(end - start);
        }

        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        
        // Response time should be reasonable (within 10x baseline for initial baseline establishment)
        expect(avgResponseTime).toBeLessThan(endpoint.baseline * 10);
      }
    });
  });
});
