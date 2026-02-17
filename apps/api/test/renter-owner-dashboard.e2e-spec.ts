import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingMode, PropertyStatus, UserRole } from '@rental-portal/database';
import { cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

describe('Renter & Owner Dashboard Flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let ownerId: string;
  let renterId: string;
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
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: ['owner@dashtest.com', 'renter@dashtest.com'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['owner@dashtest.com', 'renter@dashtest.com'] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: ['owner@dashtest.com', 'renter@dashtest.com'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['owner@dashtest.com', 'renter@dashtest.com'] } },
    });

    const owner = await createUserWithRole({
      app,
      prisma,
      email: 'owner@dashtest.com',
      password: 'SecurePass123!',
      firstName: 'Dashboard',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;
    ownerId = owner.userId;

    const renter = await createUserWithRole({
      app,
      prisma,
      email: 'renter@dashtest.com',
      password: 'SecurePass123!',
      firstName: 'Dashboard',
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
      throw new Error('No active category available for dashboard e2e');
    }

    const listing = await prisma.listing.create({
      data: {
        ownerId,
        categoryId: category.id,
        title: 'Dashboard Test Listing',
        description: 'Listing used for owner/renter dashboard e2e flows',
        slug: `dash-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        address: '123 Dashboard Street',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        country: 'US',
        type: 'APARTMENT',
        basePrice: 100,
        currency: 'USD',
        latitude: 37.7749,
        longitude: -122.4194,
        status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.REQUEST,
      },
    });
    listingId = listing.id;

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${renterToken}`)
      .send({
        listingId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        guestCount: 1,
      })
      .expect(201);
    bookingId = booking.body.id;
  });

  describe('User profile flow', () => {
    it('should get current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body.id).toBe(renterId);
      expect(response.body.email).toBe('renter@dashtest.com');
    });

    it('should update current user profile', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ firstName: 'Updated', lastName: 'Renter' })
        .expect(200);

      expect(response.body.firstName).toBe('Updated');
    });
  });

  describe('Booking flow', () => {
    it('should return renter bookings', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my-bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((booking: any) => booking.id === bookingId)).toBe(true);
    });

    it('should return owner host bookings', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/host-bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((booking: any) => booking.id === bookingId)).toBe(true);
    });
  });

  describe('Owner listings flow', () => {
    it('should return owner listings', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings/my-listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((listing: any) => listing.id === listingId)).toBe(true);
    });
  });

  describe('Favorites flow', () => {
    it('should add and remove favorite listing', async () => {
      await request(app.getHttpServer())
        .post('/favorites')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingId })
        .expect(201);

      const listResponse = await request(app.getHttpServer())
        .get('/favorites')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);
      expect(Array.isArray(listResponse.body.favorites)).toBe(true);

      await request(app.getHttpServer())
        .delete(`/favorites/${listingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(204);
    });
  });

  describe('Role upgrade flow', () => {
    it('should allow renter to upgrade to owner', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/upgrade-to-owner')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);

      expect(response.body.role).toBe(UserRole.HOST);
    });
  });
});
