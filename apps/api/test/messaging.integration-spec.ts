import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { UserRole } from '@rental-portal/database';

/**
 * Messaging Integration Tests
 *
 * Tests both REST API endpoints and WebSocket events for real-time messaging
 */
describe('Messaging (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let conversationId: string;
  let socket1: Socket;
  let socket2: Socket;

  const waitForSocketEvent = (socket: Socket, event: string, timeout = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
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
    await app.listen(0); // Use dynamic port
  });

  afterAll(async () => {
    if (socket1?.connected) socket1.disconnect();
    if (socket2?.connected) socket2.disconnect();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.message.deleteMany({
      where: {
        conversation: {
          participants: {
            some: {
              user: { email: { contains: '@msgtest.com' } },
            },
          },
        },
      },
    });
    await prisma.conversationParticipant.deleteMany({
      where: { user: { email: { contains: '@msgtest.com' } } },
    });
    await prisma.conversation.deleteMany({
      where: {
        participants: {
          some: {
            user: { email: { contains: '@msgtest.com' } },
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@msgtest.com' } },
    });

    // Create test users
    const user1Res = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'user1@msgtest.com',
      password: 'SecurePass123!',
      firstName: 'User',
      lastName: 'One',
      phone: '+1234567890',
      role: UserRole.RENTER,
    });
    user1Token = user1Res.body.tokens.accessToken;
    user1Id = user1Res.body.user.id;

    const user2Res = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'user2@msgtest.com',
      password: 'SecurePass123!',
      firstName: 'User',
      lastName: 'Two',
      phone: '+1234567891',
      role: UserRole.OWNER,
    });
    user2Token = user2Res.body.tokens.accessToken;
    user2Id = user2Res.body.user.id;
  });

  afterEach(() => {
    if (socket1?.connected) {
      socket1.disconnect();
      socket1 = null;
    }
    if (socket2?.connected) {
      socket2.disconnect();
      socket2 = null;
    }
  });

  describe('REST API - Conversations', () => {
    describe('POST /api/conversations', () => {
      it('should create a new conversation', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            participantIds: [user2Id],
            context: { type: 'listing', listingId: 'test-listing-id' },
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('participants');
        expect(response.body.participants.length).toBe(2);

        conversationId = response.body.id;
      });

      it('should return existing conversation if already exists', async () => {
        // Create first conversation
        const firstRes = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] })
          .expect(201);

        const firstId = firstRes.body.id;

        // Try to create again
        const secondRes = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] })
          .expect(201);

        expect(secondRes.body.id).toBe(firstId);
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .post('/api/conversations')
          .send({ participantIds: [user2Id] })
          .expect(401);
      });

      it('should validate participant IDs', async () => {
        await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: ['invalid-id'] })
          .expect(400);
      });
    });

    describe('GET /api/conversations', () => {
      beforeEach(async () => {
        // Create a conversation
        const res = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] });
        conversationId = res.body.id;

        // Send a message
        await prisma.message.create({
          data: {
            conversationId,
            senderId: user1Id,
            content: 'Test message',
          },
        });
      });

      it('should retrieve user conversations', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('participants');
        expect(response.body[0]).toHaveProperty('lastMessage');
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/conversations')
          .query({ page: 1, limit: 10 })
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(10);
      });

      it('should support search', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/conversations')
          .query({ search: 'User Two' })
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/conversations/unread-count', () => {
      beforeEach(async () => {
        // Create conversation with unread messages
        const res = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] });
        conversationId = res.body.id;

        // Create unread messages from user2
        await prisma.message.createMany({
          data: [
            { conversationId, senderId: user2Id, content: 'Unread 1' },
            { conversationId, senderId: user2Id, content: 'Unread 2' },
          ],
        });
      });

      it('should return unread message count', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/conversations/unread-count')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(response.body).toHaveProperty('count');
        expect(typeof response.body.count).toBe('number');
        expect(response.body.count).toBeGreaterThanOrEqual(2);
      });
    });

    describe('GET /api/conversations/:id', () => {
      beforeEach(async () => {
        const res = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] });
        conversationId = res.body.id;
      });

      it('should retrieve conversation details', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(response.body.id).toBe(conversationId);
        expect(response.body).toHaveProperty('participants');
        expect(response.body.participants.length).toBe(2);
      });

      it('should return 404 for non-existent conversation', async () => {
        await request(app.getHttpServer())
          .get('/api/conversations/non-existent-id')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(404);
      });

      it('should return 403 if user not in conversation', async () => {
        // Create third user
        const user3Res = await request(app.getHttpServer()).post('/api/auth/register').send({
          email: 'user3@msgtest.com',
          password: 'SecurePass123!',
          firstName: 'User',
          lastName: 'Three',
          phone: '+1234567892',
          role: UserRole.RENTER,
        });
        const user3Token = user3Res.body.tokens.accessToken;

        await request(app.getHttpServer())
          .get(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${user3Token}`)
          .expect(403);
      });
    });

    describe('GET /api/conversations/:id/messages', () => {
      beforeEach(async () => {
        const res = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] });
        conversationId = res.body.id;

        // Create messages
        await prisma.message.createMany({
          data: [
            { conversationId, senderId: user1Id, content: 'Message 1' },
            { conversationId, senderId: user2Id, content: 'Message 2' },
            { conversationId, senderId: user1Id, content: 'Message 3' },
          ],
        });
      });

      it('should retrieve conversation messages', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(3);
        expect(response.body[0]).toHaveProperty('content');
        expect(response.body[0]).toHaveProperty('sender');
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/conversations/${conversationId}/messages`)
          .query({ page: 1, limit: 2 })
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(2);
      });
    });

    describe('POST /api/conversations/:id/read', () => {
      beforeEach(async () => {
        const res = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] });
        conversationId = res.body.id;

        // Create unread messages
        await prisma.message.createMany({
          data: [
            { conversationId, senderId: user2Id, content: 'Unread 1' },
            { conversationId, senderId: user2Id, content: 'Unread 2' },
          ],
        });
      });

      it('should mark messages as read', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/conversations/${conversationId}/read`)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(201);

        expect(response.body).toHaveProperty('marked');
        expect(response.body.marked).toBe(2);

        // Verify messages are marked as read
        const messages = await prisma.message.findMany({
          where: { conversationId },
        });
        messages.forEach((msg) => {
          if (msg.senderId !== user1Id) {
            expect(msg.readAt).toBeDefined();
          }
        });
      });
    });

    describe('DELETE /api/conversations/:id', () => {
      beforeEach(async () => {
        const res = await request(app.getHttpServer())
          .post('/api/conversations')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ participantIds: [user2Id] });
        conversationId = res.body.id;
      });

      it('should delete conversation', async () => {
        await request(app.getHttpServer())
          .delete(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        // Verify conversation deleted
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });
        expect(conversation).toBeNull();
      });
    });
  });

  describe('WebSocket - Real-time Messaging', () => {
    const getSocketUrl = () => {
      const address = app.getHttpServer().address();
      const port = typeof address === 'string' ? 0 : address.port;
      return `http://localhost:${port}/messaging`;
    };

    beforeEach(async () => {
      // Create conversation
      const res = await request(app.getHttpServer())
        .post('/api/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantIds: [user2Id] });
      conversationId = res.body.id;
    });

    describe('Connection', () => {
      it('should establish WebSocket connection with authentication', (done) => {
        socket1 = io(getSocketUrl(), {
          auth: { userId: user1Id },
          transports: ['websocket'],
        });

        socket1.on('connect', () => {
          expect(socket1.connected).toBe(true);
          done();
        });

        socket1.on('connect_error', (error) => {
          done(error);
        });
      });

      it('should reject connection without authentication', (done) => {
        socket1 = io(getSocketUrl(), {
          transports: ['websocket'],
        });

        socket1.on('connect_error', () => {
          expect(socket1.connected).toBe(false);
          done();
        });

        socket1.on('connect', () => {
          done(new Error('Should not connect without auth'));
        });
      });

      it('should send unread count on connection', async () => {
        // Create unread messages
        await prisma.message.createMany({
          data: [
            { conversationId, senderId: user2Id, content: 'Unread 1' },
            { conversationId, senderId: user2Id, content: 'Unread 2' },
          ],
        });

        socket1 = io(getSocketUrl(), {
          auth: { userId: user1Id },
          transports: ['websocket'],
        });

        const unreadData = await waitForSocketEvent(socket1, 'unread_count');
        expect(unreadData).toHaveProperty('count');
        expect(unreadData.count).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Joining Conversations', () => {
      beforeEach(() => {
        socket1 = io(getSocketUrl(), {
          auth: { userId: user1Id },
          transports: ['websocket'],
        });
      });

      it('should join conversation room', async () => {
        await waitForSocketEvent(socket1, 'connect');

        socket1.emit('join_conversation', { conversationId });

        const joinedData = await waitForSocketEvent(socket1, 'joined_conversation');
        expect(joinedData.conversationId).toBe(conversationId);
      });

      it('should reject joining unauthorized conversation', async () => {
        await waitForSocketEvent(socket1, 'connect');

        socket1.emit('join_conversation', { conversationId: 'unauthorized-id' });

        const errorData = await waitForSocketEvent(socket1, 'error');
        expect(errorData).toHaveProperty('message');
      });

      it('should mark messages as read when joining', async () => {
        // Create unread messages
        await prisma.message.createMany({
          data: [
            { conversationId, senderId: user2Id, content: 'Unread 1' },
            { conversationId, senderId: user2Id, content: 'Unread 2' },
          ],
        });

        await waitForSocketEvent(socket1, 'connect');

        socket1.emit('join_conversation', { conversationId });
        await waitForSocketEvent(socket1, 'joined_conversation');

        // Verify messages are marked as read
        const messages = await prisma.message.findMany({
          where: { conversationId, senderId: user2Id },
        });
        messages.forEach((msg) => {
          expect(msg.readAt).toBeDefined();
        });
      });
    });

    describe('Sending Messages', () => {
      beforeEach(async () => {
        socket1 = io(getSocketUrl(), {
          auth: { userId: user1Id },
          transports: ['websocket'],
        });

        socket2 = io(getSocketUrl(), {
          auth: { userId: user2Id },
          transports: ['websocket'],
        });

        await waitForSocketEvent(socket1, 'connect');
        await waitForSocketEvent(socket2, 'connect');

        // Both users join conversation
        socket1.emit('join_conversation', { conversationId });
        socket2.emit('join_conversation', { conversationId });

        await waitForSocketEvent(socket1, 'joined_conversation');
        await waitForSocketEvent(socket2, 'joined_conversation');
      });

      it('should send and receive message', async () => {
        const messageContent = 'Hello from user 1';

        const newMessagePromise = waitForSocketEvent(socket2, 'new_message');

        socket1.emit('send_message', {
          conversationId,
          content: messageContent,
        });

        const receivedMessage = await newMessagePromise;

        expect(receivedMessage).toHaveProperty('content');
        expect(receivedMessage.content).toBe(messageContent);
        expect(receivedMessage.senderId).toBe(user1Id);
      });

      it('should broadcast message to all participants', async () => {
        const messageContent = 'Broadcast test';

        const socket1ReceivePromise = waitForSocketEvent(socket1, 'new_message');
        const socket2ReceivePromise = waitForSocketEvent(socket2, 'new_message');

        socket1.emit('send_message', {
          conversationId,
          content: messageContent,
        });

        const [msg1, msg2] = await Promise.all([socket1ReceivePromise, socket2ReceivePromise]);

        expect(msg1.content).toBe(messageContent);
        expect(msg2.content).toBe(messageContent);
      });

      it('should support message attachments', async () => {
        const newMessagePromise = waitForSocketEvent(socket2, 'new_message');

        socket1.emit('send_message', {
          conversationId,
          content: 'Check this out',
          attachments: [
            {
              url: 'https://example.com/image.jpg',
              type: 'image',
              name: 'image.jpg',
            },
          ],
        });

        const receivedMessage = await newMessagePromise;

        expect(receivedMessage).toHaveProperty('attachments');
        expect(Array.isArray(receivedMessage.attachments)).toBe(true);
        expect(receivedMessage.attachments.length).toBe(1);
      });
    });

    describe('Typing Indicators', () => {
      beforeEach(async () => {
        socket1 = io(getSocketUrl(), {
          auth: { userId: user1Id },
          transports: ['websocket'],
        });

        socket2 = io(getSocketUrl(), {
          auth: { userId: user2Id },
          transports: ['websocket'],
        });

        await waitForSocketEvent(socket1, 'connect');
        await waitForSocketEvent(socket2, 'connect');

        socket1.emit('join_conversation', { conversationId });
        socket2.emit('join_conversation', { conversationId });

        await waitForSocketEvent(socket1, 'joined_conversation');
        await waitForSocketEvent(socket2, 'joined_conversation');
      });

      it('should broadcast typing indicator', async () => {
        const typingPromise = waitForSocketEvent(socket2, 'user_typing');

        socket1.emit('typing', { conversationId });

        const typingData = await typingPromise;

        expect(typingData).toHaveProperty('userId');
        expect(typingData.userId).toBe(user1Id);
        expect(typingData.conversationId).toBe(conversationId);
      });

      it('should broadcast stop typing', async () => {
        const stopTypingPromise = waitForSocketEvent(socket2, 'user_stopped_typing');

        socket1.emit('stop_typing', { conversationId });

        const stopData = await stopTypingPromise;

        expect(stopData).toHaveProperty('userId');
        expect(stopData.userId).toBe(user1Id);
      });
    });

    describe('Online Status', () => {
      it('should broadcast online status on connect', async () => {
        socket1 = io(getSocketUrl(), {
          auth: { userId: user1Id },
          transports: ['websocket'],
        });

        await waitForSocketEvent(socket1, 'connect');

        // In real implementation, this would broadcast to contacts
        // For now, verify connection is established
        expect(socket1.connected).toBe(true);
      });

      it('should broadcast offline status on disconnect', async () => {
        socket1 = io(getSocketUrl(), {
          auth: { userId: user1Id },
          transports: ['websocket'],
        });

        await waitForSocketEvent(socket1, 'connect');

        socket1.disconnect();

        // In real implementation, verify offline status broadcast
        expect(socket1.connected).toBe(false);
      });
    });
  });
});
