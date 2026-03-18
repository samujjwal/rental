import { api } from "~/lib/api-client";

export type NotificationType = 
  | "BOOKING_REQUEST"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_REMINDER"
  | "PAYMENT_RECEIVED"
  | "PAYOUT_PROCESSED"
  | "MESSAGE_RECEIVED"
  | "REVIEW_RECEIVED"
  | "REVIEW_RESPONSE"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "LISTING_APPROVED"
  | "LISTING_REJECTED"
  | "ACCOUNT_VERIFIED"
  | "VERIFICATION_COMPLETE"
  | "PROMOTION"
  | "MARKETING"
  | "SYSTEM"
  | "SYSTEM_UPDATE"
  | "SYSTEM_ANNOUNCEMENT";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  bookingUpdates: boolean;
  paymentUpdates: boolean;
  reviewAlerts: boolean;
  messageAlerts: boolean;
  marketingEmails: boolean;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount?: number;
}

function normalizeNotificationData(value: unknown): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  return typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeNotification(notification: Notification & { data?: unknown }): Notification {
  return {
    ...notification,
    data: normalizeNotificationData(notification.data),
  };
}

export const notificationsApi = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  }): Promise<NotificationsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.unreadOnly) queryParams.append("unreadOnly", "true");
    if (params?.type) queryParams.append("type", params.type);

    const query = queryParams.toString();
    const response = await api.get<NotificationsResponse>(
      `/notifications${query ? `?${query}` : ""}`
    );

    return {
      ...response,
      notifications: Array.isArray(response.notifications)
        ? response.notifications.map((notification) =>
            normalizeNotification(notification as Notification & { data?: unknown })
          )
        : [],
    };
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>("/notifications/unread-count");
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    return api.post<void>(`/notifications/${notificationId}/read`);
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<{ count: number }> {
    return api.post<{ count: number }>("/notifications/read-all");
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    return api.delete<void>(`/notifications/${notificationId}`);
  },

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    return api.get<NotificationPreferences>("/notifications/preferences");
  },

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    return api.patch<NotificationPreferences>(
      "/notifications/preferences",
      preferences
    );
  },

  // Device registration endpoints are not implemented in the API yet.
};
