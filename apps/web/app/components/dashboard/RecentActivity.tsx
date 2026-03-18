import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  CreditCard, 
  Package, 
  MessageSquare, 
  Star, 
  Heart, 
  AlertTriangle, 
  User, 
  Clock,
  TrendingUp,
  Shield,
  ArrowRight,
  RefreshCw,
  MoreHorizontal
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { activityApi, type ActivityItem, type ActivityType } from "~/lib/api/activity";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "~/components/ui";
import { cn } from "~/lib/utils";
import { toast } from "~/lib/toast";

const ACTIVITY_CONFIG: Record<ActivityType, { 
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "success" | "warning" | "destructive" | "info";
  color: string;
  actionText?: string;
  getActionUrl?: (activity: ActivityItem) => string;
}> = {
  booking_created: { 
    icon: Calendar, 
    variant: "default", 
    color: "text-blue-500",
    actionText: "View Details",
    getActionUrl: (activity) => `/bookings/${activity.entityId}`
  },
  booking_confirmed: { 
    icon: CheckCircle, 
    variant: "success", 
    color: "text-green-500",
    actionText: "View Booking",
    getActionUrl: (activity) => `/bookings/${activity.entityId}`
  },
  booking_cancelled: { 
    icon: XCircle, 
    variant: "destructive", 
    color: "text-red-500",
    actionText: "View Details",
    getActionUrl: (activity) => `/bookings/${activity.entityId}`
  },
  booking_completed: { 
    icon: CheckCircle, 
    variant: "success", 
    color: "text-green-500",
    actionText: "Leave Review",
    getActionUrl: (activity) => `/bookings/${activity.entityId}`
  },
  payment_processed: { 
    icon: CreditCard, 
    variant: "success", 
    color: "text-green-500",
    actionText: "View Receipt",
    getActionUrl: (activity) => `/bookings/${activity.entityId}`
  },
  payment_failed: { 
    icon: XCircle, 
    variant: "destructive", 
    color: "text-red-500",
    actionText: "Retry Payment",
    getActionUrl: (activity) => `/checkout/${activity.entityId}`
  },
  listing_created: { 
    icon: Package, 
    variant: "success", 
    color: "text-green-500",
    actionText: "View Listing",
    getActionUrl: (activity) => `/listings/${activity.entityId}`
  },
  listing_updated: { 
    icon: Package, 
    variant: "default", 
    color: "text-blue-500",
    actionText: "View Changes",
    getActionUrl: (activity) => `/listings/${activity.entityId}`
  },
  listing_viewed: { 
    icon: TrendingUp, 
    variant: "info", 
    color: "text-purple-500",
    actionText: "View Listing",
    getActionUrl: (activity) => `/listings/${activity.entityId}`
  },
  message_sent: { 
    icon: MessageSquare, 
    variant: "default", 
    color: "text-blue-500",
    actionText: "View Message",
    getActionUrl: (activity) => `/messages${activity.entityId ? `/${activity.entityId}` : ''}`
  },
  message_received: { 
    icon: MessageSquare, 
    variant: "info", 
    color: "text-blue-500",
    actionText: "Reply",
    getActionUrl: (activity) => `/messages${activity.entityId ? `/${activity.entityId}` : ''}`
  },
  review_submitted: { 
    icon: Star, 
    variant: "success", 
    color: "text-yellow-500",
    actionText: "View Review",
    getActionUrl: (activity) => `/reviews/${activity.entityId}`
  },
  review_received: { 
    icon: Star, 
    variant: "warning", 
    color: "text-yellow-500",
    actionText: "View Review",
    getActionUrl: (activity) => `/reviews/${activity.entityId}`
  },
  favorite_added: { 
    icon: Heart, 
    variant: "default", 
    color: "text-pink-500",
    actionText: "View Listing",
    getActionUrl: (activity) => `/listings/${activity.entityId}`
  },
  favorite_removed: { 
    icon: Heart, 
    variant: "default", 
    color: "text-gray-500"
  },
  dispute_filed: { 
    icon: AlertTriangle, 
    variant: "warning", 
    color: "text-orange-500",
    actionText: "View Dispute",
    getActionUrl: (activity) => `/disputes/${activity.entityId}`
  },
  dispute_resolved: { 
    icon: CheckCircle, 
    variant: "success", 
    color: "text-green-500",
    actionText: "View Resolution",
    getActionUrl: (activity) => `/disputes/${activity.entityId}`
  },
  user_login: { 
    icon: User, 
    variant: "info", 
    color: "text-gray-500"
  },
  user_profile_updated: { 
    icon: User, 
    variant: "default", 
    color: "text-blue-500",
    actionText: "View Profile",
    getActionUrl: (activity) => `/profile/${activity.entityId}`
  },
  insurance_purchased: { 
    icon: Shield, 
    variant: "success", 
    color: "text-green-500",
    actionText: "View Insurance",
    getActionUrl: (activity) => `/insurance/${activity.entityId}`
  },
  insurance_expiring: { 
    icon: Shield, 
    variant: "warning", 
    color: "text-orange-500",
    actionText: "Renew Insurance",
    getActionUrl: (activity) => `/insurance/${activity.entityId}`
  },
  payout_processed: { 
    icon: CreditCard, 
    variant: "success", 
    color: "text-green-500",
    actionText: "View Earnings",
    getActionUrl: (activity) => "/dashboard/owner/earnings"
  },
  refund_processed: { 
    icon: CreditCard, 
    variant: "default", 
    color: "text-blue-500",
    actionText: "View Refund",
    getActionUrl: (activity) => `/bookings/${activity.entityId}`
  },
};

