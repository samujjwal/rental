import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingMode, PropertyStatus, UserRole } from '@rental-portal/database';
import { createUserWithRole } from './e2e-helpers';

describe('Insurance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let adminToken: string;
  let ownerId: string;
  let listingId: string;

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
    await prisma.insurancePolicy.deleteMany({
      where: { user: { email: { in: ['insurance-owner@test.com', 'insurance-admin@test.com'] } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: ['insurance-owner@test.com', 'insurance-admin@test.com'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['insurance-owner@test.com', 'insurance-admin@test.com'] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.insurancePolicy.deleteMany({
      where: { user: { email: { in: ['insurance-owner@test.com', 'insurance-admin@test.com'] } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: ['insurance-owner@test.com', 'insurance-admin@test.com'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['insurance-owner@test.com', 'insurance-admin@test.com'] } },
    });

    const owner = await createUserWithRole({
      app,
      prisma,
      email: 'insurance-owner@test.com',
      password: 'TestPass123!',
      firstName: 'Insurance',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;
    ownerId = owner.userId;

    const admin = await createUserWithRole({
      app,
      prisma,
      email: 'insurance-admin@test.com',
      password: 'TestPass123!',
      firstName: 'Insurance',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;

    const category = await prisma.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!category?.id) {
      throw new Error('No active category found for insurance e2e');
    }

    const listing = await prisma.listing.create({
      data: {
        ownerId,
        categoryId: category.id,
        title: 'Insurance Test Listing',
        description: 'Listing used for insurance flow tests',
        slug: `insurance-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        address: '123 Insurance Ave',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
        type: 'APARTMENT',
        basePrice: 1200,
        currency: 'USD',
        latitude: 37.7749,
        longitude: -122.4194,
        status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.INSTANT_BOOK,
      },
    });
    listingId = listing.id;
  });

  describe('GET /insurance/listings/:id/requirement', () => {
    it('should return listing insurance requirement', async () => {
      const response = await request(app.getHttpServer())
        .get(`/insurance/listings/${listingId}/requirement`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('required');
      expect(response.body).toHaveProperty('minimumCoverage');
      expect(response.body).toHaveProperty('type');
    });
  });

  describe('POST /insurance/policies', () => {
    it('should upload policy for listing owner', async () => {
      const response = await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          listingId,
          policyNumber: `POL-${Date.now()}`,
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 20000,
          effectiveDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('ACTIVE');
    });
  });

  describe('GET /insurance/listings/:id/status', () => {
    it('should return valid insurance after policy upload', async () => {
      await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          listingId,
          policyNumber: `POL-STATUS-${Date.now()}`,
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 20000,
          effectiveDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
          documentUrl: 'https://example.com/policy-status.pdf',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/insurance/listings/${listingId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.hasValidInsurance).toBe(true);
    });
  });

  describe('PUT /insurance/policies/:policyId/verify', () => {
    it('should allow admin to verify policy', async () => {
      const policy = await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          listingId,
          policyNumber: `POL-VERIFY-${Date.now()}`,
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 20000,
          effectiveDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
          documentUrl: 'https://example.com/policy-verify.pdf',
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/insurance/policies/${policy.body.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true, notes: 'Verified in e2e' })
        .expect(200);
    });

    it('should reject non-admin verification attempts', async () => {
      const policy = await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          listingId,
          policyNumber: `POL-NONADMIN-${Date.now()}`,
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 20000,
          effectiveDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
          documentUrl: 'https://example.com/policy-nonadmin.pdf',
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/insurance/policies/${policy.body.id}/verify`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ approved: true })
        .expect(403);
    });
  });
});
