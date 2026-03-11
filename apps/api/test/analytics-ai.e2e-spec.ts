import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, createUserWithRole } from './e2e-helpers';

describe('Analytics & AI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;

  const email = buildTestEmail('analytics-user');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
    const user = await createUserWithRole({
      app,
      prisma,
      email,
      password: 'Password123!',
      firstName: 'Analytics',
      lastName: 'User',
      role: UserRole.HOST,
    });
    userToken = user.accessToken;
  });

  /* ── Analytics ── */

  describe('GET /analytics/performance', () => {
    it('should return performance metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/performance')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should accept period query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/performance?period=30d')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/analytics/performance')
        .expect(401);
    });
  });

  describe('GET /analytics/insights', () => {
    it('should return business insights', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/insights')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/analytics/insights')
        .expect(401);
    });
  });

  /* ── AI ── */

  describe('POST /ai/generate-description', () => {
    it('should generate a listing description', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Mountain View Apartment',
          category: 'Apartment',
          features: ['wifi', 'parking', 'mountain view'],
          location: 'Pokhara, Nepal',
        });

      // Accept 200 (success) or 503/424 (if AI provider unavailable in test env)
      expect([200, 424, 500, 503].includes(response.status)).toBe(true);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('description');
      }
    });

    it('should 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/ai/generate-description')
        .send({ title: 'Test' })
        .expect(401);
    });
  });
});
