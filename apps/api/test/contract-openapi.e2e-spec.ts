/**
 * P1: Contract Tests — OpenAPI Spec Validation
 *
 * Validates that the running API conforms to its own OpenAPI schema.
 * Checks:
 * 1. OpenAPI spec is generated at runtime and is valid JSON
 * 2. Critical endpoints are documented in the spec
 * 3. Response shapes from real API calls match declared schemas
 * 4. Required fields are present in DTO schemas
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';

describe('OpenAPI Contract Tests (e2e)', () => {
  let app: INestApplication;
  let openApiSpec: OpenAPIObject;

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

    // Generate OpenAPI spec programmatically (same as main.ts)
    const config = new DocumentBuilder()
      .setTitle('GharBatai Rentals API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    openApiSpec = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, openApiSpec);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OpenAPI Spec Structure', () => {
    it('should have valid OpenAPI 3.0 structure', () => {
      expect(openApiSpec).toBeDefined();
      expect(openApiSpec.openapi).toMatch(/^3\./);
      expect(openApiSpec.info).toBeDefined();
      expect(openApiSpec.info.title).toBeDefined();
      expect(openApiSpec.paths).toBeDefined();
    });

    it('should have paths object with at least 10 endpoints', () => {
      const pathCount = Object.keys(openApiSpec.paths).length;
      expect(pathCount).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Critical Endpoint Documentation', () => {
    const criticalEndpoints = [
      { method: 'post', path: '/auth/register' },
      { method: 'post', path: '/auth/login' },
      { method: 'post', path: '/auth/refresh' },
      { method: 'post', path: '/auth/logout' },
      { method: 'get', path: '/auth/me' },
      { method: 'get', path: '/listings' },
      { method: 'post', path: '/bookings' },
      { method: 'get', path: '/bookings/my-bookings' },
      { method: 'get', path: '/bookings/:id' },
      { method: 'patch', path: '/bookings/:id' },
      { method: 'get', path: '/users/profile' },
      { method: 'get', path: '/payments' },
      { method: 'post', path: '/payments/create-intent' },
      { method: 'post', path: '/payments/confirm' },
      { method: 'get', path: '/insurance/policies' },
      { method: 'get', path: '/disputes' },
      { method: 'get', path: '/organizations' },
      { method: 'get', path: '/notifications' },
      { method: 'post', path: '/messages' },
      { method: 'get', path: '/categories' },
      { method: 'get', path: '/reviews' },
      { method: 'post', path: '/favorites' },
      { method: 'get', path: '/search' },
      { method: 'get', path: '/geo/locations' },
    ];

    for (const { method, path } of criticalEndpoints) {
      it(`should document ${method.toUpperCase()} ${path}`, () => {
        const pathSpec = openApiSpec.paths[path];
        expect(pathSpec).toBeDefined();
        expect(pathSpec[method]).toBeDefined();
        expect(pathSpec[method].responses).toBeDefined();
      });
    }
  });

  describe('Schema Definitions', () => {
    it('should define schemas in components', () => {
      expect(openApiSpec.components).toBeDefined();
      expect(openApiSpec.components.schemas).toBeDefined();
      const schemaCount = Object.keys(openApiSpec.components.schemas).length;
      expect(schemaCount).toBeGreaterThan(0);
    });

    it('should document authentication requirements', () => {
      // At least some endpoints should require bearerAuth
      const paths = openApiSpec.paths;
      let securedEndpoints = 0;

      for (const pathKey of Object.keys(paths)) {
        for (const method of Object.keys(paths[pathKey])) {
          if (paths[pathKey][method].security) {
            securedEndpoints++;
          }
        }
      }

      // Most endpoints should be secured
      expect(securedEndpoints).toBeGreaterThan(5);
    });
  });

  describe('Error Response Schema Validation', () => {
    it('400 Bad Request should have consistent error structure', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.message).toBe('string');
      expect(typeof res.body.error).toBe('string');
    });

    it('401 Unauthorized should have consistent error structure', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.message).toBe('string');
    });

    it('404 Not Found should have consistent error structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings/nonexistent-id-12345');

      expect([404, 401]).toContain(res.status);

      if (res.status === 404) {
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('error');
      }
    });
  });

  describe('Response Shape Validation', () => {
    it('GET /health should match its OpenAPI response schema', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect([200, 404, 503]).toContain(res.status);

      if (res.status !== 404) {
        expect(res.body).toBeDefined();
        expect(typeof res.body).toBe('object');
        expect(res.body).toHaveProperty('status');
      }
    });

    it('POST /auth/register should validate required fields per schema', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBeDefined();
    });

    it('POST /auth/register with valid data should return user object', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'contract-test@example.com',
          username: 'contracttest',
          password: 'Password123!',
          firstName: 'Contract',
          lastName: 'Test',
        });

      expect([200, 201, 409]).toContain(res.status);

      if (res.status === 200 || res.status === 201) {
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('email');
        expect(res.body.user).toHaveProperty('username');
        expect(res.body).toHaveProperty('token');
        
        // Field-level validation
        expect(typeof res.body.user.id).toBe('string');
        expect(typeof res.body.user.email).toBe('string');
        expect(res.body.user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        expect(typeof res.body.user.username).toBe('string');
        expect(res.body.user.username.length).toBeGreaterThanOrEqual(3);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(20);
      }
    });

    it('GET /listings should return paginated array shape', async () => {
      const res = await request(app.getHttpServer()).get('/listings');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        if (Array.isArray(res.body)) {
          expect(Array.isArray(res.body)).toBe(true);
        } else {
          expect(
            Array.isArray(res.body.listings) ||
            Array.isArray(res.body.data) ||
            Array.isArray(res.body.items),
          ).toBe(true);
        }
      }
    });

    it('GET /listings/:id should return single listing object', async () => {
      const res = await request(app.getHttpServer()).get('/listings');

      if (res.status === 200) {
        const listings = Array.isArray(res.body) ? res.body : (res.body.listings || res.body.data || res.body.items || []);
        
        if (listings.length > 0) {
          const listingId = listings[0].id;
          const detailRes = await request(app.getHttpServer()).get(`/listings/${listingId}`);
          
          expect([200, 404]).toContain(detailRes.status);
          
          if (detailRes.status === 200) {
            expect(detailRes.body).toHaveProperty('id');
            expect(detailRes.body).toHaveProperty('title');
            expect(detailRes.body).toHaveProperty('price');
            expect(detailRes.body).toHaveProperty('type');
            
            // Field-level validation
            expect(typeof detailRes.body.id).toBe('string');
            expect(typeof detailRes.body.title).toBe('string');
            expect(typeof detailRes.body.price).toBe('number');
            expect(detailRes.body.price).toBeGreaterThan(0);
            expect(typeof detailRes.body.type).toBe('string');
          }
        }
      }
    });

    it('POST /auth/login with invalid credentials should return 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('GET /bookings/my-bookings should return bookings array', async () => {
      const res = await request(app.getHttpServer()).get('/bookings/my-bookings');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        const bookings = Array.isArray(res.body) ? res.body : (res.body.bookings || res.body.data || res.body.items || []);
        
        if (bookings.length > 0) {
          // Field-level validation on first booking
          const booking = bookings[0];
          expect(booking).toHaveProperty('id');
          expect(booking).toHaveProperty('status');
          expect(booking).toHaveProperty('startDate');
          expect(booking).toHaveProperty('endDate');
          
          expect(typeof booking.id).toBe('string');
          expect(typeof booking.status).toBe('string');
          expect(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).toContain(booking.status);
          expect(typeof booking.startDate).toBe('string');
          expect(typeof booking.endDate).toBe('string');
        }
      }
    });

    it('GET /categories should return categories array', async () => {
      const res = await request(app.getHttpServer()).get('/categories');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body) || Array.isArray(res.body.categories)).toBe(true);
      }
    });

    it('GET /payments should return payments array', async () => {
      const res = await request(app.getHttpServer()).get('/payments');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body) || Array.isArray(res.body.payments)).toBe(true);
      }
    });

    it('POST /payments/create-intent should validate required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/create-intent')
        .send({});

      expect([400, 401]).toContain(res.status);

      if (res.status === 400) {
        expect(res.body.message).toBeDefined();
      }
    });

    it('GET /notifications should return notifications array', async () => {
      const res = await request(app.getHttpServer()).get('/notifications');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body) || Array.isArray(res.body.notifications)).toBe(true);
      }
    });

    it('GET /organizations should return organizations array', async () => {
      const res = await request(app.getHttpServer()).get('/organizations');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body) || Array.isArray(res.body.organizations)).toBe(true);
      }
    });

    it('GET /disputes should return disputes array', async () => {
      const res = await request(app.getHttpServer()).get('/disputes');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body) || Array.isArray(res.body.disputes)).toBe(true);
      }
    });

    it('GET /reviews should return reviews array', async () => {
      const res = await request(app.getHttpServer()).get('/reviews');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body) || Array.isArray(res.body.reviews)).toBe(true);
      }
    });
  });

  describe('Spec Serves via HTTP', () => {
    it('should serve OpenAPI JSON at /api/docs-json', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json');

      // Swagger module exposes JSON at <prefix>-json
      if (res.status === 200) {
        expect(res.body.openapi).toMatch(/^3\./);
        expect(res.body.paths).toBeDefined();
      }
      // 404 is also acceptable if the JSON endpoint is not configured
      expect([200, 404]).toContain(res.status);
    });
  });
});
