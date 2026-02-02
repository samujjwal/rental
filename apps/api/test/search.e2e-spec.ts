import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ListingStatus, UserRole, BookingMode } from '@rental-portal/database';

/**
 * Search E2E Tests
 *
 * Tests search functionality including:
 * - Full-text search
 * - Geo-spatial search
 * - Filtering and facets
 * - Autocomplete
 * - Similar listings
 */
describe('Search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let categoryId: string;
  let listing1Id: string;
  let listing2Id: string;
  let listing3Id: string;

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
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.listing.deleteMany({
      where: { slug: { contains: 'search-test' } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'search-test' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@searchtest.com' } },
    });

    // Create admin user
    const adminRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'admin@searchtest.com',
      password: 'SecurePass123!',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567890',
      role: UserRole.ADMIN,
    });
    adminToken = adminRes.body.tokens.accessToken;

    // Create owner
    const ownerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'owner@searchtest.com',
      password: 'SecurePass123!',
      firstName: 'Owner',
      lastName: 'User',
      phone: '+1234567891',
      role: UserRole.HOST,
    });
    const ownerId = ownerRes.body.user.id;

    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'Search Test Category',
        slug: 'search-test-category',
        description: 'Test category for search',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
      },
    });
    categoryId = category.id;

    // Create test listings with different characteristics
    const listing1 = await prisma.listing.create({
      data: {
        ownerId,
        categoryId,
        title: 'Luxury Camera Equipment',
        description: 'Professional DSLR camera with lens kit. Perfect for photography enthusiasts.',
        slug: 'search-test-camera-luxury',
        basePrice: 15000, // $150.00
        currency: 'USD',
        city: 'New York',
        state: 'NY',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        status: ListingStatus.ACTIVE,
        bookingMode: BookingMode.REQUEST,
        minRentalDays: 1,
        maxRentalDays: 7,
        condition: 'EXCELLENT',
        depositAmount: 5000,
        details: {
          features: ['professional', 'full-frame', 'weather-sealed'],
          brand: 'Canon',
        },
      },
    });
    listing1Id = listing1.id;

    const listing2 = await prisma.listing.create({
      data: {
        ownerId,
        categoryId,
        title: 'Budget Camping Tent',
        description: 'Affordable camping tent for 2-3 people. Great for weekend trips.',
        slug: 'search-test-tent-budget',
        basePrice: 3000, // $30.00
        currency: 'USD',
        city: 'Los Angeles',
        state: 'CA',
        country: 'US',
        latitude: 34.0522,
        longitude: -118.2437,
        status: ListingStatus.ACTIVE,
        bookingMode: BookingMode.INSTANT_BOOK,
        minRentalDays: 2,
        maxRentalDays: 14,
        condition: 'GOOD',
        instantBooking: true,
        details: {
          features: ['waterproof', 'lightweight'],
          capacity: 3,
        },
      },
    });
    listing2Id = listing2.id;

    const listing3 = await prisma.listing.create({
      data: {
        ownerId,
        categoryId,
        title: 'Professional Video Camera',
        description: 'High-end video camera for filmmaking and content creation.',
        slug: 'search-test-video-camera',
        basePrice: 25000, // $250.00
        currency: 'USD',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        latitude: 37.7749,
        longitude: -122.4194,
        status: ListingStatus.ACTIVE,
        bookingMode: BookingMode.REQUEST,
        minRentalDays: 1,
        maxRentalDays: 30,
        condition: 'EXCELLENT',
        depositAmount: 10000,
        details: {
          features: ['4k', 'professional', 'stabilized'],
          brand: 'Sony',
        },
      },
    });
    listing3Id = listing3.id;

    // Wait for indexing
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('GET /api/search - Basic search', () => {
    it('should search listings by keyword', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ query: 'camera' })
        .expect(200);

      expect(response.body).toHaveProperty('hits');
      expect(Array.isArray(response.body.hits)).toBe(true);
      expect(response.body.hits.length).toBeGreaterThan(0);

      // Should find both camera listings
      const cameraTitles = response.body.hits.filter((hit: any) =>
        hit.title.toLowerCase().includes('camera'),
      );
      expect(cameraTitles.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty results for non-matching query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ query: 'nonexistent-item-xyz' })
        .expect(200);

      expect(response.body.hits.length).toBe(0);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ page: 1, size: 2 })
        .expect(200);

      expect(response.body).toHaveProperty('hits');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('size');
      expect(response.body.hits.length).toBeLessThanOrEqual(2);
    });

    it('should return all listings when no query provided', async () => {
      const response = await request(app.getHttpServer()).get('/api/search').expect(200);

      expect(response.body.hits.length).toBe(3);
    });
  });

  describe('GET /api/search - Filtering', () => {
    it('should filter by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ categoryId })
        .expect(200);

      expect(response.body.hits.length).toBe(3);
      response.body.hits.forEach((hit: any) => {
        expect(hit.categoryId).toBe(categoryId);
      });
    });

    it('should filter by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ minPrice: 5000, maxPrice: 20000 })
        .expect(200);

      expect(response.body.hits.length).toBeGreaterThan(0);
      response.body.hits.forEach((hit: any) => {
        expect(hit.basePrice).toBeGreaterThanOrEqual(5000);
        expect(hit.basePrice).toBeLessThanOrEqual(20000);
      });

      // Should find the camera equipment listing
      const luxuryCam = response.body.hits.find((h: any) => h.id === listing1Id);
      expect(luxuryCam).toBeDefined();

      // Should NOT find the professional video camera
      const videoCam = response.body.hits.find((h: any) => h.id === listing3Id);
      expect(videoCam).toBeUndefined();
    });

    it('should filter by booking mode', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ bookingMode: 'INSTANT' })
        .expect(200);

      expect(response.body.hits.length).toBeGreaterThan(0);
      response.body.hits.forEach((hit: any) => {
        expect(hit.instantBooking).toBe(true);
      });

      // Should only find the camping tent
      expect(response.body.hits.length).toBe(1);
      expect(response.body.hits[0].id).toBe(listing2Id);
    });

    it('should filter by condition', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ condition: 'EXCELLENT' })
        .expect(200);

      expect(response.body.hits.length).toBeGreaterThan(0);
      response.body.hits.forEach((hit: any) => {
        expect(hit.condition).toBe('EXCELLENT');
      });

      // Should find both camera listings
      expect(response.body.hits.length).toBe(2);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({
          query: 'camera',
          minPrice: 10000,
          maxPrice: 20000,
          condition: 'EXCELLENT',
        })
        .expect(200);

      expect(response.body.hits.length).toBeGreaterThan(0);

      // Should only find the luxury camera
      expect(response.body.hits.length).toBe(1);
      expect(response.body.hits[0].id).toBe(listing1Id);
    });
  });

  describe('GET /api/search - Geo-spatial search', () => {
    it('should find listings near New York', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({
          lat: 40.7128,
          lon: -74.006,
          radius: '50km',
        })
        .expect(200);

      expect(response.body.hits.length).toBeGreaterThan(0);

      // Should find the camera equipment (in New York)
      const nyListing = response.body.hits.find((h: any) => h.id === listing1Id);
      expect(nyListing).toBeDefined();
    });

    it('should not find distant listings with small radius', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({
          lat: 40.7128,
          lon: -74.006,
          radius: '10km',
        })
        .expect(200);

      // Should find New York listing but not California listings
      const caListings = response.body.hits.filter(
        (h: any) => h.id === listing2Id || h.id === listing3Id,
      );
      expect(caListings.length).toBe(0);
    });

    it('should sort by distance when location provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({
          lat: 34.0522,
          lon: -118.2437,
          radius: '5000km',
        })
        .expect(200);

      expect(response.body.hits.length).toBe(3);

      // First result should be closest (Los Angeles tent)
      expect(response.body.hits[0].id).toBe(listing2Id);
    });
  });

  describe('GET /api/search - Sorting', () => {
    it('should sort by price ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ sort: 'price_asc' })
        .expect(200);

      expect(response.body.hits.length).toBe(3);

      // First should be cheapest (camping tent)
      expect(response.body.hits[0].id).toBe(listing2Id);

      // Last should be most expensive (video camera)
      expect(response.body.hits[2].id).toBe(listing3Id);
    });

    it('should sort by price descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ sort: 'price_desc' })
        .expect(200);

      expect(response.body.hits.length).toBe(3);

      // First should be most expensive (video camera)
      expect(response.body.hits[0].id).toBe(listing3Id);

      // Last should be cheapest (camping tent)
      expect(response.body.hits[2].id).toBe(listing2Id);
    });

    it('should sort by newest', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ sort: 'newest' })
        .expect(200);

      expect(response.body.hits.length).toBe(3);

      // Most recently created should be first
      const firstDate = new Date(response.body.hits[0].createdAt);
      const lastDate = new Date(response.body.hits[2].createdAt);
      expect(firstDate.getTime()).toBeGreaterThanOrEqual(lastDate.getTime());
    });
  });

  describe('POST /api/search/advanced - Advanced search', () => {
    it('should handle complex search query', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/search/advanced')
        .send({
          query: 'camera',
          categoryId,
          priceRange: { min: 10000, max: 30000 },
          location: {
            lat: 40.7128,
            lon: -74.006,
            radius: '1000km',
          },
          filters: {
            condition: 'EXCELLENT',
            features: ['professional'],
          },
          sort: 'price_asc',
          page: 1,
          size: 10,
        })
        .expect(200);

      expect(response.body).toHaveProperty('hits');
      expect(response.body.hits.length).toBeGreaterThan(0);

      // Should find camera equipment
      const cameraListing = response.body.hits.find((h: any) => h.id === listing1Id);
      expect(cameraListing).toBeDefined();
    });
  });

  describe('GET /api/search/autocomplete - Autocomplete', () => {
    it('should provide autocomplete suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/autocomplete')
        .query({ q: 'cam' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Should include camera-related suggestions
      const suggestions = response.body.map((s: any) => s.toLowerCase());
      expect(suggestions.some((s: string) => s.includes('camera'))).toBe(true);
    });

    it('should limit autocomplete results', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/autocomplete')
        .query({ q: 'c', limit: 5 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });

    it('should handle short queries', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/autocomplete')
        .query({ q: 'ca' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/search/suggestions - Search suggestions', () => {
    it('should provide comprehensive suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/suggestions')
        .query({ q: 'camera' })
        .expect(200);

      expect(response.body).toHaveProperty('listings');
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('locations');

      // Should find camera listings
      expect(response.body.listings.length).toBeGreaterThan(0);
    });

    it('should include category suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/suggestions')
        .query({ q: 'test' })
        .expect(200);

      expect(response.body.categories.length).toBeGreaterThan(0);
    });

    it('should include location suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/suggestions')
        .query({ q: 'new york' })
        .expect(200);

      expect(response.body.locations.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/search/similar/:listingId - Similar listings', () => {
    it('should find similar listings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/search/similar/${listing1Id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Should find the video camera (similar to luxury camera)
      const similarListing = response.body.find((l: any) => l.id === listing3Id);
      expect(similarListing).toBeDefined();

      // Should NOT include the original listing
      const originalListing = response.body.find((l: any) => l.id === listing1Id);
      expect(originalListing).toBeUndefined();
    });

    it('should limit similar listings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/search/similar/${listing1Id}`)
        .query({ limit: 1 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should return empty for non-existent listing', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/similar/non-existent-id')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/search/popular - Popular searches', () => {
    it('should retrieve popular searches', async () => {
      // Perform some searches to populate popular searches
      await request(app.getHttpServer()).get('/api/search').query({ query: 'camera' });

      await request(app.getHttpServer()).get('/api/search').query({ query: 'camera' });

      await request(app.getHttpServer()).get('/api/search').query({ query: 'tent' });

      const response = await request(app.getHttpServer()).get('/api/search/popular').expect(200);

      expect(response.body).toHaveProperty('searches');
      expect(Array.isArray(response.body.searches)).toBe(true);
    });

    it('should limit popular searches', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/popular')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.searches.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Admin search management', () => {
    describe('POST /api/search/index/listing/:listingId', () => {
      it('should index listing as admin', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/search/index/listing/${listing1Id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('message');
      });

      it('should reject non-admin users', async () => {
        // Create regular user
        const userRes = await request(app.getHttpServer()).post('/api/auth/register').send({
          email: 'user@searchtest.com',
          password: 'SecurePass123!',
          firstName: 'Regular',
          lastName: 'User',
          phone: '+1234567892',
          role: UserRole.USER,
        });
        const userToken = userRes.body.tokens.accessToken;

        await request(app.getHttpServer())
          .post(`/api/search/index/listing/${listing1Id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .post(`/api/search/index/listing/${listing1Id}`)
          .expect(401);
      });
    });

    describe('DELETE /api/search/index/listing/:listingId', () => {
      it('should remove listing from index as admin', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/api/search/index/listing/${listing1Id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Wait for index update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify listing not in search results
        const searchRes = await request(app.getHttpServer())
          .get('/api/search')
          .query({ query: 'Luxury Camera Equipment' });

        const removedListing = searchRes.body.hits.find((h: any) => h.id === listing1Id);
        expect(removedListing).toBeUndefined();
      });
    });
  });

  describe('Search performance and edge cases', () => {
    it('should handle special characters in query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ query: 'camera @#$%' })
        .expect(200);

      expect(response.body).toHaveProperty('hits');
    });

    it('should handle very long queries', async () => {
      const longQuery = 'camera '.repeat(100);
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ query: longQuery })
        .expect(200);

      expect(response.body).toHaveProperty('hits');
    });

    it('should handle negative price ranges gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ minPrice: -1000, maxPrice: 5000 })
        .expect(200);

      expect(response.body).toHaveProperty('hits');
    });

    it('should handle invalid coordinates gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search')
        .query({ lat: 999, lon: 999, radius: '10km' })
        .expect(200);

      expect(response.body).toHaveProperty('hits');
    });

    it('should return consistent results for same query', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/search')
        .query({ query: 'camera', sort: 'price_asc' });

      const response2 = await request(app.getHttpServer())
        .get('/api/search')
        .query({ query: 'camera', sort: 'price_asc' });

      expect(response1.body.hits).toEqual(response2.body.hits);
    });
  });
});
