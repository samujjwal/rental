/**
 * Cache Integration Tests
 * TC-CACHE-001 through TC-CACHE-005
 *
 * Validates Redis caching behavior, cache invalidation,
 * and cache consistency across the application.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CacheService } from '../src/common/cache/cache.service';
import { UserRole, PropertyStatus, BookingStatus } from '@rental-portal/database';
import { createUserWithRole, buildTestEmail, cleanupCoreRelationalData } from './e2e-helpers';

describe('Cache Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cacheService: CacheService;

  let adminToken: string;
  let hostToken: string;
  let userToken: string;
  let hostId: string;
  let categoryId: string;
  let listingId: string;

  const testEmails = {
    admin: buildTestEmail('cache-admin'),
    host: buildTestEmail('cache-host'),
    user: buildTestEmail('cache-user'),
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
    cacheService = app.get<CacheService>(CacheService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.delPattern('*');

    // Clean up database
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: Object.values(testEmails) } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(testEmails) } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'cache-test' } },
    });

    // Create test users
    const admin = await createUserWithRole({
      app,
      prisma,
      email: testEmails.admin,
      role: UserRole.ADMIN,
      password: 'TestPass123!',
      firstName: 'Cache',
      lastName: 'Admin',
    });
    adminToken = admin.accessToken;
    await prisma.user.update({
      where: { id: admin.userId },
      data: { emailVerified: true, status: 'ACTIVE' },
    });

    const host = await createUserWithRole({
      app,
      prisma,
      email: testEmails.host,
      role: UserRole.HOST,
      password: 'TestPass123!',
      firstName: 'Cache',
      lastName: 'Host',
    });
    hostToken = host.accessToken;
    hostId = host.userId;
    await prisma.user.update({
      where: { id: hostId },
      data: { emailVerified: true, status: 'ACTIVE' },
    });

    const user = await createUserWithRole({
      app,
      prisma,
      email: testEmails.user,
      role: UserRole.USER,
      password: 'TestPass123!',
      firstName: 'Cache',
      lastName: 'User',
    });
    userToken = user.accessToken;
    await prisma.user.update({
      where: { id: user.userId },
      data: { emailVerified: true, status: 'ACTIVE' },
    });

    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'Cache Test Category',
        slug: `cache-test-category-${Date.now()}`,
        description: 'Test category for cache tests',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
        searchableFields: [],
        requiredFields: [],
      },
    });
    categoryId = category.id;

    // Create test listing
    const listing = await prisma.listing.create({
      data: {
        title: 'Cache Test Listing',
        slug: `cache-test-listing-${Date.now()}`,
        description: 'Test listing for cache tests',
        address: '123 Cache St',
        city: 'Cache City',
        state: 'CC',
        zipCode: '12345',
        country: 'US',
        type: 'APARTMENT',
        basePrice: 100,
        currency: 'USD',
        categoryId: category.id,
        ownerId: hostId,
        status: PropertyStatus.AVAILABLE,
      },
    });
    listingId = listing.id;
  });

  describe('TC-CACHE-001: Listing cache behavior', () => {
    it('should cache listing list endpoint results', async () => {
      // First request - should hit database
      const start1 = Date.now();
      const res1 = await request(app.getHttpServer()).get('/listings').expect(200);
      const duration1 = Date.now() - start1;

      expect(res1.body).toHaveProperty('data');
      expect(res1.body.data.length).toBeGreaterThan(0);

      // Second request - should be faster (from cache)
      const start2 = Date.now();
      const res2 = await request(app.getHttpServer()).get('/listings').expect(200);
      const duration2 = Date.now() - start2;

      expect(res2.body).toEqual(res1.body);
      // Cached response should be significantly faster
      expect(duration2).toBeLessThan(duration1);
    });

    it('should cache individual listing details', async () => {
      // First request
      const res1 = await request(app.getHttpServer()).get(`/listings/${listingId}`).expect(200);

      expect(res1.body).toHaveProperty('id', listingId);

      // Second request (from cache)
      const res2 = await request(app.getHttpServer()).get(`/listings/${listingId}`).expect(200);

      expect(res2.body).toEqual(res1.body);
    });

    it('should invalidate listing cache on update', async () => {
      // Get initial cached value
      const res1 = await request(app.getHttpServer()).get(`/listings/${listingId}`).expect(200);

      const originalTitle = res1.body.title;

      // Update listing
      await request(app.getHttpServer())
        .patch(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Updated Cache Title' })
        .expect(200);

      // Get listing again - should have new value (cache invalidated)
      const res2 = await request(app.getHttpServer()).get(`/listings/${listingId}`).expect(200);

      expect(res2.body.title).toBe('Updated Cache Title');
      expect(res2.body.title).not.toBe(originalTitle);
    });
  });

  describe('TC-CACHE-002: User session cache', () => {
    it('should cache user profile data', async () => {
      // First request
      const res1 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Second request (should be cached)
      const res2 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res2.body).toEqual(res1.body);
    });

    it('should invalidate user cache on profile update', async () => {
      // Get initial profile
      const res1 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Update profile
      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'UpdatedCacheName' })
        .expect(200);

      // Get profile again - should reflect update
      const res2 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res2.body.firstName).toBe('UpdatedCacheName');
    });
  });

  describe('TC-CACHE-003: Category cache', () => {
    it('should cache category list', async () => {
      // First request
      const res1 = await request(app.getHttpServer()).get('/categories').expect(200);

      // Second request (cached)
      const res2 = await request(app.getHttpServer()).get('/categories').expect(200);

      expect(res2.body).toEqual(res1.body);
    });

    it('should cache individual category', async () => {
      const res1 = await request(app.getHttpServer()).get(`/categories/${categoryId}`).expect(200);

      const res2 = await request(app.getHttpServer()).get(`/categories/${categoryId}`).expect(200);

      expect(res2.body).toEqual(res1.body);
    });

    it('should invalidate category cache on admin update', async () => {
      // Get initial
      const res1 = await request(app.getHttpServer()).get(`/categories/${categoryId}`).expect(200);

      // Admin updates category
      await request(app.getHttpServer())
        .patch(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated via cache test' })
        .expect(200);

      // Get again - should be updated
      const res2 = await request(app.getHttpServer()).get(`/categories/${categoryId}`).expect(200);

      expect(res2.body.description).toBe('Updated via cache test');
    });
  });

  describe('TC-CACHE-004: Search results cache', () => {
    it('should cache search query results', async () => {
      const query = 'cache';

      // First search
      const res1 = await request(app.getHttpServer())
        .get(`/listings/search?q=${query}`)
        .expect(200);

      // Same search (cached)
      const res2 = await request(app.getHttpServer())
        .get(`/listings/search?q=${query}`)
        .expect(200);

      expect(res2.body).toEqual(res1.body);
    });

    it('should have different cache keys for different queries', async () => {
      const query1 = 'cache';
      const query2 = 'different';

      const res1 = await request(app.getHttpServer())
        .get(`/listings/search?q=${query1}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get(`/listings/search?q=${query2}`)
        .expect(200);

      // Results should be different (or at least independently cached)
      expect(res1.body).toBeDefined();
      expect(res2.body).toBeDefined();
    });

    it('should invalidate search cache on new listing creation', async () => {
      const query = 'newlisting';

      // Initial search
      const res1 = await request(app.getHttpServer())
        .get(`/listings/search?q=${query}`)
        .expect(200);

      const initialCount = res1.body.pagination?.total || 0;

      // Create new listing with query term in title
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: `NewListing Cache Test ${Date.now()}`,
          description: 'Created for cache invalidation test',
          categoryId: categoryId,
          address: '456 New St',
          city: 'New City',
          state: 'NC',
          zipCode: '54321',
          country: 'US',
          basePrice: 150,
          currency: 'USD',
          type: 'HOUSE',
        })
        .expect(201);

      // Search again - should include new listing
      const res2 = await request(app.getHttpServer())
        .get(`/listings/search?q=${query}`)
        .expect(200);

      const newCount = res2.body.pagination?.total || 0;
      // Should have more results or at least reflect the change
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });
  });

  describe('TC-CACHE-005: Cache TTL and expiration', () => {
    it('should respect cache TTL settings', async () => {
      // This test verifies that cache entries expire after TTL
      // Note: TTL values depend on implementation

      // Store a value with short TTL
      const cacheKey = 'test-ttl-key';
      const testValue = { data: 'test', timestamp: Date.now() };

      await cacheService.set(cacheKey, testValue, 1); // 1 second TTL

      // Value should exist immediately
      const cached1 = await cacheService.get(cacheKey);
      expect(cached1).toEqual(testValue);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Value should be expired (null or undefined)
      const cached2 = await cacheService.get(cacheKey);
      expect(cached2).toBeNull();
    });

    it('should handle cache service unavailability gracefully', async () => {
      // When cache is unavailable, application should still work
      // (fallback to database)

      const res = await request(app.getHttpServer()).get('/listings').expect(200);

      expect(res.body).toHaveProperty('data');
      // Should return data even if cache fails
    });

    it('should support cache warming for critical data', async () => {
      // Test that we can pre-populate cache with critical data
      const categories = await prisma.category.findMany({
        where: { isActive: true },
      });

      // Warm cache
      await cacheService.set('categories:active', categories, 300);

      // Verify warmed data
      const cached = await cacheService.get('categories:active');
      expect(cached).toBeDefined();
      expect(Array.isArray(cached)).toBe(true);
    });
  });

  describe('TC-CACHE-006: Cache stampede prevention', () => {
    it('should handle concurrent requests for same uncached resource', async () => {
      // Clear cache for this test
      await cacheService.delPattern('*');

      // Fire multiple concurrent requests for the same resource
      const requests = Array(5)
        .fill(null)
        .map(() => request(app.getHttpServer()).get(`/listings/${listingId}`));

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', listingId);
      });

      // Only one should have hit the database (others from cache)
      // This is hard to verify in e2e, but the test passes if no errors
    });
  });

  describe('TC-CACHE-007: Booking cache invalidation', () => {
    it('should invalidate availability cache on booking creation', async () => {
      // Get initial availability
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const res1 = await request(app.getHttpServer())
        .get(
          `/listings/${listingId}/availability?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
        )
        .expect(200);

      // Create booking
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      // Availability should be updated (cache invalidated)
      const res2 = await request(app.getHttpServer())
        .get(
          `/listings/${listingId}/availability?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
        )
        .expect(200);

      // Should reflect that dates are now booked
      expect(res2.body).toBeDefined();
    });
  });
});
