import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, createUserWithRole, uniqueSuffix } from './e2e-helpers';

describe('Moderation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;
  const testEntityType = 'MODERATION_TEST';

  const createQueueItem = async (params?: {
    entityId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    flags?: Array<{ type: string; severity: string; confidence: number; description: string }>;
  }) => {
    const entityId = params?.entityId ?? `moderation-entity-${uniqueSuffix()}`;

    await prisma.auditLog.create({
      data: {
        action: 'MODERATION_QUEUE_ADD',
        entityType: testEntityType,
        entityId,
        metadata: JSON.stringify({
          flags: params?.flags ?? [
            {
              type: 'SPAM',
              severity: 'HIGH',
              confidence: 0.9,
              description: 'Possible spam',
            },
          ],
          priority: params?.priority ?? 'MEDIUM',
          status: params?.status ?? 'PENDING',
        }),
      },
    });

    return entityId;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    const suffix = uniqueSuffix();
    const regular = await createUserWithRole({
      app,
      prisma,
      email: buildTestEmail(`moderation-user-${suffix}`),
      firstName: 'Moderation',
      lastName: 'User',
      role: UserRole.USER,
    });
    userToken = regular.accessToken;
    userId = regular.userId;

    const admin = await createUserWithRole({
      app,
      prisma,
      email: buildTestEmail(`moderation-admin-${suffix}`),
      firstName: 'Moderation',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;
    adminId = admin.userId;
  });

  afterAll(async () => {
    await prisma.auditLog
      .deleteMany({
        where: {
          OR: [{ entityType: testEntityType }, { userId: { in: [userId, adminId] } }],
        },
      })
      .catch(() => {});

    await prisma.user
      .deleteMany({
        where: {
          id: { in: [userId, adminId] },
        },
      })
      .catch(() => {});

    await app.close();
  });

  describe('POST /moderation/test/text', () => {
    it('should approve clean text for admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/moderation/test/text')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Hello, this rental looks great and I would like to book it next week.',
        })
        .expect(201);

      expect(response.body.status).toBe('APPROVED');
      expect(Array.isArray(response.body.flags)).toBe(true);
    });

    it('should reject critical violations for admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/moderation/test/text')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'You should kill yourself.',
        })
        .expect(201);

      expect(response.body.status).toBe('REJECTED');
      expect(response.body.blockedReasons).toBeDefined();
      expect(response.body.flags.some((flag: { severity: string }) => flag.severity === 'CRITICAL')).toBe(
        true,
      );
    });

    it('should require admin role', async () => {
      await request(app.getHttpServer())
        .post('/moderation/test/text')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text: 'Normal text' })
        .expect(403);
    });
  });

  describe('GET /moderation/queue', () => {
    it('should return moderation queue for admin', async () => {
      const entityId = await createQueueItem({ priority: 'HIGH', status: 'PENDING' });

      const response = await request(app.getHttpServer())
        .get(`/moderation/queue?entityType=${testEntityType}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const createdItem = response.body.find((item: { entityId: string }) => item.entityId === entityId);
      expect(createdItem).toBeDefined();
      expect(createdItem.status).toBe('PENDING');
      expect(createdItem.priority).toBe('HIGH');
    });

    it('should filter queue by status', async () => {
      await createQueueItem({ status: 'PENDING' });
      await createQueueItem({ status: 'APPROVED' });

      const response = await request(app.getHttpServer())
        .get(`/moderation/queue?entityType=${testEntityType}&status=PENDING`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((item: { status: string }) => {
        expect(item.status).toBe('PENDING');
      });
    });

    it('should filter queue by priority', async () => {
      await createQueueItem({ priority: 'HIGH' });
      await createQueueItem({ priority: 'LOW' });

      const response = await request(app.getHttpServer())
        .get(`/moderation/queue?entityType=${testEntityType}&priority=HIGH`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((item: { priority: string }) => {
        expect(item.priority).toBe('HIGH');
      });
    });

    it('should require admin role', async () => {
      await request(app.getHttpServer())
        .get('/moderation/queue')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('POST /moderation/queue/:entityId/approve', () => {
    it('should approve moderation queue item and persist resolution metadata', async () => {
      const entityId = await createQueueItem({ status: 'PENDING' });

      const response = await request(app.getHttpServer())
        .post(`/moderation/queue/${entityId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: testEntityType,
          notes: 'Content is acceptable',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      const queueLog = await prisma.auditLog.findFirst({
        where: {
          action: 'MODERATION_QUEUE_ADD',
          entityId,
        },
      });
      expect(queueLog).toBeTruthy();

      const metadata = JSON.parse(queueLog?.metadata || '{}') as {
        status?: string;
        resolvedBy?: string;
        notes?: string;
      };
      expect(metadata.status).toBe('APPROVED');
      expect(metadata.resolvedBy).toBe(adminId);
      expect(metadata.notes).toContain('acceptable');
    });

    it('should require admin role', async () => {
      const entityId = await createQueueItem({ status: 'PENDING' });

      await request(app.getHttpServer())
        .post(`/moderation/queue/${entityId}/approve`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ entityType: testEntityType, notes: 'Not allowed' })
        .expect(403);
    });
  });

  describe('POST /moderation/queue/:entityId/reject', () => {
    it('should reject moderation queue item and persist resolution metadata', async () => {
      const entityId = await createQueueItem({ status: 'PENDING' });

      const response = await request(app.getHttpServer())
        .post(`/moderation/queue/${entityId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: testEntityType,
          reason: 'Content violates guidelines',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      const queueLog = await prisma.auditLog.findFirst({
        where: {
          action: 'MODERATION_QUEUE_ADD',
          entityId,
        },
      });
      expect(queueLog).toBeTruthy();

      const metadata = JSON.parse(queueLog?.metadata || '{}') as {
        status?: string;
        resolvedBy?: string;
        notes?: string;
      };
      expect(metadata.status).toBe('REJECTED');
      expect(metadata.resolvedBy).toBe(adminId);
      expect(metadata.notes).toContain('guidelines');
    });

    it('should require admin role', async () => {
      const entityId = await createQueueItem({ status: 'PENDING' });

      await request(app.getHttpServer())
        .post(`/moderation/queue/${entityId}/reject`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ entityType: testEntityType, reason: 'Not allowed' })
        .expect(403);
    });
  });

  describe('GET /moderation/history/:userId', () => {
    it('should return moderation history summary for admin', async () => {
      await prisma.auditLog.createMany({
        data: [
          {
            action: 'CONTENT_REJECTED',
            entityType: testEntityType,
            entityId: `history-rejected-${uniqueSuffix()}`,
            userId,
            newValues: JSON.stringify({ reason: 'Policy violation' }),
          },
          {
            action: 'CONTENT_MODERATED',
            entityType: testEntityType,
            entityId: `history-moderated-${uniqueSuffix()}`,
            userId,
            metadata: JSON.stringify({ status: 'FLAGGED' }),
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/moderation/history/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalViolations');
      expect(response.body).toHaveProperty('recentViolations');
      expect(response.body).toHaveProperty('riskLevel');
      expect(response.body.totalViolations).toBeGreaterThanOrEqual(1);
    });

    it('should require admin role', async () => {
      await request(app.getHttpServer())
        .get(`/moderation/history/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
