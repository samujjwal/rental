import { api } from "~/lib/api-client";

export type NotificationType = 
  | "BOOKING_REQUEST"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
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
  | "PROMOTION"
  | "SYSTEM";

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
  email: {
    bookingUpdates: boolean;
    paymentUpdates: boolean;
    messages: boolean;
    reviews: boolean;
    marketing: boolean;
    securityAlerts: boolean;
  };
  push: {
    bookingUpdates: boolean;
    paymentUpdates: boolean;
    messages: boolean;
    reviews: boolean;
    marketing: boolean;
    securityAlerts: boolean;
  };
  sms: {
    bookingUpdates: boolean;
    paymentUpdates: boolean;
    messages: boolean;
    securityAlerts: boolean;
  };
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface RegisterDeviceDto {
  token: string;
  platform: "web" | "ios" | "android";
  deviceInfo?: Record<string, unknown>;
}

export const notificationsApi = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
  }): Promise<NotificationsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.unreadOnly) queryParams.append("unreadOnly", "true");
    if (params?.type) queryParams.append("type", params.type);

    const query = queryParams.toString();
    return api.get<NotificationsResponse>(
      `/notifications${query ? `?${query}` : ""}`
    );
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>("/notifications/count");
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    return api.patch<void>(`/notifications/${notificationId}/read`);
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

  /**
   * Register device for push notifications
   */
  async registerDevice(data: RegisterDeviceDto): Promise<{ deviceId: string }> {
    return api.post<{ deviceId: string }>(
      "/notifications/devices/register",
      data
    );
  },

  /**
   * Unregister device from push notifications
   */
  async unregisterDevice(deviceId: string): Promise<void> {
    return api.post<void>("/notifications/devices/unregister", { deviceId });
  },

  /**
   * Test push notification (development only)
   */
  async sendTestNotification(): Promise<void> {
    return api.post<void>("/notifications/test");
  },
};
