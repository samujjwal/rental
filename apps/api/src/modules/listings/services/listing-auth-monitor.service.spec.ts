import { EventEmitter2 } from '@nestjs/event-emitter';
import { ListingAuthMonitorService, type AuthEvent } from './listing-auth-monitor.service';

describe('ListingAuthMonitorService', () => {
  let service: ListingAuthMonitorService;
  let emitter: jest.Mocked<EventEmitter2>;

  const makeEvent = (overrides: Partial<AuthEvent> = {}): AuthEvent => ({
    listingId: 'listing-1',
    listingStatus: 'AVAILABLE',
    accessGranted: true,
    reason: 'public listing',
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    emitter = { emit: jest.fn() } as any;
    service = new ListingAuthMonitorService(emitter);
  });

  describe('recordAuthEvent', () => {
    it('increments totalRequests on each call', () => {
      service.recordAuthEvent(makeEvent());
      service.recordAuthEvent(makeEvent());
      expect(service.getMetrics().totalRequests).toBe(2);
    });

    it('increments successfulAccess for granted events', () => {
      service.recordAuthEvent(makeEvent({ accessGranted: true }));
      expect(service.getMetrics().successfulAccess).toBe(1);
    });

    it('increments deniedAccess for denied events', () => {
      service.recordAuthEvent(makeEvent({ accessGranted: false, reason: 'Listing is not available' }));
      expect(service.getMetrics().deniedAccess).toBe(1);
    });

    it('tracks publicAccess when no userId', () => {
      service.recordAuthEvent(makeEvent({ userId: undefined, accessGranted: true }));
      expect(service.getMetrics().publicAccess).toBe(1);
    });

    it('tracks adminAccess for ADMIN role', () => {
      service.recordAuthEvent(makeEvent({ userId: 'u1', userRole: 'ADMIN', accessGranted: true }));
      expect(service.getMetrics().adminAccess).toBe(1);
    });

    it('tracks failedAuth for invalid token denial', () => {
      service.recordAuthEvent(makeEvent({ accessGranted: false, reason: 'Invalid token provided' }));
      expect(service.getMetrics().failedAuth).toBe(1);
    });

    it('emits listing.auth.event via EventEmitter2', () => {
      const event = makeEvent();
      service.recordAuthEvent(event);
      expect(emitter.emit).toHaveBeenCalledWith('listing.auth.event', event);
    });

    it('stores recent events up to maxRecentEvents', () => {
      for (let i = 0; i < 5; i++) {
        service.recordAuthEvent(makeEvent({ listingId: `listing-${i}` }));
      }
      expect(service.getRecentEvents().length).toBe(5);
    });

    it('detects suspicious activity when same IP has 10+ failures in 1 minute', () => {
      const ip = '1.2.3.4';
      const now = new Date();
      for (let i = 0; i < 11; i++) {
        service.recordAuthEvent(makeEvent({ accessGranted: false, ipAddress: ip, timestamp: now }));
      }
      expect(service.getMetrics().suspiciousActivity).toBeGreaterThan(0);
      expect(emitter.emit).toHaveBeenCalledWith('security.suspicious_activity', expect.objectContaining({ ipAddress: ip }));
    });
  });

  describe('getRecentEvents', () => {
    it('returns events limited by the provided limit', () => {
      for (let i = 0; i < 10; i++) {
        service.recordAuthEvent(makeEvent());
      }
      expect(service.getRecentEvents(3).length).toBe(3);
    });
  });

  describe('getEventsByListingId', () => {
    it('filters events by listingId', () => {
      service.recordAuthEvent(makeEvent({ listingId: 'listing-A' }));
      service.recordAuthEvent(makeEvent({ listingId: 'listing-B' }));
      const result = service.getEventsByListingId('listing-A');
      expect(result).toHaveLength(1);
      expect(result[0].listingId).toBe('listing-A');
    });
  });

  describe('getEventsByUserId', () => {
    it('filters events by userId', () => {
      service.recordAuthEvent(makeEvent({ userId: 'user-1', accessGranted: true }));
      service.recordAuthEvent(makeEvent({ userId: 'user-2', accessGranted: true }));
      expect(service.getEventsByUserId('user-1')).toHaveLength(1);
    });
  });

  describe('getEventsByIpAddress', () => {
    it('filters events by ipAddress', () => {
      service.recordAuthEvent(makeEvent({ ipAddress: '10.0.0.1' }));
      service.recordAuthEvent(makeEvent({ ipAddress: '10.0.0.2' }));
      expect(service.getEventsByIpAddress('10.0.0.1')).toHaveLength(1);
    });
  });

  describe('resetMetrics', () => {
    it('resets all counters to zero and clears events', () => {
      service.recordAuthEvent(makeEvent());
      service.resetMetrics();
      const metrics = service.getMetrics();
      Object.values(metrics).forEach((v) => expect(v).toBe(0));
      expect(service.getRecentEvents()).toHaveLength(0);
    });
  });

  describe('getHealthStatus', () => {
    it('returns healthy when error rate is low', () => {
      service.recordAuthEvent(makeEvent({ accessGranted: true, timestamp: new Date() }));
      const status = service.getHealthStatus();
      expect(status.status).toBe('healthy');
    });

    it('returns unhealthy when error rate exceeds 50%', () => {
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        service.recordAuthEvent(makeEvent({ accessGranted: false, reason: 'denied', timestamp: now }));
      }
      for (let i = 0; i < 4; i++) {
        service.recordAuthEvent(makeEvent({ accessGranted: true, timestamp: now }));
      }
      const status = service.getHealthStatus();
      expect(status.status).toBe('unhealthy');
    });
  });
});
