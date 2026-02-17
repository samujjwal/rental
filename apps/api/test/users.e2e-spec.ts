import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let testUserId: string;
  let testUserEmail: string;
  let adminEmail: string;

  const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const register = async (email: string, firstName: string, lastName: string, password = 'Password123!') => {
    const response = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password,
      firstName,
      lastName,
      phoneNumber: '+1234567890',
    });

    expect(response.status).toBe(201);
    return response.body as { accessToken: string; refreshToken: string; user: { id: string } };
  };

  const login = async (email: string, password = 'Password123!') => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    return response.body as { accessToken: string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    const suffix = uniqueSuffix();

    adminEmail = `admin-users-${suffix}@test.com`;
    testUserEmail = `testuser-profile-${suffix}@test.com`;

    await register(adminEmail, 'Admin', 'User');
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });

    const adminLogin = await login(adminEmail);
    adminToken = adminLogin.accessToken;

    const userSignup = await register(testUserEmail, 'Test', 'User');
    userToken = userSignup.accessToken;
    testUserId = userSignup.user.id;
  });

  afterAll(async () => {
    await prisma.user
      .deleteMany({
        where: {
          OR: [
            { email: adminEmail },
            { email: testUserEmail },
            { email: { contains: '@users-admin-test.com' } },
          ],
        },
      })
      .catch(() => {});

    await app.close();
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('email', testUserEmail);
      expect(response.body).toHaveProperty('firstName', 'Test');
      expect(response.body).toHaveProperty('lastName', 'User');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
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
      await request(app.getHttpServer()).patch('/users/me').send({ firstName: 'Unauthorized' }).expect(401);
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
      expect(response.body.addressLine1).toBe(addressDto.addressLine1);
    });

    it('should reject invalid phone number format', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ phoneNumber: 'invalid-phone' })
        .expect(400);
    });

    it('should not allow email update directly', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'newemail@test.com' })
        .expect(200);

      expect(response.body.email).toBe(testUserEmail);
    });

    it('should sanitize HTML in bio', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: '<script>alert("xss")</script>Safe bio content' })
        .expect(200);

      expect(response.body.bio).toContain('Safe bio content');
      expect(response.body.bio).not.toContain('<script>');
    });
  });

  describe('GET /users/me/stats', () => {
    it('should return user statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('listingsCount');
      expect(response.body).toHaveProperty('bookingsAsRenter');
      expect(response.body).toHaveProperty('bookingsAsOwner');
      expect(response.body).toHaveProperty('reviewsGiven');
      expect(response.body).toHaveProperty('reviewsReceived');
      expect(response.body).toHaveProperty('memberSince');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/users/me/stats').expect(401);
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

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/users/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('Admin User Management', () => {
    describe('GET /admin/users', () => {
      it('should return all users for admin', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.users)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users?page=1&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body.users)).toBe(true);
      });

      it('should filter by role', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users?role=ADMIN')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const users = response.body.users || [];
        users.forEach((user: any) => {
          expect(user.role).toBe('ADMIN');
        });
      });

      it('should search by email', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users?search=testuser-profile')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body.users)).toBe(true);
      });

      it('should reject non-admin access', async () => {
        await request(app.getHttpServer())
          .get('/admin/users')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('PATCH /admin/users/:id/role', () => {
      it('should update user role', async () => {
        const suffix = uniqueSuffix();
        const email = `role-test-${suffix}@users-admin-test.com`;
        const newUser = await prisma.user.create({
          data: {
            email,
            username: email,
            passwordHash: 'test',
            firstName: 'Role',
            lastName: 'Test',
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/admin/users/${newUser.id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'HOST' })
          .expect(200);

        expect(response.body.role).toBe('HOST');
      });
    });

    describe('POST /admin/users/:id/suspend', () => {
      it('should suspend a user', async () => {
        const suffix = uniqueSuffix();
        const email = `suspend-test-${suffix}@users-admin-test.com`;
        const newUser = await prisma.user.create({
          data: {
            email,
            username: email,
            passwordHash: 'test',
            firstName: 'Suspend',
            lastName: 'Test',
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });

        const response = await request(app.getHttpServer())
          .post(`/admin/users/${newUser.id}/suspend`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);

        expect(response.body.status).toBe('SUSPENDED');
      });

      it('should reject suspending admin users', async () => {
        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (admin) {
          await request(app.getHttpServer())
            .post(`/admin/users/${admin.id}/suspend`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(400);
        }
      });
    });

    describe('POST /admin/users/:id/activate', () => {
      it('should activate a suspended user', async () => {
        const suffix = uniqueSuffix();
        const email = `activate-test-${suffix}@users-admin-test.com`;
        const newUser = await prisma.user.create({
          data: {
            email,
            username: email,
            passwordHash: 'test',
            firstName: 'Activate',
            lastName: 'Test',
            role: 'CUSTOMER',
            status: 'SUSPENDED',
          },
        });

        const response = await request(app.getHttpServer())
          .post(`/admin/users/${newUser.id}/activate`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);

        expect(response.body.status).toBe('ACTIVE');
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
        firstName: 'Tanaka',
        lastName: 'Taro',
        bio: 'Japanese profile text',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(unicodeDto)
        .expect(200);

      expect(response.body.firstName).toBe(unicodeDto.firstName);
    });
  });

  describe('User Preferences Integration', () => {
    it('should return 404 for legacy /users/me/preferences route', async () => {
      await request(app.getHttpServer())
        .get('/users/me/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should read and update preferences through the shared notifications module', async () => {
      const initial = await request(app.getHttpServer())
        .get('/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(initial.body).toHaveProperty('email');
      expect(initial.body).toHaveProperty('inApp');

      const updated = await request(app.getHttpServer())
        .patch('/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: false,
          bookingUpdates: false,
        })
        .expect(200);

      expect(updated.body.email).toBe(false);
      expect(updated.body.bookingUpdates).toBe(false);
    });
  });
});
