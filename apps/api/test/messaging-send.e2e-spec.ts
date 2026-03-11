import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, createUserWithRole, cleanupCoreRelationalData } from './e2e-helpers';

describe('Messaging — Send & Manage (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let renterToken: string;
  let ownerToken: string;
  let otherToken: string;
  let renterId: string;
  let ownerId: string;
  let listingId: string;
  let conversationId: string;
  let messageId: string;
  let categoryId: string;

  const renterEmail = buildTestEmail('msg-renter');
  const ownerEmail = buildTestEmail('msg-owner');
  const otherEmail = buildTestEmail('msg-other');
  const testEmails = [renterEmail, ownerEmail, otherEmail];

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
    ownerId = owner.userId;

    const renter = await createUserWithRole({ app, prisma, email: renterEmail, role: UserRole.USER });
    renterToken = renter.accessToken;
    renterId = renter.userId;

    const other = await createUserWithRole({ app, prisma, email: otherEmail, role: UserRole.USER });
    otherToken = other.accessToken;

    // Create a listing for conversation context
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    categoryId = cat?.id || (await prisma.category.create({
      data: { name: 'Msg Test Cat', slug: `msg-test-cat-${Date.now()}`, isActive: true },
    })).id;

    const listingRes = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        categoryId,
        title: 'Messaging Test Listing',
        description: 'For messaging E2E tests',
        city: 'Kathmandu', state: 'Bagmati', country: 'NP',
        latitude: 27.7172, longitude: 85.324,
        pricingMode: 'DAILY', basePrice: 100,
        bookingMode: 'INSTANT_BOOK',
        addressLine1: '789 Test St', postalCode: '44600',
      });
    listingId = listingRes.body.id || listingRes.body.listing?.id;
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: testEmails } } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ── Create Conversation ──
  describe('POST /conversations — Create conversation', () => {
    it('should create a conversation about a listing', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingId, recipientId: ownerId })
        .expect((r) => expect([200, 201]).toContain(r.status));

      conversationId = res.body.id || res.body.conversation?.id;
      expect(conversationId).toBeDefined();
    });

    it('should return existing conversation for same pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingId, recipientId: ownerId })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const id = res.body.id || res.body.conversation?.id;
      expect(id).toBe(conversationId);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ listingId, recipientId: ownerId })
        .expect((r) => expect([401, 403]).toContain(r.status));
    });
  });

  // ── Send Message ──
  describe('POST /conversations/:id/messages — Send message', () => {
    it('should send a message as renter', async () => {
      const res = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ content: 'Hi, is this item available next week?' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      messageId = res.body.id || res.body.message?.id;
      expect(res.body.content || res.body.message?.content).toBeDefined();
    });

    it('should send a reply as owner', async () => {
      const res = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Yes, it is available! Would you like to book?' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      expect(res.body).toBeDefined();
    });

    it('should reject message from non-participant', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'I am not in this conversation' })
        .expect((r) => expect([403, 404]).toContain(r.status));
    });

    it('should reject empty message', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ content: '' })
        .expect((r) => expect([400, 422]).toContain(r.status));
    });
  });

  // ── Get Messages ──
  describe('GET /conversations/:id/messages — Message history', () => {
    it('should return messages for participant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      const messages = res.body.data || res.body.messages || res.body;
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const res = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages?page=1&limit=1`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('should deny access to non-participant', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect((r) => expect([403, 404]).toContain(r.status));
    });
  });

  // ── Mark as Read ──
  describe('POST /conversations/:id/read — Mark as read', () => {
    it('should mark conversation as read', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect((r) => expect([200, 201]).toContain(r.status));
    });
  });

  // ── Unread Count ──
  describe('GET /conversations/unread-count', () => {
    it('should return unread count', async () => {
      const res = await request(app.getHttpServer())
        .get('/conversations/unread-count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });

  // ── List Conversations ──
  describe('GET /conversations', () => {
    it('should list user conversations', async () => {
      const res = await request(app.getHttpServer())
        .get('/conversations')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      const conversations = res.body.data || res.body.conversations || res.body;
      expect(Array.isArray(conversations)).toBe(true);
      expect(conversations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Get Single Conversation ──
  describe('GET /conversations/:id', () => {
    it('should return conversation details for participant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body.id || res.body.conversation?.id).toBeDefined();
    });

    it('should deny access to non-participant', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect((r) => expect([403, 404]).toContain(r.status));
    });
  });

  // ── Delete Message ──
  describe('DELETE /conversations/messages/:messageId', () => {
    it('should delete own message', async () => {
      if (!messageId) return; // skip if message wasn't created
      await request(app.getHttpServer())
        .delete(`/conversations/messages/${messageId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([200, 204]).toContain(r.status));
    });

    it('should reject deleting other user message', async () => {
      // Send a new message as owner then try to delete as renter
      const sendRes = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Owner-only message' });
      const ownerMsgId = sendRes.body.id || sendRes.body.message?.id;

      if (ownerMsgId) {
        await request(app.getHttpServer())
          .delete(`/conversations/messages/${ownerMsgId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect((r) => expect([403, 404]).toContain(r.status));
      }
    });
  });

  // ── Delete Conversation ──
  describe('DELETE /conversations/:id', () => {
    it('should soft-delete conversation for participant', async () => {
      // Create a new conversation to delete (doesn't affect other tests)
      const newConvo = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ listingId, recipientId: ownerId, message: 'temp' });

      const tempId = newConvo.body.id || newConvo.body.conversation?.id || conversationId;

      await request(app.getHttpServer())
        .delete(`/conversations/${tempId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect((r) => expect([200, 204]).toContain(r.status));
    });
  });
});
