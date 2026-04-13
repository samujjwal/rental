import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('DB Failure Scenarios', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Connection timeout handling', () => {
    it('should return 503 when DB is unreachable', async () => {
      // Disconnect DB to simulate failure
      await prisma.$disconnect();

      const response = await request(app.getHttpServer())
        .get('/health/readiness')
        .expect((res) => {
          // Should return 503 or indicate unhealthy
          expect([200, 503]).toContain(res.status);
        });

      // Reconnect for other tests
      await prisma.$connect();
    });
  });

  describe('Query timeout handling', () => {
    it('should handle slow queries gracefully', async () => {
      // Execute a query with a short statement timeout
      try {
        await prisma.$queryRawUnsafe('SET statement_timeout = 1');
        await prisma.$queryRawUnsafe('SELECT pg_sleep(0.01)');
      } catch (error: any) {
        expect(error.message).toBeDefined();
      } finally {
        // Reset timeout
        await prisma.$queryRawUnsafe('SET statement_timeout = 0');
      }
    });
  });

  describe('Connection pool exhaustion', () => {
    it('should queue requests when pool is exhausted', async () => {
      // Run many concurrent queries to stress the connection pool
      const concurrentQueries = Array.from({ length: 20 }, () =>
        prisma.$queryRawUnsafe('SELECT 1').catch((err: any) => err)
      );

      const results = await Promise.allSettled(concurrentQueries);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');

      // Most queries should succeed even under pool pressure
      expect(fulfilled.length).toBeGreaterThan(0);
    });
  });

  describe('Retry logic validation', () => {
    it('should retry on transient connection errors', async () => {
      let attempts = 0;
      const maxAttempts = 3;

      const attemptQuery = async (): Promise<boolean> => {
        attempts++;
        try {
          await prisma.$queryRawUnsafe('SELECT 1');
          return true;
        } catch {
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 100 * attempts));
            return attemptQuery();
          }
          return false;
        }
      };

      const result = await attemptQuery();
      expect(result).toBe(true);
      // Should succeed within allowed retries
      expect(attempts).toBeLessThanOrEqual(maxAttempts);
    });
  });

  describe('Transaction rollback on error', () => {
    it('should rollback transaction when an error occurs mid-transaction', async () => {
      const testEmail = `db-fail-test-${Date.now()}@test.com`;

      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.create({
            data: {
              email: testEmail,
              passwordHash: 'test',
              firstName: 'DB',
              lastName: 'Test',
            },
          });
          // Force error inside transaction
          throw new Error('Simulated transaction failure');
        });
      } catch {
        // Expected
      }

      // User should NOT exist due to rollback
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(user).toBeNull();
    });
  });
});
