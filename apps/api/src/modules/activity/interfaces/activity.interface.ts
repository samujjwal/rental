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
