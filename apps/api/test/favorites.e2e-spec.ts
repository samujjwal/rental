import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole, BookingMode, PropertyStatus } from '@rental-portal/database';
import { buildTestEmail, createUserWithRole, cleanupCoreRelationalData } from './e2e-helpers';

describe('Favorites (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let renterToken: string;
  let ownerToken: string;
  let renterId: string;
  let listingId1: string;
  let listingId2: string;
  let listingId3: string;
  let categoryId: string;

  const renterEmail = buildTestEmail('fav-renter');
  const ownerEmail = buildTestEmail('fav-owner');
  const testEmails = [renterEmail, ownerEmail];

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
    renterId = renter.userId;

    // Get or create category
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    categoryId = cat?.id || (await prisma.category.create({
      data: { name: 'Fav Test Cat', slug: `fav-test-cat-${Date.now()}`, isActive: true },
    })).id;

    // Seed 3 listings
    const mkListing = async (title: string) => {
      const res = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          categoryId,
          title,
          description: 'A test listing for favorites',
          city: 'Kathmandu', state: 'Bagmati', country: 'NP',
          latitude: 27.7172, longitude: 85.324,
          pricingMode: 'DAILY', basePrice: 100,
          bookingMode: 'INSTANT_BOOK',
          addressLine1: '123 Test St', postalCode: '44600',
        });
      return res.body.id || res.body.listing?.id;
    };

    listingId1 = await mkListing('Fav Listing 1');
    listingId2 = await mkListing('Fav Listing 2');
    listingId3 = await mkListing('Fav Listing 3');
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.favoriteListing.deleteMany({ where: { userId: renterId } });
    await prisma.listing.deleteMany({ where: { owner: { email: { in: testEmails } } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ── POST /favorites — Add to favorites ──
  describe('POST /favorites', () => {
    it('should add a listing to favorites', async () => {
      const res = await request(app.getHttpServer())
        .post('/favorites')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingId: listingId1 })
        .expect((r) => expect([200, 201]).toContain(r.status));

      expect(res.body).toBeDefined();
    });

    it('should handle duplicate favorite gracefully', async () => {
      // Add again — should not throw
      await request(app.getHttpServer())
        .post('/favorites')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingId: listingId1 })
        .expect((r) => expect([200, 201, 409]).toContain(r.status));
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/favorites')
        .send({ listingId: listingId2 })
        .expect((r) => expect([401, 403]).toContain(r.status));
    });
  });

  // ── GET /favorites — List favorites ──
  describe('GET /favorites', () => {
    beforeAll(async () => {
      // Ensure at least one favorite exists
      await request(app.getHttpServer())
        .post('/favorites')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingId: listingId2 });
    });

    it('should return user favorites list', async () => {
      const res = await request(app.getHttpServer())
        .get('/favorites')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data || res.body.favorites || res.body)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/favorites')
        .expect((r) => expect([401, 403]).toContain(r.status));
    });
  });

  // ── GET /favorites/count — Favorites count ──
  describe('GET /favorites/count', () => {
    it('should return favorites count', async () => {
      const res = await request(app.getHttpServer())
        .get('/favorites/count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  // ── GET /favorites/listing/:listingId — Check if favorited ──
  describe('GET /favorites/listing/:listingId', () => {
    it('should indicate listing is favorited', async () => {
      const res = await request(app.getHttpServer())
        .get(`/favorites/listing/${listingId1}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('isFavorite');
      expect(res.body.isFavorite).toBe(true);
    });

    it('should indicate listing is NOT favorited', async () => {
      const res = await request(app.getHttpServer())
        .get(`/favorites/listing/${listingId3}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('isFavorite');
      expect(res.body.isFavorite).toBe(false);
    });
  });

  // ── POST /favorites/bulk — Bulk add ──
  describe('POST /favorites/bulk', () => {
    it('should add multiple listings to favorites', async () => {
      await request(app.getHttpServer())
        .post('/favorites/bulk')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingIds: [listingId2, listingId3] })
        .expect((r) => expect([200, 201]).toContain(r.status));

      // Verify count increased
      const countRes = await request(app.getHttpServer())
        .get('/favorites/count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(countRes.body.count).toBeGreaterThanOrEqual(3);
    });
  });

  // ── DELETE /favorites/:listingId — Remove favorite ──
  describe('DELETE /favorites/:listingId', () => {
    it('should remove a listing from favorites', async () => {
      await request(app.getHttpServer())
        .delete(`/favorites/${listingId3}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([200, 204]).toContain(r.status));

      // Verify it's removed
      const check = await request(app.getHttpServer())
        .get(`/favorites/listing/${listingId3}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(check.body.isFavorite).toBe(false);
    });

    it('should handle removing non-existent favorite gracefully', async () => {
      await request(app.getHttpServer())
        .delete(`/favorites/${listingId3}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([200, 204, 404]).toContain(r.status));
    });
  });

  // ── DELETE /favorites/bulk — Bulk remove ──
  describe('DELETE /favorites/bulk', () => {
    it('should remove multiple favorites', async () => {
      await request(app.getHttpServer())
        .delete('/favorites/bulk')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingIds: [listingId1, listingId2] })
        .expect((r) => expect([200, 204]).toContain(r.status));
    });
  });

  // ── DELETE /favorites/all — Clear all ──
  describe('DELETE /favorites/all', () => {
    beforeAll(async () => {
      // Re-add some favorites
      await request(app.getHttpServer())
        .post('/favorites/bulk')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingIds: [listingId1, listingId2] });
    });

    it('should clear all favorites', async () => {
      await request(app.getHttpServer())
        .delete('/favorites/all')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([200, 204]).toContain(r.status));

      const countRes = await request(app.getHttpServer())
        .get('/favorites/count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(countRes.body.count).toBe(0);
    });
  });
});
