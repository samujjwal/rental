/**
 * P1: Messaging Reliability E2E Tests
 *
 * Comprehensive reliability testing for messaging system:
 * - WebSocket connection resilience
 * - Message delivery guarantees
 * - Reconnection handling
 * - Message ordering
 * - Offline message queueing
 * - Duplicate message detection
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

describe('Messaging Reliability E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let conversationId: string;
  
  const WS_URL = process.env.WS_URL || 'ws://localhost:3400';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
    await app.listen(3400);

    // Create test users
    const user1 = await createTestUser('user1');
    user1Id = user1.id;
    user1Token = user1.token;

    const user2 = await createTestUser('user2');
    user2Id = user2.id;
    user2Token = user2.token;

    // Create conversation
    conversationId = await createTestConversation(user1Id, user2Id);
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('WebSocket Connection Reliability', () => {
    test('should establish connection with valid token', async () => {
      const socket = await createAuthenticatedSocket(user1Token);
      
      expect(socket.connected).toBe(true);
      expect(socket.id).toBeDefined();
      
      socket.disconnect();
    });

    test('should reject connection without token', (done) => {
      const socket = io(WS_URL, {
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect_error', (error) => {
        expect(error.message).toContain('authentication');
        socket.disconnect();
        done();
      });

      socket.on('connect', () => {
        socket.disconnect();
        done(new Error('Should not connect without token'));
      });
    });

    test('should handle token expiration gracefully', async () => {
      const expiredToken = jwtService.sign(
        { sub: user1Id, email: 'test@test.com' },
        { secret: process.env.JWT_SECRET, expiresIn: '0s' }
      );

      const socket = io(WS_URL, {
        transports: ['websocket'],
        auth: { token: expiredToken },
        reconnection: false,
      });

      return new Promise<void>((resolve, reject) => {
        socket.on('connect_error', (error) => {
          expect(error.message).toContain('token');
          socket.disconnect();
          resolve();
        });

        socket.on('connect', () => {
          socket.disconnect();
          reject(new Error('Should not connect with expired token'));
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      const cycles = 5;
      
      for (let i = 0; i < cycles; i++) {
        const socket = await createAuthenticatedSocket(user1Token);
        expect(socket.connected).toBe(true);
        
        socket.disconnect();
        expect(socket.connected).toBe(false);
        
        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    test('should maintain user presence state across reconnections', async () => {
      const socket = await createAuthenticatedSocket(user1Token);
      
      // Join conversation room
      socket.emit('join_conversation', { conversationId });
      await waitForEvent(socket, 'joined_conversation');
      
      // Disconnect
      socket.disconnect();
      
      // Reconnect
      const newSocket = await createAuthenticatedSocket(user1Token);
      
      // Verify user appears online after reconnection
      newSocket.emit('join_conversation', { conversationId });
      const joinData = await waitForEvent(newSocket, 'joined_conversation');
      
      expect(joinData.presence).toContain(user1Id);
      
      newSocket.disconnect();
    });
  });

  describe('Message Delivery Guarantees', () => {
    test('should deliver message to online recipient', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      const receiver = await createAuthenticatedSocket(user2Token);
      
      // Join conversation
      sender.emit('join_conversation', { conversationId });
      receiver.emit('join_conversation', { conversationId });
      await Promise.all([
        waitForEvent(sender, 'joined_conversation'),
        waitForEvent(receiver, 'joined_conversation'),
      ]);
      
      // Send message
      const messageContent = `Test message ${randomUUID()}`;
      sender.emit('send_message', {
        conversationId,
        content: messageContent,
      });
      
      // Verify receiver gets message
      const receivedMessage = await waitForEvent(receiver, 'new_message');
      expect(receivedMessage.content).toBe(messageContent);
      expect(receivedMessage.senderId).toBe(user1Id);
      
      sender.disconnect();
      receiver.disconnect();
    });

    test('should queue messages for offline recipient', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      
      // Sender joins conversation
      sender.emit('join_conversation', { conversationId });
      await waitForEvent(sender, 'joined_conversation');
      
      // Send message while receiver is offline
      const offlineMessages = [
        'Offline message 1',
        'Offline message 2',
        'Offline message 3',
      ];
      
      for (const content of offlineMessages) {
        sender.emit('send_message', { conversationId, content });
      }
      
      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now receiver connects
      const receiver = await createAuthenticatedSocket(user2Token);
      receiver.emit('join_conversation', { conversationId });
      
      // Collect received messages
      const receivedMessages: string[] = [];
      receiver.on('new_message', (msg) => {
        receivedMessages.push(msg.content);
      });
      
      // Wait for all messages to be delivered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify all offline messages were delivered
      for (const msg of offlineMessages) {
        expect(receivedMessages).toContain(msg);
      }
      
      sender.disconnect();
      receiver.disconnect();
    });

    test('should maintain message ordering', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      const receiver = await createAuthenticatedSocket(user2Token);
      
      // Join conversation
      sender.emit('join_conversation', { conversationId });
      receiver.emit('join_conversation', { conversationId });
      await Promise.all([
        waitForEvent(sender, 'joined_conversation'),
        waitForEvent(receiver, 'joined_conversation'),
      ]);
      
      // Send messages in sequence
      const messages = Array.from({ length: 10 }, (_, i) => `Message ${i + 1}`);
      
      for (const content of messages) {
        sender.emit('send_message', { conversationId, content });
      }
      
      // Collect messages in order received
      const receivedOrder: string[] = [];
      receiver.on('new_message', (msg) => {
        receivedOrder.push(msg.content);
      });
      
      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify order is maintained
      expect(receivedOrder).toEqual(messages);
      
      sender.disconnect();
      receiver.disconnect();
    });

    test('should detect and prevent duplicate messages', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      const receiver = await createAuthenticatedSocket(user2Token);
      
      sender.emit('join_conversation', { conversationId });
      receiver.emit('join_conversation', { conversationId });
      await Promise.all([
        waitForEvent(sender, 'joined_conversation'),
        waitForEvent(receiver, 'joined_conversation'),
      ]);
      
      // Send message with deduplication ID
      const dedupId = randomUUID();
      const content = 'Deduplication test message';
      
      sender.emit('send_message', {
        conversationId,
        content,
        deduplicationId: dedupId,
      });
      
      // Try to send same message again
      sender.emit('send_message', {
        conversationId,
        content,
        deduplicationId: dedupId,
      });
      
      // Count received messages
      let receivedCount = 0;
      receiver.on('new_message', (msg) => {
        if (msg.content === content) {
          receivedCount++;
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should only receive once
      expect(receivedCount).toBe(1);
      
      sender.disconnect();
      receiver.disconnect();
    });

    test('should handle message delivery acknowledgment', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      const receiver = await createAuthenticatedSocket(user2Token);
      
      sender.emit('join_conversation', { conversationId });
      receiver.emit('join_conversation', { conversationId });
      await Promise.all([
        waitForEvent(sender, 'joined_conversation'),
        waitForEvent(receiver, 'joined_conversation'),
      ]);
      
      // Send message with delivery receipt request
      const messageId = randomUUID();
      sender.emit('send_message', {
        conversationId,
        content: 'Message with delivery receipt',
        messageId,
        requireDeliveryReceipt: true,
      });
      
      // Receiver gets message and sends acknowledgment
      const receivedMsg = await waitForEvent(receiver, 'new_message');
      receiver.emit('message_delivered', {
        messageId: receivedMsg.id,
        conversationId,
      });
      
      // Sender receives delivery acknowledgment
      const deliveryReceipt = await waitForEvent(sender, 'message_delivered');
      expect(deliveryReceipt.messageId).toBe(receivedMsg.id);
      
      sender.disconnect();
      receiver.disconnect();
    });
  });

  describe('Reconnection Handling', () => {
    test('should recover missed messages after reconnection', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      let receiver = await createAuthenticatedSocket(user2Token);
      
      // Initial join
      sender.emit('join_conversation', { conversationId });
      receiver.emit('join_conversation', { conversationId });
      await Promise.all([
        waitForEvent(sender, 'joined_conversation'),
        waitForEvent(receiver, 'joined_conversation'),
      ]);
      
      // Receiver disconnects
      receiver.disconnect();
      
      // Sender sends messages while receiver offline
      const missedMessages = ['Missed 1', 'Missed 2', 'Missed 3'];
      for (const content of missedMessages) {
        sender.emit('send_message', { conversationId, content });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Receiver reconnects
      receiver = await createAuthenticatedSocket(user2Token);
      receiver.emit('join_conversation', { conversationId });
      receiver.emit('request_message_history', {
        conversationId,
        since: new Date(Date.now() - 60000).toISOString(),
      });
      
      // Get missed messages
      const history = await waitForEvent(receiver, 'message_history');
      const contents = history.messages.map((m: { content: string }) => m.content);
      
      for (const msg of missedMessages) {
        expect(contents).toContain(msg);
      }
      
      sender.disconnect();
      receiver.disconnect();
    });

    test('should handle reconnection with exponential backoff', async () => {
      const socket = io(WS_URL, {
        transports: ['websocket'],
        auth: { token: user1Token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 100,
        reconnectionDelayMax: 1000,
      });

      const connectionAttempts: number[] = [];
      let attemptCount = 0;

      socket.on('reconnect_attempt', (attempt) => {
        attemptCount++;
        connectionAttempts.push(Date.now());
      });

      // Connect initially
      await new Promise<void>((resolve) => {
        socket.on('connect', () => {
          if (attemptCount === 0) resolve();
        });
      });

      // Force disconnect
      socket.io.engine.close();

      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify multiple reconnection attempts were made
      expect(attemptCount).toBeGreaterThan(0);

      // Verify exponential backoff (delays should increase)
      if (connectionAttempts.length >= 2) {
        const delays = [];
        for (let i = 1; i < connectionAttempts.length; i++) {
          delays.push(connectionAttempts[i] - connectionAttempts[i - 1]);
        }
        
        // Delays should generally increase (with some tolerance)
        for (let i = 1; i < delays.length; i++) {
          expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1] * 0.5);
        }
      }

      socket.disconnect();
    });

    test('should preserve conversation subscriptions after reconnection', async () => {
      let socket = await createAuthenticatedSocket(user1Token);
      
      // Subscribe to multiple conversations
      const conversations = [conversationId, `conv-${randomUUID()}`];
      for (const convId of conversations) {
        socket.emit('join_conversation', { conversationId: convId });
        await waitForEvent(socket, 'joined_conversation');
      }
      
      // Disconnect
      socket.disconnect();
      
      // Reconnect
      socket = await createAuthenticatedSocket(user1Token);
      
      // Request active subscriptions
      socket.emit('get_active_conversations');
      const activeConvs = await waitForEvent(socket, 'active_conversations');
      
      // Verify subscriptions were preserved or can be restored
      expect(activeConvs.conversations).toBeDefined();
      
      socket.disconnect();
    });
  });

  describe('Network Failure Handling', () => {
    test('should handle network interruption gracefully', async () => {
      const socket = await createAuthenticatedSocket(user1Token);
      
      socket.emit('join_conversation', { conversationId });
      await waitForEvent(socket, 'joined_conversation');
      
      // Simulate network interruption by closing underlying transport
      socket.io.engine.close();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Socket should attempt reconnection
      expect(socket.io.opts.reconnection).toBe(true);
      
      // Wait for reconnection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Reconnection timeout')), 5000);
        socket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      expect(socket.connected).toBe(true);
      
      socket.disconnect();
    });

    test('should timeout pending message sends', async () => {
      const socket = await createAuthenticatedSocket(user1Token);
      
      // Close transport to simulate network failure during send
      socket.io.engine.close();
      
      // Try to send message
      const sendPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(); // Timeout is expected
        }, 3000);
        
        socket.emit('send_message', {
          conversationId,
          content: 'This may not send',
        }, (ack: any) => {
          clearTimeout(timeout);
          if (ack && ack.error) {
            resolve(); // Expected error
          } else {
            reject(new Error('Should have failed'));
          }
        });
      });
      
      await sendPromise;
      
      socket.disconnect();
    });

    test('should handle high latency scenarios', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      const receiver = await createAuthenticatedSocket(user2Token);
      
      sender.emit('join_conversation', { conversationId });
      receiver.emit('join_conversation', { conversationId });
      await Promise.all([
        waitForEvent(sender, 'joined_conversation'),
        waitForEvent(receiver, 'joined_conversation'),
      ]);
      
      // Send burst of messages
      const burstSize = 50;
      const startTime = Date.now();
      
      for (let i = 0; i < burstSize; i++) {
        sender.emit('send_message', {
          conversationId,
          content: `Burst message ${i}`,
        });
      }
      
      // Collect all messages
      const received: string[] = [];
      receiver.on('new_message', (msg) => {
        received.push(msg.content);
      });
      
      // Wait with timeout
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const duration = Date.now() - startTime;
      
      // All messages should arrive within reasonable time
      expect(received.length).toBe(burstSize);
      expect(duration).toBeLessThan(10000);
      
      sender.disconnect();
      receiver.disconnect();
    });
  });

  describe('Message Persistence', () => {
    test('should persist messages to database', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      
      sender.emit('join_conversation', { conversationId });
      await waitForEvent(sender, 'joined_conversation');
      
      const content = `Persistent message ${randomUUID()}`;
      sender.emit('send_message', { conversationId, content });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify in database
      const dbMessage = await prisma.message.findFirst({
        where: {
          conversationId,
          content,
        },
      });
      
      expect(dbMessage).not.toBeNull();
      expect(dbMessage?.senderId).toBe(user1Id);
      expect(dbMessage?.status).toBe('SENT');
      
      sender.disconnect();
    });

    test('should update message status to delivered when read', async () => {
      const sender = await createAuthenticatedSocket(user1Token);
      const receiver = await createAuthenticatedSocket(user2Token);
      
      sender.emit('join_conversation', { conversationId });
      receiver.emit('join_conversation', { conversationId });
      await Promise.all([
        waitForEvent(sender, 'joined_conversation'),
        waitForEvent(receiver, 'joined_conversation'),
      ]);
      
      // Send message
      sender.emit('send_message', {
        conversationId,
        content: 'Status test message',
      });
      
      const receivedMsg = await waitForEvent(receiver, 'new_message');
      
      // Mark as read
      receiver.emit('mark_read', {
        conversationId,
        messageId: receivedMsg.id,
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify status in database
      const dbMessage = await prisma.message.findUnique({
        where: { id: receivedMsg.id },
      });
      
      expect(dbMessage?.status).toBe('READ');
      
      sender.disconnect();
      receiver.disconnect();
    });
  });

  // Helper functions
  async function createTestUser(prefix: string) {
    const email = `test-${prefix}-${randomUUID()}@test.com`;
    
    const user = await prisma.user.create({
      data: {
        email,
        password: 'hashed-password',
        firstName: 'Test',
        lastName: prefix,
        role: 'USER',
        emailVerified: true,
      },
    });

    const token = jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { id: user.id, token };
  }

  async function createTestConversation(user1Id: string, user2Id: string) {
    const conversation = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        participants: {
          create: [
            { userId: user1Id },
            { userId: user2Id },
          ],
        },
      },
    });

    return conversation.id;
  }

  async function createAuthenticatedSocket(token: string): Promise<Socket> {
    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 3,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  function waitForEvent(socket: Socket, event: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, 5000);

      socket.once(event, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  }

  async function cleanupTestData() {
    await prisma.message.deleteMany({
      where: {
        conversation: {
          participants: {
            some: {
              user: { email: { contains: 'test-' } },
            },
          },
        },
      },
    });

    await prisma.conversationParticipant.deleteMany({
      where: {
        user: { email: { contains: 'test-' } },
      },
    });

    await prisma.conversation.deleteMany({
      where: {
        participants: {
          every: {
            user: { email: { contains: 'test-' } },
          },
        },
      },
    });

    await prisma.user.deleteMany({
      where: { email: { contains: 'test-' } },
    });
  }
});
