import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Get admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@rental-portal.com', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    // Create test user
    const userSignup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'testuser-profile@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });
    userToken = userSignup.body.accessToken;
    testUserId = userSignup.body.user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { email: 'testuser-profile@test.com' } }).catch(() => {});
    await app.close();
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('email', 'testuser-profile@test.com');
      expect(response.body).toHaveProperty('firstName', 'Test');
      expect(response.body).toHaveProperty('lastName', 'User');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });

    it('should include user statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalReviews');
      expect(response.body).toHaveProperty('averageRating');
    });
  });

  describe('PATCH /users/me', () => {
    it('should update user profile', async () => {
      const updateDto = {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'This is my updated bio',
        phoneNumber: '+1234567890',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.firstName).toBe(updateDto.firstName);
      expect(response.body.lastName).toBe(updateDto.lastName);
      expect(response.body.bio).toBe(updateDto.bio);
      expect(response.body.phoneNumber).toBe(updateDto.phoneNumber);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .send({ firstName: 'Unauthorized' })
        .expect(401);
    });

    it('should validate phone number format', async () => {
      const invalidDto = {
        phoneNumber: 'invalid-phone',
      };

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should update profile photo URL', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ profilePhotoUrl: 'https://example.com/photo.jpg' })
        .expect(200);

      expect(response.body.profilePhotoUrl).toBe('https://example.com/photo.jpg');
    });

    it('should update address fields', async () => {
      const addressDto = {
        addressLine1: '123 Main St',
        addressLine2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(addressDto)
        .expect(200);

      expect(response.body.city).toBe(addressDto.city);
      expect(response.body.state).toBe(addressDto.state);
    });

    it('should not allow email update directly', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'newemail@test.com' })
        .expect(200);

      // Email should remain unchanged
      expect(response.body.email).toBe('testuser-profile@test.com');
    });

    it('should sanitize HTML in bio', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: '<script>alert("xss")</script>Safe bio content' })
        .expect(200);

      expect(response.body.bio).not.toContain('<script>');
    });
  });

  describe('GET /users/:id/stats', () => {
    it('should return user statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${testUserId}/stats`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalBookings');
      expect(response.body).toHaveProperty('totalListings');
      expect(response.body).toHaveProperty('totalReviews');
      expect(response.body).toHaveProperty('averageRating');
      expect(response.body).toHaveProperty('memberSince');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/users/${testUserId}/stats`)
        .expect(401);
    });
  });

  describe('GET /users/:id (Public Profile)', () => {
    it('should return public profile', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('firstName');
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('phoneNumber');
    });

    it('should include user\'s listings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${testUserId}?includeListings=true`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('listings');
      expect(Array.isArray(response.body.listings)).toBe(true);
    });

    it('should include user\'s reviews', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${testUserId}?includeReviews=true`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reviews');
      expect(Array.isArray(response.body.reviews)).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/users/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('Admin User Management', () => {
    describe('GET /v1/admin/users', () => {
      it('should return all users for admin', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body.data || response.body)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/admin/users?page=1&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body.data || response.body)).toBe(true);
      });

      it('should filter by status', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/admin/users?status=ACTIVE')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const users = response.body.data || response.body;
        users.forEach((user: any) => {
          expect(user.status).toBe('ACTIVE');
        });
      });

      it('should search by email', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/admin/users?search=testuser')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body.data || response.body)).toBe(true);
      });

      it('should reject non-admin access', async () => {
        await request(app.getHttpServer())
          .get('/v1/admin/users')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('PATCH /v1/admin/users/:id/role', () => {
      it('should update user role', async () => {
        // Create a test user for role change
        const newUser = await prisma.user.create({
          data: {
            email: 'role-test@test.com',
            username: 'role-test',
            password: 'test',
            passwordHash: 'test',
            firstName: 'Role',
            lastName: 'Test',
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/v1/admin/users/${newUser.id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'HOST' })
          .expect(200);

        expect(response.body.role).toBe('HOST');

        // Cleanup
        await prisma.user.delete({ where: { id: newUser.id } });
      });
    });

    describe('POST /v1/admin/users/:id/suspend', () => {
      it('should suspend a user', async () => {
        // Create a test user for suspension
        const newUser = await prisma.user.create({
          data: {
            email: 'suspend-test@test.com',
            username: 'suspend-test',
            password: 'test',
            passwordHash: 'test',
            firstName: 'Suspend',
            lastName: 'Test',
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });

        const response = await request(app.getHttpServer())
          .post(`/v1/admin/users/${newUser.id}/suspend`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Test suspension' })
          .expect(200);

        expect(response.body.status).toBe('SUSPENDED');

        // Cleanup
        await prisma.user.delete({ where: { id: newUser.id } });
      });

      it('should reject suspending admin users', async () => {
        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (admin) {
          await request(app.getHttpServer())
            .post(`/v1/admin/users/${admin.id}/suspend`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ reason: 'Test' })
            .expect(400);
        }
      });
    });

    describe('POST /v1/admin/users/:id/activate', () => {
      it('should activate a suspended user', async () => {
        // Create a suspended user
        const newUser = await prisma.user.create({
          data: {
            email: 'activate-test@test.com',
            username: 'activate-test',
            password: 'test',
            passwordHash: 'test',
            firstName: 'Activate',
            lastName: 'Test',
            role: 'CUSTOMER',
            status: 'SUSPENDED',
          },
        });

        const response = await request(app.getHttpServer())
          .post(`/v1/admin/users/${newUser.id}/activate`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.status).toBe('ACTIVE');

        // Cleanup
        await prisma.user.delete({ where: { id: newUser.id } });
      });
    });
  });

  describe('User Preferences', () => {
    describe('GET /users/me/preferences', () => {
      it('should return user preferences', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/me/preferences')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('language');
        expect(response.body).toHaveProperty('currency');
        expect(response.body).toHaveProperty('timezone');
        expect(response.body).toHaveProperty('emailNotifications');
      });

      it('should create default preferences if none exist', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/me/preferences')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.language).toBe('en');
        expect(response.body.currency).toBe('USD');
      });
    });

    describe('PATCH /users/me/preferences', () => {
      it('should update user preferences', async () => {
        const updateDto = {
          language: 'es',
          currency: 'EUR',
          timezone: 'Europe/Madrid',
          emailNotifications: false,
        };

        const response = await request(app.getHttpServer())
          .patch('/users/me/preferences')
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.language).toBe(updateDto.language);
        expect(response.body.currency).toBe(updateDto.currency);
        expect(response.body.emailNotifications).toBe(false);
      });

      it('should validate language code', async () => {
        await request(app.getHttpServer())
          .patch('/users/me/preferences')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ language: 'invalid_language_code_too_long' })
          .expect(400);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent profile updates', async () => {
      const updates = Array(5)
        .fill(null)
        .map((_, i) =>
          request(app.getHttpServer())
            .patch('/users/me')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ bio: `Update ${i}` }),
        );

      const responses = await Promise.all(updates);
      const successful = responses.filter((r) => r.status === 200);

      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle very long bio', async () => {
      const longBio = 'A'.repeat(5000);

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: longBio })
        .expect(200);

      expect(response.body.bio.length).toBeLessThanOrEqual(5000);
    });

    it('should handle Unicode characters in profile', async () => {
      const unicodeDto = {
        firstName: '田中',
        lastName: '太郎',
        bio: '日本語のプロフィール 🎉',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(unicodeDto)
        .expect(200);

      expect(response.body.firstName).toBe(unicodeDto.firstName);
    });
  });
});
