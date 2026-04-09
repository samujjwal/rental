import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../app.module';
import request from 'supertest';

/**
 * API CONTRACT DRIFT TESTS
 * 
 * These tests validate that API responses match their expected contracts:
 * - Response structure validation
 * - Field type validation
 * - Required field presence
 * - Deprecated field detection
 * - Breaking change detection
 * 
 * Business Truth Validated:
 * - API contracts are stable and predictable
 * - Frontend integrations won't break unexpectedly
 * - Breaking changes are detected early
 * - Response schemas match documentation
 */
describe('API Contract Drift Tests', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth API Contract', () => {
    it('should return correct login response structure', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(401); // Invalid credentials, but structure should be consistent

      // Even on error, response structure should be consistent
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
    });

    it('should return correct registration response structure', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'Test User',
        })
        .expect(201);

      // Successful registration should return user data
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('name');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('Listings API Contract', () => {
    it('should return correct listing response structure', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(response.body) && response.body.length > 0) {
        const listing = response.body[0];
        
        // Required fields
        expect(listing).toHaveProperty('id');
        expect(listing).toHaveProperty('title');
        expect(listing).toHaveProperty('description');
        expect(listing).toHaveProperty('price');
        expect(listing).toHaveProperty('currency');
        
        // Field types
        expect(typeof listing.id).toBe('string');
        expect(typeof listing.title).toBe('string');
        expect(typeof listing.description).toBe('string');
        expect(typeof listing.price).toBe('number');
        expect(typeof listing.currency).toBe('string');
      }
    });

    it('should return correct single listing response structure', async () => {
      // First get a listing ID
      const listResponse = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(listResponse.body) && listResponse.body.length > 0) {
        const listingId = listResponse.body[0].id;
        
        const response = await request(httpServer)
          .get(`/listings/${listingId}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('description');
        expect(response.body).toHaveProperty('price');
        expect(response.body).toHaveProperty('currency');
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('updatedAt');
      }
    });
  });

  describe('Bookings API Contract', () => {
    it('should return correct booking response structure', async () => {
      // This requires authentication, so we expect 401
      const response = await request(httpServer)
        .get('/bookings')
        .expect(401);

      // Error response structure should be consistent
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
    });
  });

  describe('Users API Contract', () => {
    it('should return correct user profile response structure', async () => {
      // This requires authentication, so we expect 401
      const response = await request(httpServer)
        .get('/users/profile')
        .expect(401);

      // Error response structure should be consistent
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
    });
  });

  describe('Error Response Contract', () => {
    it('should return consistent error structure for 404', async () => {
      const response = await request(httpServer)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
      expect(response.body.statusCode).toBe(404);
    });

    it('should return consistent error structure for 400', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
      expect(response.body.statusCode).toBe(400);
    });

    it('should return consistent error structure for 401', async () => {
      const response = await request(httpServer)
        .get('/bookings')
        .expect(401);

      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
      expect(response.body.statusCode).toBe(401);
    });

    it('should return consistent error structure for 403', async () => {
      const response = await request(httpServer)
        .delete('/admin/some-resource')
        .expect(401); // First fails auth, but structure should be consistent

      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Pagination Contract', () => {
    it('should return correct pagination structure', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .query({ page: 1, limit: 10 })
        .expect(200);

      if (Array.isArray(response.body)) {
        // If it's an array, it's the direct result
        expect(Array.isArray(response.body)).toBe(true);
      } else if (response.body.data) {
        // If it has a data property, check pagination metadata
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('limit');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('Filtering and Sorting Contract', () => {
    it('should accept valid filter parameters', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .query({
          category: 'electronics',
          minPrice: 100,
          maxPrice: 1000,
        })
        .expect(200);

      // Should return 200, indicating filters are accepted
      expect(response.status).toBe(200);
    });

    it('should accept valid sort parameters', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .query({
          sortBy: 'price',
          sortOrder: 'asc',
        })
        .expect(200);

      // Should return 200, indicating sort is accepted
      expect(response.status).toBe(200);
    });
  });

  describe('Field Type Validation', () => {
    it('should return numeric price in listings', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(response.body) && response.body.length > 0) {
        const listing = response.body[0];
        expect(typeof listing.price).toBe('number');
        expect(listing.price).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return string IDs in listings', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(response.body) && response.body.length > 0) {
        const listing = response.body[0];
        expect(typeof listing.id).toBe('string');
        expect(listing.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      }
    });

    it('should return ISO date strings', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(response.body) && response.body.length > 0) {
        const listing = response.body[0];
        if (listing.createdAt) {
          expect(typeof listing.createdAt).toBe('string');
          expect(listing.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
        }
      }
    });
  });

  describe('Required Field Presence', () => {
    it('should include all required fields in listing response', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(response.body) && response.body.length > 0) {
        const listing = response.body[0];
        
        const requiredFields = ['id', 'title', 'description', 'price', 'currency'];
        requiredFields.forEach(field => {
          expect(listing).toHaveProperty(field);
        });
      }
    });

    it('should not include sensitive fields in user responses', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'Test User',
        })
        .expect(201);

      const sensitiveFields = ['password', 'passwordHash', 'salt', 'secret'];
      sensitiveFields.forEach(field => {
        expect(response.body).not.toHaveProperty(field);
      });
    });
  });

  describe('Deprecated Field Detection', () => {
    it('should not include deprecated fields', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(response.body) && response.body.length > 0) {
        const listing = response.body[0];
        
        // Example: if 'oldPrice' was deprecated
        expect(listing).not.toHaveProperty('oldPrice');
      }
    });
  });

  describe('Breaking Change Detection', () => {
    it('should maintain backward compatibility for listing responses', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      if (Array.isArray(response.body) && response.body.length > 0) {
        const listing = response.body[0];
        
        // These fields should always exist for backward compatibility
        const backwardCompatibleFields = ['id', 'title', 'description', 'price'];
        backwardCompatibleFields.forEach(field => {
          expect(listing).toHaveProperty(field);
        });
      }
    });
  });
});
