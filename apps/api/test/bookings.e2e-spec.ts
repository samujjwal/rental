import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { BookingStatus, ListingStatus, UserRole, BookingMode } from '@rental-portal/database';

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let ownerId: string;
  let renterId: string;
  let categoryId: string;
  let listingId: string;
  let bookingId: string;

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
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { renter: { email: { contains: '@bookingtest.com' } } },
          { listing: { owner: { email: { contains: '@bookingtest.com' } } } },
        ],
      },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { contains: '@bookingtest.com' } } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'test-category' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@bookingtest.com' } },
    });

    // Create owner
    const ownerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'owner@bookingtest.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'Owner',
      phone: '+1234567890',
      role: UserRole.OWNER,
    });
    ownerToken = ownerRes.body.tokens.accessToken;
    ownerId = ownerRes.body.user.id;

    // Create renter
    const renterRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'renter@bookingtest.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'Renter',
      phone: '+1234567891',
      role: UserRole.RENTER,
    });
    renterToken = renterRes.body.tokens.accessToken;
    renterId = renterRes.body.user.id;

    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: 'test-category-booking',
        description: 'Test category for bookings',
        icon: 'test',
        isActive: true,
        schema: {},
      },
    });
    categoryId = category.id;

    // Create test listing
    const listing = await prisma.listing.create({
      data: {
        ownerId,
        categoryId,
        title: 'Test Listing for Booking',
        description: 'A test listing',
        slug: 'test-listing-booking',
        basePrice: 10000, // $100.00
        currency: 'USD',
        city: 'Test City',
        state: 'TS',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        status: ListingStatus.ACTIVE,
        bookingMode: BookingMode.REQUEST,
        minRentalDays: 1,
        maxRentalDays: 30,
        instantBooking: false,
        details: {},
      },
    });
    listingId = listing.id;
  });

  describe('POST /api/bookings - Create booking', () => {
    it('should create a booking request successfully', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
          message: 'Looking forward to renting!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.listingId).toBe(listingId);
      expect(response.body.renterId).toBe(renterId);
      expect(response.body.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
      expect(response.body).toHaveProperty('subtotal');
      expect(response.body).toHaveProperty('platformFee');
      expect(response.body).toHaveProperty('totalAmount');

      bookingId = response.body.id;
    });

    it('should create instant booking when listing supports it', async () => {
      // Update listing to instant booking
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          bookingMode: BookingMode.INSTANT,
          instantBooking: true,
        },
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(201);

      expect(response.body.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should reject booking for inactive listing', async () => {
      await prisma.listing.update({
        where: { id: listingId },
        data: { status: ListingStatus.INACTIVE },
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(400);
    });

    it('should reject booking with overlapping dates', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      // Create first booking
      await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });

      // Try to create overlapping booking
      const overlapStart = new Date(startDate);
      overlapStart.setDate(overlapStart.getDate() + 1);
      const overlapEnd = new Date(endDate);
      overlapEnd.setDate(overlapEnd.getDate() + 1);

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: overlapStart.toISOString(),
          endDate: overlapEnd.toISOString(),
        })
        .expect(400);
    });

    it('should reject owner booking their own listing', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(400);
    });

    it('should validate date ranges', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() - 1); // End before start

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(400);
    });
  });

  describe('GET /api/bookings/my-bookings - Get renter bookings', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      // Create test booking
      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should retrieve renter bookings', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/bookings/my-bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].renterId).toBe(renterId);
    });

    it('should filter bookings by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/bookings/my-bookings')
        .query({ status: BookingStatus.PENDING_OWNER_APPROVAL })
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((booking: any) => {
        expect(booking.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
      });
    });
  });

  describe('GET /api/bookings/host-bookings - Get owner bookings', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should retrieve owner bookings', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/bookings/host-bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].listing.ownerId).toBe(ownerId);
    });
  });

  describe('GET /api/bookings/:id - Get booking details', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should retrieve booking details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body.id).toBe(bookingId);
      expect(response.body).toHaveProperty('listing');
      expect(response.body).toHaveProperty('renter');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent booking', async () => {
      await request(app.getHttpServer())
        .get('/api/bookings/non-existent-id')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(404);
    });
  });

  describe('POST /api/bookings/:id/approve - Approve booking', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should approve booking as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should reject approval by non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(403);
    });
  });

  describe('POST /api/bookings/:id/reject - Reject booking', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should reject booking as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Not available on these dates' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.REJECTED);
    });

    it('should reject rejection by non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(403);
    });
  });

  describe('POST /api/bookings/:id/cancel - Cancel booking', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should cancel booking as renter', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'Changed plans' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CANCELLED);
    });

    it('should cancel booking as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Listing no longer available' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CANCELLED);
    });
  });

  describe('POST /api/bookings/:id/start - Start rental', () => {
    beforeEach(async () => {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should start rental period', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.IN_PROGRESS);
      expect(response.body.actualStartDate).toBeDefined();
    });

    it('should reject starting by non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(403);
    });
  });

  describe('POST /api/bookings/:id/request-return - Request return', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date();

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.IN_PROGRESS,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
          actualStartDate: startDate,
        },
      });
      bookingId = booking.id;
    });

    it('should request return as renter', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/request-return`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.PENDING_RETURN_INSPECTION);
    });

    it('should reject return request by owner', async () => {
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/request-return`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });
  });

  describe('POST /api/bookings/:id/approve-return - Approve return', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_RETURN_INSPECTION,
          subtotal: 30000,
          totalAmount: 33000,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
          actualStartDate: startDate,
        },
      });
      bookingId = booking.id;
    });

    it('should approve return as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/approve-return`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.COMPLETED);
      expect(response.body.actualEndDate).toBeDefined();
    });

    it('should reject return approval by renter', async () => {
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/approve-return`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(403);
    });
  });

  describe('Booking lifecycle integration', () => {
    it('should complete full booking lifecycle', async () => {
      // 1. Create booking
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const createRes = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(201);

      const newBookingId = createRes.body.id;
      expect(createRes.body.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);

      // 2. Owner approves
      const approveRes = await request(app.getHttpServer())
        .post(`/api/bookings/${newBookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(approveRes.body.status).toBe(BookingStatus.PENDING_PAYMENT);

      // 3. Simulate payment (update booking to CONFIRMED)
      await prisma.booking.update({
        where: { id: newBookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          startDate: new Date(), // Move to today for testing
        },
      });

      // 4. Start rental
      const startRes = await request(app.getHttpServer())
        .post(`/api/bookings/${newBookingId}/start`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(startRes.body.status).toBe(BookingStatus.IN_PROGRESS);

      // 5. Request return
      const returnReq = await request(app.getHttpServer())
        .post(`/api/bookings/${newBookingId}/request-return`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(returnReq.body.status).toBe(BookingStatus.PENDING_RETURN_INSPECTION);

      // 6. Approve return
      const completeRes = await request(app.getHttpServer())
        .post(`/api/bookings/${newBookingId}/approve-return`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(completeRes.body.status).toBe(BookingStatus.COMPLETED);
    });
  });
});
