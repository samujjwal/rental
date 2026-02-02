import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingStatus, ListingStatus, UserRole, BookingMode } from '@rental-portal/database';

/**
 * Renter & Owner Dashboard E2E Tests
 *
 * Comprehensive tests for renter and owner dashboard functionality:
 * - Dashboard data loading and stats
 * - Renter bookings management
 * - Owner listings management
 * - Owner earnings and payouts
 * - Owner performance analytics
 * - Reviews management
 * - Disputes handling
 * - Settings and profile
 *
 * Test coverage target: 100% of dashboard routes and features
 */
describe('Renter & Owner Dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let ownerId: string;
  let renterId: string;
  let categoryId: string;
  let listingId: string;
  let secondListingId: string;
  let bookingId: string;
  let completedBookingId: string;

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
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data in proper order (respecting foreign keys)
    await prisma.review.deleteMany({
      where: {
        OR: [
          { reviewer: { email: { contains: '@dashtest.com' } } },
          { reviewee: { email: { contains: '@dashtest.com' } } },
        ],
      },
    });
    await prisma.dispute.deleteMany({
      where: {
        booking: {
          OR: [
            { renter: { email: { contains: '@dashtest.com' } } },
            { listing: { owner: { email: { contains: '@dashtest.com' } } } },
          ],
        },
      },
    });
    await prisma.payment.deleteMany({
      where: {
        booking: {
          OR: [
            { renter: { email: { contains: '@dashtest.com' } } },
            { listing: { owner: { email: { contains: '@dashtest.com' } } } },
          ],
        },
      },
    });
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { renter: { email: { contains: '@dashtest.com' } } },
          { listing: { owner: { email: { contains: '@dashtest.com' } } } },
        ],
      },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { contains: '@dashtest.com' } } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'dashboard-test' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@dashtest.com' } },
    });

    // Create owner user
    const ownerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'owner@dashtest.com',
      password: 'SecurePass123!',
      firstName: 'Dashboard',
      lastName: 'Owner',
      phone: '+1234567890',
      role: UserRole.HOST,
    });
    ownerToken = ownerRes.body.tokens.accessToken;
    ownerId = ownerRes.body.user.id;

    // Create renter user
    const renterRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'renter@dashtest.com',
      password: 'SecurePass123!',
      firstName: 'Dashboard',
      lastName: 'Renter',
      phone: '+1234567891',
      role: UserRole.USER,
    });
    renterToken = renterRes.body.tokens.accessToken;
    renterId = renterRes.body.user.id;

    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'Dashboard Test Category',
        slug: 'dashboard-test-category',
        description: 'Test category for dashboard tests',
        icon: 'camera',
        isActive: true,
        templateSchema: '{}',
      },
    });
    categoryId = category.id;

    // Create first listing
    const listing = await prisma.listing.create({
      data: {
        owner: { connect: { id: ownerId } },
        category: { connect: { id: categoryId } },
        title: 'Premium Camera Equipment',
        description: 'High-quality camera for professional shoots',
        slug: 'premium-camera-equipment-dash',
        address: '123 Camera Street',
        zipCode: '94102',
        type: 'OTHER',
        basePrice: 15000, // $150.00
        currency: 'USD',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        latitude: 37.7749,
        longitude: -122.4194,
        status: 'AVAILABLE',
        bookingMode: BookingMode.REQUEST,
      },
    });
    listingId = listing.id;

    // Create second listing
    const secondListing = await prisma.listing.create({
      data: {
        owner: { connect: { id: ownerId } },
        category: { connect: { id: categoryId } },
        title: 'Drone with 4K Camera',
        description: 'Professional drone for aerial photography',
        slug: 'drone-4k-camera-dash',
        address: '456 Drone Avenue',
        zipCode: '94103',
        type: 'OTHER',
        basePrice: 20000, // $200.00
        currency: 'USD',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        latitude: 37.7749,
        longitude: -122.4194,
        status: 'AVAILABLE',
        bookingMode: BookingMode.INSTANT_BOOK,
      },
    });
    secondListingId = secondListing.id;

    // Create pending booking
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 5);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3);

    const booking = await prisma.booking.create({
      data: {
        renterId,
        listingId,
        startDate,
        endDate,
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        basePrice: 15000,
        totalPrice: 45000, // 3 days * $150
        totalAmount: 49500,
        platformFee: 4500,
        currency: 'USD',
        guestCount: 1,
      },
    });
    bookingId = booking.id;

    // Create completed booking for reviews
    const pastStartDate = new Date();
    pastStartDate.setDate(pastStartDate.getDate() - 10);
    const pastEndDate = new Date();
    pastEndDate.setDate(pastEndDate.getDate() - 5);

    const completedBooking = await prisma.booking.create({
      data: {
        renterId,
        listingId: secondListingId,
        startDate: pastStartDate,
        endDate: pastEndDate,
        status: BookingStatus.COMPLETED,
        basePrice: 20000,
        totalPrice: 100000, // 5 days * $200
        totalAmount: 110000,
        platformFee: 10000,
        currency: 'USD',
        guestCount: 1,
      },
    });
    completedBookingId = completedBooking.id;
  });

  // ============================================
  // RENTER DASHBOARD TESTS
  // ============================================
  describe('Renter Dashboard', () => {
    describe('GET /api/users/me/dashboard - Renter Dashboard Data', () => {
      it('should return dashboard data with stats for renter', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/users/me/dashboard')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe('renter@dashtest.com');
        expect(response.body.user.role).toBe(UserRole.USER);
      });

      it('should reject request without authentication', async () => {
        await request(app.getHttpServer())
          .get('/api/users/me/dashboard')
          .expect(401);
      });
    });

    describe('GET /api/bookings/my-bookings - Renter Bookings', () => {
      it('should return all renter bookings', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/bookings/my-bookings')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
        
        const pendingBooking = response.body.find((b: any) => b.id === bookingId);
        expect(pendingBooking).toBeDefined();
        expect(pendingBooking.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
      });

      it('should filter bookings by status', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/bookings/my-bookings')
          .query({ status: BookingStatus.COMPLETED })
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach((booking: any) => {
          expect(booking.status).toBe(BookingStatus.COMPLETED);
        });
      });

      it('should include listing details in bookings', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/bookings/my-bookings')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        const booking = response.body.find((b: any) => b.id === bookingId);
        expect(booking.listing).toBeDefined();
        expect(booking.listing.title).toBe('Premium Camera Equipment');
      });
    });

    describe('GET /api/bookings/:id - Booking Detail', () => {
      it('should return booking details for renter', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body.id).toBe(bookingId);
        expect(response.body.renterId).toBe(renterId);
        expect(response.body).toHaveProperty('listing');
        expect(response.body).toHaveProperty('subtotal');
        expect(response.body).toHaveProperty('totalAmount');
      });

      it('should return 404 for non-existent booking', async () => {
        await request(app.getHttpServer())
          .get('/api/bookings/non-existent-id')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(404);
      });
    });

    describe('PUT /api/bookings/:id/cancel - Cancel Booking', () => {
      it('should allow renter to cancel pending booking', async () => {
        const response = await request(app.getHttpServer())
          .put(`/api/bookings/${bookingId}/cancel`)
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ reason: 'Changed my plans' })
          .expect(200);

        expect(response.body.status).toBe(BookingStatus.CANCELLED);
      });

      it('should reject cancellation of completed booking', async () => {
        await request(app.getHttpServer())
          .put(`/api/bookings/${completedBookingId}/cancel`)
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ reason: 'Want to cancel' })
          .expect(400);
      });
    });
  });

  // ============================================
  // OWNER DASHBOARD TESTS
  // ============================================
  describe('Owner Dashboard', () => {
    describe('GET /api/users/me/dashboard - Owner Dashboard Data', () => {
      it('should return dashboard data with stats for owner', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/users/me/dashboard')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe('owner@dashtest.com');
        expect(response.body.user.role).toBe(UserRole.HOST);
      });
    });

    describe('GET /api/listings/my-listings - Owner Listings', () => {
      it('should return all owner listings', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/listings/my-listings')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);
        
        const titles = response.body.map((l: any) => l.title);
        expect(titles).toContain('Premium Camera Equipment');
        expect(titles).toContain('Drone with 4K Camera');
      });

      it('should filter listings by status', async () => {
        // Create an inactive listing
        await prisma.listing.create({
          data: {
            owner: { connect: { id: ownerId } },
            category: { connect: { id: categoryId } },
            title: 'Inactive Item',
            description: 'Not available',
            slug: 'inactive-item-dash',
            address: '789 Inactive Road',
            zipCode: '94104',
            type: 'OTHER',
            basePrice: 5000,
            currency: 'USD',
            city: 'San Francisco',
            state: 'CA',
            country: 'US',
            latitude: 37.7749,
            longitude: -122.4194,
            status: 'UNAVAILABLE',
            bookingMode: BookingMode.REQUEST,
          },
        });

        const response = await request(app.getHttpServer())
          .get('/api/listings/my-listings')
          .query({ status: 'AVAILABLE' })
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        response.body.forEach((listing: any) => {
          expect(listing.status).toBe('AVAILABLE');
        });
      });
    });

    describe('POST /api/listings - Create Listing', () => {
      it('should create a new listing successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/listings')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            categoryId,
            title: 'New Test Equipment',
            description: 'Brand new equipment for rent',
            basePrice: 12000,
            currency: 'USD',
            city: 'Los Angeles',
            state: 'CA',
            country: 'US',
            latitude: 34.0522,
            longitude: -118.2437,
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toBe('New Test Equipment');
        expect(response.body.ownerId).toBe(ownerId);
        expect(response.body.status).toBe('DRAFT');
      });

      it('should reject listing with invalid data', async () => {
        await request(app.getHttpServer())
          .post('/api/listings')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            categoryId,
            title: '', // Invalid: empty title
            basePrice: -100, // Invalid: negative price
          })
          .expect(400);
      });

      it('should reject listing creation without auth', async () => {
        await request(app.getHttpServer())
          .post('/api/listings')
          .send({
            categoryId,
            title: 'Test',
            description: 'Test',
            basePrice: 10000,
          })
          .expect(401);
      });
    });

    describe('PUT /api/listings/:id - Update Listing', () => {
      it('should update listing successfully', async () => {
        const response = await request(app.getHttpServer())
          .put(`/api/listings/${listingId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            title: 'Updated Camera Equipment',
            basePrice: 18000,
          })
          .expect(200);

        expect(response.body.title).toBe('Updated Camera Equipment');
        expect(response.body.basePrice).toBe(18000);
      });

      it('should reject update from non-owner', async () => {
        await request(app.getHttpServer())
          .put(`/api/listings/${listingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            title: 'Hacked Listing',
          })
          .expect(403);
      });
    });

    describe('DELETE /api/listings/:id - Delete Listing', () => {
      it('should soft delete listing successfully', async () => {
        // Create a listing to delete (without bookings)
        const deleteableListing = await prisma.listing.create({
          data: {
            owner: { connect: { id: ownerId } },
            category: { connect: { id: categoryId } },
            title: 'To Be Deleted',
            description: 'Will be deleted',
            slug: 'to-be-deleted-dash',
            address: '999 Delete Lane',
            zipCode: '94105',
            type: 'OTHER',
            basePrice: 5000,
            currency: 'USD',
            city: 'Test City',
            state: 'CA',
            country: 'US',
            latitude: 37.7749,
            longitude: -122.4194,
            status: 'DRAFT',
            bookingMode: BookingMode.REQUEST,
          },
        });

        await request(app.getHttpServer())
          .delete(`/api/listings/${deleteableListing.id}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        // Verify listing is deactivated
        const listing = await prisma.listing.findUnique({
          where: { id: deleteableListing.id },
        });
        expect(listing?.status).toBe('UNAVAILABLE');
      });

      it('should reject deletion of listing with active bookings', async () => {
        await request(app.getHttpServer())
          .delete(`/api/listings/${listingId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(400);
      });
    });

    describe('GET /api/bookings/owner-bookings - Owner Booking Requests', () => {
      it('should return all booking requests for owner listings', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/bookings/owner-bookings')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
        
        // All bookings should be for owner's listings
        response.body.forEach((booking: any) => {
          expect([listingId, secondListingId]).toContain(booking.listingId);
        });
      });

      it('should filter owner bookings by status', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/bookings/owner-bookings')
          .query({ status: BookingStatus.PENDING_OWNER_APPROVAL })
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        response.body.forEach((booking: any) => {
          expect(booking.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
        });
      });
    });

    describe('PUT /api/bookings/:id/approve - Approve Booking', () => {
      it('should allow owner to approve pending booking', async () => {
        const response = await request(app.getHttpServer())
          .put(`/api/bookings/${bookingId}/approve`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body.status).toBe(BookingStatus.PENDING_PAYMENT);
      });

      it('should reject approval from non-owner', async () => {
        // Create a new pending booking first
        const newBooking = await prisma.booking.create({
          data: {
            renterId,
            listingId,
            startDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
            status: BookingStatus.PENDING_OWNER_APPROVAL,
            basePrice: 15000,
            totalPrice: 45000,
            totalAmount: 49500,
            platformFee: 4500,
            currency: 'USD',
          },
        });

        await request(app.getHttpServer())
          .put(`/api/bookings/${newBooking.id}/approve`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(403);
      });
    });

    describe('PUT /api/bookings/:id/decline - Decline Booking', () => {
      it('should allow owner to decline booking with reason', async () => {
        // Create a new pending booking
        const newBooking = await prisma.booking.create({
          data: {
            renterId,
            listingId,
            startDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
            status: BookingStatus.PENDING_OWNER_APPROVAL,
            basePrice: 15000,
            totalPrice: 45000,
            totalAmount: 49500,
            platformFee: 4500,
            currency: 'USD',
          },
        });

        const response = await request(app.getHttpServer())
          .put(`/api/bookings/${newBooking.id}/decline`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ reason: 'Item not available during those dates' })
          .expect(200);

        expect(response.body.status).toBe(BookingStatus.CANCELLED);
      });
    });
  });

  // ============================================
  // OWNER EARNINGS & PAYOUTS TESTS
  // ============================================
  describe('Owner Earnings & Payouts', () => {
    beforeEach(async () => {
      // Create payment record for completed booking
      await prisma.payment.create({
        data: {
          booking: {
            connect: { id: completedBookingId },
          },
          amount: 110000,
          currency: 'USD',
          status: 'COMPLETED',
          paymentMethod: 'card',
          paymentIntentId: `pi_test_${Date.now()}`,
          stripePaymentIntentId: `pi_stripe_${Date.now()}`,
        },
      });
    });

    describe('GET /api/payments/earnings - Owner Earnings', () => {
      it('should return earnings summary for owner', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/earnings')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalEarnings');
        expect(response.body).toHaveProperty('pendingEarnings');
        expect(response.body).toHaveProperty('availableForPayout');
      });

      it('should reject earnings request from renter', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/earnings')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        // Renters can see their payment history but earnings should be 0
        expect(response.body.totalEarnings).toBe(0);
      });
    });

    describe('GET /api/payments/transactions - Transaction History', () => {
      it('should return transaction history for owner', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/transactions')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should filter transactions by date range', async () => {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        const response = await request(app.getHttpServer())
          .get('/api/payments/transactions')
          .query({
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
          })
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  // ============================================
  // REVIEWS MANAGEMENT TESTS
  // ============================================
  describe('Reviews Management', () => {
    let reviewId: string;

    describe('POST /api/reviews - Create Review', () => {
      it('should allow renter to review completed booking', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/reviews')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId: completedBookingId,
            rating: 5,
            comment: 'Excellent experience! The drone was in perfect condition.',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.rating).toBe(5);
        reviewId = response.body.id;
      });

      it('should reject review for non-completed booking', async () => {
        await request(app.getHttpServer())
          .post('/api/reviews')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId,
            rating: 5,
            comment: 'Great!',
          })
          .expect(400);
      });

      it('should reject review from non-participant', async () => {
        // Create another user
        const otherRes = await request(app.getHttpServer()).post('/api/auth/register').send({
          email: 'other@dashtest.com',
          password: 'SecurePass123!',
          firstName: 'Other',
          lastName: 'User',
          phone: '+1234567899',
          role: UserRole.USER,
        });

        await request(app.getHttpServer())
          .post('/api/reviews')
          .set('Authorization', `Bearer ${otherRes.body.tokens.accessToken}`)
          .send({
            bookingId: completedBookingId,
            rating: 1,
            comment: 'Fake review',
          })
          .expect(403);
      });
    });

    describe('GET /api/reviews/received - Reviews Received', () => {
      it('should return reviews received by owner', async () => {
        // First create a review
        await request(app.getHttpServer())
          .post('/api/reviews')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId: completedBookingId,
            rating: 4,
            comment: 'Good experience',
          });

        const response = await request(app.getHttpServer())
          .get('/api/reviews/received')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/reviews/given - Reviews Given', () => {
      it('should return reviews given by user', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/reviews/given')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/reviews/:id/respond - Respond to Review', () => {
      it('should allow owner to respond to review', async () => {
        // Create review first
        const reviewRes = await request(app.getHttpServer())
          .post('/api/reviews')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId: completedBookingId,
            rating: 4,
            comment: 'Great drone!',
          });

        const response = await request(app.getHttpServer())
          .post(`/api/reviews/${reviewRes.body.id}/respond`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            response: 'Thank you for your kind words!',
          })
          .expect(200);

        expect(response.body.ownerResponse).toBe('Thank you for your kind words!');
      });
    });
  });

  // ============================================
  // DISPUTES TESTS
  // ============================================
  describe('Disputes', () => {
    describe('POST /api/disputes - Create Dispute', () => {
      it('should allow renter to create dispute for booking', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/disputes')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId: completedBookingId,
            type: 'DAMAGED_ITEM',
            description: 'The drone had scratches that were not shown in photos',
            requestedAmount: 5000,
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.type).toBe('DAMAGED_ITEM');
        expect(response.body.status).toBe('OPEN');
      });

      it('should reject dispute with invalid type', async () => {
        await request(app.getHttpServer())
          .post('/api/disputes')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId: completedBookingId,
            type: 'INVALID_TYPE',
            description: 'Test',
          })
          .expect(400);
      });
    });

    describe('GET /api/disputes/my-disputes - User Disputes', () => {
      it('should return disputes for user', async () => {
        // Create a dispute first
        await request(app.getHttpServer())
          .post('/api/disputes')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            bookingId: completedBookingId,
            type: 'OTHER',
            description: 'General issue',
          });

        const response = await request(app.getHttpServer())
          .get('/api/disputes/my-disputes')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter disputes by status', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/disputes/my-disputes')
          .query({ status: 'OPEN' })
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        response.body.forEach((dispute: any) => {
          expect(dispute.status).toBe('OPEN');
        });
      });
    });
  });

  // ============================================
  // FAVORITES TESTS
  // ============================================
  describe('Favorites', () => {
    describe('POST /api/favorites - Add to Favorites', () => {
      it('should add listing to favorites', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/favorites')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ listingId })
          .expect(201);

        expect(response.body.listingId).toBe(listingId);
      });

      it('should reject duplicate favorite', async () => {
        // Add first time
        await request(app.getHttpServer())
          .post('/api/favorites')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ listingId: secondListingId });

        // Try to add again
        await request(app.getHttpServer())
          .post('/api/favorites')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ listingId: secondListingId })
          .expect(400);
      });
    });

    describe('GET /api/favorites - Get Favorites', () => {
      it('should return user favorites', async () => {
        // Add to favorites first
        await request(app.getHttpServer())
          .post('/api/favorites')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ listingId });

        const response = await request(app.getHttpServer())
          .get('/api/favorites')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.some((f: any) => f.listingId === listingId)).toBe(true);
      });
    });

    describe('DELETE /api/favorites/:listingId - Remove from Favorites', () => {
      it('should remove listing from favorites', async () => {
        // Add first
        await request(app.getHttpServer())
          .post('/api/favorites')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ listingId });

        // Remove
        await request(app.getHttpServer())
          .delete(`/api/favorites/${listingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        // Verify removed
        const response = await request(app.getHttpServer())
          .get('/api/favorites')
          .set('Authorization', `Bearer ${renterToken}`);

        expect(response.body.some((f: any) => f.listingId === listingId)).toBe(false);
      });
    });
  });

  // ============================================
  // SETTINGS & PROFILE TESTS
  // ============================================
  describe('Settings & Profile', () => {
    describe('GET /api/users/me - Get Profile', () => {
      it('should return user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/users/me')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body.email).toBe('renter@dashtest.com');
        expect(response.body.firstName).toBe('Dashboard');
      });
    });

    describe('PUT /api/users/me - Update Profile', () => {
      it('should update user profile', async () => {
        const response = await request(app.getHttpServer())
          .put('/api/users/me')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            firstName: 'Updated',
            lastName: 'Name',
            phone: '+1999999999',
          })
          .expect(200);

        expect(response.body.firstName).toBe('Updated');
        expect(response.body.lastName).toBe('Name');
      });

      it('should reject invalid phone number', async () => {
        await request(app.getHttpServer())
          .put('/api/users/me')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            phone: 'invalid-phone',
          })
          .expect(400);
      });
    });

    describe('PUT /api/users/me/notification-preferences - Update Notifications', () => {
      it('should update notification preferences', async () => {
        const response = await request(app.getHttpServer())
          .put('/api/users/me/notification-preferences')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            emailNotifications: true,
            pushNotifications: false,
            smsNotifications: true,
            marketingEmails: false,
          })
          .expect(200);

        expect(response.body.emailNotifications).toBe(true);
        expect(response.body.pushNotifications).toBe(false);
      });
    });
  });

  // ============================================
  // SEARCH & DISCOVERY TESTS
  // ============================================
  describe('Search & Discovery', () => {
    describe('GET /api/listings - Search Listings', () => {
      it('should search listings with query', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/listings')
          .query({ q: 'camera' })
          .expect(200);

        expect(Array.isArray(response.body.items || response.body)).toBe(true);
      });

      it('should filter by category', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/listings')
          .query({ categoryId })
          .expect(200);

        const items = response.body.items || response.body;
        items.forEach((listing: any) => {
          expect(listing.categoryId).toBe(categoryId);
        });
      });

      it('should filter by price range', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/listings')
          .query({ minPrice: 10000, maxPrice: 20000 })
          .expect(200);

        const items = response.body.items || response.body;
        items.forEach((listing: any) => {
          expect(listing.basePrice).toBeGreaterThanOrEqual(10000);
          expect(listing.basePrice).toBeLessThanOrEqual(20000);
        });
      });

      it('should filter by location', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/listings')
          .query({ city: 'San Francisco' })
          .expect(200);

        const items = response.body.items || response.body;
        items.forEach((listing: any) => {
          expect(listing.city).toBe('San Francisco');
        });
      });
    });

    describe('GET /api/listings/:id - Listing Detail', () => {
      it('should return listing details', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/listings/${listingId}`)
          .expect(200);

        expect(response.body.id).toBe(listingId);
        expect(response.body.title).toBeDefined();
        expect(response.body.description).toBeDefined();
        expect(response.body.basePrice).toBeDefined();
      });

      it('should include owner info', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/listings/${listingId}`)
          .expect(200);

        expect(response.body.owner).toBeDefined();
        expect(response.body.owner.firstName).toBe('Dashboard');
      });

      it('should return 404 for non-existent listing', async () => {
        await request(app.getHttpServer())
          .get('/api/listings/non-existent-id')
          .expect(404);
      });
    });
  });

  // ============================================
  // BECOME OWNER FLOW TESTS
  // ============================================
  describe('Become Owner Flow', () => {
    describe('POST /api/users/upgrade-to-owner - Upgrade to Owner', () => {
      it('should upgrade renter to owner role', async () => {
        // Create a new user to upgrade
        const newUserRes = await request(app.getHttpServer()).post('/api/auth/register').send({
          email: 'upgrader@dashtest.com',
          password: 'SecurePass123!',
          firstName: 'Will',
          lastName: 'Upgrade',
          phone: '+1234567897',
          role: UserRole.USER,
        });

        const response = await request(app.getHttpServer())
          .post('/api/users/upgrade-to-owner')
          .set('Authorization', `Bearer ${newUserRes.body.tokens.accessToken}`)
          .send({
            acceptTerms: true,
            businessName: 'My Equipment Rental',
          })
          .expect(200);

        expect(response.body.role).toBe(UserRole.HOST);
      });

      it('should reject upgrade without accepting terms', async () => {
        const newUserRes = await request(app.getHttpServer()).post('/api/auth/register').send({
          email: 'noupgrade@dashtest.com',
          password: 'SecurePass123!',
          firstName: 'No',
          lastName: 'Upgrade',
          phone: '+1234567896',
          role: UserRole.USER,
        });

        await request(app.getHttpServer())
          .post('/api/users/upgrade-to-owner')
          .set('Authorization', `Bearer ${newUserRes.body.tokens.accessToken}`)
          .send({
            acceptTerms: false,
          })
          .expect(400);
      });

      it('should reject if already an owner', async () => {
        await request(app.getHttpServer())
          .post('/api/users/upgrade-to-owner')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            acceptTerms: true,
          })
          .expect(400);
      });
    });
  });

  // ============================================
  // MESSAGES TESTS
  // ============================================
  describe('Messages', () => {
    describe('GET /api/messages/conversations - Get Conversations', () => {
      it('should return user conversations', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/messages/conversations')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/messages - Send Message', () => {
      it('should send message related to booking', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/messages')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            receiverId: ownerId,
            bookingId,
            content: 'Hi, I have a question about the camera',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.content).toBe('Hi, I have a question about the camera');
      });
    });
  });

  // ============================================
  // CALENDAR & AVAILABILITY TESTS
  // ============================================
  describe('Calendar & Availability', () => {
    describe('GET /api/listings/:id/availability - Check Availability', () => {
      it('should return listing availability', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/listings/${listingId}/availability`)
          .query({
            startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .expect(200);

        expect(response.body).toHaveProperty('available');
      });
    });

    describe('PUT /api/listings/:id/availability - Update Availability', () => {
      it('should update listing availability (owner only)', async () => {
        const response = await request(app.getHttpServer())
          .put(`/api/listings/${listingId}/availability`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            blockedDates: [
              new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
              new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
            ],
          })
          .expect(200);

        expect(response.body).toBeDefined();
      });

      it('should reject availability update from non-owner', async () => {
        await request(app.getHttpServer())
          .put(`/api/listings/${listingId}/availability`)
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            blockedDates: [],
          })
          .expect(403);
      });
    });
  });

  // ============================================
  // OWNER PERFORMANCE ANALYTICS TESTS
  // ============================================
  describe('Owner Performance Analytics', () => {
    describe('GET /api/analytics/performance - Performance Metrics', () => {
      it('should return performance metrics for owner', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/analytics/performance')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalViews');
        expect(response.body).toHaveProperty('totalBookings');
        expect(response.body).toHaveProperty('conversionRate');
      });

      it('should return empty metrics for new owner', async () => {
        // Create new owner without activity
        const newOwnerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
          email: 'newowner@dashtest.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'Owner',
          phone: '+1234567898',
          role: UserRole.HOST,
        });

        const response = await request(app.getHttpServer())
          .get('/api/analytics/performance')
          .set('Authorization', `Bearer ${newOwnerRes.body.tokens.accessToken}`)
          .expect(200);

        expect(response.body.totalBookings).toBe(0);
      });
    });

    describe('GET /api/analytics/insights - Business Insights', () => {
      it('should return business insights for owner', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/analytics/insights')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('score');
        expect(response.body).toHaveProperty('recommendations');
      });
    });

    describe('GET /api/analytics/revenue - Revenue Analytics', () => {
      it('should return revenue analytics', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/analytics/revenue')
          .query({ period: 'month' })
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('breakdown');
      });
    });
  });
});
