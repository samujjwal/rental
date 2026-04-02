import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityGateway } from './availability.gateway';
import { AvailabilityGraphService } from '../services/availability-graph.service';
import { WsJwtAuthGuard } from '@/modules/auth/guards/ws-jwt-auth.guard';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@/modules/auth/services/auth.service';

describe('AvailabilityGateway', () => {
  let gateway: AvailabilityGateway;
  let mockAvailabilityService: any;
  let mockWsAuthGuard: any;

  const mockAvailabilityGraphService = {
    checkRealTimeAvailability: jest.fn(),
  };

  const mockAuthGuard: any = {
    validateSocket: jest.fn(),
    canActivate: jest.fn(),
  };

  const mockJwtService = {};
  const mockConfigService = { get: jest.fn() };
  const mockAuthService = {};

  function fakeSocket(userId?: string, id = 'sock-1'): any {
    return {
      id,
      userId,
      data: {},
      handshake: { auth: {} },
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      disconnect: jest.fn(),
    };
  }

  function fakeServer(): any {
    return {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityGateway,
        { provide: AvailabilityGraphService, useValue: mockAvailabilityGraphService },
        { provide: WsJwtAuthGuard, useValue: mockAuthGuard },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    gateway = module.get<AvailabilityGateway>(AvailabilityGateway);
    mockAvailabilityService = mockAvailabilityGraphService as any;
    mockWsAuthGuard = mockAuthGuard as any;
    gateway.server = fakeServer();

    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should authenticate and track socket for valid user', async () => {
      mockWsAuthGuard.validateSocket.mockResolvedValue({ id: 'user-1' });
      const client = fakeSocket(undefined, 'sock-1');

      await gateway.handleConnection(client);

      expect(client.userId).toBe('user-1');
      expect(mockWsAuthGuard.validateSocket).toHaveBeenCalledWith(client);
    });

    it('should disconnect unauthenticated clients', async () => {
      mockWsAuthGuard.validateSocket.mockResolvedValue(null);
      const client = fakeSocket(undefined, 'sock-1');

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      mockWsAuthGuard.validateSocket.mockRejectedValue(new Error('Auth failed'));
      const client = fakeSocket(undefined, 'sock-1');

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should track multiple sockets for same user', async () => {
      mockWsAuthGuard.validateSocket.mockResolvedValue({ id: 'user-1' });

      const socket1 = fakeSocket(undefined, 'sock-1');
      const socket2 = fakeSocket(undefined, 'sock-2');

      await gateway.handleConnection(socket1);
      await gateway.handleConnection(socket2);

      const stats = gateway.getStats();
      expect(stats.uniqueUsers).toBe(1);
      expect(stats.connectedSockets).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up subscriptions on disconnect', async () => {
      mockWsAuthGuard.validateSocket.mockResolvedValue({ id: 'user-1' });
      const client = fakeSocket(undefined, 'sock-1');

      await gateway.handleConnection(client);

      // Subscribe to a listing
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      // Disconnect
      gateway.handleDisconnect(client);

      const stats = gateway.getStats();
      expect(stats.connectedSockets).toBe(0);
      expect(stats.watchedListings).toBe(0);
    });

    it('should handle disconnect for untracked socket', () => {
      const client = fakeSocket('user-1', 'unknown-sock');

      // Should not throw
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  describe('handleSubscribeAvailability', () => {
    it('should subscribe socket to listing updates', async () => {
      mockWsAuthGuard.validateSocket.mockResolvedValue({ id: 'user-1' });
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket(undefined, 'sock-1');
      await gateway.handleConnection(client);

      const result = await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      expect(client.join).toHaveBeenCalledWith('listing:listing-1');
      expect(result.event).toBe('availability_snapshot');
      expect(result.data.listingId).toBe('listing-1');
    });

    it('should return error for missing listingId', async () => {
      const client = fakeSocket('user-1');

      const result = await gateway.handleSubscribeAvailability(client, { listingId: '' });

      expect(result.event).toBe('error');
      expect(result.data.message).toContain('listingId is required');
    });

    it('should fetch and return availability snapshot', async () => {
      const availability = {
        available: true,
        blockedDates: [new Date('2025-01-02')],
        confirmedBookings: 1,
        pricePerNight: 150,
        hasActiveLock: false,
      };
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue(availability);

      const client = fakeSocket('user-1');
      const result = await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      expect(mockAvailabilityService.checkRealTimeAvailability).toHaveBeenCalled();
      expect(result.data.availability).toEqual(availability);
      expect(result.data.subscribedAt).toBeDefined();
    });

    it('should handle availability service errors', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockRejectedValue(new Error('DB Error'));

      const client = fakeSocket('user-1');
      const result = await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      expect(result.event).toBe('availability_snapshot');
      expect(result.data.error).toBe('Failed to load');
    });

    it('should track multiple listings per socket', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket('user-1');
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-2' });

      const stats = gateway.getStats();
      expect(stats.watchedListings).toBe(2);
      expect(stats.totalSubscriptions).toBe(2);
    });

    it('should track multiple subscribers per listing', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client1 = fakeSocket('user-1', 'sock-1');
      const client2 = fakeSocket('user-2', 'sock-2');

      await gateway.handleSubscribeAvailability(client1, { listingId: 'listing-1' });
      await gateway.handleSubscribeAvailability(client2, { listingId: 'listing-1' });

      const stats = gateway.getStats();
      expect(stats.watchedListings).toBe(1);
      expect(stats.totalSubscriptions).toBe(2);
    });
  });

  describe('handleUnsubscribeAvailability', () => {
    it('should unsubscribe socket from listing', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue([]);

      const client = fakeSocket('user-1', 'sock-1');
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      const result = gateway.handleUnsubscribeAvailability(client, { listingId: 'listing-1' });

      expect(client.leave).toHaveBeenCalledWith('listing:listing-1');
      expect(result.event).toBe('unsubscribed');
    });

    it('should clean up empty subscriber sets', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket('user-1', 'sock-1');
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });
      gateway.handleUnsubscribeAvailability(client, { listingId: 'listing-1' });

      const stats = gateway.getStats();
      expect(stats.watchedListings).toBe(0);
    });

    it('should handle unsubscribe for non-subscribed listing', () => {
      const client = fakeSocket('user-1', 'sock-1');

      // Should not throw
      expect(() =>
        gateway.handleUnsubscribeAvailability(client, { listingId: 'not-subscribed' }),
      ).not.toThrow();
    });
  });

  describe('handleCheckDates', () => {
    it('should check availability for specific dates', async () => {
      const availability = [{ date: new Date('2025-01-15'), status: 'available', price: 150 }];
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue(availability);

      const client = fakeSocket('user-1');
      const result = await gateway.handleCheckDates(client, {
        listingId: 'listing-1',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(result.event).toBe('date_check_result');
      expect(result.data.listingId).toBe('listing-1');
      expect(result.data.availability).toEqual(availability);
    });

    it('should handle check dates errors', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockRejectedValue(
        new Error('Invalid dates'),
      );

      const client = fakeSocket('user-1');
      const result = await gateway.handleCheckDates(client, {
        listingId: 'listing-1',
        startDate: 'invalid',
        endDate: 'invalid',
      });

      expect(result.event).toBe('date_check_result');
      expect(result.data.error).toBe('Invalid dates');
    });
  });

  describe('event-driven broadcasts', () => {
    it('should broadcast on booking.created event', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket('user-1', 'sock-1');
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleBookingCreated({
        listingId: 'listing-1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-05'),
        bookingId: 'booking-1',
      });

      expect(gateway.server.to).toHaveBeenCalledWith('listing:listing-1');
      expect(toEmit).toHaveBeenCalledWith(
        'availability_changed',
        expect.objectContaining({
          type: 'BOOKING_CREATED',
          listingId: 'listing-1',
          bookingId: 'booking-1',
        }),
      );
    });

    it('should broadcast on booking.cancelled event', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket('user-1', 'sock-1');
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleBookingCancelled({
        listingId: 'listing-1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-05'),
        bookingId: 'booking-1',
      });

      expect(toEmit).toHaveBeenCalledWith(
        'availability_changed',
        expect.objectContaining({
          type: 'BOOKING_CANCELLED',
        }),
      );
    });

    it('should broadcast on listing.availability_updated event', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket('user-1', 'sock-1');
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleAvailabilityUpdate({
        listingId: 'listing-1',
        changes: { price: 200, blockedDates: ['2025-01-01'] },
      });

      expect(toEmit).toHaveBeenCalledWith(
        'availability_changed',
        expect.objectContaining({
          type: 'CALENDAR_UPDATED',
          changes: expect.any(Object),
        }),
      );
    });

    it('should not broadcast when no subscribers', () => {
      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleBookingCreated({
        listingId: 'listing-with-no-subscribers',
        startDate: new Date(),
        endDate: new Date(),
        bookingId: 'booking-1',
      });

      // Should not call to/emit when there are no subscribers
      expect(toEmit).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      // Set up some connections and subscriptions
      mockWsAuthGuard.validateSocket.mockResolvedValue({ id: 'user-1' });
      const client1 = fakeSocket(undefined, 'sock-1');
      const client2 = fakeSocket(undefined, 'sock-2');

      await gateway.handleConnection(client1);
      await gateway.handleConnection(client2);

      await gateway.handleSubscribeAvailability(client1, { listingId: 'listing-1' });
      await gateway.handleSubscribeAvailability(client2, { listingId: 'listing-1' });
      await gateway.handleSubscribeAvailability(client1, { listingId: 'listing-2' });

      const stats = gateway.getStats();

      expect(stats.connectedSockets).toBe(2);
      expect(stats.uniqueUsers).toBe(1); // Same user
      expect(stats.watchedListings).toBe(2);
      expect(stats.totalSubscriptions).toBe(3);
    });

    it('should return zero for empty gateway', () => {
      const stats = gateway.getStats();

      expect(stats.connectedSockets).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.watchedListings).toBe(0);
      expect(stats.totalSubscriptions).toBe(0);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent subscriptions', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket('user-1', 'sock-1');

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(gateway.handleSubscribeAvailability(client, { listingId: `listing-${i}` }));
      }

      await Promise.all(promises);

      const stats = gateway.getStats();
      expect(stats.watchedListings).toBe(10);
      expect(stats.totalSubscriptions).toBe(10);
    });

    it('should handle subscribe/unsubscribe race conditions', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 100,
        hasActiveLock: false,
      });

      const client = fakeSocket('user-1', 'sock-1');

      // Subscribe
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      // Unsubscribe
      gateway.handleUnsubscribeAvailability(client, { listingId: 'listing-1' });

      // Subscribe again
      await gateway.handleSubscribeAvailability(client, { listingId: 'listing-1' });

      const stats = gateway.getStats();
      expect(stats.watchedListings).toBe(1);
      expect(stats.totalSubscriptions).toBe(1);
    });
  });
});
