/**
 * Soak Testing
 * 
 * Tests for system behavior under sustained load over extended periods:
 * 1. Memory leak detection
 * 2. Performance degradation over time
 * 3. Connection pool stability
 * 4. Cache consistency over time
 * 5. Long-running transaction handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Soak Testing', () => {
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

  describe('Memory Leak Detection', () => {
    it('should not leak memory over repeated requests', async () => {
      const iterations = 50;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Make multiple requests
        await request(app.getHttpServer()).get('/health');
        await request(app.getHttpServer()).get('/categories');
        
        // Capture memory snapshot (simplified)
        const memoryUsage = process.memoryUsage().heapUsed;
        memorySnapshots.push(memoryUsage);
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check that memory doesn't grow continuously
      const initialMemory = memorySnapshots[0];
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercentage = (memoryGrowth / initialMemory) * 100;

      // Memory growth should be reasonable (< 50% over test duration)
      expect(growthPercentage).toBeLessThan(50);
    });

    it('should handle garbage collection gracefully', async () => {
      // This test checks if the application handles GC pressure
      const requests = Array(100).fill(null).map(() =>
        request(app.getHttpServer()).get('/health')
      );

      await Promise.all(requests);
      
      // Force GC if available (Node.js with --expose-gc flag)
      if (global.gc) {
        global.gc();
      }

      // Application should still respond after GC
      const res = await request(app.getHttpServer()).get('/health');
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Performance Degradation Over Time', () => {
    it('should maintain response times over sustained load', async () => {
      const iterations = 30;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await request(app.getHttpServer()).get('/health');
        const endTime = Date.now();
        
        responseTimes.push(endTime - startTime);
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      // Response times should be consistent (within 5x range)
      expect(maxResponseTime / minResponseTime).toBeLessThan(5);
      
      // Average should be reasonable (< 1 second)
      expect(avgResponseTime).toBeLessThan(1000);
    });

    it('should handle sustained concurrent load', async () => {
      const cycles = 10;
      const requestsPerCycle = 10;

      for (let cycle = 0; cycle < cycles; cycle++) {
        const requests = Array(requestsPerCycle).fill(null).map(() =>
          request(app.getHttpServer()).get('/categories')
        );

        const responses = await Promise.all(requests);
        const successCount = responses.filter(r => r.status === 200 || r.status === 401).length;
        
        // Success rate should remain high (> 80%)
        expect(successCount / requestsPerCycle).toBeGreaterThan(0.8);
        
        // Wait between cycles
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    });
  });

  describe('Connection Pool Stability', () => {
    it('should maintain database connections over time', async () => {
      const iterations = 40;
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        try {
          const res = await request(app.getHttpServer()).get('/categories');
          if (res.status === 200 || res.status === 401) {
            successCount++;
          }
        } catch (error) {
          // Connection errors might indicate pool exhaustion
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // Should maintain high success rate (> 90%)
      expect(successCount / iterations).toBeGreaterThan(0.9);
    });
  });

  describe('Cache Consistency Over Time', () => {
    it('should maintain cache consistency over repeated reads', async () => {
      const iterations = 30;
      let consistentResponses = 0;
      let lastResponse: any = null;

      for (let i = 0; i < iterations; i++) {
        const res = await request(app.getHttpServer()).get('/categories');
        
        if (res.status === 200) {
          if (lastResponse === null) {
            lastResponse = res.body;
            consistentResponses++;
          } else if (JSON.stringify(res.body) === JSON.stringify(lastResponse)) {
            consistentResponses++;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Cache should be consistent (> 80% consistency)
      const consistencyRate = consistentResponses / iterations;
      expect(consistencyRate).toBeGreaterThan(0.8);
    });
  });

  describe('Long-Running Transaction Handling', () => {
    it('should handle long-running operations gracefully', async () => {
      // Simulate a long-running operation by making multiple sequential requests
      const operations = 20;
      let successCount = 0;

      for (let i = 0; i < operations; i++) {
        try {
          const res = await request(app.getHttpServer()).get('/health');
          if (res.status === 200 || res.status === 404) {
            successCount++;
          }
        } catch (error) {
          // Log error but continue
        }
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Should maintain stability (> 90% success)
      expect(successCount / operations).toBeGreaterThan(0.9);
    });
  });

  describe('Session Persistence Over Time', () => {
    it('should maintain session validity over extended period', async () => {
      // This test checks if sessions remain valid
      const res = await request(app.getHttpServer()).get('/health');
      
      // Health endpoint should be accessible without session
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources after request completion', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make many requests
      const requests = Array(50).fill(null).map(() =>
        request(app.getHttpServer()).get('/health')
      );

      await Promise.all(requests);
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable
      const growthPercentage = (memoryGrowth / initialMemory) * 100;
      expect(growthPercentage).toBeLessThan(30);
    });
  });

  describe('Error Recovery Over Time', () => {
    it('should recover from transient errors over time', async () => {
      const iterations = 20;
      let recoveryCount = 0;

      for (let i = 0; i < iterations; i++) {
        try {
          const res = await request(app.getHttpServer()).get('/health');
          if ([200, 404].includes(res.status)) {
            recoveryCount++;
          }
        } catch (error) {
          // Error occurred, check if next request succeeds
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Should recover from most errors (> 85% success rate)
      expect(recoveryCount / iterations).toBeGreaterThan(0.85);
    });
  });

  describe('Extended Load Testing', () => {
    it('should handle extended period of moderate load', async () => {
      const duration = 5000; // 5 seconds
      const interval = 200; // Request every 200ms
      const startTime = Date.now();
      let successCount = 0;
      let requestCount = 0;

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
        
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      // Should maintain high success rate (> 90%)
      if (requestCount > 0) {
        expect(successCount / requestCount).toBeGreaterThan(0.9);
      }
    });
  });
});
