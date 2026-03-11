/**
 * Unit tests for the mobile notification routing logic.
 *
 * Focuses exclusively on `routeNotification()` — the function that maps
 * an incoming push-notification data payload to a navigator.navigate() call.
 * All expo-notifications platform APIs are mocked so these run in pure Node.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  getBadgeCountAsync: jest.fn().mockResolvedValue(0),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { MAX: 5, HIGH: 4 },
}));

jest.mock('expo-device', () => ({ isDevice: true, osName: 'Android' }));
jest.mock('../client', () => ({ mobileClient: { registerDeviceToken: jest.fn() } }));
jest.mock('../authStore', () => ({ getToken: jest.fn().mockResolvedValue('tok-1') }));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { routeNotification } from '../notifications';

// ─── Helper ──────────────────────────────────────────────────────────────────

const makeNavigator = () => ({ navigate: jest.fn() });

// ─── Booking type cases ───────────────────────────────────────────────────────

describe('routeNotification — booking lifecycle', () => {
  it('booking_request → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'booking_request', bookingId: 'b-1' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-1' });
  });

  it('booking_confirmed → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'booking_confirmed', bookingId: 'b-2' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-2' });
  });

  it('booking_cancelled → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'booking_cancelled', bookingId: 'b-3' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-3' });
  });

  it('booking_update → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'booking_update', bookingId: 'b-4' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-4' });
  });

  it('booking_approved → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'booking_approved', bookingId: 'b-5' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-5' });
  });

  it('booking_rejected → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'booking_rejected', bookingId: 'b-6' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-6' });
  });

  it('does not navigate if bookingId is absent for booking types', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'booking_confirmed' });
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

// ─── Payment cases ────────────────────────────────────────────────────────────

describe('routeNotification — payment', () => {
  it('payment_failed → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'payment_failed', bookingId: 'b-10' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-10' });
  });

  it('payment_success → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'payment_success', bookingId: 'b-11' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-11' });
  });

  it('payment_received → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'payment_received', bookingId: 'b-12' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-12' });
  });

  it('refund_processed → BookingDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'refund_processed', bookingId: 'b-13' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-13' });
  });

  it('refund_processed does not navigate without bookingId', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'refund_processed' });
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

// ─── Messaging ────────────────────────────────────────────────────────────────

describe('routeNotification — messaging', () => {
  it('new_message → MessageThread with conversationId', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'new_message', conversationId: 'conv-1' });
    expect(nav.navigate).toHaveBeenCalledWith('MessageThread', { conversationId: 'conv-1' });
  });

  it('does not navigate if conversationId is absent for new_message', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'new_message' });
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

describe('routeNotification — reviews', () => {
  it('review_request → BookingDetail when bookingId present', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'review_request', bookingId: 'b-20' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-20' });
  });

  it('review_request → Listing when no bookingId but listingId present', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'review_request', listingId: 'l-5' });
    expect(nav.navigate).toHaveBeenCalledWith('Listing', { listingId: 'l-5' });
  });

  it('new_review → BookingDetail when bookingId present', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'new_review', bookingId: 'b-21' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-21' });
  });
});

// ─── Disputes ────────────────────────────────────────────────────────────────

describe('routeNotification — disputes', () => {
  it('dispute_opened → DisputeDetail when disputeId present', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'dispute_opened', disputeId: 'd-1' });
    expect(nav.navigate).toHaveBeenCalledWith('DisputeDetail', { disputeId: 'd-1' });
  });

  it('dispute_updated → DisputeDetail', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'dispute_updated', disputeId: 'd-2' });
    expect(nav.navigate).toHaveBeenCalledWith('DisputeDetail', { disputeId: 'd-2' });
  });

  it('dispute_opened falls back to BookingDetail when no disputeId', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'dispute_opened', bookingId: 'b-30' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-30' });
  });

  it('does not navigate if no disputeId or bookingId for dispute type', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'dispute_opened' });
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

// ─── Listings ────────────────────────────────────────────────────────────────

describe('routeNotification — listings', () => {
  it('listing_update → Listing screen', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'listing_update', listingId: 'l-10' });
    expect(nav.navigate).toHaveBeenCalledWith('Listing', { listingId: 'l-10' });
  });

  it('listing_update does not navigate without listingId', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'listing_update' });
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

// ─── Legacy type field fallback ───────────────────────────────────────────────

describe('routeNotification — legacy type fallback', () => {
  it('falls back to `type` when `notificationType` is absent', () => {
    const nav = makeNavigator();
    // Old payloads that only have `type` (before the notificationType fix)
    routeNotification(nav, { type: 'booking_confirmed', bookingId: 'b-99' });
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'b-99' });
  });

  it('prefers notificationType over type', () => {
    const nav = makeNavigator();
    routeNotification(nav, {
      notificationType: 'dispute_opened',
      type: 'booking_confirmed',     // conflicting legacy field — should be ignored
      disputeId: 'd-99',
    });
    expect(nav.navigate).toHaveBeenCalledWith('DisputeDetail', { disputeId: 'd-99' });
  });
});

// ─── Unknown / missing type ───────────────────────────────────────────────────

describe('routeNotification — unknown type', () => {
  it('does not navigate for unknown type', () => {
    const nav = makeNavigator();
    routeNotification(nav, { notificationType: 'some_future_type', bookingId: 'b-1' });
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate for empty data', () => {
    const nav = makeNavigator();
    routeNotification(nav, {});
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate for null data', () => {
    const nav = makeNavigator();
    routeNotification(nav, null as any);
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});
