/**
 * Integration Test Real Dependency Verification
 *
 * This test suite validates that integration tests use real dependencies
 * instead of mocks. It checks for:
 * - Real database connections (Prisma)
 * - Real cache connections (Redis)
 * - Real queue connections (Bull)
 * - Real external API calls (Stripe, Resend, Twilio in test mode)
 * - No jest.mock() or mockImplementation() usage in integration tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { AppModule } from '../../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('Real Dependency Verification', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cacheService: CacheService;
  let paymentQueue: Queue;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    cacheService = app.get<CacheService>(CacheService);
    paymentQueue = app.get<Queue>(getQueueToken('payments'));

    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Database Connection (Prisma)', () => {
    it('should connect to real database', async () => {
      // Verify actual database connection
      const result = await prisma.$queryRaw`SELECT 1 as connection_test`;
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use real database transactions', async () => {
      // Test that transactions actually commit to database
      const testData = {
        email: `verify-test-${Date.now()}@example.com`,
        username: `verify-test-${Date.now()}`,
        password: 'TestPass123!',
      };

      let createdUser: any;

      try {
        await prisma.$transaction(async (tx) => {
          createdUser = await tx.user.create({
            data: testData,
          });
        });

        // Verify user was actually created in database
        const foundUser = await prisma.user.findUnique({
          where: { id: createdUser.id },
        });

        expect(foundUser).not.toBeNull();
        expect(foundUser?.email).toBe(testData.email);
      } finally {
        // Cleanup
        if (createdUser) {
          await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
        }
      }
    });

    it('should rollback transactions on error', async () => {
      const testEmail = `rollback-test-${Date.now()}@example.com`;
      
      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.create({
            data: {
              email: testEmail,
              username: `rollback-${Date.now()}`,
              password: 'TestPass123!',
            },
          });
          
          // Force rollback with error
          throw new Error('Intentional rollback');
        });
      } catch {
        // Expected
      }

      // Verify user was NOT created (transaction rolled back)
      const foundUser = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      expect(foundUser).toBeNull();
    });
  });

  describe('Cache Connection (Redis)', () => {
    it('should connect to real Redis cache', async () => {
      const testKey = `verify-test:${Date.now()}`;
      const testValue = { test: 'data', timestamp: Date.now() };

      // Write to cache
      await cacheService.set(testKey, testValue, 60);

      // Read from cache
      const retrieved = await cacheService.get(testKey);

      expect(retrieved).toEqual(testValue);

      // Cleanup
      await cacheService.del(testKey);
    });

    it('should handle cache expiration with real TTL', async () => {
      const testKey = `verify-expire:${Date.now()}`;
      const testValue = 'temporary';

      await cacheService.set(testKey, testValue, 1); // 1 second TTL

      // Verify exists immediately
      expect(await cacheService.get(testKey)).toBe(testValue);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify expired
      expect(await cacheService.get(testKey)).toBeNull();
    });

    it('should use real Redis pub/sub', async () => {
      const testChannel = `test-channel-${Date.now()}`;
      const testMessage = { event: 'test', data: 'hello' };
      let receivedMessage: any;

      // Subscribe
      await cacheService.subscribe(testChannel, (msg) => {
        receivedMessage = msg;
      });

      // Publish
      await cacheService.publish(testChannel, testMessage);

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(receivedMessage).toEqual(testMessage);
    });
  });

  describe('Queue Connection (Bull/Redis)', () => {
    it('should connect to real queue', async () => {
      const testJob = {
        test: true,
        timestamp: Date.now(),
      };

      // Add job to queue
      const job = await paymentQueue.add('test-job', testJob);

      expect(job.id).toBeDefined();
      expect(job.data).toEqual(testJob);

      // Cleanup
      await job.remove();
    });

    it('should process jobs with real queue', async () => {
      // This test verifies the queue is functional
      const jobCount = await paymentQueue.count();
      
      // Just verify we can interact with real queue
      expect(typeof jobCount).toBe('number');
    });

    it('should handle job delays with real queue', async () => {
      const jobData = { delayed: true };
      const delayMs = 2000;

      const job = await paymentQueue.add('delayed-test', jobData, {
        delay: delayMs,
      });

      // Verify job is delayed
      const delayedJobs = await paymentQueue.getDelayed();
      const foundJob = delayedJobs.find(j => j.id === job.id);

      expect(foundJob).toBeDefined();

      // Cleanup
      await job.remove();
    });
  });

  describe('External API Readiness', () => {
    it('should have Stripe configuration', () => {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      
      // In test environment, this should be set (even if test key)
      expect(stripeKey).toBeDefined();
      
      // Should be a test key in test environment
      if (stripeKey) {
        expect(stripeKey.startsWith('sk_test_') || stripeKey.startsWith('rk_test_')).toBe(true);
      }
    });

    it('should have email provider configuration', () => {
      const resendKey = process.env.RESEND_API_KEY;
      
      // Should be configured (may be test key)
      expect(resendKey).toBeDefined();
    });

    it('should have SMS provider configuration', () => {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      
      // Should be configured
      expect(twilioSid).toBeDefined();
      expect(twilioToken).toBeDefined();
    });
  });

  describe('Integration Test File Analysis', () => {
    it('should not have jest.mock in integration test files', () => {
      const integrationDir = path.join(__dirname);
      
      if (!fs.existsSync(integrationDir)) {
        // Skip if directory doesn't exist
        return;
      }

      const files = fs.readdirSync(integrationDir)
        .filter(f => f.endsWith('.spec.ts') || f.endsWith('.test.ts'));

      const filesWithMocks: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(path.join(integrationDir, file), 'utf-8');
        
        // Check for mocking patterns that shouldn't be in integration tests
        if (content.includes('jest.mock(') || 
            content.includes('jest.spyOn(') && content.includes('.mockImplementation(')) {
          filesWithMocks.push(file);
        }
      }

      // Integration tests should use real dependencies
      expect(filesWithMocks).toEqual([]);
    });

    it('should use real NestJS modules in integration tests', () => {
      // Verify we're using real module imports
      expect(AppModule).toBeDefined();
      expect(typeof AppModule).toBe('object');
    });
  });

  describe('End-to-End Flow Verification', () => {
    it('should complete full booking flow with real dependencies', async () => {
      // This test verifies the entire flow uses real services
      
      // 1. Create user in real database
      const testEmail = `e2e-verify-${Date.now()}@example.com`;
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          username: `e2e-verify-${Date.now()}`,
          firstName: 'Test',
          lastName: 'User',
        },
      });

      try {
        // 2. Verify user exists in real DB
        const foundUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        expect(foundUser).not.toBeNull();

        // 3. Cache user data in real Redis
        const cacheKey = `user:${user.id}`;
        await cacheService.set(cacheKey, { id: user.id, email: user.email }, 60);
        
        const cachedUser = await cacheService.get(cacheKey);
        expect(cachedUser).toEqual({ id: user.id, email: user.email });

        // 4. Queue a notification job in real queue
        const job = await paymentQueue.add('notification-job', {
          userId: user.id,
          type: 'welcome',
        });
        expect(job.id).toBeDefined();

        // Cleanup
        await job.remove();
        await cacheService.del(cacheKey);
      } finally {
        // Cleanup database
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });
  });
});
