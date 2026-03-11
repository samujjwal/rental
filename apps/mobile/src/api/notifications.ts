import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { mobileClient } from './client';
import { getToken } from './authStore';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let pushToken: string | null = null;

/**
 * Request notification permissions and register the device.
 * Call this after successful login.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  // Get Expo push token
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    pushToken = tokenResponse.data;

    // Register token with backend
    const authToken = await getToken();
    if (authToken && pushToken) {
      try {
        await mobileClient.registerDeviceToken(pushToken, Platform.OS);
      } catch (err: any) {
        // Silently fail but log to console rather than warn, or log safely.
        // During tests, mock devices might fail backend registration harmlessly.
        if (process.env.NODE_ENV !== 'test') {
          console.debug('Device token registration skipped or failed:', err?.message);
        }
      }
    }

    // Android-specific notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
      });

      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200],
      });

      await Notifications.setNotificationChannelAsync('bookings', {
        name: 'Bookings',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    return pushToken;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Unregister device token on logout.
 */
export async function unregisterPushNotifications(): Promise<void> {
  if (pushToken) {
    try {
      await mobileClient.unregisterDeviceToken(pushToken);
    } catch {
      // Silently fail
    }
    pushToken = null;
  }
}

/**
 * Navigate to the appropriate screen based on notification data.
 */
export type NotificationNavigator = {
  navigate: (screen: string, params?: Record<string, any>) => void;
};

export function setupNotificationNavigation(navigator: NotificationNavigator): () => void {
  // Handle notification tapped (app in background)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      const data = response.notification.request.content.data;
      routeNotification(navigator, data);
      // Clear badge when user taps a notification
      await Notifications.setBadgeCountAsync(0).catch(() => undefined);
    },
  );

  // Handle notification received (app in foreground) — update badge count
  const receivedSubscription = Notifications.addNotificationReceivedListener(async (_notification) => {
    try {
      // Fetch updated badge count from the OS-level badge
      const count = await Notifications.getBadgeCountAsync();
      // Increment badge by 1 for the incoming notification
      await Notifications.setBadgeCountAsync(Math.max(0, count) + 1);
    } catch {
      // Badge update is best-effort; silently ignore failures
    }
  });

  // Check if app was opened from a notification (cold start)
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data;
      routeNotification(navigator, data);
    }
  });

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}

/** @internal exported for unit testing */
export function routeNotification(
  navigator: NotificationNavigator,
  data: Record<string, any>,
): void {
  // Support both legacy `type` and the canonical `notificationType` field
  const type: string = data?.notificationType ?? data?.type ?? '';
  const { bookingId, conversationId, listingId, disputeId } = data ?? {};

  switch (type) {
    // Booking lifecycle
    case 'booking_request':
    case 'booking_update':
    case 'booking_confirmed':
    case 'booking_approved':
    case 'booking_rejected':
    case 'booking_cancelled':
      if (bookingId) navigator.navigate('BookingDetail', { bookingId });
      break;

    // Payment events — navigate to the booking detail so users can retry
    case 'payment_failed':
    case 'payment_success':
    case 'payment_received':
    case 'refund_processed':
      if (bookingId) navigator.navigate('BookingDetail', { bookingId });
      break;

    // Messaging
    case 'new_message':
      if (conversationId) navigator.navigate('MessageThread', { conversationId });
      break;

    // Reviews
    case 'new_review':
    case 'review_request':
      if (bookingId) navigator.navigate('BookingDetail', { bookingId });
      else if (listingId) navigator.navigate('Listing', { listingId });
      break;

    // Disputes
    case 'dispute_opened':
    case 'dispute_updated':
      if (disputeId) navigator.navigate('DisputeDetail', { disputeId });
      else if (bookingId) navigator.navigate('BookingDetail', { bookingId });
      break;

    // Listing events
    case 'listing_update':
      if (listingId) navigator.navigate('Listing', { listingId });
      break;

    default:
      // Unknown notification type — no navigation
      break;
  }
}

/**
 * Get current push token.
 */
export function getPushToken(): string | null {
  return pushToken;
}
