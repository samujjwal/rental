import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingMode, PropertyStatus, UserRole, VerificationStatus } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole, registerUser } from './e2e-helpers';

const adminEmail = buildTestEmail('search-admin');
const ownerEmail = buildTestEmail('search-owner');
const userEmail = buildTestEmail('search-user');

describe('Search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let listing1Id: string;
  let listing2Id: string;
  let uniqueSearchKeyword: string;

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
    await prisma.listing.deleteMany({ where: { slug: { contains: 'search-stabilized-' } } });
    await prisma.category.deleteMany({ where: { slug: { contains: 'search-stabilized-' } } });
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, ownerEmail, userEmail] } } });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { slug: { contains: 'search-stabilized-' } } });
    await prisma.category.deleteMany({ where: { slug: { contains: 'search-stabilized-' } } });
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, ownerEmail, userEmail] } } });

    const admin = await createUserWithRole({
      app,
      prisma,
      email: adminEmail,
      firstName: 'Admin',
      lastName: 'Search',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;

    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Owner',
      lastName: 'Search',
      role: UserRole.HOST,
    });

    const category = await prisma.category.create({
      data: {
        name: 'Search Stabilized Category',
        slug: `search-stabilized-${Date.now()}`,
        description: 'Search test category',
        icon: 'search',
        isActive: true,
        templateSchema: '{}',
      },
    });
    uniqueSearchKeyword = `stabilized-ultra-camera-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const listing1 = await prisma.listing.create({
      data: {
        ownerId: owner.userId,
        categoryId: category.id,
        title: 'Stabilized Ultra Camera',
        description: `Unique search keyword: ${uniqueSearchKeyword}`,
        slug: `search-stabilized-camera-${Date.now()}`,
        address: '100 Search Ave',
        basePrice: 12000,
        currency: 'USD',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        type: 'APARTMENT',
        latitude: 40.7128,
        longitude: -74.006,
        status: PropertyStatus.AVAILABLE,
        verificationStatus: VerificationStatus.VERIFIED,
        bookingMode: BookingMode.REQUEST,
        condition: 'EXCELLENT',
      },
    });
    listing1Id = listing1.id;

    const listing2 = await prisma.listing.create({
      data: {
        ownerId: owner.userId,
        categoryId: category.id,
        title: 'Stabilized Budget Tent',
        description: 'Unique search keyword: stabilized-budget-tent',
        slug: `search-stabilized-tent-${Date.now()}`,
        address: '101 Search Ave',
        basePrice: 3000,
        currency: 'USD',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        country: 'US',
        type: 'APARTMENT',
        latitude: 34.0522,
        longitude: -118.2437,
        status: PropertyStatus.AVAILABLE,
        verificationStatus: VerificationStatus.VERIFIED,
        bookingMode: BookingMode.INSTANT_BOOK,
        condition: 'GOOD',
      },
    });
    listing2Id = listing2.id;
  });

  describe('GET /search', () => {
    it('should return results payload and find unique query match', async () => {
      const response = await request(app.getHttpServer())
        .get('/search')
        .query({ query: uniqueSearchKeyword })
        .expect(200);

      expect(Array.isArray(response.body.results)).toBe(true);
      expect(typeof response.body.total).toBe('number');
      expect(response.body.results.some((listing: any) => listing.id === listing1Id)).toBe(true);
    });

    it('should accept bookingMode filter values without internal errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/search')
        .query({ query: 'stabilized', bookingMode: 'INSTANT' })
        .expect(200);

      expect(Array.isArray(response.body.results)).toBe(true);
    });
  });

  describe('Search helper endpoints', () => {
    it('should return autocomplete suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'stabilized' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return suggestions payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/suggestions')
        .query({ q: 'stabilized' })
        .expect(200);

      expect(response.body).toHaveProperty('listings');
      expect(response.body).toHaveProperty('categories');
    });

    it('should return similar listings payload', async () => {
      const response = await request(app.getHttpServer())
        .get(`/search/similar/${listing1Id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return popular searches payload', async () => {
      const response = await request(app.getHttpServer()).get('/search/popular').expect(200);
      expect(Array.isArray(response.body.searches)).toBe(true);
    });
  });

  describe('Admin search endpoints', () => {
    it('should allow admin access to search stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject non-admin users', async () => {
      const user = await createUserWithRole({
        app,
        prisma,
        email: userEmail,
        firstName: 'Regular',
        lastName: 'User',
      });

      await request(app.getHttpServer())
        .get('/search/stats')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);
    });
  });
});
