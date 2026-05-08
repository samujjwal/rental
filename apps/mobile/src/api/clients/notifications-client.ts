/**
 * Notifications Client
 * 
 * Handles all notification-related API endpoints:
 * - Get notifications
 * - Mark notifications as read
 * - Notification preferences
 * - Device token registration
 */

import type { NotificationPreferences } from '~/types';
import { BaseClient } from './base-client';

export class NotificationsClient extends BaseClient {
  /**
   * Get notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/notifications/preferences');
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(payload: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Register device token for push notifications
   */
  async registerDeviceToken(token: string, platform: string): Promise<void> {
    return this.request<void>('/notifications/devices/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    return this.request<void>('/notifications/devices/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Get notifications with pagination
   */
  async getNotifications(page = 1, limit = 20): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.request<any>(`/notifications?page=${page}&limit=${limit}`);
  }

  /**
   * Get unread notification count
   */
  async getUnreadNotificationCount(): Promise<{ count: number }> {
    return this.request<any>('/notifications/unread-count');
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(id: string): Promise<void> {
    return this.request<void>(`/notifications/${id}/read`, { method: 'POST' });
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(): Promise<void> {
    return this.request<void>('/notifications/read-all', { method: 'POST' });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<void> {
    return this.request<void>(`/notifications/${id}`, { method: 'DELETE' });
  }
}
