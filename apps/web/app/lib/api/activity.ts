import { api } from "~/lib/api-client";

export type ActivityType = 
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_completed"
  | "payment_processed"
  | "payment_failed"
  | "listing_created"
  | "listing_updated"
  | "listing_viewed"
  | "message_sent"
  | "message_received"
  | "review_submitted"
  | "review_received"
  | "favorite_added"
  | "favorite_removed"
  | "dispute_filed"
  | "dispute_resolved"
  | "user_login"
  | "user_profile_updated"
  | "insurance_purchased"
  | "insurance_expiring"
  | "payout_processed"
  | "refund_processed";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  entityId?: string;
  entityType?: "booking" | "listing" | "message" | "review" | "dispute" | "payment" | "user" | "insurance";
  metadata?: Record<string, unknown>;
  icon?: string;
  link?: string;
  actor?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface RecentActivityResponse {
  activities: ActivityItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export const activityApi = {
  /**
   * Get recent activity for the current user
   * Combines bookings, messages, listings, and other user activities
   */
  async getRecentActivity(params?: {
    limit?: number;
    cursor?: string;
    types?: ActivityType[];
    startDate?: string;
    endDate?: string;
  }): Promise<RecentActivityResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append("limit", String(params.limit));
    if (params?.cursor) queryParams.append("cursor", params.cursor);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    if (params?.types?.length) {
      queryParams.append("types", params.types.join(","));
    }
    
    const query = queryParams.toString();
    return api.get<RecentActivityResponse>(`/activity/recent${query ? `?${query}` : ""}`);
  },

  /**
   * Get activity feed for dashboard (simplified, limited types)
   */
  async getDashboardActivity(limit = 10): Promise<RecentActivityResponse> {
    return this.getRecentActivity({
      limit,
      types: [
        "booking_created",
        "booking_confirmed",
        "booking_completed",
        "payment_processed",
        "listing_created",
        "message_received",
        "review_received",
        "favorite_added",
        "dispute_filed",
        "dispute_resolved",
        "payout_processed",
      ],
    });
  },

  /**
   * Get activity statistics for the current user
   */
  async getActivityStats(period: "7d" | "30d" | "90d" = "30d"): Promise<{
    totalActivities: number;
    byType: Record<ActivityType, number>;
    mostActiveDay: string;
    trend: "up" | "down" | "stable";
    changePercent: number;
  }> {
    return api.get(`/activity/stats`, { params: { period } });
  },

  /**
   * Mark activity as read (for notification-style activities)
   */
  async markAsRead(activityId: string): Promise<void> {
    return api.patch(`/activity/${activityId}/read`, {});
  },

  /**
   * Mark all activities as read
   */
  async markAllAsRead(): Promise<void> {
    return api.patch(`/activity/read-all`, {});
  },

  /**
   * Get unread activity count (for badges)
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return api.get(`/activity/unread-count`);
  },
};

export default activityApi;
