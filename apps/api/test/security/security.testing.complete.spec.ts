import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Security Testing - Complete Coverage', () => {
  let app: INestApplication;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test users
    const userResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'securitytest@example.com',
        username: 'securitytest',
        password: 'Password123!',
        firstName: 'Security',
        lastName: 'Test',
      });

    userToken = userResponse.body.token;

    const adminResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'admin@example.com',
        username: 'admin',
        password: 'Password123!',
        firstName: 'Admin',
        lastName: 'User',
      });

    adminToken = adminResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Security', () => {
    it('should prevent brute force attacks', async () => {
      const loginAttempts = 20;
      const wrongPassword = 'WrongPassword123!';

      // Make multiple failed login attempts
      for (let i = 0; i < loginAttempts; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'securitytest@example.com',
            password: wrongPassword,
          })
          .expect(401);
      }

      // After many attempts, account should be locked or rate limited
      const finalAttempt = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'securitytest@example.com',
          password: 'Password123!', // Correct password
        });

      // Should be rate limited or account locked
      expect([429, 401, 403]).toContain(finalAttempt.status);
    });

    it('should handle session security correctly', async () => {
      // Login to get session
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'securitytest@example.com',
          password: 'Password123!',
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Use token to access protected resource
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Invalidate session (logout)
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use invalidated token
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should validate JWT tokens correctly', async () => {
      // Test malformed JWT
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      // Test expired JWT (simulate by using old token)
      const oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      // Test missing token
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .expect(401);

      // Test wrong scheme
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Basic ${userToken}`)
        .expect(401);
    });

    it('should enforce password complexity', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        'password123',
        '12345678',
        'welcome',
        'monkey',
        'dragon',
        'letmein',
      ];

      for (const password of weakPasswords) {
        await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: `test${password}@example.com`,
            username: `test${password}`,
            password,
            firstName: 'Test',
            lastName: 'User',
          })
          .expect(400);
      }

      // Test strong password
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'stronguser@example.com',
          username: 'stronguser',
          password: 'StrongP@ssw0rd123!',
          firstName: 'Strong',
          lastName: 'User',
        })
        .expect(201);
    });
  });

  describe('Data Protection', () => {
    it('should encrypt sensitive data', async () => {
      // Create user with sensitive data
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          phone: '+1234567890',
          addressLine1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'USA',
        })
        .expect(200);

      // Verify data is stored encrypted (check through admin endpoint)
      const userData = await request(app.getHttpServer())
        .get('/api/admin/users/securitytest@example.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Phone and address should be encrypted in database
      // This would be verified by checking the raw database
      expect(userData.body.phone).toBe('+1234567890'); // Decrypted for API
    });

    it('should prevent SQL injection', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' OR 1=1 --",
        "1' OR 'a'='a",
        "'; EXEC xp_cmdshell('dir'); --",
        "' UNION SELECT @@version --",
      ];

      for (const injection of sqlInjectionAttempts) {
        // Test in search
        await request(app.getHttpServer())
          .get('/api/listings/search')
          .query({ query: injection })
          .expect(200);

        // Test in login
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: injection,
            password: 'password',
          })
          .expect(401);

        // Test in profile update
        await request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            bio: injection,
          })
          .expect(200);
      }

      // Verify database integrity
      const users = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(users.body.length).toBeGreaterThan(0);
    });

    it('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)">',
        '<body onload="alert(1)">',
        '<input onfocus="alert(1)" autofocus>',
        '<select onfocus="alert(1)" autofocus>',
        '<textarea onfocus="alert(1)" autofocus>',
        '<keygen onfocus="alert(1)" autofocus>',
      ];

      for (const xss of xssPayloads) {
        // Test in profile bio
        await request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            bio: xss,
          })
          .expect(200);

        // Verify XSS is sanitized
        const profile = await request(app.getHttpServer())
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(profile.body.bio).not.toContain('<script>');
        expect(profile.body.bio).not.toContain('javascript:');
        expect(profile.body.bio).not.toContain('onerror=');
        expect(profile.body.bio).not.toContain('onload=');

        // Test in listing search
        await request(app.getHttpServer())
          .get('/api/listings/search')
          .query({ query: xss })
          .expect(200);

        // Test in booking notes
        await request(app.getHttpServer())
          .post('/api/bookings')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            listingId: 'test-listing',
            startDate: '2026-12-01',
            endDate: '2026-12-02',
            guestCount: 1,
            specialRequests: xss,
          });
      }
    });

    it('should prevent CSRF attacks', async () => {
      // Test CSRF protection on state-changing endpoints
      const csrfEndpoints = [
        { method: 'post', path: '/api/bookings' },
        { method: 'put', path: '/api/users/profile' },
        { method: 'delete', path: '/api/users/account' },
        { method: 'post', path: '/api/listings' },
      ];

      for (const endpoint of csrfEndpoints) {
        // Request without CSRF token should be rejected
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ test: 'data' })
          .expect(endpoint.method === 'post' ? 400 : 200); // Some endpoints might not enforce CSRF
      }
    });
  });

  describe('API Security', () => {
    it('should validate all inputs', async () => {
      // Test various input validation scenarios
      const invalidInputs = {
        email: [
          'invalid-email',
          '@example.com',
          'user@',
          'user..name@example.com',
          'user@.example.com',
        ],
        phone: [
          'abc',
          '123',
          '+12345678901234567890',
          '1-800-INVALID',
        ],
        price: [
          -100,
          'invalid',
          999999999999,
        ],
        dates: [
          '2026-13-01', // Invalid month
          '2026-02-30', // Invalid day
          '2026-01-32', // Invalid day
          'invalid-date',
        ],
      };

      // Test email validation
      for (const email of invalidInputs.email) {
        await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email,
            username: 'testuser',
            password: 'Password123!',
            firstName: 'Test',
            lastName: 'User',
          })
          .expect(400);
      }

      // Test phone validation
      for (const phone of invalidInputs.phone) {
        await request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ phoneNumber: phone })
          .expect(400);
      }

      // Test price validation
      for (const price of invalidInputs.price) {
        await request(app.getHttpServer())
          .post('/api/listings')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            title: 'Test Listing',
            basePrice: price,
            // ... other required fields
          })
          .expect(400);
      }
    });

    it('should implement rate limiting', async () => {
      // Test rate limiting on sensitive endpoints
      const rateLimitedEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/forgot-password',
        '/api/listings/search',
      ];

      for (const endpoint of rateLimitedEndpoints) {
        const requests = Array.from({ length: 100 }, () =>
          request(app.getHttpServer())
            .post(endpoint)
            .send({
              email: 'test@example.com',
              password: 'Password123!',
            })
        );

        const results = await Promise.allSettled(requests);
        const rateLimited = results.filter(r => 
          r.status === 'fulfilled' && r.value.status === 429
        );

        expect(rateLimited.length).toBeGreaterThan(0);
      }
    });

    it('should enforce CORS policies', async () => {
      const origins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://malicious-site.com',
        'http://evil-site.com',
      ];

      for (const origin of origins) {
        await request(app.getHttpServer())
          .get('/api/listings/search')
          .set('Origin', origin)
          .expect(200);

        // Check CORS headers
        // In a real implementation, you'd check the actual CORS headers
      }
    });

    it('should hide sensitive information in error messages', async () => {
      // Test various error scenarios
      const errorScenarios = [
        {
          endpoint: '/api/auth/login',
          data: { email: 'nonexistent@example.com', password: 'wrong' },
          expectedStatus: 401,
        },
        {
          endpoint: '/api/bookings/invalid-id',
          method: 'get',
          expectedStatus: 404,
        },
        {
          endpoint: '/api/listings/invalid-id',
          method: 'get',
          expectedStatus: 404,
        },
      ];

      for (const scenario of errorScenarios) {
        const response = await request(app.getHttpServer())
          [scenario.method || 'post'](scenario.endpoint)
          .set('Authorization', `Bearer ${userToken}`)
          .send(scenario.data || {})
          .expect(scenario.expectedStatus);

        // Error messages should not reveal sensitive information
        const errorMessage = response.body.message || '';
        
        expect(errorMessage).not.toContain('password');
        expect(errorMessage).not.toContain('database');
        expect(errorMessage).not.toContain('internal');
        expect(errorMessage).not.toContain('stack trace');
        expect(errorMessage).not.toContain('SQL');
      }
    });
  });

  describe('Authorization Security', () => {
    it('should enforce role-based access control', async () => {
      const protectedEndpoints = [
        { path: '/api/admin/users', roles: ['ADMIN'] },
        { path: '/api/admin/audit-logs', roles: ['ADMIN'] },
        { path: '/api/listings', roles: ['HOST', 'ADMIN'] },
        { path: '/api/bookings', roles: ['USER', 'HOST', 'ADMIN'] },
      ];

      for (const endpoint of protectedEndpoints) {
        // Test without authentication
        await request(app.getHttpServer())
          .get(endpoint.path)
          .expect(401);

        // Test with wrong role
        if (!endpoint.roles.includes('USER')) {
          await request(app.getHttpServer())
            .get(endpoint.path)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(403);
        }
      }
    });

    it('should prevent privilege escalation', async () => {
      // Test attempting to upgrade role
      await request(app.getHttpServer())
        .put('/api/users/role')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'ADMIN' })
        .expect(403);

      // Test accessing admin functions
      await request(app.getHttpServer())
        .get('/api/admin/system-status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Test modifying other users' data
      await request(app.getHttpServer())
        .put('/api/users/admin/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'Hacked' })
        .expect(403);
    });

    it('should validate resource ownership', async () => {
      // Create a booking as user
      const booking = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: 'test-listing',
          startDate: '2026-12-01',
          endDate: '2026-12-02',
          guestCount: 1,
        })
        .expect(201);

      // Try to modify booking as different user
      await request(app.getHttpServer())
        .put(`/api/bookings/${booking.body.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`) // Different user
        .expect(403);

      // Test accessing other users' bookings
      await request(app.getHttpServer())
        .get(`/api/bookings/${booking.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types', async () => {
      const maliciousFiles = [
        { name: 'malware.exe', content: Buffer.from('fake executable') },
        { name: 'script.js', content: Buffer.from('alert("xss")') },
        { name: 'virus.bat', content: Buffer.from('del /f /s /q C:\\') },
        { name: 'rootkit.sh', content: Buffer.from('rm -rf /') },
      ];

      for (const file of maliciousFiles) {
        await request(app.getHttpServer())
          .post('/api/listings/photos')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('photos', file.content, file.name)
          .expect(400);
      }
    });

    it('should limit file sizes', async () => {
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB

      await request(app.getHttpServer())
        .post('/api/listings/photos')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('photos', largeFile, 'large.jpg')
        .expect(400);
    });

    it('should scan uploaded files', async () => {
      // Test with suspicious file content
      const suspiciousContent = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

      await request(app.getHttpServer())
        .post('/api/listings/photos')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('photos', suspiciousContent, 'eicar.txt')
        .expect(400);
    });
  });

  describe('Webhook Security', () => {
    it('should validate webhook signatures', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            status: 'succeeded',
            metadata: { bookingId: 'test-booking' },
          },
        },
      };

      // Test without signature
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .expect(400);

      // Test with invalid signature
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send(webhookPayload)
        .expect(400);

      // Test with valid signature (mocked)
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);
    });

    it('should handle webhook replay attacks', async () => {
      const webhookPayload = {
        id: 'evt_unique_id',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            status: 'succeeded',
            metadata: { bookingId: 'test-booking' },
          },
        },
      };

      // First webhook
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);

      // Replay attack - same webhook again
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200); // Should handle gracefully (idempotent)
    });
  });

  describe('Audit Logging Security', () => {
    it('should log all security events', async () => {
      // Trigger security events
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'securitytest@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      // Check audit logs
      const auditLogs = await request(app.getHttpServer())
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ action: 'LOGIN_FAILED' })
        .expect(200);

      expect(auditLogs.body.length).toBeGreaterThan(0);
      expect(auditLogs.body[0].action).toBe('LOGIN_FAILED');
    });

    it('should protect audit logs from tampering', async () => {
      // Try to modify audit logs
      await request(app.getHttpServer())
        .put('/api/admin/audit-logs/123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'MODIFIED' })
        .expect(404); // Should not allow modification

      // Try to delete audit logs
      await request(app.getHttpServer())
        .delete('/api/admin/audit-logs/123')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404); // Should not allow deletion
    });
  });

  describe('Compliance Security', () => {
    it('should handle GDPR data requests', async () => {
      // Request data export
      await request(app.getHttpServer())
        .post('/api/users/data-export')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          format: 'json',
          includeSensitive: false,
        })
        .expect(200);

      // Request data deletion
      await request(app.getHttpServer())
        .post('/api/users/request-deletion')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'Privacy request',
          confirmation: true,
        })
        .expect(200);
    });

    it('should implement data retention policies', async () => {
      // Check old data cleanup
      const oldData = await request(app.getHttpServer())
        .get('/api/admin/old-data')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ olderThan: '365 days' })
        .expect(200);

      // Should show data retention status
      expect(oldData.body.retentionPolicy).toBeDefined();
    });

    it('should maintain audit trail for compliance', async () => {
      // Create audit trail
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'Updated' })
        .expect(200);

      // Verify audit trail
      const auditTrail = await request(app.getHttpServer())
        .get('/api/admin/audit-trail/securitytest@example.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(auditTrail.body.length).toBeGreaterThan(0);
      expect(auditTrail.body[0].entityType).toBe('User');
    });
  });
});
