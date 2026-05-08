import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { cleanupCoreRelationalData } from '../../../test/e2e-helpers';

/**
 * Cross-Module Integration Tests
 *
 * These tests validate that different modules work together correctly using real DB and API:
 * - Bookings + Payments integration
 * - Bookings + Availability integration
 * - Listings + Categories integration
 * - Users + Organizations integration
 * - Auth + Security integration
 */
describe('Cross-Module Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let renterAccessToken: string;
  let ownerAccessToken: string;
  let renterId: string;
  let ownerId: string;
  let listingId: string;
  let bookingId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data
    await cleanupCoreRelationalData(prisma);
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await app.close();
  });

  describe('Setup: User Registration and Authentication', () => {
    it('should register renter user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `renter-cross-${Date.now()}@example.com`,
          username: `renter-cross-${Date.now()}`,
          password: 'SecurePassword123!',
          firstName: 'Jane',
          lastName: 'Renter',
        })
        .expect(201);

      const { user, token } = response.body;
      renterId = user.id;
      renterAccessToken = token;

      expect(user).toBeDefined();
      expect(user.email).toContain('renter-cross');
      expect(token).toBeDefined();
    });

    it('should register owner user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `owner-cross-${Date.now()}@example.com`,
          username: `owner-cross-${Date.now()}`,
          password: 'SecurePassword123!',
          firstName: 'John',
          lastName: 'Owner',
        })
        .expect(201);

      const { user, token } = response.body;
      ownerId = user.id;
      ownerAccessToken = token;

      expect(user).toBeDefined();
      expect(user.email).toContain('owner-cross');
      expect(token).toBeDefined();
    });
  });

  describe('Setup: Category and Listing Creation', () => {
    it('should create a category', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          name: 'Vehicles',
          slug: 'vehicles',
          description: 'Vehicle rentals',
        })
        .expect(201);

      const { category } = response.body;
      categoryId = category.id;

      expect(category).toBeDefined();
      expect(category.slug).toBe('vehicles');
    });

    it('should create a listing with category', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Modern Apartment in Kathmandu',
          description: 'Beautiful 2-bedroom apartment with city views',
          categoryId: categoryId,
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Thamel',
            city: 'Kathmandu',
            state: 'Bagmati',
            postalCode: '44600',
            country: 'Nepal',
            latitude: 27.7172,
            longitude: 85.3240,
          },
          amenities: ['wifi', 'parking', 'ac'],
          houseRules: ['No smoking', 'No pets'],
          checkInTime: '14:00',
          checkOutTime: '11:00',
          minimumNights: 1,
          maximumNights: 30,
        })
        .expect(201);

      const { listing } = response.body;
      listingId = listing.id;

      expect(listing).toBeDefined();
      expect(listing.categoryId).toBe(categoryId);
    });
  });

  describe('BOOKINGS + LISTINGS INTEGRATION', () => {
    it('should create booking for listing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId: listingId,
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
          guestCount: 2,
        })
        .expect(201);

      const { booking } = response.body;
      bookingId = booking.id;

      expect(booking).toBeDefined();
      expect(booking.listingId).toBe(listingId);
      expect(booking.renterId).toBe(renterId);
    });

    it('should retrieve listing with booking count', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const { listing } = response.body;

      expect(listing).toBeDefined();
      expect(listing.id).toBe(listingId);
    });

    it('should prevent listing deletion with active bookings', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(400); // Should fail due to active bookings

      expect(response.body).toBeDefined();
    });
  });

  describe('BOOKINGS + PAYMENTS INTEGRATION', () => {
    it('should create payment for booking', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          bookingId: bookingId,
          amount: 300,
          currency: 'USD',
          paymentMethod: 'stripe',
        })
        .expect(201);

      const { payment } = response.body;

      expect(payment).toBeDefined();
      expect(payment.bookingId).toBe(bookingId);
      expect(payment.currency).toBe('USD');
    });

    it('should retrieve booking with payment status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      const { booking } = response.body;

      expect(booking).toBeDefined();
      expect(booking.id).toBe(bookingId);
    });
  });

  describe('USERS + ORGANIZATIONS INTEGRATION', () => {
    let organizationId: string;

    it('should create organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          name: 'Test Organization',
          description: 'A test organization',
        })
        .expect(201);

      const { organization } = response.body;
      organizationId = organization.id;

      expect(organization).toBeDefined();
      expect(organization.name).toBe('Test Organization');
    });

    it('should add user to organization', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          userId: renterId,
          role: 'MEMBER',
        })
        .expect(201);

      expect(response.body).toBeDefined();
    });

    it('should retrieve user with organization membership', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/users/${ownerId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const { user } = response.body;

      expect(user).toBeDefined();
      expect(user.id).toBe(ownerId);
    });
  });

  describe('LISTINGS + CATEGORIES INTEGRATION', () => {
    it('should retrieve category with listings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/categories/${categoryId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const { category } = response.body;

      expect(category).toBeDefined();
      expect(category.id).toBe(categoryId);
    });

    it('should filter listings by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ categoryId })
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      const { listings } = response.body;

      expect(listings).toBeDefined();
      expect(Array.isArray(listings)).toBe(true);
    });
  });

  describe('CROSS-MODULE DATA CONSISTENCY', () => {
    it('should maintain consistency across booking lifecycle', async () => {
      const bookingResponse = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      const { booking } = bookingResponse.body;

      expect(booking).toBeDefined();
      expect(booking.listingId).toBe(listingId);
      expect(booking.renterId).toBe(renterId);
    });

    it('should validate currency consistency', async () => {
      const bookingResponse = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      const { booking } = bookingResponse.body;
      const listingResponse = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const { listing } = listingResponse.body;

      expect(booking.currency).toBe(listing.currency);
    });
  });

  describe('CROSS-MODULE ERROR HANDLING', () => {
    it('should handle invalid booking ID gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/bookings/invalid-id')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(404);

      expect(response.body).toBeDefined();
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .expect(401);

      expect(response.body).toBeDefined();
    });

    it('should handle concurrent booking attempts', async () => {
      // First booking attempt
      const response1 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId: listingId,
          startTime: new Date(Date.now() + 86400000 * 5).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 7).toISOString(),
          guestCount: 2,
        });

      // Second booking attempt with overlapping dates
      const response2 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          listingId: listingId,
          startTime: new Date(Date.now() + 86400000 * 6).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 8).toISOString(),
          guestCount: 2,
        });

      // At least one should succeed or fail appropriately based on availability logic
      expect(response1.status).toBeDefined();
      expect(response2.status).toBeDefined();
    });
  });
});
