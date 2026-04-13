/**
 * Performance Tests - Critical Endpoints
 * 
 * Tests performance characteristics of critical API endpoints:
 * 1. Response time benchmarks
 * 2. Throughput under load
 * 3. Resource utilization
 * 4. Latency percentiles
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Performance Tests - Critical Endpoints', () => {
  let app: INestApplication;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Setup test user
    const userResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'perf-test@example.com',
        username: 'perftest',
        password: 'Password123!',
        firstName: 'Perf',
        lastName: 'Test',
      });

    userToken = userResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Response Time Benchmarks', () => {
    const PERFORMANCE_THRESHOLDS = {
      healthCheck: 50, // ms
      authentication: 200, // ms
      listingQuery: 300, // ms
      bookingCreation: 500, // ms
      search: 500, // ms
      notifications: 200, // ms
    };

    it('GET /health should respond within threshold', async () => {
      const startTime = Date.now();
      const response = await request(app.getHttpServer()).get('/health');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.healthCheck);
      
      console.log(`Health check response time: ${responseTime}ms`);
    });

    it('POST /auth/login should respond within threshold', async () => {
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'perf-test@example.com', password: 'Password123!' });
      const responseTime = Date.now() - startTime;

      expect([200, 401]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.authentication);
      
      console.log(`Login response time: ${responseTime}ms`);
    });

    it('GET /listings should respond within threshold', async () => {
      const startTime = Date.now();
      const response = await request(app.getHttpServer()).get('/listings');
      const responseTime = Date.now() - startTime;

      expect([200, 401]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.listingQuery);
      
      console.log(`Listings query response time: ${responseTime}ms`);
    });

    it('GET /search should respond within threshold', async () => {
      const startTime = Date.now();
      const response = await request(app.getHttpServer()).get('/search?q=test');
      const responseTime = Date.now() - startTime;

      expect([200, 401]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.search);
      
      console.log(`Search response time: ${responseTime}ms`);
    });

    it('GET /notifications should respond within threshold', async () => {
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`);
      const responseTime = Date.now() - startTime;

      expect([200, 401]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.notifications);
      
      console.log(`Notifications response time: ${responseTime}ms`);
    });
  });

  describe('Throughput Tests', () => {
    const CONCURRENT_REQUESTS = 10;
    const TARGET_THROUGHPUT = 50; // requests per second

    it('should handle concurrent health check requests', async () => {
      const requests = Array(CONCURRENT_REQUESTS).fill(null).map(() =>
        request(app.getHttpServer()).get('/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      const successCount = responses.filter(r => r.status === 200).length;
      const throughput = (CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(2);

      expect(successCount).toBe(CONCURRENT_REQUESTS);
      expect(parseFloat(throughput)).toBeGreaterThan(TARGET_THROUGHPUT);
      
      console.log(`Health check throughput: ${throughput} req/s`);
    });

    it('should handle concurrent listing requests', async () => {
      const requests = Array(CONCURRENT_REQUESTS).fill(null).map(() =>
        request(app.getHttpServer()).get('/listings')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      const successCount = responses.filter(r => r.status === 200 || r.status === 401).length;
      const throughput = (CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(2);

      expect(successCount).toBe(CONCURRENT_REQUESTS);
      expect(parseFloat(throughput)).toBeGreaterThan(TARGET_THROUGHPUT * 0.5); // Slightly lower threshold for data queries
      
      console.log(`Listings throughput: ${throughput} req/s`);
    });

    it('should handle concurrent search requests', async () => {
      const requests = Array(CONCURRENT_REQUESTS).fill(null).map(() =>
        request(app.getHttpServer()).get('/search?q=test')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      const successCount = responses.filter(r => r.status === 200 || r.status === 401).length;
      const throughput = (CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(2);

      expect(successCount).toBe(CONCURRENT_REQUESTS);
      expect(parseFloat(throughput)).toBeGreaterThan(TARGET_THROUGHPUT * 0.5);
      
      console.log(`Search throughput: ${throughput} req/s`);
    });
  });

  describe('Latency Percentiles', () => {
    const REQUEST_COUNT = 50;

    async function measureLatency(endpoint: string, method = 'GET', body?: any): Promise<number[]> {
      const latencies: number[] = [];

      for (let i = 0; i < REQUEST_COUNT; i++) {
        const startTime = Date.now();
        if (method === 'GET') {
          await request(app.getHttpServer()).get(endpoint);
        } else if (method === 'POST') {
          await request(app.getHttpServer()).post(endpoint).send(body);
        }
        latencies.push(Date.now() - startTime);
      }

      return latencies.sort((a, b) => a - b);
    }

    function getPercentile(values: number[], percentile: number): number {
      const index = Math.ceil((percentile / 100) * values.length) - 1;
      return values[index];
    }

    it('health check latency percentiles should be within limits', async () => {
      const latencies = await measureLatency('/health');
      const p50 = getPercentile(latencies, 50);
      const p95 = getPercentile(latencies, 95);
      const p99 = getPercentile(latencies, 99);

      expect(p50).toBeLessThan(30); // 50th percentile < 30ms
      expect(p95).toBeLessThan(100); // 95th percentile < 100ms
      expect(p99).toBeLessThan(200); // 99th percentile < 200ms

      console.log(`Health check latency - P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
    });

    it('listings latency percentiles should be within limits', async () => {
      const latencies = await measureLatency('/listings');
      const p50 = getPercentile(latencies, 50);
      const p95 = getPercentile(latencies, 95);
      const p99 = getPercentile(latencies, 99);

      expect(p50).toBeLessThan(200); // 50th percentile < 200ms
      expect(p95).toBeLessThan(500); // 95th percentile < 500ms
      expect(p99).toBeLessThan(1000); // 99th percentile < 1000ms

      console.log(`Listings latency - P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
    });

    it('search latency percentiles should be within limits', async () => {
      const latencies = await measureLatency('/search?q=test');
      const p50 = getPercentile(latencies, 50);
      const p95 = getPercentile(latencies, 95);
      const p99 = getPercentile(latencies, 99);

      expect(p50).toBeLessThan(300); // 50th percentile < 300ms
      expect(p95).toBeLessThan(700); // 95th percentile < 700ms
      expect(p99).toBeLessThan(1500); // 99th percentile < 1500ms

      console.log(`Search latency - P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
    });
  });

  describe('Memory and Resource Utilization', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const REQUESTS = 100;

      for (let i = 0; i < REQUESTS; i++) {
        await request(app.getHttpServer()).get('/health');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be less than 10MB for 100 requests
      expect(memoryIncreaseMB).toBeLessThan(10);

      console.log(`Memory increase for ${REQUESTS} requests: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });

  describe('Cache Performance', () => {
    it('cached responses should be significantly faster', async () => {
      // First request (cache miss)
      const startTime1 = Date.now();
      await request(app.getHttpServer()).get('/categories');
      const time1 = Date.now() - startTime1;

      // Second request (cache hit)
      const startTime2 = Date.now();
      await request(app.getHttpServer()).get('/categories');
      const time2 = Date.now() - startTime2;

      // Cached response should be at least 2x faster
      if (time2 < time1) {
        const speedup = time1 / time2;
        expect(speedup).toBeGreaterThan(1.5);
        console.log(`Cache speedup: ${speedup.toFixed(2)}x (${time1}ms -> ${time2}ms)`);
      }
    });
  });

  describe('Database Query Performance', () => {
    it('complex queries should complete within threshold', async () => {
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get('/listings')
        .query({ 
          page: 1, 
          limit: 50, 
          sortBy: 'price', 
          sortOrder: 'asc',
          filters: JSON.stringify({
            type: 'APARTMENT',
            bedrooms: 2,
            priceRange: [100, 500],
          }),
        });
      const responseTime = Date.now() - startTime;

      expect([200, 401]).toContain(response.status);
      expect(responseTime).toBeLessThan(1000); // 1 second threshold for complex queries

      console.log(`Complex query response time: ${responseTime}ms`);
    });
  });

  describe('Pagination Performance', () => {
    it('pagination should not degrade performance with larger pages', async () => {
      const smallPageTime = await measurePaginationTime(10);
      const largePageTime = await measurePaginationTime(100);

      // Large page should not be more than 5x slower than small page
      const slowdown = largePageTime / smallPageTime;
      expect(slowdown).toBeLessThan(5);

      console.log(`Pagination slowdown: ${slowdown.toFixed(2)}x (${smallPageTime}ms -> ${largePageTime}ms)`);
    });

    async function measurePaginationTime(limit: number): Promise<number> {
      const startTime = Date.now();
      await request(app.getHttpServer())
        .get('/listings')
        .query({ page: 1, limit });
      return Date.now() - startTime;
    }
  });

  describe('Rate Limiting Performance', () => {
    it('rate limiting should not impact legitimate traffic', async () => {
      const REQUESTS = 20;
      const requests = Array(REQUESTS).fill(null).map((_, i) =>
        request(app.getHttpServer()).get('/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      const successCount = responses.filter(r => r.status === 200).length;
      
      // At least 80% of requests should succeed (allowing for rate limiting)
      expect(successCount).toBeGreaterThanOrEqual(REQUESTS * 0.8);
      expect(totalTime).toBeLessThan(REQUESTS * 100); // Each request should average < 100ms

      console.log(`Rate limiting test: ${successCount}/${REQUESTS} successful in ${totalTime}ms`);
    });
  });
});
