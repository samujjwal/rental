/**
 * WebSocket Integration Tests - Real-time Updates
 * 
 * Tests real-time WebSocket functionality for:
 * 1. Connection and authentication
 * 2. Booking state updates
 * 3. Notifications
 * 4. Messaging
 * 5. Connection resilience
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { io, Socket } from 'socket.io-client';

describe('WebSocket Integration - Real-time Updates', () => {
  let app: INestApplication;
  let userToken: string;
  let ownerToken: string;
  let userSocket: Socket;
  let ownerSocket: Socket;
  let testBookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    await app.listen(0); // Get random available port

    const serverUrl = `http://localhost:${app.getHttpServer().address().port}`;

    // Setup test users
    const userResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'ws-user@example.com',
        username: 'ws-user',
        password: 'Password123!',
        firstName: 'WS',
        lastName: 'User',
      });

    userToken = userResponse.body.token;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'ws-owner@example.com',
        username: 'ws-owner',
        password: 'Password123!',
        firstName: 'WS',
        lastName: 'Owner',
      });

    ownerToken = ownerResponse.body.token;

    // Upgrade to host
    await request(app.getHttpServer())
      .post('/users/upgrade-to-host')
      .set('Authorization', `Bearer ${ownerToken}`);

    // Connect user WebSocket
    userSocket = io(serverUrl, {
      auth: { token: userToken },
      transports: ['websocket'],
    });

    // Connect owner WebSocket
    ownerSocket = io(serverUrl, {
      auth: { token: ownerToken },
      transports: ['websocket'],
    });

    // Wait for connections
    await Promise.all([
      new Promise<void>((resolve) => userSocket.on('connect', resolve)),
      new Promise<void>((resolve) => ownerSocket.on('connect', resolve)),
    ]);

    // Create test booking
    const listingResponse = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'WS Test Listing',
        description: 'Testing WebSocket',
        address: '123 WS St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'USA',
        latitude: 40.7128,
        longitude: -74.0060,
        type: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        basePrice: 100,
        currency: 'USD',
        amenities: ['wifi'],
        photos: ['https://example.com/photo.jpg'],
      })
      .expect(201);

    const testListingId = listingResponse.body.id;

    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        listingId: testListingId,
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        guestCount: 2,
      })
      .expect(201);

    testBookingId = bookingResponse.body.id;
  });

  afterAll(async () => {
    if (userSocket) userSocket.disconnect();
    if (ownerSocket) ownerSocket.disconnect();
    if (app) await app.close();
  });

  describe('Connection and Authentication', () => {
    it('should connect with valid token', () => {
      expect(userSocket.connected).toBe(true);
      expect(ownerSocket.connected).toBe(true);
    });

    it('should reject connection without token', async () => {
      const serverUrl = `http://localhost:${app.getHttpServer().address().port}`;
      const invalidSocket = io(serverUrl, {
        auth: {},
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        invalidSocket.on('connect_error', () => resolve());
      });

      expect(invalidSocket.connected).toBe(false);
      invalidSocket.disconnect();
    });

    it('should reject connection with invalid token', async () => {
      const serverUrl = `http://localhost:${app.getHttpServer().address().port}`;
      const invalidSocket = io(serverUrl, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        invalidSocket.on('connect_error', () => resolve());
      });

      expect(invalidSocket.connected).toBe(false);
      invalidSocket.disconnect();
    });

    it('should receive connection acknowledgment', async () => {
      const userAck = await new Promise<any>((resolve) => {
        userSocket.once('connected', resolve);
      });

      expect(userAck).toHaveProperty('userId');
      expect(userAck).toHaveProperty('socketId');
    });
  });

  describe('Booking State Updates', () => {
    it('should receive booking state update on approval', async () => {
      const stateUpdatePromise = new Promise<any>((resolve) => {
        ownerSocket.once('booking:state_update', resolve);
      });

      // Approve booking
      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const update = await stateUpdatePromise;
      expect(update).toHaveProperty('bookingId', testBookingId);
      expect(update).toHaveProperty('oldStatus');
      expect(update).toHaveProperty('newStatus');
      expect(update.newStatus).toBe('PENDING_PAYMENT');
    });

    it('should receive booking state update on cancellation', async () => {
      const stateUpdatePromise = new Promise<any>((resolve) => {
        userSocket.once('booking:state_update', resolve);
      });

      // Cancel booking
      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(200);

      const update = await stateUpdatePromise;
      expect(update).toHaveProperty('bookingId', testBookingId);
      expect(update.newStatus).toBe('CANCELLED');
    });
  });

  describe('Notifications', () => {
    it('should receive notification on booking creation', async () => {
      const notificationPromise = new Promise<any>((resolve) => {
        ownerSocket.once('notification:new', resolve);
      });

      // Create new booking
      const listingResponse = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Another WS Test Listing',
          description: 'Testing WebSocket notifications',
          address: '456 WS St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
          latitude: 40.7128,
          longitude: -74.0060,
          type: 'APARTMENT',
          bedrooms: 1,
          bathrooms: 1,
          maxGuests: 2,
          basePrice: 80,
          currency: 'USD',
          amenities: ['wifi'],
          photos: ['https://example.com/photo.jpg'],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: listingResponse.body.id,
          startDate: '2026-12-10',
          endDate: '2026-12-12',
          guestCount: 1,
        })
        .expect(201);

      const notification = await notificationPromise;
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('type');
      expect(notification).toHaveProperty('message');
    });

    it('should receive notification on message', async () => {
      const notificationPromise = new Promise<any>((resolve) => {
        userSocket.once('notification:new', resolve);
      });

      // Send message
      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ message: 'Test message via WebSocket' })
        .expect(201);

      const notification = await notificationPromise;
      expect(notification.type).toBe('NEW_MESSAGE');
    });
  });

  describe('Messaging', () => {
    it('should receive message in real-time', async () => {
      const messagePromise = new Promise<any>((resolve) => {
        userSocket.once('message:new', resolve);
      });

      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ message: 'Real-time test message' })
        .expect(201);

      const message = await messagePromise;
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('bookingId', testBookingId);
      expect(message).toHaveProperty('content', 'Real-time test message');
      expect(message).toHaveProperty('senderId');
    });

    it('should send message via WebSocket', async () => {
      const messagePromise = new Promise<any>((resolve) => {
        ownerSocket.once('message:new', resolve);
      });

      userSocket.emit('message:send', {
        bookingId: testBookingId,
        content: 'WebSocket direct message',
      });

      const message = await messagePromise;
      expect(message.content).toBe('WebSocket direct message');
    });

    it('should handle typing indicators', async () => {
      const typingPromise = new Promise<any>((resolve) => {
        ownerSocket.once('message:typing', resolve);
      });

      userSocket.emit('message:typing', {
        bookingId: testBookingId,
        isTyping: true,
      });

      const typing = await typingPromise;
      expect(typing).toHaveProperty('bookingId', testBookingId);
      expect(typing).toHaveProperty('isTyping', true);
    });
  });

  describe('Connection Resilience', () => {
    it('should handle reconnection', async () => {
      userSocket.disconnect();

      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const reconnectPromise = new Promise<void>((resolve) => {
        userSocket.on('connect', resolve);
      });

      userSocket.connect();
      await reconnectPromise;

      expect(userSocket.connected).toBe(true);
    });

    it('should queue messages during disconnection', async () => {
      // Disconnect user socket
      userSocket.disconnect();

      // Send message via API while disconnected
      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ message: 'Message while disconnected' })
        .expect(201);

      // Reconnect
      userSocket.connect();
      await new Promise<void>((resolve) => {
        userSocket.on('connect', resolve);
      });

      // Should receive queued messages
      const messagePromise = new Promise<any>((resolve) => {
        userSocket.once('message:new', resolve);
      });

      const message = await messagePromise;
      expect(message.content).toBe('Message while disconnected');
    });

    it('should handle heartbeat', async () => {
      const heartbeatPromise = new Promise<any>((resolve) => {
        userSocket.once('heartbeat', resolve);
      });

      // Wait for heartbeat (typically sent every 30 seconds, but we can trigger manually)
      userSocket.emit('heartbeat:request');

      const heartbeat = await heartbeatPromise;
      expect(heartbeat).toHaveProperty('timestamp');
    });
  });

  describe('Room Management', () => {
    it('should join booking room', async () => {
      const joinPromise = new Promise<any>((resolve) => {
        userSocket.once('room:joined', resolve);
      });

      userSocket.emit('room:join', { bookingId: testBookingId });

      const joined = await joinPromise;
      expect(joined).toHaveProperty('room', `booking:${testBookingId}`);
      expect(joined).toHaveProperty('success', true);
    });

    it('should leave booking room', async () => {
      const leavePromise = new Promise<any>((resolve) => {
        userSocket.once('room:left', resolve);
      });

      userSocket.emit('room:leave', { bookingId: testBookingId });

      const left = await leavePromise;
      expect(left).toHaveProperty('room', `booking:${testBookingId}`);
      expect(left).toHaveProperty('success', true);
    });

    it('should receive room-specific messages', async () => {
      // Join room
      userSocket.emit('room:join', { bookingId: testBookingId });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const messagePromise = new Promise<any>((resolve) => {
        userSocket.once('message:new', resolve);
      });

      // Send message to room
      await request(app.getHttpServer())
        .post(`/bookings/${testBookingId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ message: 'Room-specific message' })
        .expect(201);

      const message = await messagePromise;
      expect(message.bookingId).toBe(testBookingId);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event data', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        userSocket.once('error', resolve);
      });

      userSocket.emit('message:send', {}); // Missing required fields

      const error = await errorPromise;
      expect(error).toHaveProperty('message');
    });

    it('should handle unauthorized room access', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        userSocket.once('error', resolve);
      });

      // Try to join room without access
      userSocket.emit('room:join', { bookingId: 'non-existent-booking-id' });

      const error = await errorPromise;
      expect(error).toHaveProperty('message');
    });
  });
});
