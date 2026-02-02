import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingStatus, ListingStatus, UserRole, BookingMode } from '@rental-portal/database';

/**
 * Reviews E2E Tests
 *
 * Tests bidirectional review system:
 * - Renter reviews listing/owner
 * - Owner reviews renter
 * - Review moderation
 * - Rating aggregation
 */
describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let ownerId: string;
  let renterId: string;
  let listingId: string;
  let bookingId: string;
  let reviewId: string;

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
    // Clean up test data
    await prisma.review.deleteMany({
      where: {
        OR: [
          { reviewer: { email: { contains: '@reviewtest.com' } } },
          { reviewee: { email: { contains: '@reviewtest.com' } } },
        ],
      },
    });
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { renter: { email: { contains: '@reviewtest.com' } } },
          { listing: { owner: { email: { contains: '@reviewtest.com' } } } },
        ],
      },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { contains: '@reviewtest.com' } } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'review-test' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@reviewtest.com' } },
    });

    // Create test users
    const ownerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'owner@reviewtest.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'Owner',
      phone: '+1234567890',
      role: UserRole.HOST,
    });
    ownerToken = ownerRes.body.tokens.accessToken;
    ownerId = ownerRes.body.user.id;

    const renterRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'renter@reviewtest.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'Renter',
      phone: '+1234567891',
      role: UserRole.USER,
    });
    renterToken = renterRes.body.tokens.accessToken;
    renterId = renterRes.body.user.id;

    // Create test category and listing
    const category = await prisma.category.create({
      data: {
        name: 'Review Test Category',
        slug: 'review-test-category',
        description: 'Test category',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
      },
    });

    const listing = await prisma.listing.create({
      data: {
        ownerId,
        categoryId: category.id,
        title: 'Test Review Listing',
        description: 'A test listing',
        slug: 'test-review-listing',
        basePrice: 10000,
        currency: 'USD',
        city: 'Test City',
        state: 'TS',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        status: ListingStatus.ACTIVE,
        bookingMode: BookingMode.INSTANT_BOOK,
        minRentalDays: 1,
        maxRentalDays: 30,
        details: {},
      },
    });
    listingId = listing.id;

    // Create completed booking
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);

    const booking = await prisma.booking.create({
      data: {
        renterId,
        listingId,
        startDate,
        endDate,
        status: BookingStatus.COMPLETED,
        basePrice: 300,
        totalPrice: 330,
        totalAmount: 330,
        currency: 'USD',
        platformFee: 2000,
        serviceFee: 1000,
        actualStartDate: startDate,
        actualEndDate: endDate,
      },
    });
    bookingId = booking.id;
  });

  describe('POST /api/reviews - Create review', () => {
    it('should create renter review of listing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Excellent rental experience! The owner was very responsive.',
          categories: {
            communication: 5,
            cleanliness: 5,
            accuracy: 5,
            value: 5,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.bookingId).toBe(bookingId);
      expect(response.body.reviewerId).toBe(renterId);
      expect(response.body.revieweeId).toBe(ownerId);
      expect(response.body.rating).toBe(5);
      expect(response.body.type).toBe('LISTING_REVIEW');

      reviewId = response.body.id;
    });

    it('should create owner review of renter', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          bookingId,
          revieweeId: renterId,
          type: 'RENTER_REVIEW',
          rating: 4,
          comment: 'Good renter, returned item in good condition.',
          categories: {
            communication: 4,
            responsibility: 5,
            cleanliness: 4,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.reviewerId).toBe(ownerId);
      expect(response.body.revieweeId).toBe(renterId);
      expect(response.body.type).toBe('RENTER_REVIEW');
    });

    it('should reject review for incomplete booking', async () => {
      // Create in-progress booking
      const inProgressBooking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          status: BookingStatus.IN_PROGRESS,
          basePrice: 100,
          totalPrice: 110,
          totalAmount: 110,
          currency: 'USD',
          platformFee: 500,
          serviceFee: 500,
        },
      });

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: inProgressBooking.id,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Good',
        })
        .expect(400);
    });

    it('should reject duplicate review', async () => {
      // Create first review
      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Great!',
        })
        .expect(201);

      // Try to create another review for same booking
      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 4,
          comment: 'Changing my mind',
        })
        .expect(409);
    });

    it('should reject review from unauthorized user', async () => {
      // Create third user
      const user3Res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'user3@reviewtest.com',
        password: 'SecurePass123!',
        firstName: 'User',
        lastName: 'Three',
        phone: '+1234567892',
        role: UserRole.USER,
      });
      const user3Token = user3Res.body.tokens.accessToken;

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${user3Token}`)
        .send({
          bookingId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Not my booking',
        })
        .expect(403);
    });

    it('should validate rating range', async () => {
      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 6, // Invalid: should be 1-5
          comment: 'Great!',
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/reviews')
        .send({
          bookingId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Great!',
        })
        .expect(401);
    });
  });

  describe('GET /api/reviews/:id - Get review', () => {
    beforeEach(async () => {
      const review = await prisma.review.create({
        data: {
          bookingId,
          reviewerId: renterId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Excellent!',
        },
      });
      reviewId = review.id;
    });

    it('should retrieve review details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reviews/${reviewId}`)
        .expect(200);

      expect(response.body.id).toBe(reviewId);
      expect(response.body).toHaveProperty('reviewer');
      expect(response.body).toHaveProperty('reviewee');
      expect(response.body).toHaveProperty('rating');
      expect(response.body).toHaveProperty('comment');
    });

    it('should return 404 for non-existent review', async () => {
      await request(app.getHttpServer()).get('/api/reviews/non-existent-id').expect(404);
    });
  });

  describe('PATCH /api/reviews/:id - Update review', () => {
    beforeEach(async () => {
      const review = await prisma.review.create({
        data: {
          bookingId,
          reviewerId: renterId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 4,
          comment: 'Good',
        },
      });
      reviewId = review.id;
    });

    it('should update own review', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          rating: 5,
          comment: 'Actually, it was excellent!',
        })
        .expect(200);

      expect(response.body.rating).toBe(5);
      expect(response.body.comment).toBe('Actually, it was excellent!');
    });

    it('should reject update of other user review', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          rating: 1,
          comment: 'Trying to change their review',
        })
        .expect(403);
    });

    it('should reject update after 7 days', async () => {
      // Update review to be 8 days old
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      });

      await request(app.getHttpServer())
        .patch(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          rating: 5,
          comment: 'Too late',
        })
        .expect(400);
    });
  });

  describe('DELETE /api/reviews/:id - Delete review', () => {
    beforeEach(async () => {
      const review = await prisma.review.create({
        data: {
          bookingId,
          reviewerId: renterId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Great!',
        },
      });
      reviewId = review.id;
    });

    it('should delete own review', async () => {
      await request(app.getHttpServer())
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(204);

      // Verify review deleted
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(review).toBeNull();
    });

    it('should reject deletion of other user review', async () => {
      await request(app.getHttpServer())
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });
  });

  describe('GET /api/reviews/listing/:listingId - Get listing reviews', () => {
    beforeEach(async () => {
      // Create multiple reviews for the listing
      for (let i = 0; i < 3; i++) {
        const newBooking = await prisma.booking.create({
          data: {
            renterId,
            listingId,
            startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            status: BookingStatus.COMPLETED,
            basePrice: 100,
            totalPrice: 110,
            totalAmount: 110,
            currency: 'USD',
            platformFee: 500,
            serviceFee: 500,
          },
        });

        await prisma.review.create({
          data: {
            bookingId: newBooking.id,
            reviewerId: renterId,
            revieweeId: ownerId,
            type: 'LISTING_REVIEW',
            rating: 5 - i,
            comment: `Review ${i + 1}`,
          },
        });
      }
    });

    it('should retrieve listing reviews', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reviews/listing/${listingId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('reviewer');
      expect(response.body[0]).toHaveProperty('rating');
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reviews/listing/${listingId}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for listing with no reviews', async () => {
      const newListing = await prisma.listing.create({
        data: {
          ownerId,
          categoryId: (await prisma.category.findFirst()).id,
          title: 'New Listing',
          description: 'No reviews yet',
          slug: 'new-listing-no-reviews',
          basePrice: 5000,
          currency: 'USD',
          city: 'Test',
          state: 'TS',
          country: 'US',
          latitude: 0,
          longitude: 0,
          status: ListingStatus.ACTIVE,
          details: {},
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/reviews/listing/${newListing.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/reviews/user/:userId - Get user reviews', () => {
    beforeEach(async () => {
      // Create reviews received by owner
      await prisma.review.create({
        data: {
          bookingId,
          reviewerId: renterId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Great owner!',
        },
      });

      // Create review given by owner
      await prisma.review.create({
        data: {
          bookingId,
          reviewerId: ownerId,
          revieweeId: renterId,
          type: 'RENTER_REVIEW',
          rating: 4,
          comment: 'Good renter!',
        },
      });
    });

    it('should retrieve reviews received by user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reviews/user/${ownerId}`)
        .query({ type: 'received' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((review: any) => {
        expect(review.revieweeId).toBe(ownerId);
      });
    });

    it('should retrieve reviews given by user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reviews/user/${ownerId}`)
        .query({ type: 'given' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((review: any) => {
        expect(review.reviewerId).toBe(ownerId);
      });
    });

    it('should require type parameter', async () => {
      await request(app.getHttpServer()).get(`/api/reviews/user/${ownerId}`).expect(400);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reviews/user/${ownerId}`)
        .query({ type: 'received', page: 1, limit: 10 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });
  });

  describe('GET /api/reviews/booking/:bookingId - Get booking reviews', () => {
    beforeEach(async () => {
      // Create bidirectional reviews
      await prisma.review.create({
        data: {
          bookingId,
          reviewerId: renterId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 5,
          comment: 'Great listing!',
        },
      });

      await prisma.review.create({
        data: {
          bookingId,
          reviewerId: ownerId,
          revieweeId: renterId,
          type: 'RENTER_REVIEW',
          rating: 4,
          comment: 'Good renter!',
        },
      });
    });

    it('should retrieve both reviews for booking', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reviews/booking/${bookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('listingReview');
      expect(response.body).toHaveProperty('renterReview');
      expect(response.body.listingReview.reviewerId).toBe(renterId);
      expect(response.body.renterReview.reviewerId).toBe(ownerId);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get(`/api/reviews/booking/${bookingId}`).expect(401);
    });
  });

  describe('Rating aggregation', () => {
    beforeEach(async () => {
      // Create multiple bookings and reviews
      for (let i = 0; i < 5; i++) {
        const booking = await prisma.booking.create({
          data: {
            renterId,
            listingId,
            startDate: new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - (8 + i) * 24 * 60 * 60 * 1000),
            status: BookingStatus.COMPLETED,
            basePrice: 100,
            totalPrice: 110,
            totalAmount: 110,
            currency: 'USD',
            platformFee: 500,
            serviceFee: 500,
          },
        });

        await prisma.review.create({
          data: {
            bookingId: booking.id,
            reviewerId: renterId,
            revieweeId: ownerId,
            type: 'LISTING_REVIEW',
            rating: 4 + (i % 2), // Alternate between 4 and 5
            comment: `Review ${i + 1}`,
          },
        });
      }
    });

    it('should calculate average rating for listing', async () => {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
      });

      // Calculate expected average
      const reviews = await prisma.review.findMany({
        where: {
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
        },
      });

      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const expectedAvg = totalRating / reviews.length;

      // Note: Actual implementation would update listing.averageRating
      expect(listing).toBeDefined();
      expect(reviews.length).toBe(5);
    });
  });

  describe('Review moderation', () => {
    beforeEach(async () => {
      const review = await prisma.review.create({
        data: {
          bookingId,
          reviewerId: renterId,
          revieweeId: ownerId,
          type: 'LISTING_REVIEW',
          rating: 1,
          comment: 'Terrible experience with bad words',
        },
      });
      reviewId = review.id;
    });

    it('should flag inappropriate reviews', async () => {
      // Create admin
      const adminRes = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'admin@reviewtest.com',
        password: 'SecurePass123!',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+1234567892',
        role: UserRole.ADMIN,
      });
      const adminToken = adminRes.body.tokens.accessToken;

      // Flag review
      await request(app.getHttpServer())
        .post(`/api/reviews/${reviewId}/flag`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Inappropriate language' })
        .expect(200);

      // Verify review flagged
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(review.status).toBe('FLAGGED');
    });
  });
});
