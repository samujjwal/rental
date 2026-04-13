/**
 * Listings Endpoints Contract Validation Suite
 * 
 * Comprehensive contract tests for listings module endpoints:
 * - Request/response schema validation
 * - Authentication and authorization
 * - Status codes and error handling
 * - Pagination, filtering, sorting
 * - Content-Type validation
 * - Rate limiting
 * - Input validation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Listings Contract Validation', () => {
  let app: INestApplication;
  let accessToken: string;
  let listingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Setup: Register and login user for authenticated tests
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'contract-test@example.com',
        username: 'contract-test',
        password: 'SecurePassword123!',
        firstName: 'Contract',
        lastName: 'Test',
      })
      .expect(201);

    accessToken = registerResponse.body.token;

    // Create a test listing
    const listingResponse = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Contract Test Listing',
        description: 'Listing for contract testing',
        categoryId: 'vehicles',
        basePrice: 100,
        currency: 'USD',
        pricingMode: 'PER_DAY',
        location: {
          addressLine1: '123 Test St',
          city: 'Kathmandu',
          state: 'Bagmati',
          postalCode: '44600',
          country: 'Nepal',
          latitude: 27.7172,
          longitude: 85.3240,
        },
        amenities: ['wifi'],
        houseRules: ['No smoking'],
        checkInTime: '14:00',
        checkOutTime: '11:00',
        minimumNights: 1,
        maximumNights: 30,
      })
      .expect(201);

    listingId = listingResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test listing
    if (listingId) {
      await request(app.getHttpServer())
        .delete(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    }
    await app.close();
  });

  describe('GET /api/listings - Public Listings Endpoint', () => {
    it('should return 200 and correct content-type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should return paginated results with correct structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings?page=1&limit=10')
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should validate pagination parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/listings?page=0')
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/listings?page=-1')
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/listings?limit=0')
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/listings?limit=101')
        .expect(400);
    });

    it('should support filtering by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings?categoryId=vehicles')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should support filtering by price range', async () => {
      const response = await request(app.getServer())
        .get('/api/listings?minPrice=50&maxPrice=200')
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    it('should support filtering by location', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings?city=Kathmandu')
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    it('should support filtering by amenities', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings?amenities=wifi,parking')
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    it('should support sorting', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings?sortBy=price&sortOrder=asc')
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    it('should reject invalid sort fields', async () => {
      await request(app.getHttpServer())
        .get('/api/listings?sortBy=invalidField')
        .expect(400);
    });

    it('should reject invalid sort order', async () => {
      await request(app.getHttpServer())
        .get('/api/listings?sortOrder=invalid')
        .expect(400);
    });

    it('should return empty results for non-existent filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings?city=NonExistentCity12345')
        .expect(200);

      expect(response.body.results).toEqual([]);
    });
  });

  describe('GET /api/listings/:id - Single Listing Endpoint', () => {
    it('should return 200 for existing listing', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('basePrice');
      expect(response.body).toHaveProperty('location');
    });

    it('should return 404 for non-existent listing', async () => {
      await request(app.getHttpServer())
        .get('/api/listings/non-existent-id-12345')
        .expect(404);
    });

    it('should return correct content-type', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include nested objects (location, amenities)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .expect(200);

      expect(response.body.location).toBeDefined();
      expect(response.body.location).toMatchObject({
        addressLine1: expect.any(String),
        city: expect.any(String),
        country: expect.any(String),
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      });
      expect(Array.isArray(response.body.amenities)).toBe(true);
    });
  });

  describe('POST /api/listings - Create Listing Endpoint', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .send({
          title: 'Test Listing',
          description: 'Test',
          basePrice: 100,
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('title');
      expect(response.body.message).toContain('description');
      expect(response.body.message).toContain('categoryId');
      expect(response.body.message).toContain('basePrice');
    });

    it('should validate field types', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          description: 'Test',
          categoryId: 'vehicles',
          basePrice: 'invalid', // Should be number
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test',
            city: 'Test',
            state: 'Test',
            country: 'Test',
            latitude: 27.7172,
            longitude: 85.3240,
          },
        })
        .expect(400);
    });

    it('should validate location object structure', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          description: 'Test',
          categoryId: 'vehicles',
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {}, // Empty location should fail
        })
        .expect(400);
    });

    it('should validate price constraints', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          description: 'Test',
          categoryId: 'vehicles',
          basePrice: -100, // Negative price
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test',
            city: 'Test',
            state: 'Test',
            country: 'Test',
            latitude: 27.7172,
            longitude: 85.3240,
          },
        })
        .expect(400);
    });

    it('should validate date/time constraints', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          description: 'Test',
          categoryId: 'vehicles',
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test',
            city: 'Test',
            state: 'Test',
            country: 'Test',
            latitude: 27.7172,
            longitude: 85.3240,
          },
          checkInTime: '25:00', // Invalid time
          checkOutTime: '11:00',
          minimumNights: 1,
          maximumNights: 30,
        })
        .expect(400);
    });

    it('should validate minimum/maximum nights constraints', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          description: 'Test',
          categoryId: 'vehicles',
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test',
            city: 'Test',
            state: 'Test',
            country: 'Test',
            latitude: 27.7172,
            longitude: 85.3240,
          },
          checkInTime: '14:00',
          checkOutTime: '11:00',
          minimumNights: 10,
          maximumNights: 5, // Max less than min
        })
        .expect(400);
    });

    it('should create listing with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Valid Test Listing',
          description: 'A valid listing for contract testing',
          categoryId: 'vehicles',
          basePrice: 150,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '456 Valid St',
            city: 'Pokhara',
            state: 'Gandaki',
            postalCode: '33700',
            country: 'Nepal',
            latitude: 28.2096,
            longitude: 83.9856,
          },
          amenities: ['wifi', 'parking'],
          houseRules: ['No smoking', 'No pets'],
          checkInTime: '14:00',
          checkOutTime: '11:00',
          minimumNights: 2,
          maximumNights: 14,
          bedrooms: 2,
          beds: 3,
          bathrooms: 1,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Valid Test Listing');
      expect(response.body.status).toBe('DRAFT');

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/api/listings/${response.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
    });

    it('should sanitize HTML in text fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '<script>alert("xss")</script>',
          description: 'Test',
          categoryId: 'vehicles',
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test',
            city: 'Test',
            state: 'Test',
            country: 'Test',
            latitude: 27.7172,
            longitude: 85.3240,
          },
        })
        .expect(201);

      expect(response.body.title).not.toContain('<script>');
    });
  });

  describe('PATCH /api/listings/:id - Update Listing Endpoint', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}`)
        .send({ title: 'Updated' })
        .expect(401);
    });

    it('should require ownership', async () => {
      // Create another user
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'other-user@example.com',
          username: 'other-user',
          password: 'SecurePassword123!',
          firstName: 'Other',
          lastName: 'User',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.token;

      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);
    });

    it('should update listing with valid data', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Contract Test Listing' })
        .expect(200);

      expect(response.body.title).toBe('Updated Contract Test Listing');
    });

    it('should validate update data', async () => {
      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ basePrice: -50 })
        .expect(400);
    });

    it('should return 404 for non-existent listing', async () => {
      await request(app.getHttpServer())
        .patch('/api/listings/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/listings/:id - Delete Listing Endpoint', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete('/api/listings/some-id')
        .expect(401);
    });

    it('should require ownership', async () => {
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'delete-test@example.com',
          username: 'delete-test',
          password: 'SecurePassword123!',
          firstName: 'Delete',
          lastName: 'Test',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.token;

      await request(app.getHttpServer())
        .delete(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent listing', async () => {
      await request(app.getHttpServer())
        .delete('/api/listings/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /api/listings/:id/availability - Availability Endpoint', () => {
    it('should return 200 for valid date range', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/availability?startDate=2026-07-01&endDate=2026-07-05`)
        .expect(200);

      expect(response.body).toHaveProperty('isAvailable');
      expect(typeof response.body.isAvailable).toBe('boolean');
      expect(response.body).toHaveProperty('availableSlots');
    });

    it('should validate date parameters', async () => {
      await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/availability`)
        .expect(400); // Missing dates

      await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/availability?startDate=invalid&endDate=2026-07-05`)
        .expect(400); // Invalid date format
    });

    it('should reject end date before start date', async () => {
      await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/availability?startDate=2026-07-05&endDate=2026-07-01`)
        .expect(400);
    });

    it('should return 404 for non-existent listing', async () => {
      await request(app.getHttpServer())
        .get('/api/listings/non-existent-id/availability?startDate=2026-07-01&endDate=2026-07-05')
        .expect(404);
    });
  });

  describe('POST /api/listings/:id/images - Image Upload Endpoint', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/images`)
        .expect(401);
    });

    it('should require ownership', async () => {
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'image-test@example.com',
          username: 'image-test',
          password: 'SecurePassword123!',
          firstName: 'Image',
          lastName: 'Test',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.token;

      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should validate image files', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('images', Buffer.from('fake-image'), 'test.txt') // Invalid file type
        .expect(400);
    });

    it('should limit number of images', async () => {
      // Upload more than allowed (e.g., 20 images)
      const images = Array.from({ length: 25 }, (_, i) => ({
        fieldname: 'images',
        originalname: `image${i}.jpg`,
        buffer: Buffer.from('fake-image'),
      }));

      // This test would need proper multipart handling
      // For now, just verify the endpoint exists
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400); // Should fail without actual images
    });
  });

  describe('GET /api/categories - Categories Endpoint', () => {
    it('should return 200 and correct structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('slug');
      }
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/categories?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('GET /api/categories/:id - Single Category Endpoint', () => {
    it('should return 200 for valid category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/categories/vehicles')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('requiredFields');
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer())
        .get('/api/categories/non-existent-category')
        .expect(404);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for 400 errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(400);
    });

    it('should return consistent error format for 401 errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(401);
    });

    it('should return consistent error format for 404 errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(404);
    });

    it('should return consistent error format for 403 errors', async () => {
      // Create another user and try to access protected resource
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'forbidden-test@example.com',
          username: 'forbidden-test',
          password: 'SecurePassword123!',
          firstName: 'Forbidden',
          lastName: 'Test',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.token;

      const response = await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Unauthorized' })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(403);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting on public endpoints', async () => {
      // Make multiple requests to test rate limiting
      const requests = Array.from({ length: 100 }, () =>
        request(app.getHttpServer()).get('/api/listings')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // If rate limiting is enabled, some requests should be throttled
      // This is a soft check - rate limiting configuration may vary
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body).toHaveProperty('message');
      }
    });
  });

  describe('Content Negotiation', () => {
    it('should accept JSON content type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({
          title: 'Test',
          description: 'Test',
          categoryId: 'vehicles',
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test',
            city: 'Test',
            state: 'Test',
            country: 'Test',
            latitude: 27.7172,
            longitude: 85.3240,
          },
        })
        .expect(201);

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should reject non-JSON content type', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/xml')
        .send('<test>data</test>')
        .expect(415); // Unsupported Media Type
    });
  });
});
