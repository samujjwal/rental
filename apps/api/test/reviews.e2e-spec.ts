import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingMode, BookingStatus, PropertyStatus, ReviewType, UserRole } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

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

  const ownerEmail = buildTestEmail('review-owner');
  const renterEmail = buildTestEmail('review-renter');

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
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });

    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Test',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;
    ownerId = owner.userId;

    const renter = await createUserWithRole({
      app,
      prisma,
      email: renterEmail,
      firstName: 'Test',
      lastName: 'Renter',
      role: UserRole.USER,
    });
    renterToken = renter.accessToken;
    renterId = renter.userId;

    const category = await prisma.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!category?.id) {
      throw new Error('No active category available for reviews e2e');
    }

    const listing = await prisma.listing.create({
      data: {
        ownerId,
        categoryId: category.id,
        title: 'Review Test Listing',
        description: 'Listing used for review flow tests',
        slug: `review-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        address: '600 Review Ave',
        basePrice: 10000,
        currency: 'USD',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
        type: 'APARTMENT',
        latitude: 40.7128,
        longitude: -74.006,
        status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.INSTANT_BOOK,
      },
    });
    listingId = listing.id;

    const booking = await prisma.booking.create({
      data: {
        listingId,
        renterId,
        ownerId,
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: BookingStatus.COMPLETED,
        basePrice: 10000,
        totalPrice: 10000,
        platformFee: 1500,
        serviceFee: 500,
        currency: 'USD',
      },
    });
    bookingId = booking.id;
    reviewId = '';
  });

  describe('POST /reviews', () => {
    it('should create renter-to-owner review', async () => {
      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          reviewType: 'RENTER_TO_OWNER',
          overallRating: 5,
          comment: 'Great rental experience',
        })
        .expect(201);

      reviewId = response.body.id;
      expect(response.body.type).toBe(ReviewType.LISTING_REVIEW);
      expect(response.body.bookingId).toBe(bookingId);
    });

    it('should reject duplicate review for same direction', async () => {
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          reviewType: 'RENTER_TO_OWNER',
          overallRating: 5,
          comment: 'First review',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          reviewType: 'RENTER_TO_OWNER',
          overallRating: 4,
          comment: 'Second review',
        })
        .expect(400);
    });
  });

  describe('GET /reviews/listing/:listingId', () => {
    it('should return listing review payload', async () => {
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          reviewType: 'RENTER_TO_OWNER',
          overallRating: 5,
          comment: 'Listing review',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/reviews/listing/${listingId}`)
        .expect(200);

      expect(Array.isArray(response.body.reviews)).toBe(true);
      expect(response.body.total).toBeGreaterThan(0);
    });
  });

  describe('PATCH /reviews/:id', () => {
    it('should allow reviewer to update review', async () => {
      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId,
          reviewType: 'RENTER_TO_OWNER',
          overallRating: 4,
          comment: 'Original review',
        })
        .expect(201);
      reviewId = created.body.id;

      const updated = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ overallRating: 5, comment: 'Updated review' })
        .expect(200);

      expect(updated.body.overallRating).toBe(5);
      expect(updated.body.comment).toBe('Updated review');
    });
  });
});
