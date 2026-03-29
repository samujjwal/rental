/**
 * TC-USER-002: RBAC Permission Enforcement
 * Comprehensive Role-Based Access Control Tests
 *
 * Validates that role restrictions are properly enforced
 * across all critical endpoints in the API.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole, BookingStatus, PropertyStatus, BookingMode } from '@rental-portal/database';
import { createUserWithRole, buildTestEmail, cleanupCoreRelationalData } from './e2e-helpers';

describe('RBAC Permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tokens for different roles
  let adminToken: string;
  let hostToken: string;
  let renterToken: string;
  let userToken: string;
  let unverifiedToken: string;

  // IDs
  let adminId: string;
  let hostId: string;
  let renterId: string;
  let userId: string;
  let unverifiedId: string;
  let listingId: string;
  let categoryId: string;
  let bookingId: string;
  let organizationId: string;

  const testEmails = {
    admin: buildTestEmail('rbac-admin'),
    host: buildTestEmail('rbac-host'),
    renter: buildTestEmail('rbac-renter'),
    user: buildTestEmail('rbac-user'),
    unverified: buildTestEmail('rbac-unverified'),
  };

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
    await cleanupCoreRelationalData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up previous test data
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: Object.values(testEmails) } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(testEmails) } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'rbac-test' } },
    });
    await prisma.organization.deleteMany({
      where: { name: { contains: 'RBAC Test' } },
    });

    // Create users with different roles
    const admin = await createUserWithRole({
      app,
      prisma,
      email: testEmails.admin,
      role: UserRole.ADMIN,
      password: 'TestPass123!',
      firstName: 'Admin',
      lastName: 'User',
    });
    adminToken = admin.accessToken;
    adminId = admin.userId;
    await prisma.user.update({
      where: { id: adminId },
      data: { emailVerified: true, status: 'ACTIVE' },
    });

    const host = await createUserWithRole({
      app,
      prisma,
      email: testEmails.host,
      role: UserRole.HOST,
      password: 'TestPass123!',
      firstName: 'Host',
      lastName: 'User',
    });
    hostToken = host.accessToken;
    hostId = host.userId;
    await prisma.user.update({
      where: { id: hostId },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        stripeConnectId: 'acct_test_host',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });

    const renter = await createUserWithRole({
      app,
      prisma,
      email: testEmails.renter,
      role: UserRole.USER,
      password: 'TestPass123!',
      firstName: 'Renter',
      lastName: 'User',
    });
    renterToken = renter.accessToken;
    renterId = renter.userId;
    await prisma.user.update({
      where: { id: renterId },
      data: { emailVerified: true, status: 'ACTIVE' },
    });

    const user = await createUserWithRole({
      app,
      prisma,
      email: testEmails.user,
      role: UserRole.USER,
      password: 'TestPass123!',
      firstName: 'Regular',
      lastName: 'User',
    });
    userToken = user.accessToken;
    userId = user.userId;
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, status: 'ACTIVE' },
    });

    const unverified = await createUserWithRole({
      app,
      prisma,
      email: testEmails.unverified,
      role: UserRole.USER,
      password: 'TestPass123!',
      firstName: 'Unverified',
      lastName: 'User',
    });
    unverifiedToken = unverified.accessToken;
    unverifiedId = unverified.userId;
    // Keep as PENDING_VERIFICATION

    // Create category and listing
    const category = await prisma.category.create({
      data: {
        name: 'RBAC Test Category',
        slug: `rbac-test-category-${Date.now()}`,
        description: 'Test category',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
        searchableFields: [],
        requiredFields: [],
      },
    });
    categoryId = category.id;

    const listing = await prisma.listing.create({
      data: {
        title: 'RBAC Test Listing',
        slug: `rbac-test-listing-${Date.now()}`,
        description: 'Test listing for RBAC',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
        type: 'APARTMENT',
        basePrice: 100,
        currency: 'USD',
        categoryId: category.id,
        ownerId: hostId,
        status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.REQUEST,
        instantBookable: false,
      },
    });
    listingId = listing.id;

    // Create booking
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3);

    const booking = await prisma.booking.create({
      data: {
        listingId: listing.id,
        renterId: renterId,
        ownerId: hostId,
        startDate,
        endDate,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        basePrice: 300,
        serviceFee: 30,
        totalPrice: 330,
        guestCount: 2,
        currency: 'USD',
      },
    });
    bookingId = booking.id;

    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: 'RBAC Test Organization',
        slug: `rbac-test-org-${Date.now()}`,
        ownerId: adminId,
      },
    });
    organizationId = org.id;

    await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: hostId,
        role: 'MEMBER',
      },
    });
  });

  describe('Admin-only endpoints', () => {
    it('should allow ADMIN to access admin dashboard', async () => {
      await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject HOST from admin dashboard (403)', async () => {
      await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(403);
    });

    it('should reject USER from admin dashboard (403)', async () => {
      await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow ADMIN to access user management', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject non-ADMIN from user management', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(403);
    });

    it('should allow ADMIN to modify any listing', async () => {
      await request(app.getHttpServer())
        .patch(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Modified Title' })
        .expect(200);
    });

    it('should allow ADMIN to delete any user', async () => {
      const testUser = await createUserWithRole({
        app,
        prisma,
        email: buildTestEmail('rbac-delete-target'),
        role: UserRole.USER,
        password: 'TestPass123!',
        firstName: 'Delete',
        lastName: 'Target',
      });

      await request(app.getHttpServer())
        .delete(`/admin/users/${testUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Host-only endpoints', () => {
    it('should allow HOST to create listings', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'New Host Listing',
          description: 'Created by host',
          categoryId: categoryId,
          address: '456 Host St',
          city: 'Host City',
          state: 'HC',
          zipCode: '54321',
          country: 'US',
          basePrice: 150,
          currency: 'USD',
          type: 'HOUSE',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject USER from creating listings (403)', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Unauthorized Listing',
          description: 'Should fail',
          categoryId: categoryId,
          address: '789 Fail St',
          city: 'Fail City',
          state: 'FC',
          zipCode: '99999',
          country: 'US',
          basePrice: 100,
          currency: 'USD',
          type: 'APARTMENT',
        })
        .expect(403);
    });

    it('should allow HOST to modify their own listing', async () => {
      await request(app.getHttpServer())
        .patch(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Host Modified Title' })
        .expect(200);
    });

    it('should reject HOST from modifying another hosts listing (403)', async () => {
      // Create another host and their listing
      const otherHost = await createUserWithRole({
        app,
        prisma,
        email: buildTestEmail('rbac-other-host'),
        role: UserRole.HOST,
        password: 'TestPass123!',
        firstName: 'Other',
        lastName: 'Host',
      });

      await prisma.user.update({
        where: { id: otherHost.userId },
        data: { emailVerified: true, status: 'ACTIVE' },
      });

      const otherListing = await prisma.listing.create({
        data: {
          title: 'Other Host Listing',
          slug: `rbac-other-listing-${Date.now()}`,
          description: 'Owned by other host',
          address: '999 Other St',
          city: 'Other City',
          state: 'OC',
          zipCode: '11111',
          country: 'US',
          type: 'APARTMENT',
          basePrice: 200,
          currency: 'USD',
          categoryId: categoryId,
          ownerId: otherHost.userId,
          status: PropertyStatus.AVAILABLE,
        },
      });

      await request(app.getHttpServer())
        .patch(`/listings/${otherListing.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Attempted Hijack' })
        .expect(403);
    });

    it('should allow HOST to approve booking for their listing', async () => {
      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ message: 'Approved!' })
        .expect(201);
    });

    it('should reject RENTER from approving booking (403)', async () => {
      // Create a new booking since previous was approved
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const newBooking = await prisma.booking.create({
        data: {
          listingId: listingId,
          renterId: renterId,
          ownerId: hostId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          serviceFee: 30,
          totalPrice: 330,
          guestCount: 2,
          currency: 'USD',
        },
      });

      await request(app.getHttpServer())
        .post(`/bookings/${newBooking.id}/approve`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ message: 'Trying to approve' })
        .expect(403);
    });

    it('should allow HOST to view their dashboard', async () => {
      await request(app.getHttpServer())
        .get('/host/dashboard')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
    });

    it('should reject USER from host dashboard (403)', async () => {
      await request(app.getHttpServer())
        .get('/host/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Renter permissions', () => {
    it('should allow USER to create bookings', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 21);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should allow RENTER to cancel their own booking', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 28);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          listingId: listingId,
          renterId: renterId,
          ownerId: hostId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          serviceFee: 30,
          totalPrice: 330,
          guestCount: 2,
          currency: 'USD',
        },
      });

      await request(app.getHttpServer())
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'Changed plans' })
        .expect(201);
    });

    it('should reject USER from canceling another users booking (403)', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 35);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          listingId: listingId,
          renterId: renterId,
          ownerId: hostId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          serviceFee: 30,
          totalPrice: 330,
          guestCount: 2,
          currency: 'USD',
        },
      });

      await request(app.getHttpServer())
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Trying to cancel' })
        .expect(403);
    });
  });

  describe('Email verification requirements', () => {
    it('should reject unverified user from creating listings (403)', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          title: 'Unverified Listing',
          description: 'Should fail',
          categoryId: categoryId,
          address: '111 Unverified St',
          city: 'Unverified',
          state: 'UV',
          zipCode: '00000',
          country: 'US',
          basePrice: 100,
          currency: 'USD',
          type: 'APARTMENT',
        })
        .expect(403);
    });

    it('should reject unverified user from creating bookings (403)', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 42);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(403);
    });

    it('should allow unverified user to access public endpoints (200)', async () => {
      await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect(200);
    });
  });

  describe('Organization permissions', () => {
    it('should allow organization member to access org resources', async () => {
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
    });

    it('should reject non-member from accessing org resources (403)', async () => {
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow org owner to add members', async () => {
      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: userId,
          role: 'MEMBER',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject non-owner from adding members (403)', async () => {
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          userId: userId,
          role: 'MEMBER',
        })
        .expect(403);
    });
  });

  describe('Resource ownership enforcement', () => {
    it('should allow user to view their own profile', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should allow user to update their own profile', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'UpdatedName' })
        .expect(200);
    });

    it('should allow admin to view any user profile', async () => {
      await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject user from viewing another users private data (403)', async () => {
      // This tests that regular users cannot access other users' private endpoints
      // Note: Some user data is public (like profiles), but private data should be protected
      await request(app.getHttpServer())
        .get(`/users/${adminId}/bookings`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Role hierarchy', () => {
    it('should enforce role hierarchy: ADMIN > HOST > USER', async () => {
      // ADMIN can do everything HOST can
      const adminListing = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Created Listing',
          description: 'Created by admin',
          categoryId: categoryId,
          address: '999 Admin St',
          city: 'Admin City',
          state: 'AC',
          zipCode: '99999',
          country: 'US',
          basePrice: 500,
          currency: 'USD',
          type: 'HOUSE',
        })
        .expect(201);

      expect(adminListing.body).toHaveProperty('id');

      // HOST cannot access admin endpoints
      await request(app.getHttpServer())
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(403);

      // USER cannot access HOST endpoints
      await request(app.getHttpServer())
        .get('/host/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Public endpoint access', () => {
    it('should allow unauthenticated access to public listings', async () => {
      await request(app.getHttpServer()).get('/listings').expect(200);
    });

    it('should allow unauthenticated access to categories', async () => {
      await request(app.getHttpServer()).get('/categories').expect(200);
    });

    it('should allow unauthenticated access to single listing', async () => {
      await request(app.getHttpServer()).get(`/listings/${listingId}`).expect(200);
    });

    it('should reject unauthenticated access to protected endpoints (401)', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });
  });
});
