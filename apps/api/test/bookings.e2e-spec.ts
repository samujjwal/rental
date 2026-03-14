import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingStatus, PropertyStatus, UserRole, BookingMode } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

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
  const ownerEmail = buildTestEmail('booking-owner');
  const renterEmail = buildTestEmail('booking-renter');

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
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'test-category' } },
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
      phoneNumber: '+1234567890',
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
      phoneNumber: '+1234567891',
      role: UserRole.USER,
    });
    renterToken = renter.accessToken;
    renterId = renter.userId;

    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: `test-category-booking-${Date.now()}`,
        description: 'Test category for bookings',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
        searchableFields: [],
        requiredFields: [],
      },
    });
    categoryId = category.id;

    // Create test listing
    const listing = await prisma.listing.create({
      data: {
        owner: { connect: { id: ownerId } },
        category: { connect: { id: categoryId } },
        title: 'Test Listing for Booking',
        description: 'A test listing',
        slug: `test-listing-booking-${Date.now()}`,
        address: '123 Booking Test St',
        basePrice: 100,
        currency: 'USD',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
        type: 'APARTMENT',
        latitude: 40.7128,
        longitude: -74.006,
        status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.REQUEST,
        minStayNights: 1,
        maxStayNights: 30,
        instantBookable: false,
      },
    });
    listingId = listing.id;
  });

  describe('POST /bookings - Create booking', () => {
    it('should create a booking request successfully', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings')
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
      expect(response.body).toHaveProperty('basePrice');
      expect(response.body).toHaveProperty('platformFee');
      expect(response.body).toHaveProperty('totalPrice');

      bookingId = response.body.id;
    });

    it('should create instant booking when listing supports it', async () => {
      // Update listing to instant booking
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          bookingMode: BookingMode.INSTANT_BOOK,
          instantBookable: true,
        },
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app.getHttpServer())
        .post('/bookings')
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
        data: { status: PropertyStatus.UNAVAILABLE },
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          ownerId,
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
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          basePrice: 300,
          totalPrice: 330,
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
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          ownerId,
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
        .post('/bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          listingId,
          ownerId,
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
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          ownerId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(400);
    });
  });

  describe('GET /bookings/my-bookings - Get renter bookings', () => {
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
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should retrieve renter bookings', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].renterId).toBe(renterId);
    });

    it('should filter bookings by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .query({ status: BookingStatus.PENDING_OWNER_APPROVAL })
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((booking: any) => {
        expect(booking.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
      });
    });
  });

  describe('GET /bookings/host-bookings - Get owner bookings', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should retrieve owner bookings', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/host-bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].listing.ownerId).toBe(ownerId);
    });
  });

  describe('GET /bookings/:id - Get booking details', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should retrieve booking details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body.id).toBe(bookingId);
      expect(response.body).toHaveProperty('listing');
      expect(response.body).toHaveProperty('renter');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent booking', async () => {
      await request(app.getHttpServer())
        .get('/bookings/non-existent-id')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(404);
    });
  });

  describe('POST /bookings/:id/approve - Approve booking', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should approve booking as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('should reject approval by non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(403);
    });
  });

  describe('POST /bookings/:id/reject - Reject booking', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_OWNER_APPROVAL,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should reject booking as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Not available on these dates' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CANCELLED);
    });

    it('should reject rejection by non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(403);
    });
  });

  describe('POST /bookings/:id/cancel - Cancel booking', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should cancel booking as renter', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'Changed plans' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CANCELLED);
    });

    it('should cancel booking as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Listing no longer available' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CANCELLED);
    });
  });

  describe('POST /bookings/:id/start - Start rental', () => {
    beforeEach(async () => {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should start rental period', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.IN_PROGRESS);
    });

    it('should allow renter to start rental', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.IN_PROGRESS);
    });
  });

  describe('POST /bookings/:id/request-return - Request return', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date();

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.IN_PROGRESS,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should request return as renter', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/request-return`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.AWAITING_RETURN_INSPECTION);
    });

    it('should reject return request by owner', async () => {
      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/request-return`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });
  });

  describe('POST /bookings/:id/approve-return - Approve return', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          ownerId,
          startDate,
          endDate,
          status: BookingStatus.AWAITING_RETURN_INSPECTION,
          basePrice: 300,
          totalPrice: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;
    });

    it('should approve return as owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/approve-return`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.COMPLETED);
    });

    it('should reject return approval by renter', async () => {
      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/approve-return`)
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
        .post('/bookings')
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
        .post(`/bookings/${newBookingId}/approve`)
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
        .post(`/bookings/${newBookingId}/start`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(startRes.body.status).toBe(BookingStatus.IN_PROGRESS);

      // 5. Request return
      const returnReq = await request(app.getHttpServer())
        .post(`/bookings/${newBookingId}/request-return`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(returnReq.body.status).toBe(BookingStatus.AWAITING_RETURN_INSPECTION);

      // 6. Approve return
      const completeRes = await request(app.getHttpServer())
        .post(`/bookings/${newBookingId}/approve-return`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(completeRes.body.status).toBe(BookingStatus.COMPLETED);
    });
  });
});
