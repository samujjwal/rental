/**
 * P1: Concurrent Booking Race Condition E2E Test
 *
 * Validates that the advisory-lock based concurrency control in
 * bookings.service.ts prevents double-booking the same listing for
 * overlapping dates when parallel requests arrive simultaneously.
 *
 * Key implementation detail:
 *   pg_advisory_xact_lock(lockKey) serializes booking creation
 *   per listing, then conflicts[] query rejects overlapping dates.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import {
  createUserWithRole,
  loginUser,
  cleanupCoreRelationalData,
  uniqueSuffix,
  buildTestEmail,
} from './e2e-helpers';

describe('Concurrent Booking Race Condition (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renter1Token: string;
  let renter2Token: string;
  let listingId: string;
  let categoryId: string;

  const suffix = uniqueSuffix();
  const ownerEmail = buildTestEmail(`conc-owner-${suffix}`);
  const renter1Email = buildTestEmail(`conc-renter1-${suffix}`);
  const renter2Email = buildTestEmail(`conc-renter2-${suffix}`);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 3);

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

    // Create owner with Stripe connect
    const { userId: ownerUserId } = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      role: UserRole.HOST,
      password: 'ConcTest!123',
      firstName: 'ConcOwner',
    });
    await prisma.user.update({
      where: { id: ownerUserId },
      data: {
        emailVerified: true,
        stripeConnectId: `acct_test_conc_${suffix}`,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });
    ownerToken = (await loginUser(app, ownerEmail, 'ConcTest!123')).accessToken;

    // Create two renters
    const { userId: renter1UserId } = await createUserWithRole({
      app,
      prisma,
      email: renter1Email,
      role: UserRole.USER,
      password: 'ConcTest!123',
      firstName: 'Renter1',
    });
    await prisma.user.update({
      where: { id: renter1UserId },
      data: { emailVerified: true },
    });
    renter1Token = (await loginUser(app, renter1Email, 'ConcTest!123')).accessToken;

    const { userId: renter2UserId } = await createUserWithRole({
      app,
      prisma,
      email: renter2Email,
      role: UserRole.USER,
      password: 'ConcTest!123',
      firstName: 'Renter2',
    });
    await prisma.user.update({
      where: { id: renter2UserId },
      data: { emailVerified: true },
    });
    renter2Token = (await loginUser(app, renter2Email, 'ConcTest!123')).accessToken;

    // Create category + listing
    const cat = await prisma.category.create({
      data: { name: `ConcCat-${suffix}`, slug: `conc-cat-${suffix}` },
    });
    categoryId = cat.id;

    const listing = await prisma.listing.create({
      data: {
        title: `Concurrent Test Listing ${suffix}`,
        slug: `conc-listing-${suffix}`,
        description: 'Testing concurrent booking prevention',
        address: '1 Test Street',
        city: 'Kathmandu',
        state: 'Bagmati',
        zipCode: '44600',
        country: 'NP',
        type: 'HOUSE',
        basePrice: 100,
        currency: 'NPR',
        categoryId: cat.id,
        ownerId: ownerUserId,
        status: 'AVAILABLE',
        condition: 'GOOD',
      },
    });
    listingId = listing.id;
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    try {
      await prisma.listing.deleteMany({
        where: { id: listingId },
      });
      await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.user.deleteMany({
        where: { email: { in: [ownerEmail, renter1Email, renter2Email] } },
      });
    } catch { /* cleanup best-effort */ }
    await prisma.$disconnect();
    await app.close();
  });

  it('should allow only one booking when two renters book overlapping dates simultaneously', async () => {
    const bookingPayload = {
      listingId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    // Fire both booking requests in parallel
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renter1Token}`)
        .send(bookingPayload),
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renter2Token}`)
        .send(bookingPayload),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // One should succeed (201), one should fail (400 — "Listing not available")
    const successCount = statuses.filter((s) => s === 201).length;
    const failCount = statuses.filter((s) => s === 400).length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    // Verify the failure message
    const failedRes = res1.status === 400 ? res1 : res2;
    expect(failedRes.body.message).toMatch(/not available/i);
  });

  it('should allow bookings on non-overlapping dates for the same listing', async () => {
    // Dates well after the first booking
    const laterStart = new Date();
    laterStart.setDate(laterStart.getDate() + 60);
    const laterEnd = new Date(laterStart);
    laterEnd.setDate(laterEnd.getDate() + 2);

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${renter2Token}`)
      .send({
        listingId,
        startDate: laterStart.toISOString(),
        endDate: laterEnd.toISOString(),
      });

    // Should succeed since dates don't overlap
    expect(res.status).toBe(201);
  });

  it('should reject booking with exact same dates as existing active booking', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${renter2Token}`)
      .send({
        listingId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not available/i);
  });

  it('should reject booking with partially overlapping dates', async () => {
    // Overlaps: starts 1 day into existing booking
    const partialStart = new Date(startDate);
    partialStart.setDate(partialStart.getDate() + 1);
    const partialEnd = new Date(partialStart);
    partialEnd.setDate(partialEnd.getDate() + 5);

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${renter2Token}`)
      .send({
        listingId,
        startDate: partialStart.toISOString(),
        endDate: partialEnd.toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not available/i);
  });
});
