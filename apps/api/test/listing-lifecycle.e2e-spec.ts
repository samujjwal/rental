import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, createUserWithRole, cleanupCoreRelationalData } from './e2e-helpers';

describe('Listing Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let adminToken: string;
  let listingId: string;
  let categoryId: string;

  const ownerEmail = buildTestEmail('lifecycle-owner');
  const renterEmail = buildTestEmail('lifecycle-renter');
  const adminEmail = buildTestEmail('lifecycle-admin');
  const testEmails = [ownerEmail, renterEmail, adminEmail];

  const listingPayload = () => ({
    categoryId,
    title: `Lifecycle Listing ${Date.now()}`,
    description: 'A listing for lifecycle testing with a sufficiently long description to pass the fifty character minimum validation requirement.',
    city: 'Kathmandu', state: 'Bagmati', country: 'NP',
    latitude: 27.7172, longitude: 85.324,
    pricingMode: 'DAILY', basePrice: 200,
    bookingMode: 'INSTANT_BOOK',
    addressLine1: '456 Test St', postalCode: '44600',
    categorySpecificData: {},
    photos: [{ url: 'https://example.com/photo1.jpg', order: 1 }],
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Create users
    const owner = await createUserWithRole({ app, prisma, email: ownerEmail, role: UserRole.HOST });
    ownerToken = owner.accessToken;

    const renter = await createUserWithRole({ app, prisma, email: renterEmail, role: UserRole.USER });
    renterToken = renter.accessToken;

    const admin = await createUserWithRole({ app, prisma, email: adminEmail, role: UserRole.ADMIN });
    adminToken = admin.accessToken;

    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    categoryId = cat?.id || (await prisma.category.create({
      data: { name: 'Lifecycle Cat', slug: `lifecycle-cat-${Date.now()}`, isActive: true },
    })).id;
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: testEmails } } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ── Create a listing ──
  describe('POST /listings — Create', () => {
    it('should create a listing as owner', async () => {
      const res = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload())
        .expect(201);

      listingId = res.body.id || res.body.listing?.id;
      expect(listingId).toBeDefined();
    });

    it('should reject listing creation without category', async () => {
      const payload = listingPayload();
      delete (payload as any).categoryId;
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(payload)
        .expect((r) => expect([400, 422]).toContain(r.status));
    });

    it('should reject listing creation by unauthenticated user', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .send(listingPayload())
        .expect((r) => expect([401, 403]).toContain(r.status));
    });
  });

  // ── Publish listing ──
  describe('POST /listings/:id/publish', () => {
    it('should publish a listing as owner', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect((r) => expect([200, 201]).toContain(r.status));
    });

    it('should reject publish by non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/publish`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([403, 404]).toContain(r.status));
    });
  });

  // ── Pause listing ──
  describe('POST /listings/:id/pause', () => {
    it('should pause a listing as owner', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/pause`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect((r) => expect([200, 201]).toContain(r.status));
    });

    it('should reject pause by non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/pause`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([403, 404]).toContain(r.status));
    });
  });

  // ── Activate listing ──
  describe('POST /listings/:id/activate', () => {
    it('should re-activate a paused listing', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/activate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect((r) => expect([200, 201]).toContain(r.status));
    });
  });

  // ── View listing (tracks view count) ──
  describe('POST /listings/:id/view', () => {
    it('should record a view', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/view`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([200, 201, 204]).toContain(r.status));
    });

    it('should work without authentication (public view)', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/view`)
        .expect((r) => expect([200, 201, 204]).toContain(r.status));
    });
  });

  // ── Check availability ──
  describe('POST /listings/:id/check-availability', () => {
    it('should check availability for a date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const res = await request(app.getHttpServer())
        .post(`/listings/${listingId}/check-availability`)
        .send({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect((r) => expect([200, 201]).toContain(r.status));

      expect(res.body).toHaveProperty('available');
    });

    it('should reject invalid date ranges', async () => {
      await request(app.getHttpServer())
        .post(`/listings/${listingId}/check-availability`)
        .send({
          startDate: '2020-01-01',
          endDate: '2019-01-01',
        })
        .expect((r) => expect([400, 422]).toContain(r.status));
    });
  });

  // ── Available dates ──
  describe('GET /listings/:id/available-dates', () => {
    it('should return available dates for listing', async () => {
      const res = await request(app.getHttpServer())
        .get(`/listings/${listingId}/available-dates`)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  // ── Listing stats ──
  describe('GET /listings/:id/stats', () => {
    it('should return listing stats for owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/listings/${listingId}/stats`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  // ── Completeness score ──
  describe('GET /listings/:id/completeness', () => {
    it('should return completeness score', async () => {
      const res = await request(app.getHttpServer())
        .get(`/listings/${listingId}/completeness`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('score');
    });
  });

  // ── Featured listings ──
  describe('GET /listings/featured', () => {
    it('should return featured listings (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings/featured')
        .expect(200);

      expect(Array.isArray(res.body.data || res.body.listings || res.body)).toBe(true);
    });
  });

  // ── Price suggestion ──
  describe('GET /listings/price-suggestion', () => {
    it('should return price suggestion with params', async () => {
      const res = await request(app.getHttpServer())
        .get(`/listings/price-suggestion?categoryId=${categoryId}&city=Kathmandu`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  // ── Update listing ──
  describe('PATCH /listings/:id', () => {
    it('should update listing fields', async () => {
      await request(app.getHttpServer())
        .patch(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Updated Lifecycle Listing', basePrice: 250 })
        .expect(200);
    });

    it('should reject update by non-owner non-admin', async () => {
      await request(app.getHttpServer())
        .patch(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ title: 'Hacked Title' })
        .expect((r) => expect([403, 404]).toContain(r.status));
    });
  });

  // ── Delete listing ──
  describe('DELETE /listings/:id', () => {
    let deletableId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingPayload());
      deletableId = res.body.id || res.body.listing?.id;
    });

    it('should soft-delete listing as owner', async () => {
      await request(app.getHttpServer())
        .delete(`/listings/${deletableId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect((r) => expect([200, 204]).toContain(r.status));
    });

    it('should reject delete by non-owner', async () => {
      await request(app.getHttpServer())
        .delete(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([403, 404]).toContain(r.status));
    });
  });
});
