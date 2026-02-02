import { formatDistanceToNow } from "date-fns";
import {
  User,
  Package,
  Calendar,
  DollarSign,
  AlertTriangle,
  Star,
  CheckCircle,
  XCircle,
  MessageSquare,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

export interface ActivityItem {
  id: string;
  type: "user" | "listing" | "booking" | "payment" | "dispute" | "review" | "system";
  action: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
  link?: string;
  severity?: "info" | "success" | "warning" | "error";
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
  maxItems?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

const typeConfig: Record<
  ActivityItem["type"],
  { icon: LucideIcon; color: string }
> = {
  user: { icon: User, color: "text-blue-500 bg-blue-100" },
  listing: { icon: Package, color: "text-purple-500 bg-purple-100" },
  booking: { icon: Calendar, color: "text-green-500 bg-green-100" },
  payment: { icon: DollarSign, color: "text-emerald-500 bg-emerald-100" },
  dispute: { icon: AlertTriangle, color: "text-orange-500 bg-orange-100" },
  review: { icon: Star, color: "text-yellow-500 bg-yellow-100" },
  system: { icon: Shield, color: "text-gray-500 bg-gray-100" },
};

const severityColors: Record<string, string> = {
  info: "border-l-blue-500",
  success: "border-l-green-500",
  warning: "border-l-orange-500",
  error: "border-l-red-500",
};

export function ActivityFeed({
  activities,
  className,
  maxItems = 10,
  showViewAll = true,
  onViewAll,
}: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className={cn("space-y-4", className)}>
      {displayActivities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayActivities.map((activity) => (
            <ActivityItemCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {showViewAll && activities.length > maxItems && (
        <button
          onClick={onViewAll}
          className="w-full text-center text-sm text-primary hover:text-primary/80 font-medium py-2"
        >
          View all {activities.length} activities →
        </button>
      )}
    </div>
  );
}

function ActivityItemCard({ activity }: { activity: ActivityItem }) {
  const config = typeConfig[activity.type] || typeConfig.system;
  const Icon = config.icon;
  const severityColor = activity.severity
    ? severityColors[activity.severity]
    : "";

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
        severityColor && `border-l-4 ${severityColor}`
      )}
    >
      <div className={cn("p-2 rounded-full shrink-0", config.color)}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">
              {activity.action}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {activity.description}
            </p>
          </div>
          {activity.user?.avatar ? (
            <img
              src={activity.user.avatar}
              alt={activity.user.name}
              className="w-8 h-8 rounded-full"
            />
          ) : activity.user ? (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {activity.user.name.charAt(0)}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.timestamp), {
              addSuffix: true,
            })}
          </span>
          {activity.user && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {activity.user.name}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (activity.link) {
    return (
      <a href={activity.link} className="block">
        {content}
      </a>
    );
  }

  return content;
}
