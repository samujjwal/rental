/**
 * WebSocket Messaging E2E Test
 *
 * Tests real-time messaging over WebSocket:
 * 1. Establish WebSocket connections for multiple users
 * 2. Create conversation via REST API
 * 3. Join conversation room via WebSocket
 * 4. Send messages and verify real-time delivery
 * 5. Test typing indicators
 * 6. Test read receipts
 * 7. Test connection/disconnection
 *
 * This covers the gap identified in the Deep Flow Verification Report (Section 10.1):
 * "WebSocket real-time messaging E2E with actual WebSocket connections"
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { WebhookService } from '../src/modules/payments/webhook.service';
import { UserRole } from '@rental-portal/database';
import {
  buildTestEmail,
  cleanupCoreRelationalData,
  createUserWithRole,
  loginUser,
} from './e2e-helpers';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';

// ── Mocks ─────────────────────────────────────────────
const mockStripeService = {
  providerId: 'stripe',
  providerConfig: {
    providerId: 'stripe',
    name: 'Stripe',
    supportedCountries: ['US', 'NP'],
    supportedCurrencies: ['USD', 'NPR'],
  },
  get config() {
    return this.providerConfig;
  },
  createPaymentIntent: jest.fn().mockResolvedValue({
    clientSecret: 'pi_test_secret_mock',
    paymentIntentId: 'pi_mock_ws',
    providerId: 'stripe',
  }),
  capturePaymentIntent: jest.fn().mockResolvedValue(undefined),
  holdDeposit: jest.fn().mockResolvedValue('pi_deposit_mock'),
  releaseDeposit: jest.fn().mockResolvedValue(undefined),
  refundPayment: jest.fn().mockResolvedValue({ refundId: 'rf_mock' }),
  createConnectAccount: jest.fn().mockResolvedValue('acct_mock'),
  createAccountLink: jest
    .fn()
    .mockResolvedValue('https://mock-onboard.example.com'),
  getAccountStatus: jest.fn().mockResolvedValue({
    detailsSubmitted: true,
    chargesEnabled: true,
    payoutsEnabled: true,
  }),
  createPayout: jest.fn().mockResolvedValue('tr_ws_mock'),
  createRefund: jest
    .fn()
    .mockResolvedValue({ id: 're_mock', status: 'succeeded' }),
};

const mockWebhookService = {
  handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

// ── Helper to wait for event ─────────────────────────────────────────
function waitForEvent<T = any>(
  socket: Socket,
  eventName: string,
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    socket.once(eventName, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('WebSocket Messaging (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user1Id: string;
  let user2Id: string;
  let user1AccessToken: string;
  let user2AccessToken: string;
  let user1Socket: Socket;
  let user2Socket: Socket;
  let serverUrl: string;
  const user1Email = buildTestEmail('ws-user1');
  const user2Email = buildTestEmail('ws-user2');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeService)
      .useValue(mockStripeService)
      .overrideProvider(WebhookService)
      .useValue(mockWebhookService)
      .compile();

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
    await app.listen(0); // Random port

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? 3000 : address?.port || 3000;
    serverUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.message.deleteMany({
      where: { conversation: { participants: { some: { user: { email: { in: [user1Email, user2Email] } } } } } },
    });
    await prisma.conversationParticipant.deleteMany({
      where: { user: { email: { in: [user1Email, user2Email] } } },
    });
    await prisma.conversation.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { in: [user1Email, user2Email] } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Cleanup
    await cleanupCoreRelationalData(prisma);
    await prisma.message.deleteMany({
      where: { conversation: { participants: { some: { user: { email: { in: [user1Email, user2Email] } } } } } },
    });
    await prisma.conversationParticipant.deleteMany({
      where: { user: { email: { in: [user1Email, user2Email] } } },
    });
    await prisma.conversation.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { in: [user1Email, user2Email] } },
    });

    // Create users
    const user1 = await createUserWithRole({
      app,
      prisma,
      email: user1Email,
      firstName: 'WebSocket',
      lastName: 'User1',
      role: UserRole.USER,
    });
    user1Id = user1.userId;
    await prisma.user.update({
      where: { id: user1Id },
      data: { emailVerified: true },
    });

    const user2 = await createUserWithRole({
      app,
      prisma,
      email: user2Email,
      firstName: 'WebSocket',
      lastName: 'User2',
      role: UserRole.USER,
    });
    user2Id = user2.userId;
    await prisma.user.update({
      where: { id: user2Id },
      data: { emailVerified: true },
    });

    // Login users
    const login1 = await loginUser(app, user1Email, 'Password123!');
    user1AccessToken = login1.accessToken;

    const login2 = await loginUser(app, user2Email, 'Password123!');
    user2AccessToken = login2.accessToken;
  });

  afterEach(async () => {
    // Disconnect sockets
    if (user1Socket?.connected) {
      user1Socket.disconnect();
    }
    if (user2Socket?.connected) {
      user2Socket.disconnect();
    }
  });

  describe('Connection & Authentication', () => {
    it('should establish WebSocket connection with valid JWT', async () => {
      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user1AccessToken },
        transports: ['websocket'],
      });

      await waitForEvent(user1Socket, 'connect', 3000);
      expect(user1Socket.connected).toBe(true);
    });

    it('should reject connection with invalid JWT', async () => {
      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: 'invalid_token' },
        transports: ['websocket'],
      });

      await expect(
        waitForEvent(user1Socket, 'connect', 2000),
      ).rejects.toThrow(/Timeout/);

      expect(user1Socket.connected).toBe(false);
    });

    it('should send unread count on connection', async () => {
      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user1AccessToken },
        transports: ['websocket'],
      });

      const unreadData = await waitForEvent(user1Socket, 'unread_count');
      expect(unreadData).toMatchObject({
        count: expect.any(Number),
      });
    });
  });

  describe('Real-time Messaging', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Create conversation via REST API
      const response = await request(app.getHttpServer())
        .post('/api/messaging/conversations')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({
          participantIds: [user2Id],
          type: 'DIRECT',
        })
        .expect(201);

      conversationId = response.body.id;

      // Establish WebSocket connections
      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user1AccessToken },
        transports: ['websocket'],
      });

      user2Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user2AccessToken },
        transports: ['websocket'],
      });

      await Promise.all([
        waitForEvent(user1Socket, 'connect'),
        waitForEvent(user2Socket, 'connect'),
      ]);
    });

    it('should deliver message in real-time to recipient', async () => {
      // Both users join conversation
      user1Socket.emit('join_conversation', { conversationId });
      user2Socket.emit('join_conversation', { conversationId });

      await Promise.all([
        waitForEvent(user1Socket, 'joined_conversation'),
        waitForEvent(user2Socket, 'joined_conversation'),
      ]);

      // User1 sends message
      const messagePromise = waitForEvent(user2Socket, 'new_message');
      user1Socket.emit('send_message', {
        conversationId,
        content: 'Hello from user1!',
      });

      // User2 should receive message
      const receivedMessage = await messagePromise;
      expect(receivedMessage).toMatchObject({
        content: 'Hello from user1!',
        conversationId,
        senderId: user1Id,
      });
    });

    it('should support bi-directional messaging', async () => {
      user1Socket.emit('join_conversation', { conversationId });
      user2Socket.emit('join_conversation', { conversationId });

      await Promise.all([
        waitForEvent(user1Socket, 'joined_conversation'),
        waitForEvent(user2Socket, 'joined_conversation'),
      ]);

      // User1 → User2
      const msg1Promise = waitForEvent(user2Socket, 'new_message');
      user1Socket.emit('send_message', {
        conversationId,
        content: 'Hi from user1',
      });
      const msg1 = await msg1Promise;
      expect(msg1.senderId).toBe(user1Id);

      // User2 → User1
      const msg2Promise = waitForEvent(user1Socket, 'new_message');
      user2Socket.emit('send_message', {
        conversationId,
        content: 'Hi back from user2',
      });
      const msg2 = await msg2Promise;
      expect(msg2.senderId).toBe(user2Id);
    });

    it('should broadcast messages to all participants in room', async () => {
      user1Socket.emit('join_conversation', { conversationId });
      user2Socket.emit('join_conversation', { conversationId });

      await Promise.all([
        waitForEvent(user1Socket, 'joined_conversation'),
        waitForEvent(user2Socket, 'joined_conversation'),
      ]);

      // User1 sends message — both should receive (including sender)
      const user1Receive = waitForEvent(user1Socket, 'new_message');
      const user2Receive = waitForEvent(user2Socket, 'new_message');

      user1Socket.emit('send_message', {
        conversationId,
        content: 'Broadcast test',
      });

      const [msg1, msg2] = await Promise.all([user1Receive, user2Receive]);
      expect(msg1.content).toBe('Broadcast test');
      expect(msg2.content).toBe('Broadcast test');
    });

    it('should not deliver message to user who left conversation room', async () => {
      user1Socket.emit('join_conversation', { conversationId });
      user2Socket.emit('join_conversation', { conversationId });

      await Promise.all([
        waitForEvent(user1Socket, 'joined_conversation'),
        waitForEvent(user2Socket, 'joined_conversation'),
      ]);

      // User2 leaves
      user2Socket.emit('leave_conversation', { conversationId });
      await waitForEvent(user2Socket, 'left_conversation');

      // User1 sends message
      user1Socket.emit('send_message', {
        conversationId,
        content: 'After leave',
      });

      // User2 should NOT receive message (timeout expected)
      await expect(
        waitForEvent(user2Socket, 'new_message', 1500),
      ).rejects.toThrow(/Timeout/);
    });
  });

  describe('Typing Indicators', () => {
    let conversationId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/messaging/conversations')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({
          participantIds: [user2Id],
          type: 'DIRECT',
        })
        .expect(201);

      conversationId = response.body.id;

      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user1AccessToken },
        transports: ['websocket'],
      });

      user2Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user2AccessToken },
        transports: ['websocket'],
      });

      await Promise.all([
        waitForEvent(user1Socket, 'connect'),
        waitForEvent(user2Socket, 'connect'),
      ]);

      user1Socket.emit('join_conversation', { conversationId });
      user2Socket.emit('join_conversation', { conversationId });

      await Promise.all([
        waitForEvent(user1Socket, 'joined_conversation'),
        waitForEvent(user2Socket, 'joined_conversation'),
      ]);
    });

    it('should broadcast typing indicator to other participants', async () => {
      const typingPromise = waitForEvent(user2Socket, 'user_typing');

      user1Socket.emit('typing', {
        conversationId,
        isTyping: true,
      });

      const typingData = await typingPromise;
      expect(typingData).toMatchObject({
        conversationId,
        userId: user1Id,
        isTyping: true,
      });
    });
  });

  describe('Read Receipts', () => {
    let conversationId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/messaging/conversations')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({
          participantIds: [user2Id],
          type: 'DIRECT',
        })
        .expect(201);

      conversationId = response.body.id;

      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user1AccessToken },
        transports: ['websocket'],
      });

      user2Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user2AccessToken },
        transports: ['websocket'],
      });

      await Promise.all([
        waitForEvent(user1Socket, 'connect'),
        waitForEvent(user2Socket, 'connect'),
      ]);
    });

    it('should emit read receipt when user joins conversation', async () => {
      // User1 sends message while user2 is offline
      user1Socket.emit('join_conversation', { conversationId });
      await waitForEvent(user1Socket, 'joined_conversation');

      user1Socket.emit('send_message', {
        conversationId,
        content: 'Read receipt test',
      });
      await waitForEvent(user1Socket, 'new_message');

      // User2 joins later — should trigger read receipt
      const readReceiptPromise = waitForEvent(user1Socket, 'messages_read');

      user2Socket.emit('join_conversation', { conversationId });
      await waitForEvent(user2Socket, 'joined_conversation');

      const readReceipt = await readReceiptPromise;
      expect(readReceipt).toMatchObject({
        conversationId,
        userId: user2Id,
      });
    });
  });

  describe('Connection Management', () => {
    it('should handle disconnect and reconnect', async () => {
      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user1AccessToken },
        transports: ['websocket'],
      });

      await waitForEvent(user1Socket, 'connect');
      expect(user1Socket.connected).toBe(true);

      // Disconnect
      user1Socket.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(user1Socket.connected).toBe(false);

      // Reconnect
      user1Socket.connect();
      await waitForEvent(user1Socket, 'connect');
      expect(user1Socket.connected).toBe(true);
    });
  });

  describe('Error Handling', () => {
    let conversationId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/messaging/conversations')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({
          participantIds: [user2Id],
          type: 'DIRECT',
        })
        .expect(201);

      conversationId = response.body.id;

      user1Socket = io(`${serverUrl}/messaging`, {
        auth: { token: user1AccessToken },
        transports: ['websocket'],
      });

      await waitForEvent(user1Socket, 'connect');
    });

    it('should reject unauthorized conversation join attempt', async () => {
      // User1 tries to join conversation they're not part of
      const fakeConversationId = 'fake_conversation_id';
      const errorPromise = waitForEvent(user1Socket, 'error');

      user1Socket.emit('join_conversation', {
        conversationId: fakeConversationId,
      });

      const error = await errorPromise;
      expect(error.message).toMatch(/Not authorized/i);
    });
  });
});
