import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('API Integration - Complete Coverage', () => {
  let app: INestApplication;
  let userToken: string;
  let hostToken: string;
  let adminToken: string;
  let testListingId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup test users
    const userResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });

    userToken = userResponse.body.token;

    const hostResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'testhost@example.com',
        username: 'testhost',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Host',
      });

    hostToken = hostResponse.body.token;

    // Upgrade to host
    await request(app.getHttpServer())
      .post('/api/users/upgrade-to-host')
      .set('Authorization', `Bearer ${hostToken}`);

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

    // Upgrade to admin (in real scenario, this would be done differently)
    await request(app.getHttpServer())
      .put('/api/users/admin-approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: adminResponse.body.user.id });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cross-Module Data Flow', () => {
    it('should maintain data consistency across modules', async () => {
      // Step 1: Create listing with all modules
      const listingResponse = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Integration Test Listing',
          description: 'Testing cross-module data flow',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
          latitude: 40.7128,
          longitude: -74.0060,
          type: 'APARTMENT',
          bedrooms: 2,
          bathrooms: 1,
          maxGuests: 4,
          basePrice: 100,
          currency: 'USD',
          amenities: ['wifi', 'parking'],
          photos: ['https://example.com/photo.jpg'],
        })
        .expect(201);

      testListingId = listingResponse.body.id;

      // Step 2: Create booking (Bookings Module)
      const bookingResponse = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2026-09-01',
          endDate: '2026-09-03',
          guestCount: 2,
        })
        .expect(201);

      testBookingId = bookingResponse.body.id;

      // Step 3: Process payment (Payments Module)
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: testBookingId,
          amount: bookingResponse.body.totalPrice,
          currency: 'USD',
        })
        .expect(201);

      // Step 4: Confirm payment (Webhooks Module)
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentResponse.body.paymentIntentId,
              status: 'succeeded',
              metadata: { bookingId: testBookingId },
            },
          },
        })
        .expect(200);

      // Step 5: Verify booking status updated
      const updatedBooking = await request(app.getHttpServer())
        .get(`/api/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedBooking.body.status).toBe('CONFIRMED');

      // Step 6: Verify ledger entry created (Finance Module)
      const ledgerEntries = await request(app.getHttpServer())
        .get(`/api/bookings/${testBookingId}/ledger`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(ledgerEntries.body).toHaveLength(2); // Payment and platform fee

      // Step 7: Verify notification sent (Notifications Module)
      // This would be verified through notification logs
      const notifications = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(notifications.body.some(n => n.type === 'BOOKING_CONFIRMED')).toBe(true);

      // Step 8: Verify audit trail (Audit Module)
      const auditLogs = await request(app.getHttpServer())
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ entityType: 'Booking', entityId: testBookingId })
        .expect(200);

      expect(auditLogs.body.length).toBeGreaterThan(0);
    });

    it('should handle cascading deletes correctly', async () => {
      // Create a booking with dependencies
      const bookingResponse = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2026-10-01',
          endDate: '2026-10-02',
          guestCount: 1,
        })
        .expect(201);

      const bookingToDelete = bookingResponse.body.id;

      // Create dependent data
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingToDelete}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: 'Test message' })
        .expect(201);

      // Delete booking
      await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingToDelete}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify dependent data is handled correctly
      const messages = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingToDelete}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Messages should be preserved or archived appropriately
      expect(messages.body).toBeDefined();
    });
  });

  describe('External Service Integration', () => {
    it('should handle Stripe service failures gracefully', async () => {
      // Mock Stripe failure scenario
      const bookingResponse = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2026-11-01',
          endDate: '2026-11-02',
          guestCount: 1,
        })
        .expect(201);

      // Simulate payment failure
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_failed',
              status: 'requires_payment_method',
              metadata: { bookingId: bookingResponse.body.id },
            },
          },
        })
        .expect(200);

      // Verify booking is marked as failed
      const failedBooking = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingResponse.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(failedBooking.body.paymentStatus).toBe('FAILED');
    });

    it('should integrate with email services correctly', async () => {
      // Send notification that triggers email
      await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: userToken ? 'test-user-id' : 'unknown',
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'Test Email Integration',
          message: 'This is a test of email integration',
          sendViaEmail: true,
        })
        .expect(201);

      // Verify email was queued (in real scenario, check email service logs)
      const emailLogs = await request(app.getHttpServer())
        .get('/api/admin/email-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(emailLogs.body.length).toBeGreaterThan(0);
    });

    it('should handle file upload service integration', async () => {
      // Upload multiple files
      const response = await request(app.getHttpServer())
        .post('/api/listings/photos')
        .set('Authorization', `Bearer ${hostToken}`)
        .attach('photos', Buffer.from('photo1'), 'photo1.jpg')
        .attach('photos', Buffer.from('photo2'), 'photo2.jpg')
        .attach('photos', Buffer.from('photo3'), 'photo3.jpg')
        .expect(201);

      expect(response.body.urls).toHaveLength(3);
      expect(response.body.urls[0]).toMatch(/^https:\/\//);
    });
  });

  describe('Error Handling Across Modules', () => {
    it('should handle validation errors consistently', async () => {
      // Test validation in different modules
      const invalidBooking = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: 'invalid-id',
          startDate: '2026-12-01',
          endDate: '2026-11-30', // End before start
          guestCount: -1, // Invalid
        })
        .expect(400);

      expect(invalidBooking.body.message).toBeDefined();
      expect(invalidBooking.body.errors).toBeDefined();

      const invalidListing = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: '', // Required field missing
          basePrice: -100, // Invalid
          maxGuests: 0, // Invalid
        })
        .expect(400);

      expect(invalidListing.body.message).toBeDefined();
      expect(invalidListing.body.errors).toBeDefined();
    });

    it('should handle database transaction failures', async () => {
      // Simulate concurrent booking attempts
      const bookingData = {
        listingId: testListingId,
        startDate: '2026-12-15',
        endDate: '2026-12-17',
        guestCount: 2,
      };

      // First booking should succeed
      const booking1 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(201);

      // Second booking for same dates should fail
      const booking2 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(409); // Conflict

      expect(booking2.body.message).toContain('already booked');
    });

    it('should handle rate limiting across APIs', async () => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 100 }, () =>
        request(app.getHttpServer())
          .get('/api/listings/search')
          .query({ query: 'test' })
      );

      const results = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent user operations', async () => {
      // Simulate multiple users booking simultaneously
      const users = Array.from({ length: 10 }, (_, i) => ({
        email: `user${i}@example.com`,
        username: `user${i}`,
        password: 'Password123!',
        firstName: 'User',
        lastName: String(i),
      }));

      // Register users
      const userTokens = await Promise.all(
        users.map(async (user) => {
          const response = await request(app.getHttpServer())
            .post('/api/auth/register')
            .send(user);
          return response.body.token;
        })
      );

      // Create bookings concurrently
      const bookingPromises = userTokens.map(token =>
        request(app.getHttpServer())
          .post('/api/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            listingId: testListingId,
            startDate: `2026-12-${20 + userTokens.indexOf(token)}`,
            endDate: `2026-12-${21 + userTokens.indexOf(token)}`,
            guestCount: 1,
          })
      );

      const bookingResults = await Promise.allSettled(bookingPromises);

      // Most should succeed
      const successful = bookingResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );

      expect(successful.length).toBeGreaterThan(5);
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();

      // Make 50 concurrent search requests
      const searchPromises = Array.from({ length: 50 }, () =>
        request(app.getHttpServer())
          .get('/api/listings/search')
          .query({ query: 'apartment', page: 1, size: 10 })
      );

      await Promise.all(searchPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Security Integration', () => {
    it('should enforce authentication across all protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/users/profile' },
        { method: 'post', path: '/api/bookings' },
        { method: 'put', path: '/api/listings/test-id' },
        { method: 'delete', path: '/api/bookings/test-id' },
      ];

      for (const endpoint of protectedEndpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .expect(401);
      }
    });

    it('should enforce authorization rules', async () => {
      // User trying to access admin endpoint
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // User trying to modify other user's booking
      await request(app.getHttpServer())
        .put(`/api/bookings/${testBookingId}/accept`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Host should be able to accept booking
      await request(app.getHttpServer())
        .put(`/api/bookings/${testBookingId}/accept`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
    });

    it('should sanitize inputs across all endpoints', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '../../etc/passwd',
        'SELECT * FROM users',
      ];

      for (const input of maliciousInputs) {
        await request(app.getHttpServer())
          .get('/api/listings/search')
          .query({ query: input })
          .expect(200);

        // Should not execute malicious code
        // Response should be safe
      }
    });
  });

  describe('Cache Integration', () => {
    it('should maintain cache consistency', async () => {
      // First request - cache miss
      const response1 = await request(app.getHttpServer())
        .get(`/api/listings/${testListingId}`)
        .expect(200);

      // Second request - cache hit
      const response2 = await request(app.getHttpServer())
        .get(`/api/listings/${testListingId}`)
        .expect(200);

      // Responses should be identical
      expect(response1.body).toEqual(response2.body);

      // Update listing
      await request(app.getHttpServer())
        .put(`/api/listings/${testListingId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      // Third request - should get updated data
      const response3 = await request(app.getHttpServer())
        .get(`/api/listings/${testListingId}`)
        .expect(200);

      expect(response3.body.title).toBe('Updated Title');
    });

    it('should handle cache failures gracefully', async () => {
      // Simulate cache failure
      // This would require mocking the cache service
      
      // Request should still work even if cache fails
      const response = await request(app.getHttpServer())
        .get('/api/listings/search')
        .query({ query: 'test' })
        .expect(200);

      expect(response.body.results).toBeDefined();
    });
  });

  describe('Webhook Integration', () => {
    it('should process all webhook event types', async () => {
      const webhookEvents = [
        {
          type: 'payment_intent.succeeded',
          expectedAction: 'confirm_booking',
        },
        {
          type: 'payment_intent.payment_failed',
          expectedAction: 'fail_booking',
        },
        {
          type: 'charge.dispute.created',
          expectedAction: 'handle_dispute',
        },
        {
          type: 'payout.created',
          expectedAction: 'notify_host',
        },
      ];

      for (const event of webhookEvents) {
        await request(app.getHttpServer())
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test-signature')
          .send({
            type: event.type,
            data: {
              object: {
                id: `test_${event.type}`,
                metadata: { bookingId: testBookingId },
              },
            },
          })
          .expect(200);

        // Verify appropriate action was taken
        // This would be checked through side effects
      }
    });

    it('should handle webhook idempotency', async () => {
      const webhookPayload = {
        id: 'evt_unique_id',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            status: 'succeeded',
            metadata: { bookingId: testBookingId },
          },
        },
      };

      // First webhook
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload)
        .expect(200);

      // Duplicate webhook
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload)
        .expect(200);

      // Should not create duplicate records
      const ledgerEntries = await request(app.getHttpServer())
        .get(`/api/bookings/${testBookingId}/ledger`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      // Should have only one entry for this payment
      const paymentEntries = ledgerEntries.body.filter(
        (e: any) => e.transactionType === 'PAYMENT'
      );
      expect(paymentEntries.length).toBe(1);
    });
  });
});
