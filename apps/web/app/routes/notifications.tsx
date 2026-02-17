import type { MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, redirect } from "react-router";
import { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  DollarSign,
  MessageCircle,
  Star,
  AlertTriangle,
  Shield,
  Megaphone,
  Package,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { notificationsApi } from "~/lib/api/notifications";
import type { Notification } from "~/lib/api/notifications";
import { getUser } from "~/utils/auth";
import { toast } from "~/lib/toast";
import {
  Card,
  CardContent,
  Badge,
  UnifiedButton,
  Pagination,
  RouteErrorBoundary,
} from "~/components/ui";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Notifications | GharBatai Rentals" },
    { name: "description", content: "View your notifications" },
  ];
};

export async function clientLoader({ request }: { request: Request }) {
  const user = await getUser(request);
  if (!user) return redirect("/auth/login");

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const type = url.searchParams.get("type") || undefined;
  const unreadOnly = url.searchParams.get("unread") === "true";

  try {
    const [response, unreadCountRes] = await Promise.all([
      notificationsApi.getNotifications({ page, limit: 15, type, unreadOnly }),
      notificationsApi.getUnreadCount(),
    ]);

    const notifications = Array.isArray(response.notifications) ? response.notifications : [];
    const total = typeof response.total === "number" ? response.total : notifications.length;
    const totalPages = Math.ceil(total / 15);
    const unreadCount = typeof unreadCountRes === "number"
      ? unreadCountRes
      : typeof unreadCountRes === "object" && unreadCountRes !== null && "count" in unreadCountRes
        ? Number((unreadCountRes as { count: number }).count)
        : 0;

    return { notifications, totalPages, page, unreadCount, error: null };
  } catch (error) {
    console.error("[notifications] loader failed:", error);
    return {
      notifications: [],
      totalPages: 1,
      page: 1,
      unreadCount: 0,
      error: "Failed to load notifications",
    };
  }
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  BOOKING_REQUEST: Calendar,
  BOOKING_CONFIRMED: Check,
  BOOKING_CANCELLED: AlertTriangle,
  BOOKING_COMPLETED: CheckCheck,
  BOOKING_REMINDER: Calendar,
  PAYMENT_RECEIVED: DollarSign,
  PAYOUT_PROCESSED: DollarSign,
  MESSAGE_RECEIVED: MessageCircle,
  REVIEW_RECEIVED: Star,
  REVIEW_RESPONSE: Star,
  DISPUTE_OPENED: AlertTriangle,
  DISPUTE_RESOLVED: Shield,
  LISTING_APPROVED: Package,
  LISTING_REJECTED: AlertTriangle,
  ACCOUNT_VERIFIED: Shield,
  VERIFICATION_COMPLETE: Shield,
  PROMOTION: Megaphone,
  MARKETING: Megaphone,
  SYSTEM: Settings,
  SYSTEM_UPDATE: Settings,
  SYSTEM_ANNOUNCEMENT: Megaphone,
};

const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMM d, yyyy 'at' h:mm a");
};

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[notification.type] || Bell;
  const dateLabel = safeDateLabel(notification.createdAt);

  return (
    <Card
      className={cn(
        "transition-colors",
        !notification.read && "border-l-4 border-l-primary bg-primary/5"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              notification.read ? "bg-muted" : "bg-primary/10"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                notification.read ? "text-muted-foreground" : "text-primary"
              )}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={cn(
                  "text-sm",
                  notification.read ? "font-normal text-muted-foreground" : "font-semibold text-foreground"
                )}
              >
                {notification.title || notification.type.replace(/_/g, " ")}
              </h3>
              <span className="shrink-0 text-xs text-muted-foreground">{dateLabel}</span>
            </div>

            {notification.message && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {notification.message}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {!notification.read && (
              <button
                onClick={() => onMarkRead(notification.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Mark as read"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(notification.id)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const { notifications, totalPages, page, unreadCount, error } =
    useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [localUnread, setLocalUnread] = useState(unreadCount);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setLocalUnread((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setLocalUnread(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationsApi.deleteNotification(id);
      const removed = localNotifications.find((n) => n.id === id);
      setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.read) {
        setLocalUnread((prev) => Math.max(0, prev - 1));
      }
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const handleFilterUnread = () => {
    const params = new URLSearchParams(searchParams);
    if (params.get("unread") === "true") {
      params.delete("unread");
    } else {
      params.set("unread", "true");
    }
    params.delete("page");
    setSearchParams(params);
  };

  const isFilteringUnread = searchParams.get("unread") === "true";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {localUnread > 0 && (
            <Badge variant="destructive">{localUnread} unread</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <UnifiedButton
            variant={isFilteringUnread ? "default" : "outline"}
            size="sm"
            onClick={handleFilterUnread}
          >
            {isFilteringUnread ? "Show All" : "Unread Only"}
          </UnifiedButton>
          {localUnread > 0 && (
            <UnifiedButton
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              leftIcon={<CheckCheck className="h-4 w-4" />}
            >
              Mark All Read
            </UnifiedButton>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Notifications List */}
      {localNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold text-foreground">No notifications</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFilteringUnread
                ? "You're all caught up! No unread notifications."
                : "You don't have any notifications yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {localNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        className="mt-6"
      />
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
