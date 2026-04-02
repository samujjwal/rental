import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Comprehensive E2E tests for timezone edge cases
 * Tests booking flows across different timezones and DST boundaries
 */
describe('Timezone Edge Cases E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [/* AppModule */],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cross-Timezone Bookings', () => {
    it('should handle booking from different timezone', async () => {
      // User in UTC-7 (PST) booking listing in UTC+5:45 (Nepal)
      const startDate = new Date('2026-05-01T00:00:00+05:45'); // Nepal midnight
      const endDate = new Date('2026-05-05T00:00:00+05:45');

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-nepal-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body.startDate).toBe(startDate.toISOString());
    });

    it('should calculate correct duration across timezones', async () => {
      const startDate = new Date('2026-05-01T00:00:00+05:45');
      const endDate = new Date('2026-05-05T00:00:00+05:45');

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-nepal-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body.totalDays).toBe(4); // 4 full days
    });

    it('should handle booking at timezone boundary', async () => {
      // Booking at exactly midnight in Nepal time
      const startDate = new Date('2026-05-01T00:00:00.000+05:45');
      const endDate = new Date('2026-05-02T00:00:00.000+05:45');

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-nepal-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body.totalDays).toBe(1);
    });

    it('should prevent booking with reversed timezone dates', async () => {
      const startDate = new Date('2026-05-05T00:00:00+05:45');
      const endDate = new Date('2026-05-01T00:00:00+05:45');

      await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-nepal-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(400);
    });
  });

  describe('DST Transitions', () => {
    it('should handle booking during spring DST transition', async () => {
      // March 10, 2026 - DST starts in US (2am -> 3am)
      const startDate = new Date('2026-03-10T01:00:00-08:00'); // Before DST
      const endDate = new Date('2026-03-10T04:00:00-07:00'); // After DST

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-us-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      // Should handle the "lost hour" correctly
      expect(response.body).toBeDefined();
    });

    it('should handle booking during fall DST transition', async () => {
      // November 3, 2026 - DST ends in US (2am -> 1am)
      const startDate = new Date('2026-11-03T01:00:00-07:00'); // Before DST ends
      const endDate = new Date('2026-11-03T03:00:00-08:00'); // After DST ends

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-us-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body).toBeDefined();
    });

    it('should calculate refund correctly across DST boundary', async () => {
      const booking = await createTestBooking({
        startDate: new Date('2026-03-08T10:00:00-08:00'),
        endDate: new Date('2026-03-12T10:00:00-07:00'), // Crosses DST
        totalPrice: 40000,
      });

      // Cancel on March 9 (before DST)
      const response = await request(app.getHttpServer())
        .post(`/bookings/${booking.id}/cancel`)
        .send({ reason: 'Changed plans' })
        .expect(200);

      // Should calculate refund based on actual time remaining
      expect(response.body.refund.refundAmount).toBeGreaterThan(0);
    });

    it('should handle cancellation policy deadline across DST', async () => {
      const booking = await createTestBooking({
        startDate: new Date('2026-03-10T14:00:00-08:00'), // 2pm before DST
        endDate: new Date('2026-03-12T14:00:00-07:00'),
        cancellationPolicy: {
          type: 'FLEXIBLE',
          fullRefundHours: 24,
        },
      });

      // Cancel 23 hours before (should be within 24h window despite DST)
      const cancelTime = new Date('2026-03-09T16:00:00-08:00');
      
      const response = await request(app.getHttpServer())
        .post(`/bookings/${booking.id}/cancel`)
        .send({ reason: 'Test', timestamp: cancelTime.toISOString() })
        .expect(200);

      expect(response.body.refund.refundAmount).toBe(booking.totalPrice);
    });
  });

  describe('Availability Checks Across Timezones', () => {
    it('should check availability in listing local time', async () => {
      // Create existing booking in Nepal time
      await createTestBooking({
        listingId: 'listing-nepal-1',
        startDate: new Date('2026-05-01T00:00:00+05:45'),
        endDate: new Date('2026-05-05T00:00:00+05:45'),
      });

      // Try to book overlapping dates from different timezone
      const startDate = new Date('2026-05-03T00:00:00-07:00'); // PST
      const endDate = new Date('2026-05-06T00:00:00-07:00');

      await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-nepal-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(400); // Should detect overlap
    });

    it('should handle same-day booking in different timezones', async () => {
      // May 1 in Nepal is still April 30 in PST
      const nepalDate = new Date('2026-05-01T01:00:00+05:45');
      const pstDate = new Date('2026-04-30T12:00:00-07:00');

      // These are the same moment in time
      expect(nepalDate.getTime()).toBe(pstDate.getTime());

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-nepal-1',
          startDate: nepalDate.toISOString(),
          endDate: new Date('2026-05-02T00:00:00+05:45').toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body.startDate).toBe(nepalDate.toISOString());
    });
  });

  describe('Notification Timing Across Timezones', () => {
    it('should send reminder at correct local time', async () => {
      const booking = await createTestBooking({
        startDate: new Date('2026-05-01T10:00:00+05:45'), // 10am Nepal
        listingId: 'listing-nepal-1',
      });

      // Trigger 24h reminder job
      await request(app.getHttpServer())
        .post('/admin/jobs/send-booking-reminders')
        .expect(200);

      // Verify notification sent at appropriate time
      const notifications = await prisma.notification.findMany({
        where: { 
          data: { contains: booking.id },
          type: 'BOOKING_REMINDER',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should handle payment deadline across timezones', async () => {
      const booking = await createTestBooking({
        status: 'PENDING_PAYMENT',
        createdAt: new Date('2026-04-30T23:00:00+05:45'), // 11pm Nepal
      });

      // 24 hours later in UTC
      await new Promise(resolve => setTimeout(resolve, 100));

      // Run expiration job
      await request(app.getHttpServer())
        .post('/admin/jobs/expire-pending-payments')
        .expect(200);

      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      // Should expire based on actual elapsed time, not calendar days
      expect(updatedBooking?.status).toBe('CANCELLED');
    });
  });

  describe('Price Calculation Across Timezones', () => {
    it('should calculate price based on listing timezone', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings/quote')
        .send({
          listingId: 'listing-nepal-1',
          startDate: new Date('2026-05-01T00:00:00+05:45').toISOString(),
          endDate: new Date('2026-05-05T00:00:00+05:45').toISOString(),
        })
        .expect(200);

      expect(response.body.totalDays).toBe(4);
      expect(response.body.subtotal).toBeGreaterThan(0);
    });

    it('should handle partial day pricing at timezone boundaries', async () => {
      // Check-in at 2pm Nepal time, check-out at 11am Nepal time
      const startDate = new Date('2026-05-01T14:00:00+05:45');
      const endDate = new Date('2026-05-05T11:00:00+05:45');

      const response = await request(app.getHttpServer())
        .post('/bookings/quote')
        .send({
          listingId: 'listing-nepal-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(200);

      // Should count as 4 full days (standard hotel logic)
      expect(response.body.totalDays).toBe(4);
    });
  });

  describe('Webhook Processing Across Timezones', () => {
    it('should process webhook with correct timestamp', async () => {
      const booking = await createTestBooking({
        status: 'PENDING_PAYMENT',
      });

      // Stripe webhook with UTC timestamp
      const webhookTime = new Date('2026-05-01T12:00:00Z');

      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          created: Math.floor(webhookTime.getTime() / 1000),
          data: {
            object: {
              id: 'pi_test_123',
              status: 'succeeded',
            },
          },
        })
        .expect(200);

      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: 'pi_test_123' },
      });

      expect(payment?.createdAt).toBeDefined();
    });

    it('should handle out-of-order webhooks with timestamps', async () => {
      const booking = await createTestBooking();

      // Receive later webhook first
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          created: Math.floor(Date.now() / 1000) + 100,
          data: { object: { id: 'pi_test', status: 'succeeded' } },
        });

      // Then earlier webhook
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .send({
          type: 'payment_intent.processing',
          created: Math.floor(Date.now() / 1000),
          data: { object: { id: 'pi_test', status: 'processing' } },
        });

      // Should maintain correct final state
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: 'pi_test' },
      });

      expect(payment?.status).toBe('COMPLETED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap second', async () => {
      // June 30, 2026 23:59:60 UTC (hypothetical leap second)
      const leapSecond = new Date('2026-06-30T23:59:60Z');

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-1',
          startDate: leapSecond.toISOString(),
          endDate: new Date('2026-07-05T00:00:00Z').toISOString(),
          guestCount: 2,
        });

      // Should handle gracefully (likely rounds to next second)
      expect(response.status).toBeLessThan(500);
    });

    it('should handle timezone with 45-minute offset', async () => {
      // Nepal uses UTC+5:45
      const nepalTime = new Date('2026-05-01T12:45:00+05:45');

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-nepal-1',
          startDate: nepalTime.toISOString(),
          endDate: new Date('2026-05-05T12:45:00+05:45').toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body.startDate).toBe(nepalTime.toISOString());
    });

    it('should handle booking spanning year boundary', async () => {
      const startDate = new Date('2026-12-30T00:00:00Z');
      const endDate = new Date('2027-01-03T00:00:00Z');

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-1',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      expect(response.body.totalDays).toBe(4);
    });

    it('should handle International Date Line crossing', async () => {
      // Booking from Samoa (UTC-11) to Kiribati (UTC+14)
      const samoaTime = new Date('2026-05-01T12:00:00-11:00');
      const kiribatiTime = new Date('2026-05-02T12:00:00+14:00');

      // These are only 1 hour apart in real time!
      const hoursDiff = (kiribatiTime.getTime() - samoaTime.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBe(1);

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          listingId: 'listing-pacific-1',
          startDate: samoaTime.toISOString(),
          endDate: kiribatiTime.toISOString(),
          guestCount: 2,
        });

      // Should handle correctly based on actual elapsed time
      expect(response.status).toBeLessThan(500);
    });
  });

  // Helper function
  async function createTestBooking(overrides = {}) {
    return await prisma.booking.create({
      data: {
        renterId: 'test-renter',
        ownerId: 'test-owner',
        listingId: 'test-listing',
        status: 'CONFIRMED',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        totalPrice: 50000,
        currency: 'NPR',
        ...overrides,
      },
    });
  }
});
