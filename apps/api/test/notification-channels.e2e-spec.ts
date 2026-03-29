/**
 * TC-NOTIF-001: Multi-channel Notification Delivery Tests
 * Validates Email, SMS, and Push notification routing
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole, NotificationType } from '@rental-portal/database';
import { createUserWithRole, buildTestEmail, cleanupCoreRelationalData } from './e2e-helpers';

describe('Notification Channels (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userId: string;
  let userEmail: string;

  const testEmail = buildTestEmail('notif-user');

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

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });

    const user = await createUserWithRole({
      app,
      prisma,
      email: testEmail,
      role: UserRole.USER,
      password: 'TestPass123!',
      firstName: 'Notif',
      lastName: 'User',
    });
    userId = user.userId;
    userEmail = testEmail;

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        phone: '+1234567890',
      },
    });

    // Create user preferences for notifications
    await prisma.userPreferences.create({
      data: {
        userId: userId,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
      },
    });
  });

  describe('Email notifications', () => {
    it('should create email notification for booking confirmation', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: NotificationType.BOOKING_CONFIRMED,
          title: 'Booking Confirmed',
          message: 'Your booking has been confirmed!',
          sentViaEmail: true,
          data: JSON.stringify({ bookingId: 'test-booking-123' }),
        },
      });

      expect(notification).toBeDefined();
      expect(notification.sentViaEmail).toBe(true);

      // Verify stored in database
      const dbNotification = await prisma.notification.findUnique({
        where: { id: notification.id },
      });

      expect(dbNotification).toBeDefined();
      expect(dbNotification?.type).toBe(NotificationType.BOOKING_CONFIRMED);
    });

    it('should respect email opt-out preferences', async () => {
      // Update preferences to disable email
      await prisma.userPreferences.update({
        where: { userId },
        data: { emailNotifications: false },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_REMINDER,
        title: 'Booking Reminder',
        content: 'Reminder: Your booking is tomorrow',
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      });

      expect(prefs?.emailNotifications).toBe(false);
    });
  });

  describe('SMS notifications', () => {
    it('should create SMS notification when phone verified', async () => {
      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Your booking is confirmed!',
        channels: [NotificationChannel.SMS],
      });

      expect(notification.channels).toContain(NotificationChannel.SMS);
    });

    it('should skip SMS when phone not verified', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { phoneVerified: false },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Your booking is confirmed!',
        channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
      });

      expect(notification.channels).not.toContain(NotificationChannel.SMS);
      expect(notification.channels).toContain(NotificationChannel.EMAIL);
    });

    it('should respect SMS opt-out preferences', async () => {
      await prisma.userPreferences.update({
        where: { userId },
        data: { smsNotifications: false },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_REMINDER,
        title: 'Booking Reminder',
        content: 'Reminder about booking',
        channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
      });

      expect(notification.channels).not.toContain(NotificationChannel.SMS);
    });
  });

  describe('Push notifications', () => {
    it('should create push notification when device registered', async () => {
      // Register a device token
      await prisma.deviceToken.create({
        data: {
          userId,
          token: 'test-fcm-token-123',
          platform: 'FCM',
          active: true,
        },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Your booking is confirmed!',
        channels: [NotificationChannel.PUSH],
      });

      expect(notification.channels).toContain(NotificationChannel.PUSH);
    });

    it('should skip push when no device registered', async () => {
      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Your booking is confirmed!',
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      });

      expect(notification.channels).not.toContain(NotificationChannel.PUSH);
      expect(notification.channels).toContain(NotificationChannel.EMAIL);
    });

    it('should respect push opt-out preferences', async () => {
      await prisma.deviceToken.create({
        data: {
          userId,
          token: 'test-fcm-token-456',
          platform: 'FCM',
          active: true,
        },
      });

      await prisma.userPreferences.update({
        where: { userId },
        data: { pushNotifications: false },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_REMINDER,
        title: 'Booking Reminder',
        content: 'Reminder',
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      });

      expect(notification.channels).not.toContain(NotificationChannel.PUSH);
    });
  });

  describe('Multi-channel routing', () => {
    it('should route to all enabled channels', async () => {
      // Setup: user with email, SMS, push enabled
      await prisma.deviceToken.create({
        data: {
          userId,
          token: 'test-fcm-token-789',
          platform: 'FCM',
          active: true,
        },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Great news!',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
      });

      expect(notification.channels).toContain(NotificationChannel.EMAIL);
      expect(notification.channels).toContain(NotificationChannel.SMS);
      expect(notification.channels).toContain(NotificationChannel.PUSH);
    });

    it('should fallback to in-app when no external channels available', async () => {
      // Disable all external notifications
      await prisma.userPreferences.update({
        where: { userId },
        data: {
          emailNotifications: false,
          smsNotifications: false,
          pushNotifications: false,
        },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Confirmed!',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
      });

      // Should fall back to IN_APP
      expect(notification.channels).toContain(NotificationChannel.IN_APP);
    });
  });

  describe('Notification templates', () => {
    it('should render template with variables', async () => {
      // Create a template
      await prisma.emailTemplate.create({
        data: {
          name: 'booking_confirmation',
          type: 'BOOKING_CONFIRMED',
          subject: 'Booking Confirmed: {{listingTitle}}',
          bodyHtml: '<p>Hi {{firstName}}, your booking at {{listingTitle}} is confirmed!</p>',
          bodyText: 'Hi {{firstName}}, your booking at {{listingTitle}} is confirmed!',
          active: true,
        },
      });

      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Your booking is confirmed',
        templateData: {
          firstName: 'Test',
          listingTitle: 'Beach House',
        },
        channels: [NotificationChannel.EMAIL],
      });

      expect(notification.templateData).toBeDefined();
      expect(notification.templateData?.firstName).toBe('Test');
    });
  });

  describe('Notification status tracking', () => {
    it('should track notification delivery status', async () => {
      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Confirmed!',
        channels: [NotificationChannel.EMAIL],
      });

      // Initially pending
      const created = await prisma.notification.findUnique({
        where: { id: notification.id },
      });

      expect(created?.status).toBe('PENDING');
    });

    it('should mark notification as read', async () => {
      const notification = await notificationsService.create({
        userId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        content: 'Confirmed!',
        channels: [NotificationChannel.IN_APP],
      });

      // Mark as read
      await notificationsService.markAsRead(notification.id, userId);

      const updated = await prisma.notification.findUnique({
        where: { id: notification.id },
      });

      expect(updated?.read).toBe(true);
      expect(updated?.readAt).toBeDefined();
    });
  });

  describe('Bulk notifications', () => {
    it('should create notifications for multiple users', async () => {
      // Create additional users
      const user2 = await createUserWithRole({
        app,
        prisma,
        email: buildTestEmail('notif-user2'),
        role: UserRole.USER,
        password: 'TestPass123!',
        firstName: 'User',
        lastName: 'Two',
      });

      await prisma.user.update({
        where: { id: user2.userId },
        data: { emailVerified: true, status: 'ACTIVE' },
      });

      const userIds = [userId, user2.userId];

      const notifications = await Promise.all(
        userIds.map((uid) =>
          notificationsService.create({
            userId: uid,
            type: NotificationType.BOOKING_REMINDER,
            title: 'System Update',
            content: 'Important update',
            channels: [NotificationChannel.EMAIL],
          }),
        ),
      );

      expect(notification1.id).toBeDefined();
      expect(notification2.id).toBeDefined();
    });
  });
});
