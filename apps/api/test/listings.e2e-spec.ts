import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Listings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let adminToken: string;
  let testListingId: string;
  let testUserId: string;
  let testCategoryId: string;
  let testPolicyId: string;

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

    // Create owner user
    const ownerSignup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'owner-listings@test.com',
        password: 'Password123!',
        firstName: 'Owner',
        lastName: 'User',
      });
    ownerToken = ownerSignup.body.accessToken;
    testUserId = ownerSignup.body.user.id;

    // Create renter user
    const renterSignup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'renter-listings@test.com',
        password: 'Password123!',
        firstName: 'Renter',
        lastName: 'User',
      });
    renterToken = renterSignup.body.accessToken;

    // Get category and policy IDs
    const categories = await prisma.category.findMany({ take: 1 });
    testCategoryId = categories[0]?.id;

    const policies = await prisma.cancellationPolicy.findMany({ take: 1 });
    testPolicyId = policies[0]?.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testListingId) {
      await prisma.property.delete({ where: { id: testListingId } }).catch(() => {});
    }
    await prisma.user.delete({ where: { email: 'owner-listings@test.com' } }).catch(() => {});
    await prisma.user.delete({ where: { email: 'renter-listings@test.com' } }).catch(() => {});
    await app.close();
  });

  describe('POST /listings', () => {
    it('should create a new listing', async () => {
      const createDto = {
        title: 'E2E Test Listing',
        description: 'A beautiful test property for E2E tests',
        address: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'USA',
        latitude: 37.7749,
        longitude: -122.4194,
        type: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        basePrice: 150,
        currency: 'USD',
        amenities: ['WiFi', 'Kitchen', 'Parking'],
        features: ['Ocean View', 'Balcony'],
        images: ['https://example.com/image1.jpg'],
        rules: ['No smoking', 'No parties'],
        categoryId: testCategoryId,
        cancellationPolicyId: testPolicyId,
      };

      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(createDto)
        .expect(201);

      testListingId = response.body.id;

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(createDto.title);
      expect(response.body.basePrice).toBe(createDto.basePrice);
      expect(response.body.status).toBe('DRAFT');
    });

    it('should reject creation without authentication', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .send({ title: 'Test', description: 'Test' })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        title: 'Missing required fields',
      };

      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should validate price is positive', async () => {
      const invalidDto = {
        title: 'Negative Price',
        description: 'Test',
        address: '123 Test',
        city: 'City',
        state: 'ST',
        zipCode: '12345',
        country: 'USA',
        type: 'APARTMENT',
        basePrice: -100,
        categoryId: testCategoryId,
      };

      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /listings', () => {
    it('should return all listings', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?page=1&limit=5')
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(5);
    });

    it('should filter by category', async () => {
      if (!testCategoryId) return;

      const response = await request(app.getHttpServer())
        .get(`/listings?categoryId=${testCategoryId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?minPrice=50&maxPrice=200')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by location', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?city=San Francisco')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /listings/my', () => {
    it('should return user\'s own listings', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings/my')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((listing: any) => {
        expect(listing.ownerId).toBe(testUserId);
      });
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/listings/my')
        .expect(401);
    });
  });

  describe('GET /listings/:id', () => {
    it('should return a listing by id', async () => {
      if (!testListingId) return;

      const response = await request(app.getHttpServer())
        .get(`/listings/${testListingId}`)
        .expect(200);

      expect(response.body.id).toBe(testListingId);
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('owner');
    });

    it('should return 404 for non-existent listing', async () => {
      await request(app.getHttpServer())
        .get('/listings/non-existent-id')
        .expect(404);
    });

    it('should include owner information', async () => {
      if (!testListingId) return;

      const response = await request(app.getHttpServer())
        .get(`/listings/${testListingId}`)
        .expect(200);

      expect(response.body).toHaveProperty('owner');
      expect(response.body.owner).toHaveProperty('firstName');
    });
  });

  describe('PATCH /listings/:id', () => {
    it('should update listing as owner', async () => {
      if (!testListingId) return;

      const updateDto = {
        title: 'Updated E2E Test Listing',
        description: 'Updated description',
        basePrice: 175,
      };

      const response = await request(app.getHttpServer())
        .patch(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.title).toBe(updateDto.title);
      expect(response.body.basePrice).toBe(updateDto.basePrice);
    });

    it('should reject update by non-owner', async () => {
      if (!testListingId) return;

      await request(app.getHttpServer())
        .patch(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);
    });

    it('should allow admin to update any listing', async () => {
      if (!testListingId) return;

      const response = await request(app.getHttpServer())
        .patch(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Updated Listing' })
        .expect(200);

      expect(response.body.title).toBe('Admin Updated Listing');
    });
  });

  describe('POST /listings/:id/publish', () => {
    it('should publish listing for review', async () => {
      if (!testListingId) return;

      const response = await request(app.getHttpServer())
        .post(`/listings/${testListingId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe('PENDING_REVIEW');
    });

    it('should reject publish by non-owner', async () => {
      if (!testListingId) return;

      await request(app.getHttpServer())
        .post(`/listings/${testListingId}/publish`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(403);
    });
  });

  describe('POST /listings/:id/pause', () => {
    it('should pause listing as owner', async () => {
      if (!testListingId) return;

      // First approve it (as admin)
      await prisma.property.update({
        where: { id: testListingId },
        data: { status: 'AVAILABLE', verificationStatus: 'VERIFIED' },
      });

      const response = await request(app.getHttpServer())
        .post(`/listings/${testListingId}/pause`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe('UNAVAILABLE');
    });
  });

  describe('POST /listings/:id/activate', () => {
    it('should activate paused listing', async () => {
      if (!testListingId) return;

      const response = await request(app.getHttpServer())
        .post(`/listings/${testListingId}/activate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe('AVAILABLE');
    });
  });

  describe('GET /listings/:id/stats', () => {
    it('should return listing statistics', async () => {
      if (!testListingId) return;

      const response = await request(app.getHttpServer())
        .get(`/listings/${testListingId}/stats`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('views');
      expect(response.body).toHaveProperty('totalBookings');
      expect(response.body).toHaveProperty('averageRating');
    });

    it('should require owner authentication', async () => {
      if (!testListingId) return;

      await request(app.getHttpServer())
        .get(`/listings/${testListingId}/stats`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(403);
    });
  });

  describe('Availability Management', () => {
    describe('POST /listings/:id/availability', () => {
      it('should create availability rule', async () => {
        if (!testListingId) return;

        const availabilityDto = {
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'available',
          price: 200,
        };

        const response = await request(app.getHttpServer())
          .post(`/listings/${testListingId}/availability`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send(availabilityDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.status).toBe('available');
      });

      it('should block dates', async () => {
        if (!testListingId) return;

        const blockDto = {
          startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'blocked',
          notes: 'Personal use',
        };

        const response = await request(app.getHttpServer())
          .post(`/listings/${testListingId}/availability`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send(blockDto)
          .expect(201);

        expect(response.body.status).toBe('blocked');
      });
    });

    describe('GET /listings/:id/availability', () => {
      it('should return availability calendar', async () => {
        if (!testListingId) return;

        const response = await request(app.getHttpServer())
          .get(`/listings/${testListingId}/availability`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should filter by date range', async () => {
        if (!testListingId) return;

        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await request(app.getHttpServer())
          .get(`/listings/${testListingId}/availability?startDate=${startDate}&endDate=${endDate}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /listings/:id/check-availability', () => {
      it('should check if dates are available', async () => {
        if (!testListingId) return;

        const checkDto = {
          startDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const response = await request(app.getHttpServer())
          .post(`/listings/${testListingId}/check-availability`)
          .send(checkDto)
          .expect(200);

        expect(response.body).toHaveProperty('available');
        expect(typeof response.body.available).toBe('boolean');
      });
    });
  });

  describe('DELETE /listings/:id', () => {
    it('should archive listing as owner', async () => {
      if (!testListingId) return;

      await request(app.getHttpServer())
        .delete(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Verify archived status
      const listing = await prisma.property.findUnique({
        where: { id: testListingId },
      });
      expect(listing?.status).toBe('ARCHIVED');
    });

    it('should reject deletion by non-owner', async () => {
      // Create another listing for this test
      const createResponse = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Delete Test Listing',
          description: 'Test',
          address: '123 Test',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          type: 'APARTMENT',
          basePrice: 100,
          categoryId: testCategoryId,
        });

      const newListingId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/listings/${newListingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(403);

      // Cleanup
      await prisma.property.delete({ where: { id: newListingId } });
    });
  });

  describe('Edge Cases', () => {
    it('should handle listing with maximum images', async () => {
      const createDto = {
        title: 'Max Images Listing',
        description: 'Test',
        address: '123 Test',
        city: 'City',
        state: 'ST',
        zipCode: '12345',
        country: 'USA',
        type: 'APARTMENT',
        basePrice: 100,
        images: Array(20).fill('https://example.com/image.jpg'),
        categoryId: testCategoryId,
      };

      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.images.length).toBe(20);

      // Cleanup
      await prisma.property.delete({ where: { id: response.body.id } });
    });

    it('should handle Unicode characters in title and description', async () => {
      const createDto = {
        title: '美しい アパートメント 🏠',
        description: 'Wunderschöne Unterkunft für Ihre Reise! 日本語テスト',
        address: '123 Test',
        city: 'Tokyo',
        state: 'TK',
        zipCode: '12345',
        country: 'Japan',
        type: 'APARTMENT',
        basePrice: 100,
        categoryId: testCategoryId,
      };

      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.title).toBe(createDto.title);

      // Cleanup
      await prisma.property.delete({ where: { id: response.body.id } });
    });

    it('should handle concurrent listing updates', async () => {
      // Create a listing for concurrent test
      const createResponse = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Concurrent Test',
          description: 'Test',
          address: '123 Test',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          type: 'APARTMENT',
          basePrice: 100,
          categoryId: testCategoryId,
        });

      const listingId = createResponse.body.id;

      // Make concurrent updates
      const updates = Array(5)
        .fill(null)
        .map((_, i) =>
          request(app.getHttpServer())
            .patch(`/listings/${listingId}`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ basePrice: 100 + i }),
        );

      const responses = await Promise.all(updates);
      const successful = responses.filter((r) => r.status === 200);

      expect(successful.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.property.delete({ where: { id: listingId } });
    });
  });
});
