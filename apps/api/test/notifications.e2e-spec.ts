import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { createUserWithRole } from './e2e-helpers';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
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
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { user: { email: 'testuser-notif@test.com' } },
    });
    await prisma.user.deleteMany({ where: { email: 'testuser-notif@test.com' } });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({
      where: { user: { email: 'testuser-notif@test.com' } },
    });
    await prisma.user.deleteMany({ where: { email: 'testuser-notif@test.com' } });

    const user = await createUserWithRole({
      app,
      prisma,
      email: 'testuser-notif@test.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
    });
    userToken = user.accessToken;
    testUserId = user.userId;

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

    await prisma.notification.createMany({
      data: [
        {
          userId: testUserId,
          type: 'PAYOUT_PROCESSED',
          title: 'Payout processed',
          message: 'Your payout was processed',
          read: false,
        },
        {
          userId: testUserId,
          type: 'MESSAGE_RECEIVED',
          title: 'New message',
          message: 'You have a new message',
          read: true,
        },
      ],
    });
  });

  describe('GET /notifications', () => {
    it('should return paginated notifications payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.notifications)).toBe(true);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it('should support unread filtering', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.notifications.forEach((notification: any) => {
        expect(notification.read).toBe(false);
      });
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return unread count', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThan(0);
    });
  });

  describe('POST /notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const response = await request(app.getHttpServer())
        .post(`/notifications/${testNotificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body.read).toBe(true);
      expect(response.body.readAt).toBeDefined();
    });
  });

  describe('POST /notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app.getHttpServer())
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Notification Preferences', () => {
    it('should return preferences and allow updates', async () => {
      const initial = await request(app.getHttpServer())
        .get('/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(initial.body).toHaveProperty('email');
      expect(initial.body).toHaveProperty('inApp');

      const updated = await request(app.getHttpServer())
        .patch('/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: false,
          bookingUpdates: false,
        })
        .expect(200);

      expect(updated.body.email).toBe(false);
      expect(updated.body.bookingUpdates).toBe(false);
    });
  });
});
