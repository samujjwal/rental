import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const buildEmail = (prefix: string) => `${prefix}-${uniqueSuffix()}@test.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Cleanup all test users created during this suite
    try {
      await prisma.user.deleteMany({
        where: { email: { contains: '@test.com' } },
      });
    } catch {
      // Ignore cleanup failures
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user', async () => {
      const email = buildEmail('newuser');
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+1234567890',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(email);
    });

    it('should reject duplicate email', async () => {
      const email = buildEmail('duplicate');

      await request(app.getHttpServer()).post('/auth/register').send({
        email,
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+1234567890',
      });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'SecurePass123!',
          firstName: 'Another',
          lastName: 'User',
          phoneNumber: '+1234567891',
        })
        .expect(409);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+1234567890',
        })
        .expect(400);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: buildEmail('weakpass'),
          password: '123',
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+1234567890',
        })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    let loginEmail: string;

    beforeEach(async () => {
      loginEmail = buildEmail('logintest');
      await request(app.getHttpServer()).post('/auth/register').send({
        email: loginEmail,
        password: 'SecurePass123!',
        firstName: 'Login',
        lastName: 'Test',
        phoneNumber: '+1234567890',
      });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: loginEmail,
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: loginEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: buildEmail('nonexistent'),
          password: 'SecurePass123!',
        })
        .expect(401);
    });
  });

  describe('/auth/refresh (POST)', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: buildEmail('refreshtest'),
        password: 'SecurePass123!',
        firstName: 'Refresh',
        lastName: 'Test',
        phoneNumber: '+1234567890',
      });

      refreshToken = response.body.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('Protected routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: buildEmail('protected'),
        password: 'SecurePass123!',
        firstName: 'Protected',
        lastName: 'Test',
        phoneNumber: '+1234567890',
      });

      accessToken = response.body.accessToken;
    });

    it('should access protected route with valid token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject protected route without token', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('should reject protected route with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
