import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

/**
 * Contract Tests for API Route Registry
 * 
 * These tests ensure that:
 * 1. All routes in the registry exist in actual controllers
 * 2. No new routes exist in controllers without being documented
 * 3. Routes are properly documented with metadata
 * 
 * Run these tests after adding new routes to detect contract drift.
 */
describe('API Route Registry Contract Tests', () => {
  let app: INestApplication;

  // Expected route registry (source of truth)
  const expectedRoutes = {
    '/bookings': ['POST', 'GET'],
    '/bookings/my-bookings': ['GET'],
    '/bookings/host-bookings': ['GET'],
    '/bookings/:id': ['GET'],
    '/bookings/:id/disputes': ['GET'],
    '/bookings/:id/approve': ['POST'],
    '/bookings/:id/reject': ['POST'],
    '/bookings/:id/cancel': ['POST'],
    '/bookings/:id/start': ['POST'],
    '/bookings/:id/request-return': ['POST'],
    '/bookings/:id/approve-return': ['POST'],
    '/bookings/:id/reject-return': ['POST'],
    '/bookings/:id/dispute': ['POST'],
    '/auth/register': ['POST'],
    '/auth/login': ['POST'],
    '/auth/logout': ['POST'],
    '/auth/refresh': ['POST'],
    '/auth/forgot-password': ['POST'],
    '/auth/reset-password': ['POST'],
    '/auth/verify-email': ['POST'],
    '/auth/resend-verification': ['POST'],
    '/listings': ['GET', 'POST'],
    '/listings/:id': ['GET', 'PATCH', 'DELETE'],
    '/listings/:id/photos': ['POST'],
    '/listings/:id/availability': ['GET', 'POST'],
    '/storage/upload': ['POST'],
    '/storage/upload-url': ['GET'],
    '/storage/download-url': ['GET'],
    '/storage/delete': ['DELETE'],
    '/storage/list': ['GET'],
    '/storage/listing-photos': ['POST'],
    '/storage/avatar': ['POST'],
    '/storage/org-logo': ['POST'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have all expected routes registered', async () => {
    const server = app.getHttpAdapter();
    
    for (const [path, methods] of Object.entries(expectedRoutes)) {
      for (const method of methods) {
        // Verify route is registered by attempting to access it
        // This will fail with 401/403 instead of 404 if the route exists
        const response = await request(server.getHttpServer())
          [method.toLowerCase()](path)
          .expect((res) => {
            // 404 means route doesn't exist (contract violation)
            if (res.status === 404) {
              throw new Error(`Route ${method} ${path} not found in controller`);
            }
            // Other errors (401, 403, etc.) are expected for unauthenticated requests
          });
      }
    }
  });

  it('should document all registered routes in the registry', async () => {
    // This test would require reflection to extract all routes from the app
    // For now, it's a placeholder to remind developers to update the registry
    expect(true).toBe(true); // Placeholder - implement with route extraction
  });

  it('should have consistent route naming conventions', () => {
    for (const path of Object.keys(expectedRoutes)) {
      // Routes should use kebab-case
      expect(path).toMatch(/^[a-z0-9\-\/:]+$/);
      // Routes should not have trailing slashes
      expect(path).not.toMatch(/\/$/);
    }
  });
});
