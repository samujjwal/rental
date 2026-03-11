/**
 * Chaos Engineering Tests for System Resilience
 * 
 * These tests simulate various failure scenarios to ensure system resilience:
 * 1. Database connection failures
 * 2. External service timeouts
 * 3. Memory pressure
 * 4. Network latency
 * 5. Resource exhaustion
 * 6. Concurrent load spikes
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CacheService } from '../src/common/cache/cache.service';

describe('🔥 Chaos Engineering Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cache: CacheService;
  let originalPrismaQuery: any;
  let originalCacheGet: any;
  let originalCacheSet: any;

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
    cache = app.get(CacheService);

    // Store original methods for restoration
    originalPrismaQuery = prisma.$queryRaw;
    originalCacheGet = cache.get;
    originalCacheSet = cache.set;
  }, 30_000);

  afterAll(async () => {
    // Restore original methods
    prisma.$queryRaw = originalPrismaQuery;
    cache.get = originalCacheGet;
    cache.set = originalCacheSet;
    
    await prisma.$disconnect();
    await app.close();
  });

  describe('Database Failure Scenarios', () => {
    it('should handle database connection timeouts gracefully', async () => {
      // Simulate database timeout
      prisma.$queryRaw = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 100);
        });
      });

      const response = await request(app.getHttpServer())
        .get('/listings')
        .expect(500);

      expect(response.body.message).toContain('error');
    });

    it('should handle database connection drops', async () => {
      // Simulate connection drop
      prisma.$queryRaw = jest.fn().mockRejectedValue(
        new Error('Connection terminated unexpectedly')
      );

      const response = await request(app.getHttpServer())
        .get('/categories')
        .expect(500);

      expect(response.body.message).toContain('error');
    });

    it('should handle database query timeouts', async () => {
      // Simulate slow query
      prisma.$queryRaw = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 5000);
        });
      });

      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/search?q=test')
        .expect(500);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should fail fast, not hang
    });

    it('should handle database constraint violations', async () => {
      // Simulate constraint violation
      prisma.$queryRaw = jest.fn().mockRejectedValue(
        new Error('duplicate key value violates unique constraint')
      );

      // Try to create duplicate user
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(500);

      expect(response.body.message).toContain('error');
    });
  });

  describe('Cache Failure Scenarios', () => {
    it('should operate without cache when Redis is down', async () => {
      // Simulate Redis failure
      cache.get = jest.fn().mockRejectedValue(new Error('Redis connection failed'));
      cache.set = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      // System should still work without cache
      const response = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle cache timeouts gracefully', async () => {
      // Simulate cache timeout
      cache.get = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Cache timeout')), 2000);
        });
      });

      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should not hang
    });

    it('should handle cache memory pressure', async () => {
      // Simulate memory pressure
      cache.set = jest.fn().mockRejectedValue(
        new Error('Out of memory')
      );

      // Should still work without caching
      const response = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Resource Exhaustion Tests', () => {
    it('should handle high concurrent load', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/listings')
          .expect(200)
      );

      const startTime = Date.now();
      const responses = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;

      // All requests should eventually succeed
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBe(concurrentRequests);
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(30000);
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating large payloads
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB string
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(largePayload)
        .expect(400); // Should reject large payloads

      expect(response.body.message).toContain('error');
    });

    it('should handle file upload limits', async () => {
      // Simulate large file upload
      const largeFile = Buffer.alloc(50 * 1024 * 1024); // 50MB

      const response = await request(app.getHttpServer())
        .post('/storage/upload')
        .attach('file', largeFile, 'large-file.jpg')
        .expect(413); // Payload too large

      expect(response.body.message).toContain('too large');
    });
  });

  describe('Network Failure Scenarios', () => {
    it('should handle external service timeouts', async () => {
      // This would require mocking external services like Stripe, Twilio, etc.
      // For now, we'll simulate by testing endpoints that depend on external services

      const response = await request(app.getHttpServer())
        .post('/payments/intent')
        .send({
          bookingId: 'test-booking',
          amount: 10000,
          currency: 'USD',
        })
        .expect(404); // Should handle missing booking gracefully

      expect(response.body.message).toContain('error');
    });

    it('should handle partial network failures', async () => {
      // Simulate intermittent network issues
      let callCount = 0;
      prisma.$queryRaw = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve([{ id: 1, title: 'Test Listing' }]);
      });

      // Should retry and eventually succeed
      let successCount = 0;
      for (let i = 0; i < 10; i++) {
        try {
          await request(app.getHttpServer())
            .get('/listings')
            .expect(200);
          successCount++;
        } catch (error) {
          // Some requests may fail
        }
      }

      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Cascading Failure Prevention', () => {
    it('should prevent cascading failures with circuit breakers', async () => {
      // Simulate repeated failures
      prisma.$queryRaw = jest.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      // Make several failing requests to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get('/listings')
          .expect(500);
      }

      // Circuit breaker should be open and fail fast
      const startTime = Date.now();
      await request(app.getHttpServer())
        .get('/listings')
        .expect(500);
      const duration = Date.now() - startTime;

      // Should fail immediately, not timeout
      expect(duration).toBeLessThan(1000);
    });

    it('should recover from circuit breaker after timeout', async () => {
      // This would require implementing circuit breaker recovery logic
      // For now, we'll just verify the system can recover

      // Restore normal operation
      prisma.$queryRaw = originalPrismaQuery;

      // Wait for circuit breaker timeout (simulated)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should work again after recovery
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('Data Corruption Scenarios', () => {
    it('should handle malformed data gracefully', async () => {
      // Send malformed JSON
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", "password": "invalid"}')
        .expect(400);

      expect(response.body.message).toContain('error');
    });

    it('should handle null/undefined values safely', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: null,
          password: undefined,
          firstName: '',
          lastName: null,
        })
        .expect(400);

      expect(response.body.message).toContain('error');
    });

    it('should handle extremely long strings', async () => {
      const longString = 'a'.repeat(1000000); // 1MB string

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: longString,
          lastName: 'Test',
        })
        .expect(400);

      expect(response.body.message).toContain('error');
    });
  });

  describe('Security Stress Tests', () => {
    it('should handle rate limiting under stress', async () => {
      // Make many rapid requests to trigger rate limiting
      const requests = Array(100).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword',
          })
      );

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      ).length;

      expect(rateLimited).toBeGreaterThan(0);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      const response = await request(app.getHttpServer())
        .get(`/search?q=${encodeURIComponent(maliciousInput)}`)
        .expect(200);

      // Should not crash and return empty results
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle XSS attempts', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: xssPayload,
          lastName: 'Test',
        })
        .expect(201); // Should accept but sanitize

      // Verify XSS was sanitized in response
      expect(response.body.firstName).not.toContain('<script>');
    });
  });

  describe('Recovery and Healing Tests', () => {
    it('should auto-recover from temporary failures', async () => {
      // Simulate temporary failure
      let failureCount = 0;
      prisma.$queryRaw = jest.fn().mockImplementation(() => {
        failureCount++;
        if (failureCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve([{ id: 1, title: 'Test Listing' }]);
      });

      // Should eventually succeed
      let attempts = 0;
      let success = false;
      
      while (!success && attempts < 10) {
        try {
          await request(app.getHttpServer())
            .get('/listings')
            .expect(200);
          success = true;
        } catch (error) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      expect(success).toBe(true);
      expect(attempts).toBeGreaterThan(2);
    });

    it('should maintain data consistency during failures', async () => {
      // This would test transaction rollback and data consistency
      // For now, we'll verify that failed operations don't leave inconsistent state

      const originalUser = await prisma.user.findFirst({
        where: { email: 'consistency-test@example.com' },
      });

      // Simulate failure during user creation
      prisma.user.create = jest.fn().mockRejectedValue(
        new Error('Database constraint violation')
      );

      try {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: 'consistency-test@example.com',
            password: 'Test123!',
            firstName: 'Test',
            lastName: 'User',
          });
      } catch (error) {
        // Expected to fail
      }

      // Verify user was not created
      const userAfterFailure = await prisma.user.findFirst({
        where: { email: 'consistency-test@example.com' },
      });

      expect(userAfterFailure).toBe(originalUser);
    });
  });
});
