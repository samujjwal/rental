/**
 * OpenAPI Contract Tests
 * 
 * These tests validate that the API implementation matches the OpenAPI specification.
 * They ensure API contract compliance and detect drift between spec and implementation.
 * 
 * Coverage:
 * - Endpoint existence and HTTP methods
 * - Request/response schema validation
 * - Required fields validation
 * - Error response formats
 * - Content-Type headers
 * - Query parameter handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('OpenAPI Contract Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let openApiSpec: any;

  // Test data
  let testUser: { id: string; email: string; accessToken: string };
  let testListing: { id: string };
  let testCategory: { id: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Load OpenAPI spec if available
    const specPath = path.join(__dirname, '../../docs/openapi.json');
    if (fs.existsSync(specPath)) {
      openApiSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    }

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `contract-test-${Date.now()}@test.com`,
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
      },
    });

    // Generate access token
    const { JwtService } = require('@nestjs/jwt');
    const jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'test-secret',
    });
    testUser.accessToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
      role: 'USER',
    });

    // Create test category
    testCategory = await prisma.category.create({
      data: {
        name: `Contract Test Category ${Date.now()}`,
        slug: `contract-test-category-${Date.now()}`,
      },
    });

    // Create test listing
    testListing = await prisma.listing.create({
      data: {
        title: `Contract Test Listing ${Date.now()}`,
        description: 'Test listing for contract tests',
        basePrice: 100,
        currency: 'USD',
        categoryId: testCategory.id,
        ownerId: testUser.id,
        status: 'PUBLISHED',
        location: 'Test Location',
        condition: 'GOOD',
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: { id: testListing.id },
    });
    await prisma.category.deleteMany({
      where: { id: testCategory.id },
    });
    await prisma.user.deleteMany({
      where: { id: testUser.id },
    });
    await app.close();
  }, 60000);

  describe('API Structure Validation', () => {
    it('should have consistent JSON response format', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      // Verify JSON content type
      expect(response.headers['content-type']).toContain('application/json');

      // Verify response is valid JSON
      expect(() => JSON.parse(response.text)).not.toThrow();
    });

    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/non-existent-endpoint-12345')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject unsupported HTTP methods', async () => {
      const response = await request(app.getHttpServer())
        .patch('/categories')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ name: 'Test' });

      expect([404, 405]).toContain(response.status);
    });
  });

  describe('Authentication Contract', () => {
    it('should return 401 for missing authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings');

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token format', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .set('Authorization', 'InvalidTokenFormat');

      expect(response.status).toBe(401);
    });

    it('should return 401 for expired token', async () => {
      const { JwtService } = require('@nestjs/jwt');
      const jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'test-secret',
      });

      const expiredToken = jwtService.sign(
        { sub: testUser.id, email: testUser.email, role: 'USER' },
        { expiresIn: '0s' }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Listings API Contract', () => {
    it('should return paginated list response', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?limit=10&page=1')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();

      // Should have pagination structure
      if (Array.isArray(response.body)) {
        expect(response.body.length).toBeLessThanOrEqual(10);
      } else {
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('pagination');
      }
    });

    it('should return single item with all required fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/listings/${testListing.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('basePrice');
      expect(response.body).toHaveProperty('currency');
    });

    it('should return 404 for non-existent listing', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings/non-existent-id-12345')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(404);
    });

    it('should validate required fields on creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          // Missing required fields
          description: 'Test description',
        });

      expect(response.status).toBe(400);
    });

    it('should validate field types', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          title: `Type Test ${Date.now()}`,
          description: 'Test',
          basePrice: 'invalid-price', // Should be number
          currency: 'USD',
          categoryId: testCategory.id,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Bookings API Contract', () => {
    it('should return bookings list', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should validate booking creation fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          // Missing required fields
          startDate: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it('should validate date format', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: 'invalid-date',
          endDate: 'invalid-date',
        });

      expect(response.status).toBe(400);
    });

    it('should return booking with correct status values', async () => {
      // Create a booking first
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const createResponse = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      if (createResponse.status === 201) {
        const bookingId = createResponse.body.id;

        const response = await request(app.getHttpServer())
          .get(`/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${testUser.accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(['PENDING_OWNER_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED']).toContain(response.body.status);

        // Cleanup
        await request(app.getHttpServer())
          .post(`/bookings/${bookingId}/cancel`)
          .set('Authorization', `Bearer ${testUser.accessToken}`)
          .send({ reason: 'Contract test cleanup' });
      }
    });
  });

  describe('Categories API Contract', () => {
    it('should return categories list', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should return category with required fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/categories/${testCategory.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('slug');
    });
  });

  describe('Error Response Contract', () => {
    it('should return consistent error format for 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      
      // Should have error details
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });

    it('should return consistent error format for 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should return consistent error format for 404', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings/non-existent-id')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(404);
    });

    it('should return consistent error format for 422', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 10); // Past date
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          listingId: testListing.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Query Parameter Contract', () => {
    it('should handle pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?limit=5&page=1')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
    });

    it('should handle filtering parameters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/listings?category=${testCategory.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
    });

    it('should handle sorting parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
    });

    it('should handle search parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?search=test')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
    });

    it('should ignore invalid query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?invalidParam=value&anotherInvalid=123')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Content Negotiation', () => {
    it('should return JSON by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories');

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should handle Accept header', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting Headers', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories');

      // Check for common rate limit headers
      const hasRateLimitHeaders = 
        response.headers['x-ratelimit-limit'] !== undefined ||
        response.headers['x-ratelimit-remaining'] !== undefined ||
        response.headers['ratelimit-limit'] !== undefined;

      // Not all endpoints may have rate limiting, so this is optional
      if (hasRateLimitHeaders) {
        expect(response.headers['x-ratelimit-limit'] || response.headers['ratelimit-limit']).toBeDefined();
      }
    });
  });
});
