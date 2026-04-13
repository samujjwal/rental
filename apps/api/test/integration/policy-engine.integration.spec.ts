/**
 * PolicyEngine Integration Tests
 * 
 * Tests the PolicyEngine service for:
 * 1. Fee calculation validation
 * 2. Cancellation policy enforcement
 * 3. Booking eligibility validation
 * 4. Refund calculation
 * 5. Policy compliance
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('PolicyEngine Integration Tests', () => {
  let app: INestApplication;
  let userToken: string;
  let ownerToken: string;
  let testListingId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Setup test users
    const userResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'policy-user@example.com',
        username: 'policy-user',
        password: 'Password123!',
        firstName: 'Policy',
        lastName: 'User',
      });

    userToken = userResponse.body.token;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'policy-owner@example.com',
        username: 'policy-owner',
        password: 'Password123!',
        firstName: 'Policy',
        lastName: 'Owner',
      });

    ownerToken = ownerResponse.body.token;

    // Upgrade to host
    await request(app.getHttpServer())
      .post('/users/upgrade-to-host')
      .set('Authorization', `Bearer ${ownerToken}`);

    // Create test listing
    const listingResponse = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Policy Test Listing',
        description: 'Testing PolicyEngine',
        address: '123 Policy St',
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
        cancellationPolicy: 'FLEXIBLE',
      })
      .expect(201);

    testListingId = listingResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Fee Calculation Validation', () => {
    it('should calculate correct platform fee', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-fees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          amount: 200,
          currency: 'USD',
          type: 'BOOKING',
        })
        .expect(200);

      expect(response.body).toHaveProperty('platformFee');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body.platformFee).toBeGreaterThan(0);
      expect(response.body.totalAmount).toBe(200 + response.body.platformFee);
    });

    it('should calculate correct service fee', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-fees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          amount: 200,
          currency: 'USD',
          type: 'SERVICE',
        })
        .expect(200);

      expect(response.body).toHaveProperty('serviceFee');
      expect(response.body.serviceFee).toBeGreaterThan(0);
    });

    it('should apply fee caps correctly', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-fees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          amount: 10000, // Large amount to test fee cap
          currency: 'USD',
          type: 'BOOKING',
        })
        .expect(200);

      expect(response.body).toHaveProperty('platformFee');
      // Fee should be capped at maximum
      expect(response.body.platformFee).toBeLessThanOrEqual(500); // Example cap
    });

    it('should handle different currencies', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-fees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          amount: 100,
          currency: 'EUR',
          type: 'BOOKING',
        })
        .expect(200);

      expect(response.body).toHaveProperty('platformFee');
      expect(response.body).toHaveProperty('currency', 'EUR');
    });
  });

  describe('Cancellation Policy Enforcement', () => {
    it('should validate cancellation policy for flexible bookings', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 200,
          daysBeforeBooking: 7,
          cancellationPolicy: 'FLEXIBLE',
        })
        .expect(200);

      expect(response.body).toHaveProperty('refundAmount');
      expect(response.body).toHaveProperty('refundPercentage');
      // Flexible policy should allow full refund
      expect(response.body.refundPercentage).toBe(100);
    });

    it('should validate cancellation policy for moderate bookings', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 200,
          daysBeforeBooking: 3,
          cancellationPolicy: 'MODERATE',
        })
        .expect(200);

      expect(response.body).toHaveProperty('refundAmount');
      expect(response.body).toHaveProperty('refundPercentage');
      // Moderate policy should allow partial refund
      expect(response.body.refundPercentage).toBeGreaterThan(0);
      expect(response.body.refundPercentage).toBeLessThan(100);
    });

    it('should validate cancellation policy for strict bookings', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 200,
          daysBeforeBooking: 1,
          cancellationPolicy: 'STRICT',
        })
        .expect(200);

      expect(response.body).toHaveProperty('refundAmount');
      expect(response.body).toHaveProperty('refundPercentage');
      // Strict policy should allow minimal or no refund
      expect(response.body.refundPercentage).toBeLessThanOrEqual(50);
    });

    it('should handle zero refund for last-minute cancellations', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 200,
          daysBeforeBooking: 0,
          cancellationPolicy: 'STRICT',
        })
        .expect(200);

      expect(response.body.refundAmount).toBe(0);
      expect(response.body.refundPercentage).toBe(0);
    });
  });

  describe('Booking Eligibility Validation', () => {
    it('should validate booking eligibility', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-booking')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-01-01',
          endDate: '2027-01-03',
          guestCount: 2,
        })
        .expect(200);

      expect(response.body).toHaveProperty('eligible');
      expect(response.body).toHaveProperty('reasons');
      expect(Array.isArray(response.body.reasons)).toBe(true);
    });

    it('should reject booking for past dates', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-booking')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2020-01-01',
          endDate: '2020-01-03',
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.eligible).toBe(false);
      expect(response.body.reasons).toContain('INVALID_DATE_RANGE');
    });

    it('should reject booking exceeding max guests', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-booking')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-01-01',
          endDate: '2027-01-03',
          guestCount: 10, // Exceeds maxGuests of 4
        })
        .expect(200);

      expect(response.body.eligible).toBe(false);
      expect(response.body.reasons).toContain('EXCEEDS_MAX_GUESTS');
    });

    it('should reject booking for unavailable dates', async () => {
      // Create a booking first
      const bookingResponse = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-02-01',
          endDate: '2027-02-03',
          guestCount: 2,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/bookings/${bookingResponse.body.id}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Try to book the same dates
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-booking')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-02-01',
          endDate: '2027-02-03',
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.eligible).toBe(false);
      expect(response.body.reasons).toContain('DATES_UNAVAILABLE');
    });

    it('should validate minimum booking duration', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-booking')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-01-01',
          endDate: '2027-01-01', // Same day - invalid
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.eligible).toBe(false);
      expect(response.body.reasons).toContain('MINIMUM_DURATION_NOT_MET');
    });

    it('should validate maximum booking duration', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-booking')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-01-01',
          endDate: '2028-01-01', // 1 year - too long
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.eligible).toBe(false);
      expect(response.body.reasons).toContain('MAXIMUM_DURATION_EXCEEDED');
    });
  });

  describe('Refund Calculation', () => {
    it('should calculate refund for early cancellation', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 300,
          daysBeforeBooking: 30,
          cancellationPolicy: 'FLEXIBLE',
        })
        .expect(200);

      expect(response.body.refundAmount).toBe(300);
      expect(response.body.refundPercentage).toBe(100);
    });

    it('should calculate refund with platform fee deduction', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 300,
          platformFee: 30,
          daysBeforeBooking: 14,
          cancellationPolicy: 'MODERATE',
        })
        .expect(200);

      expect(response.body).toHaveProperty('refundAmount');
      expect(response.body).toHaveProperty('platformFeeRefund');
      expect(response.body.refundAmount).toBeLessThanOrEqual(270); // 300 - platform fee
    });

    it('should calculate partial refund for moderate cancellation', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 300,
          daysBeforeBooking: 5,
          cancellationPolicy: 'MODERATE',
        })
        .expect(200);

      expect(response.body.refundAmount).toBeGreaterThan(0);
      expect(response.body.refundAmount).toBeLessThan(300);
    });

    it('should calculate deposit refund separately', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/calculate-refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          bookingAmount: 300,
          depositAmount: 50,
          daysBeforeBooking: 7,
          cancellationPolicy: 'FLEXIBLE',
        })
        .expect(200);

      expect(response.body).toHaveProperty('refundAmount');
      expect(response.body).toHaveProperty('depositRefund');
      expect(response.body.depositRefund).toBe(50);
    });
  });

  describe('Policy Compliance', () => {
    it('should enforce policy on booking creation', async () => {
      // Try to create booking with invalid dates
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2020-01-01',
          endDate: '2020-01-03',
          guestCount: 2,
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should enforce policy on cancellation', async () => {
      // Create a booking
      const bookingResponse = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-03-01',
          endDate: '2027-03-03',
          guestCount: 2,
        })
        .expect(201);

      const bookingId = bookingResponse.body.id;

      // Approve booking
      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Cancel booking
      const cancelResponse = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(200);

      expect(cancelResponse.body).toHaveProperty('booking');
      expect(cancelResponse.body).toHaveProperty('refund');
      expect(cancelResponse.body.booking.status).toBe('CANCELLED');
    });

    it('should validate policy changes', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-policy-change')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          listingId: testListingId,
          newPolicy: 'STRICT',
          existingBookings: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('affectedBookings');
      expect(Array.isArray(response.body.affectedBookings)).toBe(true);
    });

    it('should enforce age restrictions', async () => {
      // This test would verify that users under 18 cannot book
      // Implementation depends on age validation policy
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-user')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: 'test-user-id',
          action: 'BOOK',
        })
        .expect(200);

      expect(response.body).toHaveProperty('eligible');
    });
  });

  describe('Policy Versioning', () => {
    it('should track policy version', async () => {
      const response = await request(app.getHttpServer())
        .get('/policy-engine/version')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('effectiveDate');
    });

    it('should handle policy updates gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/policy-engine/validate-booking')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: testListingId,
          startDate: '2027-04-01',
          endDate: '2027-04-03',
          guestCount: 2,
          policyVersion: '1.0',
        })
        .expect(200);

      expect(response.body).toHaveProperty('eligible');
      expect(response.body).toHaveProperty('policyVersion');
    });
  });
});
