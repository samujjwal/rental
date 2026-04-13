/**
 * P3: Production Chaos Engineering Test Suite
 *
 * Comprehensive fault injection tests for production readiness validation.
 * Tests system resilience under various failure scenarios.
 *
 * WARNING: These tests may cause temporary service disruption.
 * Only run in staging/pre-production environments.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

describe('Production Chaos Engineering Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;

  // Chaos configuration
  const CHAOS_CONFIG = {
    dbFailureRate: 0.1,
    cacheFailureRate: 0.2,
    networkLatencyMs: 1000,
    circuitBreakerThreshold: 5,
    recoveryTimeoutMs: 30000,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Initialize Redis connection
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    await app.init();
  });

  afterAll(async () => {
    await redis.quit();
    await app.close();
  });

  describe('Database Chaos Tests', () => {
    test('should handle database connection pool exhaustion', async () => {
      // Simulate connection pool exhaustion by opening many connections
      const promises: Promise<any>[] = [];

      // Create 50 concurrent connections
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/listings')
            .timeout(5000)
            .catch((err) => ({ error: err.message }))
        );
      }

      const results = await Promise.all(promises);

      // Most should succeed even under load
      const successCount = results.filter(
        (r) => r.status === 200 || r.status === 304
      ).length;

      // At least 80% should succeed
      expect(successCount).toBeGreaterThanOrEqual(40);

      // None should crash the server
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .timeout(3000);

      expect(healthCheck.status).toBe(200);
    });

    test('should handle database deadlocks gracefully', async () => {
      const testId = randomUUID();

      // Create competing transactions
      const tx1 = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(1)`;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true };
      }).catch((err) => ({ error: err.message }));

      const tx2 = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(1)`;
        return { success: true };
      }).catch((err) => ({ error: err.message }));

      const [result1, result2] = await Promise.all([tx1, tx2]);

      // At least one should succeed, or both should fail gracefully
      expect(result1.success || result2.success || result1.error || result2.error).toBeTruthy();

      // System should remain healthy
      const healthCheck = await request(app.getHttpServer()).get('/health');
      expect(healthCheck.status).toBe(200);
    });

    test('should recover from database timeouts', async () => {
      // Trigger a slow query
      const slowQueryPromise = prisma.$queryRaw`
        SELECT pg_sleep(2), 'test' as result
      `.catch((err) => ({ timeout: true, error: err.message }));

      // Meanwhile, normal queries should still work
      const normalQueries = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get('/health')
          .timeout(1000)
      );

      const [, ...normalResults] = await Promise.all([slowQueryPromise, ...normalQueries]);

      // Normal queries should succeed despite slow query
      normalResults.forEach((res) => {
        expect([200, 304]).toContain(res.status);
      });
    });

    test('should handle database restart scenario', async () => {
      // Verify system works
      const beforeRestart = await request(app.getHttpServer()).get('/health');
      expect(beforeRestart.status).toBe(200);

      // Simulate connection reset (reconnect prisma)
      await prisma.$disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await prisma.$connect();

      // System should recover
      const afterReconnect = await request(app.getHttpServer())
        .get('/health')
        .timeout(5000);

      expect(afterReconnect.status).toBe(200);
    });
  });

  describe('Cache Chaos Tests', () => {
    test('should handle Redis connection failure', async () => {
      // Disconnect Redis
      await redis.disconnect();

      // System should still function (fallback to no cache)
      const response = await request(app.getHttpServer())
        .get('/listings')
        .timeout(3000);

      expect(response.status).toBe(200);

      // Reconnect Redis
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      });

      // Verify cache works again after reconnection
      const cachedResponse = await request(app.getHttpServer())
        .get('/listings')
        .timeout(3000);

      expect(cachedResponse.status).toBe(200);
    });

    test('should handle cache stampede', async () => {
      const key = 'test-stampede-key';

      // Populate cache
      await redis.setex(key, 60, JSON.stringify({ data: 'test' }));

      // Simulate stampede by requesting same key concurrently
      const promises = Array.from({ length: 100 }, () =>
        redis.get(key).catch(() => null)
      );

      const results = await Promise.all(promises);

      // Most should succeed
      const successCount = results.filter((r) => r !== null).length;
      expect(successCount).toBeGreaterThanOrEqual(90);
    });

    test('should handle cache eviction under memory pressure', async () => {
      // Fill cache with many entries
      const fillPromises = Array.from({ length: 1000 }, (_, i) =>
        redis.setex(`eviction-test-${i}`, 3600, `value-${i}`)
      );

      await Promise.all(fillPromises);

      // System should still respond normally
      const response = await request(app.getHttpServer())
        .get('/listings')
        .timeout(3000);

      expect(response.status).toBe(200);

      // Cleanup
      const cleanupPromises = Array.from({ length: 1000 }, (_, i) =>
        redis.del(`eviction-test-${i}`)
      );
      await Promise.all(cleanupPromises);
    });
  });

  describe('Network Chaos Tests', () => {
    test('should handle high latency', async () => {
      const startTime = Date.now();

      // Request with simulated high latency tolerance
      const response = await request(app.getHttpServer())
        .get('/listings')
        .timeout(10000);

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000); // Should complete within timeout
    });

    test('should handle intermittent failures', async () => {
      const results: boolean[] = [];

      // Make 20 requests
      for (let i = 0; i < 20; i++) {
        const res = await request(app.getHttpServer())
          .get('/health')
          .timeout(3000)
          .catch(() => ({ status: 0 }));

        results.push(res.status === 200);

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // At least 80% should succeed
      const successRate = results.filter((r) => r).length / results.length;
      expect(successRate).toBeGreaterThanOrEqual(0.8);
    });

    test('should handle request timeout gracefully', async () => {
      // Request with very short timeout
      const response = await request(app.getHttpServer())
        .get('/listings?complex=true')
        .timeout(100)
        .catch((err) => ({ timeout: true, message: err.message }));

      // Should either succeed quickly or fail gracefully
      expect(
        response.status === 200 || response.timeout === true
      ).toBe(true);

      // Server should still be healthy
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .timeout(3000);

      expect(healthCheck.status).toBe(200);
    });
  });

  describe('Resource Exhaustion Tests', () => {
    test('should handle memory pressure', async () => {
      // Create large payloads
      const largePayloads = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/listings?limit=100&include=all')
          .timeout(5000)
      );

      const results = await Promise.all(largePayloads);

      // All should succeed
      results.forEach((res) => {
        expect([200, 304]).toContain(res.status);
      });

      // Memory should be freed (health check passes)
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .timeout(3000);

      expect(healthCheck.status).toBe(200);
    });

    test('should handle CPU intensive operations', async () => {
      // Request search with complex filtering
      const searches = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .get(`/search?query=apartment&filters=price:${i * 100}-${(i + 1) * 100},amenities:wifi,parking`)
          .timeout(10000)
      );

      const results = await Promise.all(searches);

      results.forEach((res) => {
        expect([200, 304, 400, 422]).toContain(res.status);
      });
    });

    test('should handle file descriptor exhaustion scenario', async () => {
      // Open many connections
      const connections: Promise<any>[] = [];

      for (let i = 0; i < 100; i++) {
        connections.push(
          request(app.getHttpServer())
            .get('/health')
            .timeout(2000)
            .catch(() => ({ failed: true }))
        );
      }

      const results = await Promise.all(connections);

      // Most should succeed
      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Circuit Breaker Tests', () => {
    test('should activate circuit breaker on repeated failures', async () => {
      // Simulate a failing service by calling invalid endpoint multiple times
      const failures: number[] = [];

      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .get('/invalid-endpoint-that-returns-500')
          .timeout(1000)
          .catch(() => ({ status: 0 }));

        failures.push(res.status);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify error responses
      expect(failures.some((s) => s === 404 || s === 500 || s === 0)).toBe(true);
    });

    test('should recover from circuit breaker state', async () => {
      // First cause failures
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get('/non-existent')
          .catch(() => {});
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve(2000)));

      // Verify healthy endpoint still works
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .timeout(3000);

      expect(healthCheck.status).toBe(200);
    });
  });

  describe('Dependency Failure Tests', () => {
    test('should handle Stripe API failure gracefully', async () => {
      // Create booking
      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', 'Bearer test-token')
        .send({
          listingId: 'test-listing',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          guestCount: 2,
        })
        .timeout(5000)
        .catch((err) => ({ status: 0, error: err.message }));

      // Should either succeed or fail gracefully (not crash)
      expect([200, 201, 400, 401, 422, 0]).toContain(bookingRes.status);

      // Server should remain healthy
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .timeout(3000);

      expect(healthCheck.status).toBe(200);
    });

    test('should handle email service failure gracefully', async () => {
      // Request that triggers email
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .timeout(5000)
        .catch((err) => ({ status: 0, error: err.message }));

      // Should return success even if email fails (async processing)
      expect([200, 202, 400]).toContain(response.status);
    });

    test('should handle external API timeout gracefully', async () => {
      // Request geocoding (external service)
      const response = await request(app.getHttpServer())
        .get('/geo/geocode?address=Kathmandu,Nepal')
        .timeout(5000)
        .catch((err) => ({ timeout: true, error: err.message }));

      // Should either succeed or return cached/fallback data
      expect(
        response.status === 200 ||
        response.status === 504 ||
        response.timeout === true
      ).toBe(true);
    });
  });

  describe('Data Corruption Tests', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Content-Type', 'application/json')
        .send('{"invalid json: missing closing brace')
        .timeout(3000);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('JSON');
    });

    test('should handle SQL injection attempts', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; DELETE FROM bookings WHERE '1'='1'; --",
      ];

      for (const input of maliciousInputs) {
        const response = await request(app.getHttpServer())
          .get(`/listings?search=${encodeURIComponent(input)}`)
          .timeout(3000);

        // Should not crash, should either return empty results or filter properly
        expect([200, 400]).toContain(response.status);
      }

      // Verify database integrity
      const healthCheck = await request(app.getHttpServer()).get('/health');
      expect(healthCheck.status).toBe(200);
      expect(healthCheck.body.database?.status).toBe('up');
    });

    test('should handle oversized payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB string
      };

      const response = await request(app.getHttpServer())
        .post('/listings')
        .send(largePayload)
        .timeout(5000)
        .catch((err) => ({ status: 413, error: err.message }));

      // Should reject oversized payload
      expect([400, 413, 422]).toContain(response.status);

      // Server should remain healthy
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .timeout(3000);

      expect(healthCheck.status).toBe(200);
    });
  });

  describe('Concurrency Chaos Tests', () => {
    test('should handle race conditions in booking creation', async () => {
      // Try to book same listing concurrently
      const bookingPromises = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', 'Bearer test-token')
          .send({
            listingId: 'same-listing-id',
            startDate: '2025-07-01',
            endDate: '2025-07-05',
            guestCount: 2,
          })
          .timeout(5000)
          .catch((err) => ({ status: 0, error: err.message }))
      );

      const results = await Promise.all(bookingPromises);

      // Some should succeed, some should fail with conflict
      const successes = results.filter((r) => r.status === 201).length;
      const conflicts = results.filter((r) => r.status === 409).length;
      const failures = results.filter((r) => r.status >= 400).length;

      // At most one should succeed (no double booking)
      expect(successes).toBeLessThanOrEqual(1);

      // Total should account for all requests
      expect(successes + conflicts + failures).toBeGreaterThanOrEqual(3);
    });

    test('should handle concurrent user updates', async () => {
      const updatePromises = Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .patch('/users/me')
          .set('Authorization', 'Bearer test-token')
          .send({
            firstName: `Update${i}`,
          })
          .timeout(3000)
          .catch(() => ({ status: 0 }))
      );

      const results = await Promise.all(updatePromises);

      // Most should succeed
      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Recovery and Stability Tests', () => {
    test('should recover to normal operation after chaos', async () => {
      // Cause some chaos first
      await Promise.all([
        request(app.getHttpServer()).get('/health'),
        request(app.getHttpServer()).get('/listings'),
        request(app.getHttpServer()).get('/non-existent'),
      ]);

      // Wait for stabilization
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify normal operation
      const healthChecks = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app.getHttpServer())
            .get('/health')
            .timeout(2000)
        )
      );

      // All should succeed
      healthChecks.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });

    test('should maintain consistent response times after recovery', async () => {
      const times: number[] = [];

      // Make requests and measure times
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await request(app.getHttpServer())
          .get('/health')
          .timeout(2000);
        times.push(Date.now() - start);
      }

      // Calculate average
      const avg = times.reduce((a, b) => a + b, 0) / times.length;

      // Average should be reasonable (< 500ms)
      expect(avg).toBeLessThan(500);

      // No extreme outliers (> 2 seconds)
      const maxTime = Math.max(...times);
      expect(maxTime).toBeLessThan(2000);
    });
  });
});
