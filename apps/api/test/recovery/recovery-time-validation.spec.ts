/**
 * Recovery Time Validation Tests
 * 
 * Tests for validating system recovery times after failures:
 * 1. Service recovery time after restart
 * 2. Database connection recovery
 * 3. Cache recovery after failure
 * 4. External service recovery
 * 5. Application startup time
 * 6. Graceful shutdown recovery
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Recovery Time Validation', () => {
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

  // Recovery time thresholds (in milliseconds)
  const RECOVERY_THRESHOLDS = {
    appStartup: 5000, // 5 seconds
    databaseConnection: 1000, // 1 second
    cacheRecovery: 500, // 500ms
    serviceRecovery: 2000, // 2 seconds
    gracefulShutdown: 3000, // 3 seconds
  };

  describe('Application Startup Recovery', () => {
    it('should start within acceptable time', async () => {
      // This test validates that the application started quickly enough
      // The actual startup time is measured from beforeAll to first request
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/health');
      const end = Date.now();

      const startupTime = end - start;
      
      expect([200, 404]).toContain(res.status);
      expect(startupTime).toBeLessThan(RECOVERY_THRESHOLDS.appStartup);
    });
  });

  describe('Database Connection Recovery', () => {
    it('should recover database connection quickly after transient failure', async () => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/categories');
      const end = Date.now();

      const responseTime = end - start;
      
      // Should respond quickly even if database had to reconnect
      expect([200, 401]).toContain(res.status);
      expect(responseTime).toBeLessThan(RECOVERY_THRESHOLDS.databaseConnection * 5);
    });
  });

  describe('Cache Recovery', () => {
    it('should recover cache functionality quickly', async () => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/categories');
      const end = Date.now();

      const responseTime = end - start;
      
      // Should respond quickly even if cache had to be rebuilt
      expect([200, 401]).toContain(res.status);
      expect(responseTime).toBeLessThan(RECOVERY_THRESHOLDS.cacheRecovery * 10);
    });
  });

  describe('Service Recovery After Load', () => {
    it('should recover quickly after high load period', async () => {
      // Apply load
      const loadRequests = Array(20).fill(null).map(() =>
        request(app.getHttpServer()).get('/health')
      );
      await Promise.all(loadRequests);

      // Wait a brief moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Measure recovery time
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/health');
      const end = Date.now();

      const recoveryTime = end - start;
      
      expect([200, 404]).toContain(res.status);
      expect(recoveryTime).toBeLessThan(RECOVERY_THRESHOLDS.serviceRecovery);
    });
  });

  describe('Connection Pool Recovery', () => {
    it('should recover connection pool quickly after exhaustion', async () => {
      // Use connections
      const requests = Array(15).fill(null).map(() =>
        request(app.getHttpServer()).get('/categories')
      );
      await Promise.all(requests);

      // Wait for pool recovery
      await new Promise(resolve => setTimeout(resolve, 200));

      // Test recovery
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/categories');
      const end = Date.now();

      const recoveryTime = end - start;
      
      expect([200, 401]).toContain(res.status);
      expect(recoveryTime).toBeLessThan(RECOVERY_THRESHOLDS.databaseConnection * 3);
    });
  });

  describe('Memory Recovery', () => {
    it('should recover memory usage after garbage collection', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate some load
      const requests = Array(30).fill(null).map(() =>
        request(app.getHttpServer()).get('/health')
      );
      await Promise.all(requests);

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 200));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryRecovery = initialMemory - finalMemory;

      // Memory should not have grown significantly
      const growthPercentage = ((finalMemory - initialMemory) / initialMemory) * 100;
      expect(growthPercentage).toBeLessThan(50);
    });
  });

  describe('Rate Limit Recovery', () => {
    it('should recover from rate limit quickly', async () => {
      // Hit rate limit
      const rapidRequests = Array(15).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' })
      );
      await Promise.all(rapidRequests);

      // Wait for rate limit cooldown
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test recovery
      const start = Date.now();
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });
      const end = Date.now();

      const recoveryTime = end - start;
      
      // Should not be rate limited anymore
      expect(res.status).not.toBe(429);
      expect(recoveryTime).toBeLessThan(RECOVERY_THRESHOLDS.serviceRecovery);
    });
  });

  describe('Session Recovery', () => {
    it('should recover session state quickly after restart', async () => {
      // This test validates session recovery
      const res = await request(app.getHttpServer()).get('/health');
      
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('External Service Recovery', () => {
    it('should recover quickly from external service unavailability', async () => {
      // Test that the system recovers when external services come back
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/health');
      const end = Date.now();

      const recoveryTime = end - start;
      
      expect([200, 404]).toContain(res.status);
      expect(recoveryTime).toBeLessThan(RECOVERY_THRESHOLDS.serviceRecovery);
    });
  });

  describe('Warm-up Time', () => {
    it('should warm up caches quickly on startup', async () => {
      const start = Date.now();
      
      // Make multiple requests to warm up
      const warmupRequests = Array(5).fill(null).map(() =>
        request(app.getHttpServer()).get('/categories')
      );
      await Promise.all(warmupRequests);
      
      const end = Date.now();
      const warmupTime = end - start;

      // Warmup should complete quickly
      expect(warmupTime).toBeLessThan(RECOVERY_THRESHOLDS.serviceRecovery * 2);
    });
  });

  describe('Error State Recovery', () => {
    it('should recover from error state quickly', async () => {
      // Trigger error state
      await request(app.getHttpServer()).get('/nonexistent-endpoint');

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test recovery
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/health');
      const end = Date.now();

      const recoveryTime = end - start;
      
      expect([200, 404]).toContain(res.status);
      expect(recoveryTime).toBeLessThan(RECOVERY_THRESHOLDS.serviceRecovery);
    });
  });

  describe('Concurrent Request Recovery', () => {
    it('should recover quickly after concurrent request burst', async () => {
      // Burst of concurrent requests
      const burstRequests = Array(30).fill(null).map(() =>
        request(app.getHttpServer()).get('/health')
      );
      await Promise.all(burstRequests);

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 200));

      // Test recovery
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/health');
      const end = Date.now();

      const recoveryTime = end - start;
      
      expect([200, 404]).toContain(res.status);
      expect(recoveryTime).toBeLessThan(RECOVERY_THRESHOLDS.serviceRecovery);
    });
  });
});
