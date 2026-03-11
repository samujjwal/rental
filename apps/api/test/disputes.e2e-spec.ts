import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingMode, BookingStatus, DisputeStatus, PropertyStatus, UserRole } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

describe('Disputes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renterToken: string;
  let renterUserId: string;
  let ownerToken: string;
  let ownerUserId: string;
  let adminToken: string;
  let adminUserId: string;
  let outsiderToken: string;

  let listingId: string;
  let bookingId: string;

  const renterEmail = buildTestEmail('dispute-renter');
  const ownerEmail = buildTestEmail('dispute-owner');
  const adminEmail = buildTestEmail('dispute-admin');
  const outsiderEmail = buildTestEmail('dispute-outsider');

  const createDisputePayload = () => ({
    bookingId,
    title: `Dispute ${Date.now()}`,
    type: 'PROPERTY_DAMAGE',
    description: 'Damage discovered after booking completion',
    amount: 75,
  });

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
      where: { owner: { email: { in: [ownerEmail, renterEmail, adminEmail, outsiderEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail, adminEmail, outsiderEmail] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail, adminEmail, outsiderEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail, adminEmail, outsiderEmail] } },
    });

    const renter = await createUserWithRole({
      app,
      prisma,
      email: renterEmail,
      firstName: 'Renter',
      lastName: 'Dispute',
      role: UserRole.USER,
    });
    renterToken = renter.accessToken;
    renterUserId = renter.userId;

    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Owner',
      lastName: 'Dispute',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;
    ownerUserId = owner.userId;

    const admin = await createUserWithRole({
      app,
      prisma,
      email: adminEmail,
      firstName: 'Admin',
      lastName: 'Dispute',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;
    adminUserId = admin.userId;

    const outsider = await createUserWithRole({
      app,
      prisma,
      email: outsiderEmail,
      firstName: 'Outsider',
      lastName: 'Dispute',
      role: UserRole.USER,
    });
    outsiderToken = outsider.accessToken;

    const category = await prisma.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!category?.id) {
      throw new Error('No active category available for disputes e2e');
    }

    const listing = await prisma.listing.create({
      data: {
        ownerId: ownerUserId,
        categoryId: category.id,
        title: 'Dispute Listing',
        description: 'Listing used for dispute flow tests',
        slug: `dispute-listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        address: '10 Dispute Avenue',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
        type: 'APARTMENT',
        basePrice: 100,
        currency: 'USD',
        status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.REQUEST,
      },
    });
    listingId = listing.id;

    const booking = await prisma.booking.create({
      data: {
        listingId,
        renterId: renterUserId,
        ownerId: ownerUserId,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        status: BookingStatus.COMPLETED,
        basePrice: 300,
        totalPrice: 300,
        totalAmount: 300,
        platformFee: 45,
        serviceFee: 15,
        currency: 'USD',
      },
    });
    bookingId = booking.id;
  });

  it('creates a dispute as renter', async () => {
    const response = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    expect(response.body.status).toBe(DisputeStatus.OPEN);
    expect(response.body.initiatorId).toBe(renterUserId);
    expect(response.body.defendantId).toBe(ownerUserId);
  });

  it('prevents duplicate active disputes for the same booking', async () => {
    await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(400);
  });

  it('rejects dispute creation by unrelated user', async () => {
    await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send(createDisputePayload())
      .expect(403);
  });

  it('allows defendant response and moves dispute to under review', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    const disputeId = created.body.id;

    const response = await request(app.getHttpServer())
      .post(`/disputes/${disputeId}/responses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ message: 'I am reviewing the evidence.' })
      .expect(201);

    expect(response.body.content).toBe('I am reviewing the evidence.');

    const updated = await request(app.getHttpServer())
      .get(`/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${renterToken}`)
      .expect(200);

    expect(updated.body.status).toBe(DisputeStatus.UNDER_REVIEW);
  });

  it('rejects response from non-party', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    await request(app.getHttpServer())
      .post(`/disputes/${created.body.id}/responses`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ message: 'Unauthorized response' })
      .expect(403);
  });

  it('lists disputes for party users', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    const renterList = await request(app.getHttpServer())
      .get('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .expect(200);

    expect(Array.isArray(renterList.body.disputes)).toBe(true);
    expect(renterList.body.disputes.some((d: any) => d.id === created.body.id)).toBe(true);
  });

  it('allows admin to update dispute status', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/disputes/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: DisputeStatus.RESOLVED,
        adminNotes: 'Resolved by admin review',
        resolvedAmount: 50,
      })
      .expect(200);

    expect(updated.body.status).toBe(DisputeStatus.RESOLVED);
    expect(updated.body.assignedTo).toBe(adminUserId);
  });

  it('rejects admin update from non-admin users', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/disputes/${created.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: DisputeStatus.RESOLVED })
      .expect(403);
  });

  it('allows initiator to close dispute', async () => {
    const created = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    const closed = await request(app.getHttpServer())
      .post(`/disputes/${created.body.id}/close`)
      .set('Authorization', `Bearer ${renterToken}`)
      .send({ reason: 'Issue settled privately' })
      .expect(201);

    expect(closed.body.status).toBe(DisputeStatus.CLOSED);
  });

  it('allows admin to list all disputes', async () => {
    await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterToken}`)
      .send(createDisputePayload())
      .expect(201);

    const adminList = await request(app.getHttpServer())
      .get('/disputes/admin/all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(adminList.body.disputes)).toBe(true);
    expect(typeof adminList.body.total).toBe('number');
  });
});
