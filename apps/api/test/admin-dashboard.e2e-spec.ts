import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole, UserStatus } from '@rental-portal/database';

describe('Admin Dashboard & Core Operations E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  let regularUserToken: string;
  let regularUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-dashboard-test@example.com',
        username: 'admin-dashboard-test',
        password: '$2b$10$hashedpassword',
        firstName: 'Admin',
        lastName: 'Tester',
        role: UserRole.ADMIN,
      },
    });

    adminUserId = adminUser.id;

    // Create regular user for testing
    const regularUser = await prisma.user.create({
      data: {
        email: 'regular-user-test@example.com',
        username: 'regular-user-test',
        password: '$2b$10$hashedpassword',
        firstName: 'Regular',
        lastName: 'User',
        role: UserRole.USER,
      },
    });

    regularUserId = regularUser.id;

    // Get auth tokens (mock for testing)
    adminToken = 'mock-admin-token';
    regularUserToken = 'mock-regular-token';
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUserId, regularUserId] },
      },
    });
    await app.close();
  });

  describe('Admin Dashboard', () => {
    describe('GET /admin/dashboard', () => {
      it('should return dashboard stats for admin user', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalUsers');
        expect(response.body).toHaveProperty('activeListings');
        expect(response.body).toHaveProperty('totalBookings');
        expect(response.body).toHaveProperty('totalRevenue');
        expect(response.body).toHaveProperty('pendingDisputes');
        expect(typeof response.body.totalUsers).toBe('number');
      });

      it('should deny access for non-admin users', async () => {
        await request(app.getHttpServer())
          .get('/admin/dashboard')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .get('/admin/dashboard')
          .expect(401);
      });
    });

    describe('GET /admin/analytics', () => {
      it('should return analytics data', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('userGrowth');
        expect(response.body).toHaveProperty('bookingTrends');
        expect(Array.isArray(response.body.userGrowth)).toBe(true);
      });

      it('should accept period parameter', async () => {
        await request(app.getHttpServer())
          .get('/admin/analytics?period=week')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should accept date range parameters', async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = new Date().toISOString();

        await request(app.getHttpServer())
          .get(`/admin/analytics?startDate=${startDate}&endDate=${endDate}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });
  });

  describe('User Management', () => {
    describe('GET /admin/users', () => {
      it('should return paginated user list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('limit');
        expect(Array.isArray(response.body.users)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users?page=1&limit=5')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(5);
      });

      it('should support search filter', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users?search=admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.users).toBeDefined();
      });

      it('should support role filter', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/users?role=ADMIN')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        response.body.users.forEach((user: any) => {
          expect(user.role).toBe('ADMIN');
        });
      });

      it('should support status filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/users?status=ACTIVE')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should support sorting', async () => {
        await request(app.getHttpServer())
          .get('/admin/users?sortBy=createdAt&sortOrder=desc')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('GET /admin/users/:id', () => {
      it('should return user details', async () => {
        const response = await request(app.getHttpServer())
          .get(`/admin/users/${regularUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.id).toBe(regularUserId);
        expect(response.body.email).toBe('regular-user-test@example.com');
      });

      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer())
          .get('/admin/users/non-existent-id')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });

    describe('PATCH /admin/users/:id/role', () => {
      it('should update user role', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/users/${regularUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'HOST' })
          .expect(200);

        expect(response.body.role).toBe('HOST');

        // Reset role
        await prisma.user.update({
          where: { id: regularUserId },
          data: { role: UserRole.USER },
        });
      });

      it('should reject invalid role', async () => {
        await request(app.getHttpServer())
          .patch(`/admin/users/${regularUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'INVALID_ROLE' })
          .expect(400);
      });
    });

    describe('POST /admin/users/:id/suspend', () => {
      it('should suspend user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${regularUserId}/suspend`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Test suspension' })
          .expect(200);

        expect(response.body.status).toBe('SUSPENDED');

        // Reset status
        await prisma.user.update({
          where: { id: regularUserId },
          data: { status: UserStatus.ACTIVE },
        });
      });
    });

    describe('POST /admin/users/:id/activate', () => {
      it('should activate suspended user', async () => {
        // First suspend the user
        await prisma.user.update({
          where: { id: regularUserId },
          data: { status: UserStatus.SUSPENDED },
        });

        const response = await request(app.getHttpServer())
          .post(`/admin/users/${regularUserId}/activate`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.status).toBe('ACTIVE');
      });
    });
  });

  describe('Listing Management', () => {
    let testListingId: string;

    beforeAll(async () => {
      // Create a test listing
      const listing = await prisma.property.create({
        data: {
          title: 'Admin Test Listing',
          slug: 'admin-test-listing',
          address: '456 Admin St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US',
          type: 'APARTMENT',
          basePrice: 150,
          ownerId: regularUserId,
          status: 'ACTIVE',
        },
      });
      testListingId = listing.id;
    });

    afterAll(async () => {
      await prisma.property.delete({ where: { id: testListingId } }).catch(() => {
        /* ignore */
      });
    });

    describe('GET /admin/listings', () => {
      it('should return paginated listing list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/listings')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('listings');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.listings)).toBe(true);
      });

      it('should support status filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/listings?status=ACTIVE')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should support search', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/listings?search=Admin%20Test')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.listings).toBeDefined();
      });
    });

    describe('GET /admin/listings/pending', () => {
      it('should return pending listings', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/listings/pending')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('listings');
      });
    });

    describe('PATCH /admin/listings/:id/status', () => {
      it('should update listing status', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/listings/${testListingId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'INACTIVE', reason: 'Test deactivation' })
          .expect(200);

        expect(response.body.status).toBe('INACTIVE');

        // Reset status
        await prisma.property.update({
          where: { id: testListingId },
          data: { status: 'ACTIVE' },
        });
      });
    });
  });

  describe('System Operations', () => {
    describe('GET /admin/system/health', () => {
      it('should return system health status', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/system/health')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('services');
        expect(response.body.services).toHaveProperty('database');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      });
    });

    describe('GET /admin/system/overview', () => {
      it('should return system overview', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/system/overview')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('environment');
        expect(response.body).toHaveProperty('uptime');
      });
    });

    describe('GET /admin/system/database', () => {
      it('should return database info', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/system/database')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('size');
        expect(response.body).toHaveProperty('tables');
        expect(response.body).toHaveProperty('connections');
        expect(Array.isArray(response.body.tables)).toBe(true);
      });
    });

    describe('GET /admin/system/logs', () => {
      it('should return system logs', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/system/logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('logs');
        expect(Array.isArray(response.body.logs)).toBe(true);
      });

      it('should support level filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/system/logs?level=error')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should support limit parameter', async () => {
        await request(app.getHttpServer())
          .get('/admin/system/logs?limit=50')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('GET /admin/system/audit', () => {
      it('should return audit logs', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/system/audit')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('logs');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
      });

      it('should support filtering by action', async () => {
        await request(app.getHttpServer())
          .get('/admin/system/audit?action=USER_LOGIN')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('GET /admin/system/backups', () => {
      it('should return backup list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/system/backups')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('backups');
        expect(Array.isArray(response.body.backups)).toBe(true);
      });
    });
  });

  describe('Payment Operations', () => {
    describe('GET /admin/payments', () => {
      it('should return payment list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/payments')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('payments');
        expect(response.body).toHaveProperty('total');
      });

      it('should support type filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/payments?type=BOOKING')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should support status filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/payments?status=COMPLETED')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('GET /admin/refunds', () => {
      it('should return refund list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/refunds')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('payments');
        expect(response.body).toHaveProperty('total');
      });
    });

    describe('GET /admin/payouts', () => {
      it('should return payout list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/payouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('payments');
        expect(response.body).toHaveProperty('total');
      });
    });
  });

  describe('Dispute Management', () => {
    describe('GET /admin/disputes', () => {
      it('should return dispute list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/disputes')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('disputes');
        expect(response.body).toHaveProperty('total');
      });

      it('should support status filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/disputes?status=OPEN')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should support type filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/disputes?type=DAMAGE')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });
  });

  describe('Review Management', () => {
    describe('GET /admin/reviews', () => {
      it('should return review list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/reviews')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('reviews');
        expect(response.body).toHaveProperty('total');
      });

      it('should support flagged filter', async () => {
        await request(app.getHttpServer())
          .get('/admin/reviews?flagged=true')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });
  });

  describe('Revenue & Analytics', () => {
    describe('GET /admin/revenue', () => {
      it('should return revenue report', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/revenue')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('platformFees');
        expect(response.body).toHaveProperty('ownerPayouts');
        expect(response.body).toHaveProperty('breakdown');
      });

      it('should support period parameter', async () => {
        await request(app.getHttpServer())
          .get('/admin/revenue?period=month')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('GET /admin/analytics/users', () => {
      it('should return user analytics', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/analytics/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalUsers');
        expect(response.body).toHaveProperty('activeUsers');
        expect(response.body).toHaveProperty('usersByRole');
      });
    });

    describe('GET /admin/analytics/business', () => {
      it('should return business analytics', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/analytics/business')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalListings');
        expect(response.body).toHaveProperty('activeListings');
        expect(response.body).toHaveProperty('bookingRate');
      });
    });

    describe('GET /admin/analytics/performance', () => {
      it('should return performance metrics', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/analytics/performance')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('avgResponseTime');
        expect(response.body).toHaveProperty('errorRate');
        expect(response.body).toHaveProperty('requestsPerMinute');
      });
    });
  });

  describe('Settings Management', () => {
    describe('GET /admin/settings/api-keys', () => {
      it('should return API keys list', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/settings/api-keys')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('keys');
        expect(Array.isArray(response.body.keys)).toBe(true);
      });
    });

    describe('GET /admin/settings/services', () => {
      it('should return service status', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/settings/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('services');
        expect(Array.isArray(response.body.services)).toBe(true);
      });
    });
  });
});
