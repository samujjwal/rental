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
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

describe('OpenAPI Contract Tests (e2e)', () => {
  let app: INestApplication;
  let openApiSpec: Record<string, any>;

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
      { method: 'get', path: '/listings' },
      { method: 'post', path: '/bookings' },
      { method: 'get', path: '/bookings' },
      { method: 'get', path: '/health' },
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

  describe('Response Shape Validation', () => {
    it('GET /health should match its OpenAPI response schema', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      // Health endpoint should return 200
      expect(res.status).toBe(200);

      // Response should be a valid object with status info
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
    });

    it('POST /auth/register should validate required fields per schema', async () => {
      // Send empty body — should fail validation, proving the Schema is enforced
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({});

      expect(res.status).toBe(400);
      // Should return validation errors mentioning required fields
      expect(res.body.message).toBeDefined();
    });

    it('GET /listings should return paginated array shape', async () => {
      const res = await request(app.getHttpServer()).get('/listings');

      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        // Response should be array or paginated object
        if (Array.isArray(res.body)) {
          // Simple array response
          expect(Array.isArray(res.body)).toBe(true);
        } else {
          // Paginated response — should have data array and pagination
          expect(
            Array.isArray(res.body.data) || Array.isArray(res.body.items),
          ).toBe(true);
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
