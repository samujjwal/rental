import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let testUserId: string;
  let testNotificationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Get admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@rental-portal.com', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    // Create test user
    const userSignup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'testuser-notif@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });
    userToken = userSignup.body.accessToken;
    testUserId = userSignup.body.user.id;

    // Create test notifications
    const notification = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'BOOKING_CONFIRMED',
        title: 'Test Notification',
        message: 'This is a test notification',
        read: false,
      },
    });
    testNotificationId = notification.id;

    // Create more notifications for testing
    await prisma.notification.createMany({
      data: [
        {
          userId: testUserId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Received',
          message: 'You have received a payment',
          read: false,
        },
        {
          userId: testUserId,
          type: 'MESSAGE_RECEIVED',
          title: 'New Message',
          message: 'You have a new message',
          read: true,
        },
        {
          userId: testUserId,
          type: 'REVIEW_RECEIVED',
          title: 'New Review',
          message: 'Someone left you a review',
          read: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { email: 'testuser-notif@test.com' } }).catch(() => {});
    await app.close();
  });

  describe('GET /notifications', () => {
    it('should return user notifications', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((notification: any) => {
        expect(notification).toHaveProperty('id');
        expect(notification).toHaveProperty('type');
        expect(notification).toHaveProperty('title');
        expect(notification).toHaveProperty('message');
        expect(notification).toHaveProperty('read');
      });
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .expect(401);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(2);
    });

    it('should filter by unread only', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.forEach((notification: any) => {
        expect(notification.read).toBe(false);
      });
    });

    it('should filter by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?type=BOOKING_CONFIRMED')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.forEach((notification: any) => {
        expect(notification.type).toBe('BOOKING_CONFIRMED');
      });
    });

    it('should order by creation date descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      for (let i = 1; i < response.body.length; i++) {
        const prev = new Date(response.body[i - 1].createdAt);
        const curr = new Date(response.body[i].createdAt);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThanOrEqual(0);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(401);
    });
  });

  describe('POST /notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const response = await request(app.getHttpServer())
        .post(`/notifications/${testNotificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.read).toBe(true);
      expect(response.body.readAt).toBeDefined();
    });

    it('should handle already read notification', async () => {
      // Mark as read first
      await request(app.getHttpServer())
        .post(`/notifications/${testNotificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Try marking again
      const response = await request(app.getHttpServer())
        .post(`/notifications/${testNotificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.read).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .post('/notifications/non-existent-id/read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should not allow marking other user\'s notifications', async () => {
      // Create notification for admin
      const adminNotification = await prisma.notification.create({
        data: {
          userId: (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))!.id,
          type: 'SYSTEM_UPDATE',
          title: 'Admin Notification',
          message: 'Admin only',
          read: false,
        },
      });

      await request(app.getHttpServer())
        .post(`/notifications/${adminNotification.id}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Cleanup
      await prisma.notification.delete({ where: { id: adminNotification.id } });
    });
  });

  describe('POST /notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      // First create some unread notifications
      await prisma.notification.createMany({
        data: [
          {
            userId: testUserId,
            type: 'BOOKING_CONFIRMED',
            title: 'Unread 1',
            message: 'Test',
            read: false,
          },
          {
            userId: testUserId,
            type: 'BOOKING_CONFIRMED',
            title: 'Unread 2',
            message: 'Test',
            read: false,
          },
        ],
      });

      await request(app.getHttpServer())
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify all are read
      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('should delete a notification', async () => {
      // Create a notification to delete
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'BOOKING_CONFIRMED',
          title: 'To Delete',
          message: 'Will be deleted',
          read: false,
        },
      });

      await request(app.getHttpServer())
        .delete(`/notifications/${notification.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify deleted
      const deleted = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(deleted).toBeNull();
    });

    it('should not allow deleting other user\'s notifications', async () => {
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      const adminNotification = await prisma.notification.create({
        data: {
          userId: adminUser!.id,
          type: 'SYSTEM_UPDATE',
          title: 'Admin Notification',
          message: 'Admin only',
          read: false,
        },
      });

      await request(app.getHttpServer())
        .delete(`/notifications/${adminNotification.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Cleanup
      await prisma.notification.delete({ where: { id: adminNotification.id } });
    });
  });

  describe('Notification Preferences', () => {
    describe('GET /notifications/preferences', () => {
      it('should return notification preferences', async () => {
        const response = await request(app.getHttpServer())
          .get('/notifications/preferences')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('emailNotifications');
        expect(response.body).toHaveProperty('pushNotifications');
        expect(response.body).toHaveProperty('smsNotifications');
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .get('/notifications/preferences')
          .expect(401);
      });
    });

    describe('PATCH /notifications/preferences', () => {
      it('should update notification preferences', async () => {
        const updateDto = {
          emailNotifications: false,
          pushNotifications: true,
          smsNotifications: false,
          marketingEmails: false,
        };

        const response = await request(app.getHttpServer())
          .patch('/notifications/preferences')
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.emailNotifications).toBe(false);
        expect(response.body.pushNotifications).toBe(true);
      });

      it('should validate preference values', async () => {
        const invalidDto = {
          emailNotifications: 'invalid', // Should be boolean
        };

        await request(app.getHttpServer())
          .patch('/notifications/preferences')
          .set('Authorization', `Bearer ${userToken}`)
          .send(invalidDto)
          .expect(400);
      });
    });
  });

  describe('Device Tokens', () => {
    describe('POST /notifications/devices/register', () => {
      it('should register a device token', async () => {
        const deviceDto = {
          token: `device_token_${Date.now()}`,
          platform: 'ios',
        };

        const response = await request(app.getHttpServer())
          .post('/notifications/devices/register')
          .set('Authorization', `Bearer ${userToken}`)
          .send(deviceDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.token).toBe(deviceDto.token);
        expect(response.body.platform).toBe(deviceDto.platform);
        expect(response.body.active).toBe(true);

        // Cleanup
        await prisma.deviceToken.delete({ where: { id: response.body.id } });
      });

      it('should validate platform', async () => {
        await request(app.getHttpServer())
          .post('/notifications/devices/register')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token: 'test', platform: 'invalid_platform' })
          .expect(400);
      });

      it('should handle duplicate token', async () => {
        const token = `duplicate_token_${Date.now()}`;
        
        // First registration
        const first = await request(app.getHttpServer())
          .post('/notifications/devices/register')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token, platform: 'ios' });

        // Second registration with same token
        const second = await request(app.getHttpServer())
          .post('/notifications/devices/register')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token, platform: 'ios' })
          .expect(200); // Should update existing

        // Cleanup
        await prisma.deviceToken.deleteMany({ where: { token } });
      });
    });

    describe('POST /notifications/devices/unregister', () => {
      it('should unregister a device token', async () => {
        // First register a device
        const token = `unregister_token_${Date.now()}`;
        await prisma.deviceToken.create({
          data: {
            userId: testUserId,
            token,
            platform: 'ios',
            active: true,
          },
        });

        await request(app.getHttpServer())
          .post('/notifications/devices/unregister')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token })
          .expect(200);

        // Verify deactivated
        const device = await prisma.deviceToken.findFirst({ where: { token } });
        expect(device?.active).toBe(false);

        // Cleanup
        await prisma.deviceToken.deleteMany({ where: { token } });
      });
    });
  });

  describe('Notification Types', () => {
    it('should handle BOOKING_REQUEST notifications', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'BOOKING_REQUEST',
          title: 'New Booking Request',
          message: 'You have a new booking request',
          data: JSON.stringify({ bookingId: 'test-booking-123' }),
          read: false,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const found = response.body.find((n: any) => n.id === notification.id);
      expect(found).toBeDefined();
      expect(found.type).toBe('BOOKING_REQUEST');

      // Cleanup
      await prisma.notification.delete({ where: { id: notification.id } });
    });

    it('should handle DISPUTE_OPENED notifications', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'DISPUTE_OPENED',
          title: 'Dispute Filed',
          message: 'A dispute has been filed for your booking',
          actionUrl: '/disputes/test-dispute-123',
          read: false,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const found = response.body.find((n: any) => n.id === notification.id);
      expect(found).toBeDefined();
      expect(found.actionUrl).toBe('/disputes/test-dispute-123');

      // Cleanup
      await prisma.notification.delete({ where: { id: notification.id } });
    });
  });

  describe('Edge Cases', () => {
    it('should handle large number of notifications', async () => {
      // Create 50 notifications
      const notifications = await prisma.notification.createMany({
        data: Array(50)
          .fill(null)
          .map((_, i) => ({
            userId: testUserId,
            type: 'BOOKING_CONFIRMED',
            title: `Notification ${i}`,
            message: `Test message ${i}`,
            read: i % 2 === 0,
          })),
      });

      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.notification.deleteMany({
        where: { userId: testUserId, title: { startsWith: 'Notification' } },
      });
    });

    it('should handle concurrent read operations', async () => {
      // Create notification for concurrent test
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'BOOKING_CONFIRMED',
          title: 'Concurrent Test',
          message: 'Test',
          read: false,
        },
      });

      const reads = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post(`/notifications/${notification.id}/read`)
            .set('Authorization', `Bearer ${userToken}`),
        );

      const results = await Promise.all(reads);
      const successful = results.filter((r) => r.status === 200);

      expect(successful.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.notification.delete({ where: { id: notification.id } });
    });

    it('should handle Unicode content in notifications', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'MESSAGE_RECEIVED',
          title: '新しいメッセージ 🎉',
          message: 'Mensaje en español con emojis 🏠✨',
          read: false,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const found = response.body.find((n: any) => n.id === notification.id);
      expect(found.title).toBe('新しいメッセージ 🎉');

      // Cleanup
      await prisma.notification.delete({ where: { id: notification.id } });
    });
  });
});
