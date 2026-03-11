import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, createUserWithRole } from './e2e-helpers';

describe('Fraud Detection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  const adminEmail = buildTestEmail('fraud-admin');
  const userEmail = buildTestEmail('fraud-user');

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
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, userEmail],
        },
      },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, userEmail],
        },
      },
    });

    const admin = await createUserWithRole({
      app,
      prisma,
      email: adminEmail,
      password: 'TestPass123!',
      firstName: 'Fraud',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;

    const user = await createUserWithRole({
      app,
      prisma,
      email: userEmail,
      password: 'TestPass123!',
      firstName: 'Fraud',
      lastName: 'User',
      role: UserRole.USER,
    });
    userToken = user.accessToken;
  });

  describe('GET /fraud/high-risk-users', () => {
    it('should return high-risk users for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/fraud/high-risk-users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should deny non-admin users', async () => {
      await request(app.getHttpServer())
        .get('/fraud/high-risk-users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/fraud/high-risk-users').expect(401);
    });
  });
});
