import { getUserToken } from "~/utils/auth.server";

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

const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

const RANGE_MULTIPLIERS: Record<AnalyticsRange, number> = {
  "7d": 0.25,
  "30d": 1,
  "90d": 2.4,
  "365d": 10,
};

async function fetchAnalyticsFromApi(
  request: Request,
  range: AnalyticsRange
): Promise<AdminAnalyticsPayload | null> {
  try {
    const token = await getUserToken(request);
    if (!token) return null;

    const response = await fetch(
      `${API_BASE_URL}/admin/analytics/summary?range=${range}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.warn("Analytics API responded with status", response.status);
      return null;
    }

    const data = (await response.json()) as AdminAnalyticsPayload;
    if (!data?.summary?.kpis?.length) {
      console.warn("Analytics API payload missing KPIs");
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to fetch analytics data", error);
    return null;
  }
}

function buildMockAnalytics(range: AnalyticsRange): AdminAnalyticsPayload {
  const multiplier = RANGE_MULTIPLIERS[range] ?? 1;
  const baseRevenue = 425000 * multiplier;
  const gross = baseRevenue;
  const net = Math.round(baseRevenue * 0.18);

  const kpis: AnalyticsKpi[] = [
    {
      id: "activeUsers",
      label: "Active users",
      value: Math.round(8200 * multiplier),
      change: 8.4,
      trend: "up",
      unit: "count",
      description: "Users that logged in during the selected window",
    },
    {
      id: "listings",
      label: "Listings live",
      value: Math.round(3100 * multiplier * 0.2),
      change: 3.1,
      trend: "up",
      unit: "count",
      description: "Approved listings currently visible",
    },
    {
      id: "bookings",
      label: "Bookings in flight",
      value: Math.round(1420 * multiplier),
      change: -4.2,
      trend: "down",
      unit: "count",
      description: "Open bookings awaiting action",
    },
    {
      id: "revenue",
      label: "Gross revenue",
      value: gross,
      change: 12.6,
      trend: "up",
      unit: "currency",
      description: "Total transaction value before fees",
    },
  ];

  const trends: AnalyticsTrendPoint[] = Array.from({ length: 12 }).map(
    (_, index) => {
      const bookings = 80 * multiplier + index * 5 * multiplier;
      const revenuePoint = gross / 12 + index * 4500 * multiplier;
      const cancellations = 5 * multiplier + (index % 3) * 2;
      return {
        date: new Date(Date.now() - (11 - index) * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        bookings: Math.round(bookings),
        revenue: Math.round(revenuePoint),
        cancellations: Math.round(cancellations),
      };
    }
  );

  const funnel: AnalyticsFunnelStage[] = [
    {
      id: "visits",
      label: "Marketplace sessions",
      value: Math.round(180000 * multiplier),
      conversion: 100,
      delta: 4.1,
    },
    {
      id: "searches",
      label: "Qualified searches",
      value: Math.round(64000 * multiplier),
      conversion: 35,
      delta: 2.3,
    },
    {
      id: "inquiries",
      label: "Listing inquiries",
      value: Math.round(18400 * multiplier),
      conversion: 10,
      delta: 1.1,
    },
    {
      id: "bookings",
      label: "Confirmed bookings",
      value: Math.round(6100 * multiplier),
      conversion: 3.4,
      delta: -0.4,
    },
  ];

  const regions: AnalyticsRegionStat[] = [
    {
      region: "California",
      bookings: Math.round(1870 * multiplier),
      change: 6.2,
      revenueShare: 32,
    },
    {
      region: "New York",
      bookings: Math.round(1320 * multiplier),
      change: 4.4,
      revenueShare: 22,
    },
    {
      region: "Texas",
      bookings: Math.round(980 * multiplier),
      change: -1.8,
      revenueShare: 14,
    },
    {
      region: "Florida",
      bookings: Math.round(760 * multiplier),
      change: 2.5,
      revenueShare: 9,
    },
    {
      region: "International",
      bookings: Math.round(540 * multiplier),
      change: 8.1,
      revenueShare: 7,
    },
  ];

  const topCategories: AnalyticsCategoryStat[] = [
    {
      category: "Luxury homes",
      bookings: Math.round(420 * multiplier),
      revenue: Math.round(215000 * multiplier),
      change: 5.4,
      fulfillmentTime: 18,
    },
    {
      category: "Vehicles",
      bookings: Math.round(380 * multiplier),
      revenue: Math.round(162000 * multiplier),
      change: 3.3,
      fulfillmentTime: 6,
    },
    {
      category: "Events",
      bookings: Math.round(310 * multiplier),
      revenue: Math.round(94000 * multiplier),
      change: -1.2,
      fulfillmentTime: 4,
    },
    {
      category: "Equipment",
      bookings: Math.round(280 * multiplier),
      revenue: Math.round(72000 * multiplier),
      change: 2.1,
      fulfillmentTime: 3,
    },
  ];

  const alerts: AnalyticsAlert[] = [
    {
      id: "disputes",
      severity: "warning",
      title: "Disputes trending up",
      description: "Open disputes grew 14% WoW — review moderation backlog.",
      impact: "14 open cases",
      action: { label: "View disputes", to: "/admin/disputes" },
    },
    {
      id: "supply",
      severity: "info",
      title: "Owner activation dip",
      description:
        "New owner onboarding conversion dropped 6% after new KYC step.",
      impact: "-6% conversion",
      action: { label: "Review onboarding", to: "/admin/analytics/users" },
    },
    {
      id: "payouts",
      severity: "critical",
      title: "Delayed payouts",
      description: "$82K awaiting compliance review for more than 48 hours.",
      impact: "$82K paused",
      action: { label: "Open payouts", to: "/admin/payments/payouts" },
    },
  ];

  const channels: AnalyticsChannelStat[] = [
    { channel: "Organic", contribution: 42, change: 5.2 },
    { channel: "Paid search", contribution: 24, change: -1.4 },
    { channel: "Partnerships", contribution: 18, change: 3.8 },
    { channel: "Referrals", contribution: 9, change: 2.1 },
    { channel: "Email", contribution: 7, change: 0.6 },
  ];

  const userSegments: AnalyticsUserSegment[] = [
    {
      segment: "Power renters",
      count: Math.round(920 * multiplier),
      change: 6.2,
      retention: 88,
    },
    {
      segment: "Owners",
      count: Math.round(640 * multiplier),
      change: 3.4,
      retention: 76,
    },
    {
      segment: "New renters",
      count: Math.round(2100 * multiplier),
      change: 12.3,
      retention: 41,
    },
    {
      segment: "Dormant",
      count: Math.round(1800 * multiplier),
      change: -4.8,
      retention: 9,
    },
  ];

  return {
    range,
    generatedAt: new Date().toISOString(),
    summary: {
      kpis,
      bookings: {
        total: Math.round(6100 * multiplier),
        confirmed: Math.round(4820 * multiplier),
        cancelled: Math.round(680 * multiplier),
        disputes: Math.round(54 * multiplier),
        avgDurationDays: 4.6,
      },
      revenue: {
        gross,
        net,
        takeRate: 18.2,
        payoutVolume: Math.round(gross * 0.78),
      },
      operations: {
        openDisputes: Math.round(54 * multiplier),
        moderationBacklog: Math.round(32 * multiplier),
        supportSla: 2.6,
        fraudSignals: Math.round(11 * multiplier),
      },
    },
    trends,
    funnel,
    regions,
    topCategories,
    alerts,
    channels,
    userSegments,
  };
}

export async function getAdminAnalytics(
  request: Request,
  range: AnalyticsRange = "30d"
): Promise<AdminAnalyticsPayload> {
  const apiData = await fetchAnalyticsFromApi(request, range);
  if (apiData) {
    return apiData;
  }
  return buildMockAnalytics(range);
}
