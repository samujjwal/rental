import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

describe('Listings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let adminToken: string;
  let testListingId: string;
  let testCategoryId: string;

  const listingPayload = () => ({
    categoryId: testCategoryId,
    title: `E2E Listing ${Date.now()}`,
    description: 'A listing used for E2E stabilization',
    addressLine1: '10 Test Street',
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'US',
    latitude: 37.7749,
    longitude: -122.4194,
    pricingMode: 'DAILY',
    basePrice: 150,
    bookingMode: 'REQUEST',
    categorySpecificData: {},
    amenities: ['WiFi'],
    features: ['Fast setup'],
    rules: ['No smoking'],
  });

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
    await prisma.listing.deleteMany({
      where: {
        owner: {
          email: {
            in: ['owner-listings@test.com', 'renter-listings@test.com', 'admin-listings@test.com'],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['owner-listings@test.com', 'renter-listings@test.com', 'admin-listings@test.com'],
        },
      },
    });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: {
        owner: {
          email: {
            in: ['owner-listings@test.com', 'renter-listings@test.com', 'admin-listings@test.com'],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['owner-listings@test.com', 'renter-listings@test.com', 'admin-listings@test.com'],
        },
      },
    });

    const owner = await createUserWithRole({
      app,
      prisma,
      email: 'owner-listings@test.com',
      password: 'Password123!',
      firstName: 'Owner',
      lastName: 'User',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;

    const renter = await createUserWithRole({
      app,
      prisma,
      email: 'renter-listings@test.com',
      password: 'Password123!',
      firstName: 'Renter',
      lastName: 'User',
      role: UserRole.USER,
    });
    renterToken = renter.accessToken;

    const admin = await createUserWithRole({
      app,
      prisma,
      email: 'admin-listings@test.com',
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;

    const category = await prisma.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!category?.id) {
      throw new Error('No active category available for listings e2e');
    }
    testCategoryId = category.id;
    testListingId = '';
  });

  describe('POST /listings', () => {
    it('should create a listing as owner', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload())
        .expect(201);

      testListingId = response.body.id;

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('DRAFT');
      expect(response.body.title).toContain('E2E Listing');
    });

    it('should reject unauthenticated create requests', async () => {
      await request(app.getHttpServer()).post('/listings').send(listingPayload()).expect(401);
    });
  });

  describe('GET /listings', () => {
    it('should return paginated listing payload', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload())
        .expect(201);

      const response = await request(app.getHttpServer()).get('/listings?page=1&limit=10').expect(200);

      expect(Array.isArray(response.body.listings)).toBe(true);
      expect(typeof response.body.total).toBe('number');
    });
  });

  describe('GET /listings/my-listings', () => {
    it('should return owner listings', async () => {
      const created = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload())
        .expect(201);
      testListingId = created.body.id;

      const response = await request(app.getHttpServer())
        .get('/listings/my-listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((listing: any) => listing.id === testListingId)).toBe(true);
    });
  });

  describe('PATCH /listings/:id', () => {
    it('should allow owner update', async () => {
      const created = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload())
        .expect(201);
      testListingId = created.body.id;

      const response = await request(app.getHttpServer())
        .patch(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Updated Listing Title' })
        .expect(200);

      expect(response.body.title).toBe('Updated Listing Title');
    });

    it('should reject update by non-owner', async () => {
      const created = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload())
        .expect(201);
      testListingId = created.body.id;

      await request(app.getHttpServer())
        .patch(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ title: 'Unauthorized update' })
        .expect(403);
    });

    it('should reject admin update when not owner', async () => {
      const created = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload())
        .expect(201);
      testListingId = created.body.id;

      await request(app.getHttpServer())
        .patch(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Updated Listing' })
        .expect(403);
    });
  });
});
