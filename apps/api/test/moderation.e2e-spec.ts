import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Moderation E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Create regular user
    const userResponse = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'moderation-test@example.com',
      password: 'Test123!',
      name: 'Moderation Test User',
    });

    authToken = userResponse.body.accessToken;
    userId = userResponse.body.user.id;

    // Create admin user
    const adminResponse = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'moderation-admin@example.com',
      password: 'Admin123!',
      name: 'Moderation Admin',
      role: 'ADMIN',
    });

    adminToken = adminResponse.body.accessToken;
    adminId = adminResponse.body.user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.moderationLog.deleteMany({ where: { userId } });
    await prisma.moderationQueue.deleteMany({});
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
    await app.close();
  });

  describe('POST /moderation/listings/:id', () => {
    let listingId: string;

    beforeAll(async () => {
      const listingRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Listing for Moderation',
          description: 'A perfectly normal listing',
          pricePerDay: 50,
          categoryId: 'test-category-id',
        });

      listingId = listingRes.body.id;
    });

    it('should moderate listing content', () => {
      return request(app.getHttpServer())
        .post(`/moderation/listings/${listingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('confidence');
          expect(res.body).toHaveProperty('flags');
          expect(res.body).toHaveProperty('requiresHumanReview');
        });
    });

    it('should flag inappropriate content', () => {
      return request(app.getHttpServer())
        .post('/moderation/listings/test-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Inappropriate content here',
          description: 'This contains banned words and spam',
        })
        .expect((res) => {
          expect(res.body.flags.length).toBeGreaterThan(0);
          expect(res.body.requiresHumanReview).toBe(true);
        });
    });

    it('should require admin role', () => {
      return request(app.getHttpServer())
        .post(`/moderation/listings/${listingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('GET /moderation/queue', () => {
    beforeAll(async () => {
      // Create some moderation queue items
      await prisma.moderationQueue.createMany({
        data: [
          {
            entityType: 'LISTING',
            entityId: 'listing-1',
            status: 'PENDING',
            priority: 'HIGH',
            flags: [
              {
                type: 'SPAM',
                severity: 'HIGH',
                confidence: 0.85,
                description: 'Possible spam detected',
              },
            ],
          },
          {
            entityType: 'MESSAGE',
            entityId: 'message-1',
            status: 'PENDING',
            priority: 'MEDIUM',
            flags: [
              {
                type: 'INAPPROPRIATE',
                severity: 'MEDIUM',
                confidence: 0.7,
                description: 'Inappropriate language',
              },
            ],
          },
        ],
      });
    });

    it('should return moderation queue for admin', () => {
      return request(app.getHttpServer())
        .get('/moderation/queue')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('entityType');
          expect(res.body[0]).toHaveProperty('flags');
        });
    });

    it('should filter by status', () => {
      return request(app.getHttpServer())
        .get('/moderation/queue?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((item: any) => {
            expect(item.status).toBe('PENDING');
          });
        });
    });

    it('should filter by priority', () => {
      return request(app.getHttpServer())
        .get('/moderation/queue?priority=HIGH')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((item: any) => {
            expect(item.priority).toBe('HIGH');
          });
        });
    });

    it('should require admin role', () => {
      return request(app.getHttpServer())
        .get('/moderation/queue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('POST /moderation/queue/:id/approve', () => {
    let queueItemId: string;

    beforeAll(async () => {
      const item = await prisma.moderationQueue.create({
        data: {
          entityType: 'LISTING',
          entityId: 'listing-approve-test',
          status: 'PENDING',
          priority: 'MEDIUM',
          flags: [],
        },
      });

      queueItemId = item.id;
    });

    it('should approve moderation queue item', () => {
      return request(app.getHttpServer())
        .post(`/moderation/queue/${queueItemId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Content is acceptable',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('APPROVED');
          expect(res.body.reviewedBy).toBe(adminId);
          expect(res.body.reviewedAt).toBeDefined();
        });
    });

    it('should require admin role', () => {
      return request(app.getHttpServer())
        .post(`/moderation/queue/${queueItemId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('POST /moderation/queue/:id/reject', () => {
    let queueItemId: string;

    beforeAll(async () => {
      const item = await prisma.moderationQueue.create({
        data: {
          entityType: 'REVIEW',
          entityId: 'review-reject-test',
          status: 'PENDING',
          priority: 'HIGH',
          flags: [
            {
              type: 'HARASSMENT',
              severity: 'CRITICAL',
              confidence: 0.95,
              description: 'Harassment detected',
            },
          ],
        },
      });

      queueItemId = item.id;
    });

    it('should reject moderation queue item', () => {
      return request(app.getHttpServer())
        .post(`/moderation/queue/${queueItemId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Content violates community guidelines',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('REJECTED');
          expect(res.body.reviewedBy).toBe(adminId);
          expect(res.body.notes).toContain('Content violates community guidelines');
        });
    });

    it('should require reason for rejection', () => {
      return request(app.getHttpServer())
        .post(`/moderation/queue/${queueItemId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('should require admin role', () => {
      return request(app.getHttpServer())
        .post(`/moderation/queue/${queueItemId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('POST /moderation/messages', () => {
    it('should moderate message content', () => {
      return request(app.getHttpServer())
        .post('/moderation/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hello, is this item still available?',
          recipientId: 'recipient-user-id',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('confidence');
          expect(res.body.status).toBe('APPROVED');
        });
    });

    it('should flag inappropriate messages', () => {
      return request(app.getHttpServer())
        .post('/moderation/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Offensive and inappropriate content here',
          recipientId: 'recipient-user-id',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.flags.length).toBeGreaterThan(0);
          expect(['FLAGGED', 'REJECTED']).toContain(res.body.status);
        });
    });

    it('should block critical violations immediately', () => {
      return request(app.getHttpServer())
        .post('/moderation/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Extremely offensive harassment and threats',
          recipientId: 'recipient-user-id',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('REJECTED');
          expect(res.body.blockedReasons).toBeDefined();
        });
    });
  });

  describe('GET /moderation/stats', () => {
    it('should return moderation statistics for admin', () => {
      return request(app.getHttpServer())
        .get('/moderation/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalPending');
          expect(res.body).toHaveProperty('totalApproved');
          expect(res.body).toHaveProperty('totalRejected');
          expect(res.body).toHaveProperty('highPriority');
          expect(res.body).toHaveProperty('criticalFlags');
        });
    });

    it('should filter stats by date range', () => {
      return request(app.getHttpServer())
        .get('/moderation/stats?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalPending');
        });
    });

    it('should require admin role', () => {
      return request(app.getHttpServer())
        .get('/moderation/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});
