import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { createUserWithRole } from './e2e-helpers';

describe('Admin Dashboard & Core Operations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: ['admin-dashboard-test@example.com', 'regular-user-test@example.com'] },
      },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: ['admin-dashboard-test@example.com', 'regular-user-test@example.com'] },
      },
    });

    const admin = await createUserWithRole({
      app,
      prisma,
      email: 'admin-dashboard-test@example.com',
      password: 'TestPass123!',
      firstName: 'Admin',
      lastName: 'Tester',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;
    adminUserId = admin.userId;

    const regular = await createUserWithRole({
      app,
      prisma,
      email: 'regular-user-test@example.com',
      password: 'TestPass123!',
      firstName: 'Regular',
      lastName: 'User',
      role: UserRole.USER,
    });
    userToken = regular.accessToken;
    userId = regular.userId;
  });

  describe('Admin authorization', () => {
    it('should allow admin access to dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('listings');
      expect(response.body).toHaveProperty('bookings');
    });

    it('should deny non-admin dashboard access', async () => {
      await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Admin analytics', () => {
    it('should return analytics payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/analytics?period=week')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Admin user management', () => {
    it('should list users for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.users)).toBe(true);
      expect(typeof response.body.total).toBe('number');
    });

    it('should fetch a specific user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
    });

    it('should update user role', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.HOST })
        .expect(200);

      expect(response.body.role).toBe(UserRole.HOST);
    });

    it('should suspend and activate a user', async () => {
      const suspended = await request(app.getHttpServer())
        .post(`/admin/users/${userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(suspended.body.status).toBe('SUSPENDED');

      const activated = await request(app.getHttpServer())
        .post(`/admin/users/${userId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(activated.body.status).toBe('ACTIVE');
    });

    it('should prevent admin from suspending themselves', async () => {
      await request(app.getHttpServer())
        .post(`/admin/users/${adminUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
