import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { createUserWithRole } from './e2e-helpers';

describe('Admin Dynamic Entities (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

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
      where: { email: { in: ['admin-entities-test@example.com', 'entities-user-test@example.com'] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['admin-entities-test@example.com', 'entities-user-test@example.com'] } },
    });

    const admin = await createUserWithRole({
      app,
      prisma,
      email: 'admin-entities-test@example.com',
      password: 'TestPass123!',
      firstName: 'Admin',
      lastName: 'Entities',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;

    const user = await createUserWithRole({
      app,
      prisma,
      email: 'entities-user-test@example.com',
      password: 'TestPass123!',
      firstName: 'Regular',
      lastName: 'User',
      role: UserRole.USER,
    });
    userToken = user.accessToken;
  });

  describe('GET /admin/schema/:entity', () => {
    it('should return claims schema', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/schema/claims')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.slug).toBe('claims');
      expect(Array.isArray(response.body.fields)).toBe(true);
      expect(Array.isArray(response.body.columns)).toBe(true);
    });

    it('should return email templates schema', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/schema/email-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.slug).toBe('email-templates');
      expect(Array.isArray(response.body.fields)).toBe(true);
      expect(Array.isArray(response.body.columns)).toBe(true);
    });
  });

  describe('GET /admin/:entity', () => {
    it('should return claims data payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/claims?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should return email templates data payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/email-templates?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('Authorization', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/admin/schema/claims').expect(401);
    });

    it('should reject non-admin access', async () => {
      await request(app.getHttpServer())
        .get('/admin/schema/claims')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
