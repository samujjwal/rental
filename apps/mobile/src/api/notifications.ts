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
      } catch {
        // Silently fail — the method may not be supported yet
        console.warn('Failed to register device token with backend');
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
    (response) => {
      const data = response.notification.request.content.data;
      routeNotification(navigator, data);
    },
  );

  // Handle notification received (app in foreground) — auto-handled by handler above
  const receivedSubscription = Notifications.addNotificationReceivedListener((_notification) => {
    // Could update badge count, refresh data, etc.
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

function routeNotification(
  navigator: NotificationNavigator,
  data: Record<string, any>,
): void {
  const { type, bookingId, conversationId, listingId } = data ?? {};

  switch (type) {
    case 'booking_update':
    case 'booking_approved':
    case 'booking_rejected':
    case 'booking_cancelled':
      if (bookingId) navigator.navigate('BookingDetail', { bookingId });
      break;
    case 'new_message':
      if (conversationId) navigator.navigate('MessageThread', { conversationId });
      break;
    case 'new_review':
    case 'listing_update':
      if (listingId) navigator.navigate('Listing', { listingId });
      break;
    default:
      // Navigate to notification list or home
      break;
  }
}

/**
 * Get current push token.
 */
export function getPushToken(): string | null {
  return pushToken;
}
