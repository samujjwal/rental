import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same pipes as main app
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
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: '@test.com' } },
    });
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('tokens');
          expect(res.body.user.email).toBe('newuser@test.com');
        });
    });

    it('should reject duplicate email', async () => {
      // Create user first
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
        });

      // Try to register again
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'SecurePass123!',
          firstName: 'Another',
          lastName: 'User',
          phone: '+1234567891',
        })
        .expect(409);
    });

    it('should reject invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
        })
        .expect(400);
    });

    it('should reject weak password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'weakpass@test.com',
          password: '123',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
        })
        .expect(400);
    });
  });

  describe('/api/auth/login (POST)', () => {
    beforeEach(async () => {
      // Create test user
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'logintest@test.com',
          password: 'SecurePass123!',
          firstName: 'Login',
          lastName: 'Test',
          phone: '+1234567890',
        });
    });

    it('should login with correct credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'SecurePass123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('tokens');
          expect(res.body.tokens).toHaveProperty('accessToken');
          expect(res.body.tokens).toHaveProperty('refreshToken');
        });
    });

    it('should reject incorrect password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SecurePass123!',
        })
        .expect(401);
    });
  });

  describe('/api/auth/refresh (POST)', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'refreshtest@test.com',
          password: 'SecurePass123!',
          firstName: 'Refresh',
          lastName: 'Test',
          phone: '+1234567890',
        });

      refreshToken = response.body.tokens.refreshToken;
    });

    it('should refresh tokens with valid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('Protected routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'protected@test.com',
          password: 'SecurePass123!',
          firstName: 'Protected',
          lastName: 'Test',
          phone: '+1234567890',
        });

      accessToken = response.body.tokens.accessToken;
    });

    it('should access protected route with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject protected route without token', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);
    });

    it('should reject protected route with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
