import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * COMPLETE LISTING LIFECYCLE E2E TESTS
 * 
 * These tests validate the end-to-end listing workflow:
 * 1. Listing Creation → Content Upload → Category Validation → Approval → Publication
 * 2. Listing Management (edit, deactivate, reactivate)
 * 3. Category-Specific Attributes and Validation
 * 4. Availability Management
 * 5. Pricing Updates and Dynamic Pricing
 * 6. Listing Analytics and Insights
 * 7. Listing Versioning and History
 * 
 * These tests use real API endpoints and validate the complete listing owner journey.
 */
describe('Listing Lifecycle - Complete E2E Tests', () => {
  let app: INestApplication;
  let ownerAccessToken: string;
  let adminAccessToken: string;
  let ownerId: string;
  let listingId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Setup: Owner Authentication', () => {
    it('should register owner user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'listing-owner-e2e@example.com',
          username: 'listing-owner-e2e',
          password: 'SecurePassword123!',
          firstName: 'Sarah',
          lastName: 'Host',
        })
        .expect(201);

      const { user, token } = response.body;
      ownerId = user.id;
      ownerAccessToken = token;

      expect(user).toBeDefined();
      expect(user.email).toBe('listing-owner-e2e@example.com');
      expect(token).toBeDefined();
    });

    it('should login as admin user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })
        .expect(200);

      adminAccessToken = response.body.token;
    });

    it('should verify owner email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          token: 'verification-token',
        })
        .expect(200);
    });

    it('should complete owner profile', async () => {
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          firstName: 'Sarah',
          lastName: 'Host',
          phone: '+9779800000001',
          bio: 'Experienced host with 5+ years in hospitality',
          addressLine1: '456 Lazimpat',
          city: 'Kathmandu',
          state: 'Bagmati',
          postalCode: '44600',
          country: 'Nepal',
          preferredLanguage: 'en',
          preferredCurrency: 'NPR',
          timezone: 'Asia/Kathmandu',
        })
        .expect(200);
    });

    it('should setup Stripe Connect account for owner', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/connect-account')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          email: 'listing-owner-e2e@example.com',
          country: 'NP',
        })
        .expect(201);
    });
  });

  describe('Category Selection and Validation', () => {
    it('should retrieve available categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/categories')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);

      // Use the first category for testing
      categoryId = response.body[0].id;
      expect(categoryId).toBeDefined();
    });

    it('should retrieve category schema and required fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/categories/${categoryId}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.requiredFields).toBeDefined();
      expect(response.body.attributes).toBeDefined();
    });
  });

  describe('Listing Creation Flow', () => {
    it('should create basic listing draft', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Luxury Villa with Mountain Views',
          description: 'Stunning 4-bedroom villa with panoramic Himalayan views, private pool, and modern amenities. Perfect for families and groups seeking an unforgettable Nepal experience.',
          categoryId,
          basePrice: 500,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '789 Nagarkot Road',
            city: 'Nagarkot',
            state: 'Bagmati',
            postalCode: '44900',
            country: 'Nepal',
            latitude: 27.7167,
            longitude: 85.6167,
          },
          amenities: ['wifi', 'parking', 'pool', 'kitchen', 'ac', 'heating', 'tv', 'washer', 'dryer'],
          houseRules: ['No smoking', 'No parties', 'Quiet hours after 10pm', 'Check-in after 2pm', 'Check-out before 11am'],
          checkInTime: '14:00',
          checkOutTime: '11:00',
          minimumNights: 2,
          maximumNights: 30,
          maximumGuests: 8,
          bedrooms: 4,
          beds: 6,
          bathrooms: 3,
          propertyType: 'VILLA',
          size: 350,
          sizeUnit: 'SQUARE_METERS',
        })
        .expect(201);

      const listing = response.body;
      listingId = listing.id;

      expect(listing).toBeDefined();
      expect(listing.id).toBeDefined();
      expect(listing.title).toBe('Luxury Villa with Mountain Views');
      expect(listing.status).toBe('DRAFT');
      expect(listing.categoryId).toBe(categoryId);
    });

    it('should upload listing cover image', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/cover-image`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .attach('image', Buffer.from('cover-image-data'), 'cover.jpg')
        .expect(200);
    });

    it('should upload multiple listing images', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .attach('images', Buffer.from('image-living-room'), 'living-room.jpg')
        .attach('images', Buffer.from('image-bedroom'), 'bedroom.jpg')
        .attach('images', Buffer.from('image-bathroom'), 'bathroom.jpg')
        .attach('images', Buffer.from('image-pool'), 'pool.jpg')
        .attach('images', Buffer.from('image-view'), 'mountain-view.jpg')
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThanOrEqual(5); // Cover + 5 images
    });

    it('should add category-specific attributes', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/attributes`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          attributes: [
            { attributeDefinitionId: 'make', value: 'Custom Built' },
            { attributeDefinitionId: 'year', value: '2020' },
            { attributeDefinitionId: 'condition', value: 'Excellent' },
          ],
        })
        .expect(200);
    });

    it('should set availability slots', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3);

      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/availability`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
        })
        .expect(200);
    });

    it('should set pricing tiers', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/pricing-tiers`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          dailyPrice: 500,
          weeklyDiscount: 10,
          monthlyDiscount: 20,
          weekendPricing: {
            friday: 550,
            saturday: 550,
            sunday: 500,
          },
          seasonalPricing: [
            {
              startDate: '2026-12-01',
              endDate: '2026-12-31',
              price: 600,
              reason: 'Holiday season',
            },
          ],
        })
        .expect(200);
    });

    it('should calculate listing completeness score', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/completeness`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.score).toBeGreaterThan(80); // Should be mostly complete
      expect(response.body.missingFields).toBeDefined();
    });
  });

  describe('Listing Review and Approval Flow', () => {
    it('should submit listing for review', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/submit-review`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('PENDING_REVIEW');
    });

    it('should retrieve pending listings for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/listings/pending')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should approve listing (admin action)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/admin/listings/${listingId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          notes: 'Listing meets all quality standards',
        })
        .expect(200);

      expect(response.body.status).toBe('AVAILABLE');
    });

    it('should verify listing is published and searchable', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .expect(200);

      expect(response.body.status).toBe('AVAILABLE');
      expect(response.body.publishedAt).toBeDefined();
    });
  });

  describe('Listing Management Flow', () => {
    it('should update listing details', async () => {
      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Luxury Villa with Mountain Views - Updated',
          description: 'Updated description with more details',
        })
        .expect(200);
    });

    it('should create new listing version', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/version`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          changeDescription: 'Updated title and description',
        })
        .expect(200);

      expect(response.body.version).toBeDefined();
    });

    it('should retrieve listing version history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/versions`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should deactivate listing temporarily', async () => {
      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}/deactivate`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .expect(200);

      expect(response.body.status).toBe('INACTIVE');
    });

    it('should reactivate listing', async () => {
      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}/activate`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .expect(200);

      expect(response.body.status).toBe('AVAILABLE');
    });
  });

  describe('Availability Management Flow', () => {
    it('should block specific dates for maintenance', async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + 2);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/block-dates`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          reason: 'Scheduled maintenance',
        })
        .expect(200);
    });

    it('should verify blocked dates are unavailable', async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + 2);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/availability`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        })
        .expect(200);

      expect(response.body.isAvailable).toBe(false);
    });

    it('should remove blocked dates', async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + 2);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      await request(app.getHttpServer())
        .delete(`/api/listings/${listingId}/block-dates`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        })
        .expect(200);
    });
  });

  describe('Dynamic Pricing Flow', () => {
    it('should enable dynamic pricing', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/dynamic-pricing`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          enabled: true,
          strategy: 'DEMAND_BASED',
          minPrice: 400,
          maxPrice: 800,
          adjustmentFrequency: 'DAILY',
        })
        .expect(200);
    });

    it('should retrieve pricing recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/pricing-recommendations`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.recommendations).toBeDefined();
    });

    it('should apply manual price adjustment', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/price-adjustment`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          price: 550,
          reason: 'Summer peak season',
        })
        .expect(200);
    });
  });

  describe('Listing Analytics Flow', () => {
    it('should retrieve listing views analytics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/analytics/views`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.totalViews).toBeDefined();
      expect(response.body.uniqueViews).toBeDefined();
    });

    it('should retrieve listing inquiries analytics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/analytics/inquiries`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.totalInquiries).toBeDefined();
    });

    it('should retrieve booking conversion rate', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/analytics/conversion`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.conversionRate).toBeDefined();
    });

    it('should retrieve revenue analytics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/analytics/revenue`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.totalRevenue).toBeDefined();
    });
  });

  describe('Multi-Unit Listing Flow', () => {
    let multiUnitListingId: string;

    it('should create multi-unit listing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Apartment Complex - Multiple Units',
          description: 'Modern apartment complex with 4 identical units available',
          categoryId,
          basePrice: 150,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '101 Thamel Street',
            city: 'Kathmandu',
            state: 'Bagmati',
            postalCode: '44600',
            country: 'Nepal',
            latitude: 27.7172,
            longitude: 85.3240,
          },
          isMultiUnit: true,
          totalUnits: 4,
          amenities: ['wifi', 'parking', 'kitchen'],
          houseRules: ['No smoking', 'Quiet hours after 10pm'],
          checkInTime: '14:00',
          checkOutTime: '11:00',
          minimumNights: 1,
          maximumNights: 30,
        })
        .expect(201);

      multiUnitListingId = response.body.id;
      expect(response.body.isMultiUnit).toBe(true);
    });

    it('should create inventory units', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${multiUnitListingId}/inventory-units`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          units: [
            { name: 'Unit 101', floor: 1, bedrooms: 2 },
            { name: 'Unit 102', floor: 1, bedrooms: 2 },
            { name: 'Unit 201', floor: 2, bedrooms: 2 },
            { name: 'Unit 202', floor: 2, bedrooms: 2 },
          ],
        })
        .expect(200);
    });

    it('should retrieve inventory units', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${multiUnitListingId}/inventory-units`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBe(4);
    });

    it('should set availability per unit', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);

      await request(app.getHttpServer())
        .post(`/api/listings/${multiUnitListingId}/inventory-units/availability`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          unitIds: ['unit-1', 'unit-2'], // Specific units
        })
        .expect(200);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should reject listing with invalid category', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Invalid Listing',
          description: 'Test',
          categoryId: 'invalid-category-id',
          basePrice: 100,
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            postalCode: '12345',
            country: 'Test Country',
            latitude: 0,
            longitude: 0,
          },
        })
        .expect(400);
    });

    it('should reject listing with invalid pricing', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'Invalid Pricing Listing',
          description: 'Test',
          categoryId,
          basePrice: -100, // Negative price
          currency: 'USD',
          pricingMode: 'PER_DAY',
          location: {
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            postalCode: '12345',
            country: 'Test Country',
            latitude: 0,
            longitude: 0,
          },
        })
        .expect(400);
    });

    it('should prevent unauthorized listing modification', async () => {
      // Create another user and try to modify the listing
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'other-user@example.com',
          username: 'other-user',
          password: 'SecurePassword123!',
          firstName: 'Other',
          lastName: 'User',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.token;

      await request(app.getHttpServer())
        .patch(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          title: 'Unauthorized Modification',
        })
        .expect(403);
    });

    it('should prevent deletion of listing with active bookings', async () => {
      // First create a booking for the listing
      const renterResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'listing-test-renter@example.com',
          username: 'listing-test-renter',
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'Renter',
        })
        .expect(201);

      const renterToken = renterResponse.body.token;

      const bookingResponse = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: '2026-09-01',
          endDate: '2026-09-03',
          guestCount: 2,
        })
        .expect(201);

      // Simulate payment to confirm booking
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: bookingResponse.body.id,
          amount: 1000,
          currency: 'USD',
        })
        .expect(201);

      // Try to delete listing with active booking
      await request(app.getHttpServer())
        .delete(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(400); // Should fail due to active booking
    });
  });

  describe('Listing Search and Discovery Flow', () => {
    it('should find listing in search results', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings/search')
        .query({
          query: 'villa',
          location: 'Nagarkot',
          minPrice: 400,
          maxPrice: 600,
          page: 1,
          size: 10,
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.results).toBeDefined();
      
      // Find our listing in results
      const ourListing = response.body.results.find((l: any) => l.id === listingId);
      expect(ourListing).toBeDefined();
    });

    it('should filter by amenities', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings/search')
        .query({
          amenities: ['pool', 'wifi'],
          page: 1,
          size: 10,
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.results).toBeDefined();
    });

    it('should filter by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings/search')
        .query({
          minPrice: 300,
          maxPrice: 700,
          page: 1,
          size: 10,
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.results).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should archive test listing', async () => {
      await request(app.getHttpServer())
        .delete(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
    });

    it('should archive multi-unit test listing', async () => {
      // First get the multi-unit listing ID from earlier test
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .query({
          page: 1,
          size: 10,
        })
        .expect(200);

      const multiUnitListing = response.body.results.find((l: any) => l.title === 'Apartment Complex - Multiple Units');
      if (multiUnitListing) {
        await request(app.getHttpServer())
          .delete(`/api/listings/${multiUnitListing.id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);
      }
    });
  });
});
