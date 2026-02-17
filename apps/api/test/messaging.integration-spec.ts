import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole, uniqueSuffix } from './e2e-helpers';

type Socket = any;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const io = require('socket.io-client').io;

describe('Messaging (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renterToken: string;
  let ownerToken: string;
  let outsiderToken: string;
  let renterId: string;
  let ownerId: string;
  let outsiderId: string;
  let listingId: string;
  let conversationId: string;
  let categoryId: string;

  const testDomain = 'msgtest.com';
  const listingPayload = () => ({
    categoryId,
    title: `Messaging Listing ${uniqueSuffix()}`,
    description: 'Listing for messaging integration tests',
    addressLine1: '100 Messaging Street',
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'US',
    latitude: 40.7128,
    longitude: -74.006,
    pricingMode: 'DAILY',
    basePrice: 120,
    bookingMode: 'REQUEST',
    categorySpecificData: {},
    amenities: ['WiFi'],
    features: ['Desk'],
    rules: ['No smoking'],
  });

  const createConversation = async () => {
    const response = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${renterToken}`)
      .send({
        listingId,
        participantId: ownerId,
      })
      .expect(201);

    conversationId = response.body.id;
    return response;
  };

  const waitForSocketEvent = (socket: Socket, event: string, timeout = 5000): Promise<any> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for socket event: ${event}`)), timeout);
      socket.once(event, (data: any) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

  const connectSocket = async (userId: string, token: string): Promise<Socket> => {
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? 0 : address.port;
    const socket = io(`http://localhost:${port}/messaging`, {
      auth: { token, userId },
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    await waitForSocketEvent(socket, 'connect');
    return socket;
  };

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
    await app.listen(0);
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma).catch(() => {});
    await prisma.listing.deleteMany({
      where: {
        owner: {
          email: { contains: `@${testDomain}` },
        },
      },
    });
    await prisma.user.deleteMany({ where: { email: { contains: `@${testDomain}` } } });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: {
        owner: {
          email: { contains: `@${testDomain}` },
        },
      },
    });
    await prisma.user.deleteMany({ where: { email: { contains: `@${testDomain}` } } });

    const category = await prisma.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (category?.id) {
      categoryId = category.id;
    } else {
      const created = await prisma.category.create({
        data: {
          name: `Messaging Category ${uniqueSuffix()}`,
          slug: `messaging-category-${uniqueSuffix()}`,
          description: 'Category for messaging integration',
          searchableFields: [],
          requiredFields: [],
          templateSchema: '{}',
          isActive: true,
          active: true,
        },
      });
      categoryId = created.id;
    }

    const owner = await createUserWithRole({
      app,
      prisma,
      email: buildTestEmail('owner-msg', testDomain),
      firstName: 'Owner',
      lastName: 'Messaging',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;
    ownerId = owner.userId;

    const renter = await createUserWithRole({
      app,
      prisma,
      email: buildTestEmail('renter-msg', testDomain),
      firstName: 'Renter',
      lastName: 'Messaging',
      role: UserRole.USER,
    });
    renterToken = renter.accessToken;
    renterId = renter.userId;

    const outsider = await createUserWithRole({
      app,
      prisma,
      email: buildTestEmail('outsider-msg', testDomain),
      firstName: 'Outsider',
      lastName: 'Messaging',
      role: UserRole.USER,
    });
    outsiderToken = outsider.accessToken;
    outsiderId = outsider.userId;

    const listingRes = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(listingPayload())
      .expect(201);
    listingId = listingRes.body.id;
    conversationId = '';
  });

  describe('REST API - Conversations', () => {
    describe('POST /conversations', () => {
      it('should create a new conversation', async () => {
        const response = await createConversation();
        expect(response.body).toHaveProperty('id');
        expect(Array.isArray(response.body.participants)).toBe(true);
        expect(response.body.participants.some((p: { userId: string }) => p.userId === renterId)).toBe(true);
        expect(response.body.participants.some((p: { userId: string }) => p.userId === ownerId)).toBe(true);
      });

      it('should return existing conversation for same listing and participants', async () => {
        const first = await createConversation();
        const second = await createConversation();
        expect(second.body.id).toBe(first.body.id);
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .post('/conversations')
          .send({ listingId, participantId: ownerId })
          .expect(401);
      });

      it('should return 404 when listing does not exist', async () => {
        await request(app.getHttpServer())
          .post('/conversations')
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            listingId: `missing-listing-${uniqueSuffix()}`,
            participantId: ownerId,
          })
          .expect(404);
      });
    });

    describe('GET /conversations', () => {
      beforeEach(async () => {
        await createConversation();
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ content: 'Initial message' })
          .expect(201);
      });

      it('should return paginated conversations payload', async () => {
        const response = await request(app.getHttpServer())
          .get('/conversations')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('conversations');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.conversations)).toBe(true);
        expect(response.body.total).toBeGreaterThan(0);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/conversations?page=1&limit=1')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body.conversations)).toBe(true);
        expect(response.body.conversations.length).toBeLessThanOrEqual(1);
      });
    });

    describe('GET /conversations/unread-count', () => {
      it('should return unread message count', async () => {
        await createConversation();
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content: 'Unread message 1' })
          .expect(201);
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content: 'Unread message 2' })
          .expect(201);

        const response = await request(app.getHttpServer())
          .get('/conversations/unread-count')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(typeof response.body.count).toBe('number');
        expect(response.body.count).toBeGreaterThanOrEqual(2);
      });
    });

    describe('GET /conversations/:id', () => {
      beforeEach(async () => {
        await createConversation();
      });

      it('should get conversation details for participant', async () => {
        const response = await request(app.getHttpServer())
          .get(`/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body.id).toBe(conversationId);
        expect(Array.isArray(response.body.participants)).toBe(true);
      });

      it('should return 403 for non-participant', async () => {
        await request(app.getHttpServer())
          .get(`/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .expect(403);
      });
    });

    describe('GET /conversations/:id/messages', () => {
      beforeEach(async () => {
        await createConversation();
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${renterToken}`)
          .send({ content: 'Message 1' })
          .expect(201);
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content: 'Message 2' })
          .expect(201);
      });

      it('should return messages payload with paging metadata', async () => {
        const response = await request(app.getHttpServer())
          .get(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('messages');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('hasMore');
        expect(Array.isArray(response.body.messages)).toBe(true);
        expect(response.body.messages.length).toBeGreaterThan(0);
      });
    });

    describe('POST /conversations/:id/read', () => {
      it('should mark conversation messages as read', async () => {
        await createConversation();
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content: 'Unread by renter' })
          .expect(201);

        const response = await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/read`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(201);

        expect(response.body).toHaveProperty('marked');
        expect(response.body.marked).toBeGreaterThanOrEqual(1);
      });
    });

    describe('DELETE /conversations/:id', () => {
      it('should delete a conversation for a participant', async () => {
        await createConversation();

        await request(app.getHttpServer())
          .delete(`/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        await request(app.getHttpServer())
          .get(`/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(404);
      });
    });
  });

  describe('WebSocket - Real-time Messaging', () => {
    let socketRenter: Socket | null = null;
    let socketOwner: Socket | null = null;

    const closeSocket = async (socket: Socket | null) => {
      if (!socket) {
        return;
      }

      if (socket.connected) {
        socket.disconnect();
      }
    };

    beforeEach(async () => {
      await createConversation();
    });

    afterEach(async () => {
      await closeSocket(socketRenter);
      await closeSocket(socketOwner);
      socketRenter = null;
      socketOwner = null;
    });

    it('should connect and receive unread count event', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Unread before socket connect' })
        .expect(201);

      const address = app.getHttpServer().address();
      const port = typeof address === 'string' ? 0 : address.port;
      socketRenter = io(`http://localhost:${port}/messaging`, {
        auth: { token: renterToken, userId: renterId },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      const unreadPromise = waitForSocketEvent(socketRenter, 'unread_count');
      await waitForSocketEvent(socketRenter, 'connect');
      const unreadPayload = await unreadPromise;

      expect(unreadPayload).toHaveProperty('count');
      expect(unreadPayload.count).toBeGreaterThanOrEqual(1);
    });

    it('should join conversation and receive new_message broadcast', async () => {
      socketRenter = await connectSocket(renterId, renterToken);
      socketOwner = await connectSocket(ownerId, ownerToken);

      const renterJoinedPromise = waitForSocketEvent(socketRenter, 'joined_conversation');
      const ownerJoinedPromise = waitForSocketEvent(socketOwner, 'joined_conversation');
      socketRenter.emit('join_conversation', { conversationId });
      socketOwner.emit('join_conversation', { conversationId });
      await Promise.all([renterJoinedPromise, ownerJoinedPromise]);

      const newMessagePromise = waitForSocketEvent(socketOwner, 'new_message');
      socketRenter.emit('send_message', {
        conversationId,
        content: 'Hello over websocket',
      });

      const payload = await newMessagePromise;
      expect(payload).toHaveProperty('content');
      expect(payload.content).toBe('Hello over websocket');
      expect(payload.senderId).toBe(renterId);
    });

    it('should emit messages_read when unread messages are marked on join', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Mark this as read' })
        .expect(201);

      socketRenter = await connectSocket(renterId, renterToken);
      socketOwner = await connectSocket(ownerId, ownerToken);

      const ownerJoinedPromise = waitForSocketEvent(socketOwner, 'joined_conversation');
      socketOwner.emit('join_conversation', { conversationId });
      await ownerJoinedPromise;

      const readPromise = waitForSocketEvent(socketOwner, 'messages_read');
      const renterJoinedPromise = waitForSocketEvent(socketRenter, 'joined_conversation');
      socketRenter.emit('join_conversation', { conversationId });
      await renterJoinedPromise;
      const readPayload = await readPromise;

      expect(readPayload.conversationId).toBe(conversationId);
      expect(readPayload.userId).toBe(renterId);
    });

    it('should reject joining unauthorized conversation', async () => {
      socketRenter = await connectSocket(renterId, renterToken);

      const errorPromise = waitForSocketEvent(socketRenter, 'error');
      socketRenter.emit('join_conversation', { conversationId: `missing-${uniqueSuffix()}` });
      const errorPayload = await errorPromise;

      expect(errorPayload).toHaveProperty('message');
    });
  });
});