function ActivityItemComponent({ activity }: { activity: ActivityItem }) {
  const { t } = useTranslation();
  const config = ACTIVITY_CONFIG[activity.type];
  const Icon = config.icon;
  
  const formattedTime = format(new Date(activity.timestamp), "MMM d, h:mm a");
  const actionUrl = config.getActionUrl?.(activity) || activity.link;
  const actionText = config.actionText || t("activity.viewDetails", "View details");
  
  return (
    <div className={cn("flex gap-3 p-3 rounded-lg hover:bg-accent transition-colors")} data-testid="activity-item">
      {/* Icon */}
      <div className={cn("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-muted", config.color)}>
        <Icon className="w-5 h-5" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm line-clamp-1">
              {activity.title}
            </p>
            {activity.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {activity.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground" data-testid="activity-timestamp">{formattedTime}</span>
              {activity.actor && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{activity.actor.name}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Enhanced Action Button */}
          {actionUrl && (
            <Link 
              to={actionUrl}
              data-testid="activity-action-button"
              aria-label={`${actionText} for ${activity.title}`}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {actionText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

interface RecentActivityProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
  showViewAll?: boolean;
  emptyState?: "default" | "compact" | "hidden";
}

export function RecentActivity({ 
  className, 
  limit = 10,
  showHeader = true,
  showViewAll = true,
  emptyState = "default"
}: RecentActivityProps) {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await activityApi.getDashboardActivity(limit);
      setActivities(response.activities);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(t("activity.failedToLoad", "Failed to load recent activity"));
      console.error("Failed to load recent activity:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [limit]);

  const handleRefresh = () => {
    fetchActivities();
    toast.success(t("activity.refreshed", "Activity feed refreshed"));
  };

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center justify-between" data-testid="activity-header">
            <CardTitle>{t("dashboard.recentActivity", "Recent Activity")}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3" data-testid="activity-loading">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.recentActivity", "Recent Activity")}</CardTitle>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              title={t("common.refresh", "Refresh")}
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={handleRefresh}
              data-testid="activity-retry-button"
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {t("common.retry", "Retry")}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (activities.length === 0) {
    if (emptyState === "hidden") return null;
    
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.recentActivity", "Recent Activity")}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className={cn(
            "text-center",
            emptyState === "compact" ? "py-4" : "py-12"
          )}>
            <Clock className={cn(
              "text-muted-foreground mx-auto mb-3",
              emptyState === "compact" ? "w-8 h-8" : "w-12 h-12"
            )} />
            <p className={cn(
              "text-muted-foreground",
              emptyState === "compact" ? "text-sm" : ""
            )}>
              {t("dashboard.noRecentActivity", "No recent activity")}
            </p>
            {emptyState !== "compact" && (
              <p className="text-sm text-muted-foreground mt-1">
                {t("dashboard.getStartedHint", "Get started by searching for items to rent or listing your own")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Activity list
  return (
    <Card className={className} data-testid="recent-activity" data-real-time-enabled="true">
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between" data-testid="activity-header">
          <div className="flex items-center gap-3">
            <CardTitle>{t("dashboard.recentActivity", "Recent Activity")}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {activities.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              title={t("common.refresh", "Refresh")}
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
            {showViewAll && hasMore && (
              <Link
                to="/activity"
                data-testid="activity-view-all"
                className="text-sm text-primary hover:text-primary/90 font-medium flex items-center ml-2"
              >
                {t("common.viewAll")}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={showHeader ? "" : "pt-6"}>
        <div className="space-y-1">
          {activities.map((activity) => (
            <ActivityItemComponent key={activity.id} activity={activity} />
          ))}
        </div>
        
        {hasMore && showViewAll && (
          <div className="mt-4 pt-4 border-t text-center">
            <Link
              to="/activity"
              className="text-sm text-primary hover:text-primary/90 font-medium inline-flex items-center"
            >
              {t("activity.viewAllActivity", "View all activity")}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentActivity;
