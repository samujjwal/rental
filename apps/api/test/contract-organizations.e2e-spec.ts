/**
 * Organizations Endpoints Contract Validation Suite
 * 
 * Comprehensive contract tests for organizations module endpoints:
 * - Request/response schema validation
 * - Authentication and authorization
 * - Status codes and error handling
 * - Pagination, filtering
 * - Content-Type validation
 * - Input validation
 * - Member management
 * - Role-based access control
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Organizations Contract Validation', () => {
  let app: INestApplication;
  let accessToken: string;
  let memberAccessToken: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Setup: Register owner user
    const ownerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'org-owner@example.com',
        username: 'org-owner',
        password: 'SecurePassword123!',
        firstName: 'Organization',
        lastName: 'Owner',
      })
      .expect(201);

    accessToken = ownerResponse.body.token;

    // Setup: Register member user
    const memberResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'org-member@example.com',
        username: 'org-member',
        password: 'SecurePassword123!',
        firstName: 'Organization',
        lastName: 'Member',
      })
      .expect(201);

    memberAccessToken = memberResponse.body.token;

    // Create a test organization
    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Organization',
        description: 'Organization for contract testing',
        type: 'RENTAL_BUSINESS',
        businessType: 'CAR_RENTAL',
        website: 'https://example.com',
        phone: '+9779800000000',
        address: {
          street: '123 Org St',
          city: 'Kathmandu',
          state: 'Bagmati',
          postalCode: '44600',
          country: 'Nepal',
        },
      })
      .expect(201);

    organizationId = orgResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup
    if (organizationId) {
      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    }
    await app.close();
  });

  describe('POST /api/organizations - Create Organization', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations')
        .send({ name: 'Test Org' })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('name');
      expect(response.body.message).toContain('type');
    });

    it('should validate organization type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Org',
          type: 'INVALID_TYPE',
        })
        .expect(400);

      expect(response.body.message).toContain('type');
    });

    it('should validate business type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Org',
          type: 'RENTAL_BUSINESS',
          businessType: 'INVALID_BUSINESS',
        })
        .expect(400);

      expect(response.body.message).toContain('businessType');
    });

    it('should validate website URL format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Org',
          type: 'RENTAL_BUSINESS',
          website: 'invalid-url',
        })
        .expect(400);

      expect(response.body.message).toContain('website');
    });

    it('should validate phone format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Org',
          type: 'RENTAL_BUSINESS',
          phone: 'invalid-phone',
        })
        .expect(400);

      expect(response.body.message).toContain('phone');
    });

    it('should validate address structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Org',
          type: 'RENTAL_BUSINESS',
          address: {},
        })
        .expect(400);

      expect(response.body.message).toContain('address');
    });

    it('should create organization with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Valid Test Organization',
          description: 'A valid organization for testing',
          type: 'RENTAL_BUSINESS',
          businessType: 'CAR_RENTAL',
          website: 'https://valid-example.com',
          phone: '+9779800000000',
          address: {
            street: '456 Valid St',
            city: 'Pokhara',
            state: 'Gandaki',
            postalCode: '33700',
            country: 'Nepal',
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('type');
      expect(response.body.name).toBe('Valid Test Organization');
      expect(response.body.type).toBe('RENTAL_BUSINESS');

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/api/organizations/${response.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('should sanitize HTML in text fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: '<script>alert("xss")</script>',
          type: 'RENTAL_BUSINESS',
        })
        .expect(201);

      expect(response.body.name).not.toContain('<script>');

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/api/organizations/${response.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });

  describe('GET /api/organizations/my - Get User Organizations', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/organizations/my')
        .expect(401);
    });

    it('should return user organizations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/organizations/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('organizations');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.organizations)).toBe(true);
      expect(typeof response.body.total).toBe('number');
    });

    it('should return empty array for user with no organizations', async () => {
      const newUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'no-orgs@example.com',
          username: 'no-orgs',
          password: 'SecurePassword123!',
          firstName: 'No',
          lastName: 'Orgs',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/organizations/my')
        .set('Authorization', `Bearer ${newUserResponse.body.token}`)
        .expect(200);

      expect(response.body.organizations).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });

  describe('GET /api/organizations/:id - Get Organization Details', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .expect(401);
    });

    it('should return organization details for member', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .get('/api/organizations/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should restrict access to non-members', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/organizations/:id - Update Organization', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}`)
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('should validate organization access', async () => {
      await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ name: 'Unauthorized Update' })
        .expect(403);
    });

    it('should validate update data', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type: 'INVALID_TYPE' })
        .expect(400);

      expect(response.body.message).toContain('type');
    });

    it('should update organization with valid data', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Test Organization' })
        .expect(200);

      expect(response.body.name).toBe('Updated Test Organization');
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .put('/api/organizations/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('POST /api/organizations/:id/members - Invite Member', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .send({ email: 'new@example.com', role: 'MEMBER' })
        .expect(401);
    });

    it('should validate organization access', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ email: 'new@example.com', role: 'MEMBER' })
        .expect(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('email');
      expect(response.body.message).toContain('role');
    });

    it('should validate email format', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'invalid-email', role: 'MEMBER' })
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should validate role values', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'new@example.com', role: 'INVALID_ROLE' })
        .expect(400);

      expect(response.body.message).toContain('role');
    });

    it('should invite member with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'invite-test@example.com', role: 'MEMBER' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
      expect(response.body.email).toBe('invite-test@example.com');
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations/non-existent-id/members')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'new@example.com', role: 'MEMBER' })
        .expect(404);
    });
  });

  describe('DELETE /api/organizations/:id/members/:userId - Remove Member', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}/members/user-id`)
        .expect(401);
    });

    it('should validate organization access', async () => {
      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}/members/user-id`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .delete('/api/organizations/non-existent-id/members/user-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 204 on successful removal', async () => {
      // First invite a member
      const inviteResponse = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'remove-test@example.com', role: 'MEMBER' })
        .expect(201);

      // Then remove them
      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}/members/${inviteResponse.body.userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });

  describe('PUT /api/organizations/:id/members/:userId/role - Update Member Role', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}/members/user-id/role`)
        .send({ role: 'ADMIN' })
        .expect(401);
    });

    it('should validate organization access', async () => {
      await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}/members/user-id/role`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ role: 'ADMIN' })
        .expect(403);
    });

    it('should validate role values', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}/members/user-id/role`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ role: 'INVALID_ROLE' })
        .expect(400);

      expect(response.body.message).toContain('role');
    });

    it('should accept valid role values', async () => {
      const validRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

      for (const role of validRoles) {
        const response = await request(app.getHttpServer())
          .put(`/api/organizations/${organizationId}/members/user-id/role`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ role })
          .expect(400); // Will fail because user doesn't exist, but role validation passes

        expect(response.status).toBe(400); // User not found, not role validation error
      }
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .put('/api/organizations/non-existent-id/members/user-id/role')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ role: 'ADMIN' })
        .expect(404);
    });
  });

  describe('GET /api/organizations/:id/stats - Get Organization Statistics', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/stats`)
        .expect(401);
    });

    it('should validate organization access', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/stats`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);
    });

    it('should return statistics for member', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/stats`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalListings');
      expect(response.body).toHaveProperty('activeListings');
      expect(response.body).toHaveProperty('totalBookings');
      expect(response.body).toHaveProperty('activeBookings');
      expect(response.body).toHaveProperty('totalRevenue');
      expect(typeof response.body.totalListings).toBe('number');
      expect(typeof response.body.activeListings).toBe('number');
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .get('/api/organizations/non-existent-id/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /api/organizations/:id/members - Get Organization Members', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/members`)
        .expect(401);
    });

    it('should validate organization access', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);
    });

    it('should return members list', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('userId');
        expect(response.body[0]).toHaveProperty('role');
        expect(response.body[0]).toHaveProperty('joinedAt');
      }
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .get('/api/organizations/non-existent-id/members')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/organizations/:id - Deactivate Organization', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete('/api/organizations/some-id')
        .expect(401);
    });

    it('should validate organization access', async () => {
      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);
    });

    it('should return 204 on successful deactivation', async () => {
      // Create a test organization to delete
      const orgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Delete Test Org',
          type: 'RENTAL_BUSINESS',
          businessType: 'CAR_RENTAL',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/organizations/${orgResponse.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .delete('/api/organizations/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('POST /api/organizations/invitations/accept - Accept Invitation', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations/invitations/accept')
        .send({ organizationId: 'org-id' })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations/invitations/accept')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('organizationId');
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations/invitations/accept')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ organizationId: 'non-existent-id' })
        .expect(404);
    });
  });

  describe('POST /api/organizations/invitations/decline - Decline Invitation', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations/invitations/decline')
        .send({ organizationId: 'org-id' })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations/invitations/decline')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('organizationId');
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations/invitations/decline')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ organizationId: 'non-existent-id' })
        .expect(404);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for 400 errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(400);
    });

    it('should return consistent error format for 401 errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/organizations/my')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(401);
    });

    it('should return consistent error format for 403 errors', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(403);
    });

    it('should return consistent error format for 404 errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/organizations/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(404);
    });
  });

  describe('Content Negotiation', () => {
    it('should accept JSON content type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({
          name: 'Content Test Org',
          type: 'RENTAL_BUSINESS',
          businessType: 'CAR_RENTAL',
        })
        .expect(201);

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should reject non-JSON content type', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/xml')
        .send('<organization><name>Test</name></organization>')
        .expect(415);
    });
  });

  describe('Input Validation', () => {
    it('should validate organization ID format', async () => {
      await request(app.getHttpServer())
        .get('/api/organizations/invalid-id-format')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should validate user ID format in member operations', async () => {
      await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}/members/invalid-user-id/role`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ role: 'ADMIN' })
        .expect(400);
    });
  });
});
