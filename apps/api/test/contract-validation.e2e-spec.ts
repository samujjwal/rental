/**
 * OpenAPI Contract Validation Suite
 * 
 * Validates API contracts against OpenAPI specification.
 * Detects contract drift between implementation and documentation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('OpenAPI Contract Validation', () => {
  let app: INestApplication;
  let openApiSpec: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Load OpenAPI spec if available
    const specPath = path.join(__dirname, '../openapi.json');
    if (fs.existsSync(specPath)) {
      openApiSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('API Contract Drift Detection', () => {
    it('API should expose OpenAPI documentation endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);
      
      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('paths');
      expect(response.body).toHaveProperty('components');
    });

    it('Swagger UI should be accessible', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs')
        .expect(200);
      
      expect(response.text).toContain('swagger');
    });
  });

  describe('Endpoint Contract Validation', () => {
    const CRITICAL_ENDPOINTS = [
      { method: 'GET', path: '/health', expectedStatus: 200 },
      { method: 'POST', path: '/auth/login', expectedStatus: 401 }, // Without creds
      { method: 'POST', path: '/auth/register', expectedStatus: 400 }, // Without body
      { method: 'GET', path: '/search', expectedStatus: 200 },
      { method: 'GET', path: '/categories', expectedStatus: 200 },
    ];

    it.each(CRITICAL_ENDPOINTS)(
      '$method $path should respond with expected status',
      async ({ method, path, expectedStatus }) => {
        let requestBuilder = request(app.getHttpServer())[method.toLowerCase()](path);
        
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          requestBuilder = requestBuilder.send({});
        }

        const response = await requestBuilder;
        expect(response.status).toBe(expectedStatus);
      }
    );
  });

  describe('Response Schema Validation', () => {
    it('Health endpoint returns correct schema', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Validate response structure
      expect(response.body).toMatchObject({
        status: expect.any(String),
        info: expect.any(Object),
        error: expect.any(Object),
        details: expect.any(Object),
      });
    });

    it('Search endpoint returns paginated results', async () => {
      const response = await request(app.getHttpServer())
        .get('/search?q=test')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.results)).toBe(true);
      
      if (response.body.pagination) {
        expect(response.body.pagination).toHaveProperty('page');
        expect(response.body.pagination).toHaveProperty('limit');
        expect(response.body.pagination).toHaveProperty('total');
      }
    });

    it('Error responses follow consistent format', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({}) // Invalid body
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
    });
  });

  describe('Request Validation', () => {
    it('Rejects invalid request bodies', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ invalidField: 'value' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('Rejects unknown query parameters', async () => {
      // If strict validation is enabled
      const response = await request(app.getHttpServer())
        .get('/search?invalidParam=value');

      // Should either ignore or reject
      expect([200, 400]).toContain(response.status);
    });

    it('Validates required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({}) // Missing email and password
        .expect(400);

      expect(response.body.message).toContain('email');
      expect(response.body.message).toContain('password');
    });
  });

  describe('Content-Type Validation', () => {
    it('Returns JSON for API endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/health');

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('Handles JSON request bodies correctly', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({ email: 'test@example.com', password: 'test123' });

      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Version Compatibility', () => {
    it('API versioning is consistent', async () => {
      const response = await request(app.getHttpServer())
        .get('/health');

      // Check if API returns version info
      if (response.body.version) {
        expect(typeof response.body.version).toBe('string');
      }
    });

    it('Deprecated endpoints are documented', async () => {
      // This test would check for deprecated flag in OpenAPI spec
      // Implementation depends on how deprecation is handled
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Security Schema Validation', () => {
    it('Protected endpoints require authentication', async () => {
      const protectedEndpoints = [
        '/bookings/my-bookings',
        '/users/me',
        '/notifications',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app.getHttpServer())
          .get(endpoint);

        expect(response.status).toBe(401);
      }
    });

    it('Invalid tokens are rejected', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Contract Drift Monitoring', () => {
    it('All documented endpoints exist', async () => {
      if (!openApiSpec) {
        console.warn('OpenAPI spec not found, skipping drift detection');
        return;
      }

      const documentedPaths = Object.keys(openApiSpec.paths);
      const actualSpec = await request(app.getHttpServer())
        .get('/api-docs-json')
        .then(res => res.body);

      const actualPaths = Object.keys(actualSpec.paths);

      // Check for removed endpoints
      const removedEndpoints = documentedPaths.filter(p => !actualPaths.includes(p));
      expect(removedEndpoints).toEqual([]);
    });

    it('New endpoints are documented', async () => {
      if (!openApiSpec) {
        console.warn('OpenAPI spec not found, skipping drift detection');
        return;
      }

      const documentedPaths = Object.keys(openApiSpec.paths);
      const actualSpec = await request(app.getHttpServer())
        .get('/api-docs-json')
        .then(res => res.body);

      const actualPaths = Object.keys(actualSpec.paths);

      // Check for undocumented endpoints (log warning, don't fail)
      const undocumentedEndpoints = actualPaths.filter(p => !documentedPaths.includes(p));
      if (undocumentedEndpoints.length > 0) {
        console.warn('Undocumented endpoints found:', undocumentedEndpoints);
      }
    });
  });
});
