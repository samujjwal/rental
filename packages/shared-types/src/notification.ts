// ============================================================================
// Notification Types
// Shared contract for notification preferences and payloads
// Canonical source — replaces duplicate definitions in apps/mobile and apps/web
// ============================================================================

import type { NotificationType } from './enums';

/** Payload for a push/in-app notification. */
export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

/** Device token registration request body. */
export interface RegisterDeviceTokenRequest {
  token: string;
  platform: 'ios' | 'android' | 'web';
}
