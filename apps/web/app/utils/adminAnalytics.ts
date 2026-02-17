import { adminApi } from "~/lib/api/admin";

type AnalyticsTrendDirection = "up" | "down" | "flat";

export type AnalyticsRange = "7d" | "30d" | "90d" | "365d";

export interface AnalyticsKpi {
  id: string;
  label: string;
  value: number;
  change: number;
  trend: AnalyticsTrendDirection;
  unit: "count" | "currency" | "percent";
  description: string;
}

export interface AnalyticsTrendPoint {
  date: string;
  bookings: number;
  revenue: number;
  cancellations: number;
}

export interface AnalyticsFunnelStage {
  id: string;
  label: string;
  value: number;
  conversion: number;
  delta: number;
}

export interface AnalyticsRegionStat {
  region: string;
  bookings: number;
  change: number;
  revenueShare: number;
}

export interface AnalyticsCategoryStat {
  category: string;
  bookings: number;
  revenue: number;
  change: number;
  fulfillmentTime: number;
}

export interface AnalyticsAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  impact: string;
  action?: {
    label: string;
    to: string;
  };
}

export interface AnalyticsChannelStat {
  channel: string;
  contribution: number;
  change: number;
}

export interface AnalyticsUserSegment {
  segment: string;
  count: number;
  change: number;
  retention: number;
}

export interface AdminAnalyticsPayload {
  range: AnalyticsRange;
  generatedAt: string;
  summary: {
    kpis: AnalyticsKpi[];
    bookings: {
      total: number;
      confirmed: number;
      cancelled: number;
      disputes: number;
      avgDurationDays: number;
    };
    revenue: {
      gross: number;
      net: number;
      takeRate: number;
      payoutVolume: number;
    };
    operations: {
      openDisputes: number;
      moderationBacklog: number;
      supportSla: number;
      fraudSignals: number;
    };
  };
  trends: AnalyticsTrendPoint[];
  funnel: AnalyticsFunnelStage[];
  regions: AnalyticsRegionStat[];
  topCategories: AnalyticsCategoryStat[];
  alerts: AnalyticsAlert[];
  channels: AnalyticsChannelStat[];
  userSegments: AnalyticsUserSegment[];
}

function rangeToAnalyticsParams(range: AnalyticsRange): {
  period?: "day" | "week" | "month" | "year";
  startDate?: string;
  endDate?: string;
} {
  const now = new Date();
  const endDate = now.toISOString();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  const startDate = start.toISOString();

  if (range === "7d") return { period: "week" };
  if (range === "30d") return { period: "month" };
  if (range === "365d") return { period: "year" };
  return { startDate, endDate };
}

export async function getAdminAnalytics(
  _request: Request,
  range: AnalyticsRange = "30d"
): Promise<AdminAnalyticsPayload> {
  const params = rangeToAnalyticsParams(range);
  const [dashboard, analytics] = await Promise.all([
    adminApi.getDashboardStats(),
    adminApi.getAnalytics(params),
  ]);

  const safeNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

  const userGrowth = asArray<{ date?: string; count?: number }>(analytics?.userGrowth);
  const bookingTrends = asArray<{ date?: string; count?: number; revenue?: number }>(
    analytics?.bookingTrends
  );
  const revenueByCategory = asArray<{ category?: string; revenue?: number }>(
    analytics?.revenueByCategory
  );

  const newUsers = userGrowth.reduce((sum, p) => sum + safeNumber(p?.count), 0);
  const totalBookings = bookingTrends.reduce((sum, p) => sum + safeNumber(p?.count), 0);
  const grossRevenue = bookingTrends.reduce((sum, p) => sum + safeNumber(p?.revenue), 0);

  const activeListings = safeNumber(
    (dashboard as { activeListings?: unknown }).activeListings ??
      (dashboard as { listings?: { active?: unknown } }).listings?.active
  );
  const pendingBookings = safeNumber(
    (dashboard as { pendingBookings?: unknown }).pendingBookings
  );
  const pendingDisputes = safeNumber(
    (dashboard as { pendingDisputes?: unknown }).pendingDisputes ??
      (dashboard as { disputes?: { pending?: unknown } }).disputes?.pending
  );
  const flaggedContent = safeNumber(
    (dashboard as { flaggedContent?: unknown }).flaggedContent
  );

  const kpis: AnalyticsKpi[] = [
    {
      id: "activeUsers",
      label: "New users",
      value: newUsers,
      change: 0,
      trend: "flat",
      unit: "count",
      description: "New users in the selected window",
    },
    {
      id: "listings",
      label: "Listings live",
      value: activeListings,
      change: 0,
      trend: "flat",
      unit: "count",
      description: "Approved listings currently visible",
    },
    {
      id: "bookings",
      label: "Bookings pending",
      value: pendingBookings,
      change: 0,
      trend: "flat",
      unit: "count",
      description: "Bookings awaiting action",
    },
    {
      id: "revenue",
      label: "Gross revenue",
      value: grossRevenue,
      change: 0,
      trend: "flat",
      unit: "currency",
      description: "Total transaction value in the selected window",
    },
    {
      id: "disputes",
      label: "Active disputes",
      value: pendingDisputes,
      change: 0,
      trend: "flat",
      unit: "count",
      description: "Disputes requiring review",
    },
  ];

  const trends: AnalyticsTrendPoint[] = bookingTrends.map((p) => ({
    date: p.date?.slice(0, 10) ?? "",
    bookings: safeNumber(p.count),
    revenue: safeNumber(p.revenue),
    cancellations: 0,
  }));

  const topCategories: AnalyticsCategoryStat[] = revenueByCategory.map((c) => ({
    category: c.category || "Uncategorized",
    bookings: 0,
    revenue: safeNumber(c.revenue),
    change: 0,
    fulfillmentTime: 0,
  }));

  const alerts: AnalyticsAlert[] = [];
  if (pendingDisputes > 0) {
    alerts.push({
      id: "disputes",
      severity: "warning",
      title: "Pending disputes",
      description: "There are disputes requiring review.",
      impact: `${pendingDisputes} pending`,
      action: { label: "View disputes", to: "/admin/disputes" },
    });
  }
  if (flaggedContent > 0) {
    alerts.push({
      id: "flagged",
      severity: "info",
      title: "Flagged content",
      description: "Content is flagged and may need moderation.",
      impact: `${flaggedContent} flagged`,
      action: { label: "Review listings", to: "/admin/listings" },
    });
  }

  return {
    range,
    generatedAt: new Date().toISOString(),
    summary: {
      kpis,
      bookings: {
        total: totalBookings,
        confirmed: totalBookings,
        cancelled: 0,
        disputes: pendingDisputes,
        avgDurationDays: 0,
      },
      revenue: {
        gross: grossRevenue,
        net: grossRevenue,
        takeRate: 0,
        payoutVolume: 0,
      },
      operations: {
        openDisputes: pendingDisputes,
        moderationBacklog: flaggedContent,
        supportSla: 0,
        fraudSignals: 0,
      },
    },
    trends,
    funnel: [],
    regions: [],
    topCategories,
    alerts,
    channels: [],
    userSegments: [],
  };
}
