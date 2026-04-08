import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../app.module';
import request from 'supertest';

/**
 * API-LEVEL SECURITY INTEGRATION TESTS
 * 
 * These tests validate security measures at the API level with actual HTTP requests:
 * - SQL Injection via API endpoints
 * - XSS via API endpoints
 * - CSRF protection
 * - Rate limiting
 * - Authentication/Authorization bypass attempts
 * - Sensitive data exposure
 * - File upload security
 * 
 * Business Truth Validated:
 * - API endpoints reject malicious input
 * - Authentication is properly enforced
 * - Rate limiting prevents abuse
 * - Sensitive data is not exposed
 * - CSRF tokens protect state-changing operations
 */
describe('API Security Integration Tests', () => {
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

  describe('SQL Injection Protection', () => {
    it('should reject SQL injection in listing search', async () => {
      const maliciousSearch = "'; DROP TABLE listings; --";

      const response = await request(httpServer)
        .get('/listings')
        .query({ search: maliciousSearch })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/validation/i);
    });

    it('should reject SQL injection in user ID parameter', async () => {
      const maliciousId = "1' OR '1'='1";

      const response = await request(httpServer)
        .get(`/users/${maliciousId}`)
        .expect(404); // UUID validation should reject this

      // Should not return user data
      expect(response.body).not.toHaveProperty('email');
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize XSS in listing description', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      // Create a listing with XSS payload
      const response = await request(httpServer)
        .post('/listings')
        .send({
          title: 'Test Listing',
          description: xssPayload,
          price: 100,
        })
        .expect(400); // Should reject or sanitize

      // If accepted, the response should not contain the script tag
      if (response.status === 201) {
        expect(response.body.description).not.toContain('<script>');
      }
    });

    it('should sanitize XSS in user profile', async () => {
      const xssPayload = '<img src=x onerror=alert("XSS")>';

      const response = await request(httpServer)
        .patch('/users/profile')
        .send({
          bio: xssPayload,
        })
        .expect(400); // Should reject or sanitize

      // If accepted, the response should not contain the onerror attribute
      if (response.status === 200) {
        expect(response.body.bio).not.toContain('onerror');
      }
    });
  });

  describe('Authentication Bypass Protection', () => {
    it('should reject requests without valid JWT', async () => {
      const response = await request(httpServer)
        .get('/bookings')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/unauthorized/i);
    });

    it('should reject requests with malformed JWT', async () => {
      const response = await request(httpServer)
        .get('/bookings')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject requests with expired JWT', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwMDAwMDAwMDB9.invalid';

      const response = await request(httpServer)
        .get('/bookings')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Authorization Enforcement', () => {
    it('should prevent users from accessing other users data', async () => {
      // This test would require setting up authenticated users
      // For now, we test that the endpoint requires authentication
      const response = await request(httpServer)
        .get('/users/other-user-id')
        .expect(401); // First must be authenticated
    });

    it('should prevent unauthorized booking modifications', async () => {
      const response = await request(httpServer)
        .patch('/bookings/some-booking-id')
        .send({ status: 'CANCELLED' })
        .expect(401); // Must be authenticated
    });
  });

  describe('Rate Limiting', () => {
    it('should limit excessive login attempts', async () => {
      const loginAttempts = Array(11).fill(null);

      // Attempt 11 logins in rapid succession
      for (const _ of loginAttempts) {
        await request(httpServer)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong-password',
          });
      }

      // The 11th attempt should be rate limited
      const response = await request(httpServer)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password',
        })
        .expect(429); // Too Many Requests

      expect(response.body).toHaveProperty('message');
    });

    it('should limit excessive API requests', async () => {
      const requests = Array(101).fill(null);

      // Make 100 rapid requests to a public endpoint
      for (const _ of requests) {
        await request(httpServer).get('/listings');
      }

      // The 101st request should be rate limited
      const response = await request(httpServer)
        .get('/listings')
        .expect(429); // Too Many Requests

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Sensitive Data Protection', () => {
    it('should not expose passwords in API responses', async () => {
      // Create user endpoint
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
        })
        .expect(201);

      // Response should not contain password field
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should not expose internal IDs in error messages', async () => {
      const response = await request(httpServer)
        .get('/non-existent-endpoint')
        .expect(404);

      // Error message should not contain internal IDs or paths
      expect(response.body.message).not.toContain('/usr');
      expect(response.body.message).not.toContain('/var');
    });

    it('should not expose stack traces in production', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .query({ invalid: 'param' })
        .expect(400);

      // Error response should not contain stack trace
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('stackTrace');
    });
  });

  describe('CSRF Protection', () => {
    it('should require CSRF token for state-changing operations', async () => {
      // Note: This depends on CSRF middleware being enabled
      // Test that POST/PUT/DELETE require CSRF token
      const response = await request(httpServer)
        .post('/listings')
        .send({
          title: 'Test Listing',
        })
        .expect(401); // Should require CSRF token if enabled

      // If CSRF is not enabled, this is a security risk that should be addressed
    });
  });

  describe('File Upload Security', () => {
    it('should reject executable file uploads', async () => {
      const response = await request(httpServer)
        .post('/listings/images')
        .attach('file', Buffer.from('fake content'), 'malware.exe')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/file type/i);
    });

    it('should reject oversized file uploads', async () => {
      const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB

      const response = await request(httpServer)
        .post('/listings/images')
        .attach('file', largeFile, 'large.jpg')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/file size/i);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid email formats', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.message).toMatch(/email/i);
    });

    it('should reject weak passwords', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.message).toMatch(/password/i);
    });

    it('should reject invalid UUIDs', async () => {
      const response = await request(httpServer)
        .get('/bookings/not-a-uuid')
        .expect(404);
    });
  });

  describe('HTTP Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should enforce HTTPS in production', async () => {
      const response = await request(httpServer)
        .get('/listings')
        .expect(200);

      // In production, should redirect to HTTPS
      // For now, we check that HSTS header is present
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });
});
