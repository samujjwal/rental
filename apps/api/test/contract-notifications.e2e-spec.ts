/**
 * Notifications Endpoints Contract Validation Suite
 * 
 * Comprehensive contract tests for notifications module endpoints:
 * - Request/response schema validation
 * - Authentication and authorization
 * - Status codes and error handling
 * - Pagination, filtering
 * - Content-Type validation
 * - Input validation
 * - Push notification device registration
 * - Admin-only endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Notifications Contract Validation', () => {
  let app: INestApplication;
  let accessToken: string;
  let adminAccessToken: string;
  let notificationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Setup: Register regular user
    const userResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'notifications-user@example.com',
        username: 'notifications-user',
        password: 'SecurePassword123!',
        firstName: 'Notifications',
        lastName: 'User',
      })
      .expect(201);

    accessToken = userResponse.body.token;

    // Setup: Register admin user
    const adminResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'notifications-admin@example.com',
        username: 'notifications-admin',
        password: 'SecurePassword123!',
        firstName: 'Notifications',
        lastName: 'Admin',
        role: 'admin',
      })
      .expect(201);

    adminAccessToken = adminResponse.body.token;

    // Create a test notification via admin
    const notificationResponse = await request(app.getHttpServer())
      .post('/api/notifications')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        userId: userResponse.body.user.id,
        type: 'BOOKING_CONFIRMED',
        title: 'Test Notification',
        message: 'This is a test notification for contract testing',
        channels: ['in-app'],
        priority: 'normal',
      })
      .expect(201);

    notificationId = notificationResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup
    if (notificationId) {
      await request(app.getHttpServer())
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .catch(() => {});
    }
    await app.close();
  });

  describe('GET /api/notifications - Get User Notifications', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/notifications')
        .expect(401);
    });

    it('should return notifications for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
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
        .get('/api/notifications?page=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/notifications?page=-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/notifications?limit=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/notifications?limit=101')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should support filtering by unread status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should support filtering by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications?type=BOOKING_CONFIRMED')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    it('should validate notification type parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/notifications?type=INVALID_TYPE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return empty results for user with no notifications', async () => {
      // Create a new user with no notifications
      const newUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'no-notifications@example.com',
          username: 'no-notifications',
          password: 'SecurePassword123!',
          firstName: 'No',
          lastName: 'Notifications',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${newUserResponse.body.token}`)
        .expect(200);

      expect(response.body.results).toEqual([]);
    });
  });

  describe('GET /api/notifications/unread-count - Get Unread Count', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .expect(401);
    });

    it('should return unread count for user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThanOrEqual(0);
    });

    it('should return zero for user with no unread notifications', async () => {
      // Mark all as read first
      await request(app.getHttpServer())
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('POST /api/notifications/:id/read - Mark as Read', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/notifications/${notificationId}/read`)
        .expect(401);
    });

    it('should validate notification ownership', async () => {
      // Create another user
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'other-notifications@example.com',
          username: 'other-notifications',
          password: 'SecurePassword123!',
          firstName: 'Other',
          lastName: 'User',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.token;

      await request(app.getHttpServer())
        .post(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/non-existent-id/read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should mark notification as read', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('readAt');
      expect(response.body.read).toBe(true);
    });
  });

  describe('POST /api/notifications/read-all - Mark All as Read', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/read-all')
        .expect(401);
    });

    it('should mark all notifications as read', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThanOrEqual(0);
    });

    it('should return zero count when no unread notifications', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('DELETE /api/notifications/:id - Delete Notification', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/api/notifications/${notificationId}`)
        .expect(401);
    });

    it('should validate notification ownership', async () => {
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'delete-notifications@example.com',
          username: 'delete-notifications',
          password: 'SecurePassword123!',
          firstName: 'Delete',
          lastName: 'User',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.token;

      await request(app.getHttpServer())
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .delete('/api/notifications/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should delete notification successfully', async () => {
      // Create a notification to delete
      const userResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'delete-test@example.com',
          username: 'delete-test',
          password: 'SecurePassword123!',
          firstName: 'Delete',
          lastName: 'Test',
        })
        .expect(201);

      const testToken = userResponse.body.token;

      const notificationResponse = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userId: userResponse.body.user.id,
          type: 'BOOKING_CONFIRMED',
          title: 'Delete Test',
          message: 'This notification will be deleted',
          channels: ['in-app'],
          priority: 'normal',
        })
        .expect(201);

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/notifications/${notificationResponse.body.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(deleteResponse.body).toHaveProperty('message');
      expect(deleteResponse.body.message).toBe('Notification deleted successfully');

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/api/notifications/${notificationResponse.body.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });
  });

  describe('GET /api/notifications/preferences - Get Preferences', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/notifications/preferences')
        .expect(401);
    });

    it('should return user preferences', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('emailEnabled');
      expect(response.body).toHaveProperty('pushEnabled');
      expect(response.body).toHaveProperty('smsEnabled');
      expect(response.body).toHaveProperty('categories');
      expect(typeof response.body.emailEnabled).toBe('boolean');
      expect(typeof response.body.pushEnabled).toBe('boolean');
      expect(typeof response.body.smsEnabled).toBe('boolean');
      expect(Array.isArray(response.body.categories)).toBe(true);
    });
  });

  describe('PATCH /api/notifications/preferences - Update Preferences', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .patch('/api/notifications/preferences')
        .send({ emailEnabled: false })
        .expect(401);
    });

    it('should validate preference types', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emailEnabled: 'invalid' })
        .expect(400);

      expect(response.body.message).toContain('emailEnabled');
    });

    it('should update preferences with valid data', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          emailEnabled: false,
          pushEnabled: true,
          smsEnabled: false,
          categories: ['BOOKING_CONFIRMED', 'PAYMENT_RECEIVED'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('emailEnabled');
      expect(response.body.emailEnabled).toBe(false);
      expect(response.body.pushEnabled).toBe(true);
    });

    it('should validate categories are valid notification types', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categories: ['INVALID_TYPE'],
        })
        .expect(400);

      expect(response.body.message).toContain('categories');
    });
  });

  describe('POST /api/notifications/devices/register - Register Device', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .send({ token: 'device-token', platform: 'ios' })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('token');
      expect(response.body.message).toContain('platform');
    });

    it('should validate platform values', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: 'device-token', platform: 'invalid' })
        .expect(400);

      expect(response.body.message).toContain('platform');
    });

    it('should register device with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: 'test-device-token-123', platform: 'ios' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
    });

    it('should support android platform', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: 'android-device-token', platform: 'android' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should support web platform', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: 'web-device-token', platform: 'web' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/notifications/devices/unregister - Unregister Device', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/devices/unregister')
        .send({ token: 'device-token' })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/unregister')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('token');
    });

    it('should unregister device with valid token', async () => {
      // First register a device
      await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: 'unregister-test-token', platform: 'ios' })
        .expect(200);

      // Then unregister it
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/unregister')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: 'unregister-test-token' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/notifications - Create Notification (Admin Only)', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications')
        .send({
          userId: 'user-id',
          type: 'BOOKING_CONFIRMED',
          title: 'Test',
          message: 'Test message',
          channels: ['in-app'],
          priority: 'normal',
        })
        .expect(401);
    });

    it('should require admin role', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: 'user-id',
          type: 'BOOKING_CONFIRMED',
          title: 'Test',
          message: 'Test message',
          channels: ['in-app'],
          priority: 'normal',
        })
        .expect(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('type');
      expect(response.body.message).toContain('title');
      expect(response.body.message).toContain('message');
      expect(response.body.message).toContain('channels');
    });

    it('should validate notification type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userId: 'user-id',
          type: 'INVALID_TYPE',
          title: 'Test',
          message: 'Test message',
          channels: ['in-app'],
          priority: 'normal',
        })
        .expect(400);

      expect(response.body.message).toContain('type');
    });

    it('should validate channels array', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userId: 'user-id',
          type: 'BOOKING_CONFIRMED',
          title: 'Test',
          message: 'Test message',
          channels: 'invalid-channel',
          priority: 'normal',
        })
        .expect(400);

      expect(response.body.message).toContain('channels');
    });

    it('should validate channel values', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userId: 'user-id',
          type: 'BOOKING_CONFIRMED',
          title: 'Test',
          message: 'Test message',
          channels: ['invalid-channel'],
          priority: 'normal',
        })
        .expect(400);

      expect(response.body.message).toContain('channels');
    });

    it('should validate priority values', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userId: 'user-id',
          type: 'BOOKING_CONFIRMED',
          title: 'Test',
          message: 'Test message',
          channels: ['in-app'],
          priority: 'invalid-priority',
        })
        .expect(400);

      expect(response.body.message).toContain('priority');
    });

    it('should create notification with valid data', async () => {
      const userResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'admin-notification-test@example.com',
          username: 'admin-notification-test',
          password: 'SecurePassword123!',
          firstName: 'Admin',
          lastName: 'Test',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userId: userResponse.body.user.id,
          type: 'BOOKING_CONFIRMED',
          title: 'Admin Test Notification',
          message: 'This is a test notification from admin',
          channels: ['in-app', 'email'],
          priority: 'high',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('message');
      expect(response.body.type).toBe('BOOKING_CONFIRMED');
      expect(response.body.title).toBe('Admin Test Notification');
    });

    it('should sanitize HTML in notification content', async () => {
      const userResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'sanitize-test@example.com',
          username: 'sanitize-test',
          password: 'SecurePassword123!',
          firstName: 'Sanitize',
          lastName: 'Test',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userId: userResponse.body.user.id,
          type: 'BOOKING_CONFIRMED',
          title: '<script>alert("xss")</script>',
          message: 'Test message',
          channels: ['in-app'],
          priority: 'normal',
        })
        .expect(201);

      expect(response.body.title).not.toContain('<script>');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for 400 errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(400);
    });

    it('should return consistent error format for 401 errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(401);
    });

    it('should return consistent error format for 403 errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: 'user-id',
          type: 'BOOKING_CONFIRMED',
          title: 'Test',
          message: 'Test',
          channels: ['in-app'],
          priority: 'normal',
        })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(403);
    });

    it('should return consistent error format for 404 errors', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/notifications/non-existent-id')
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
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ token: 'test-token', platform: 'ios' })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should reject non-JSON content type', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/devices/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/xml')
        .send('<device><token>test</token><platform>ios</platform></device>')
        .expect(415);
    });
  });

  describe('Input Validation', () => {
    it('should validate notification ID format', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/invalid-id-format/read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should validate boolean string parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notifications?unreadOnly=invalid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect([200, 400]).toContain(response.status);
    });
  });
});
