import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ComponentType } from "react";
import { useLoaderData, Link, useSearchParams, redirect } from "react-router";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  DollarSign,
  Star,
  Eye,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import { analyticsApi } from "~/lib/api/analytics";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  RouteErrorBoundary,
} from "~/components/ui";
import { cn } from "~/lib/utils";
import { getUser } from "~/utils/auth";

export const meta: MetaFunction = () => {
  return [
    { title: "Performance Analytics | Owner Dashboard" },
    { name: "description", content: "Track your listing performance and metrics" },
  ];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ALLOWED_PERIODS = new Set(["7days", "30days", "90days", "year"]);

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/dashboard");
  }

  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period") || "30days";
  const period = ALLOWED_PERIODS.has(rawPeriod) ? rawPeriod : "30days";
  try {
    const rawMetrics = await analyticsApi.getPerformanceMetrics(period);
    const metrics = {
      overview: {
        totalViews: safeNumber(rawMetrics?.overview?.totalViews),
        viewsChange: safeNumber(rawMetrics?.overview?.viewsChange),
        totalBookings: safeNumber(rawMetrics?.overview?.totalBookings),
        bookingsChange: safeNumber(rawMetrics?.overview?.bookingsChange),
        conversionRate: safeNumber(rawMetrics?.overview?.conversionRate),
        conversionChange: safeNumber(rawMetrics?.overview?.conversionChange),
        averageRating: safeNumber(rawMetrics?.overview?.averageRating),
        ratingChange: safeNumber(rawMetrics?.overview?.ratingChange),
      },
      earnings: {
        total: safeNumber(rawMetrics?.earnings?.total),
        thisMonth: safeNumber(rawMetrics?.earnings?.thisMonth),
        lastMonth: safeNumber(rawMetrics?.earnings?.lastMonth),
        change: safeNumber(rawMetrics?.earnings?.change),
      },
      topListings: Array.isArray(rawMetrics?.topListings)
        ? rawMetrics.topListings.map((listing) => ({
            ...listing,
            views: safeNumber(listing.views),
            bookings: safeNumber(listing.bookings),
            revenue: safeNumber(listing.revenue),
            rating: safeNumber(listing.rating),
          }))
        : [],
      monthlyData: Array.isArray(rawMetrics?.monthlyData)
        ? rawMetrics.monthlyData.map((item) => ({
            ...item,
            revenue: safeNumber(item.revenue),
          }))
        : [],
      responseMetrics: {
        averageResponseTime: safeNumber(rawMetrics?.responseMetrics?.averageResponseTime),
        responseRate: safeNumber(rawMetrics?.responseMetrics?.responseRate),
        acceptanceRate: safeNumber(rawMetrics?.responseMetrics?.acceptanceRate),
      },
    };
    return { metrics, error: null, period };
  } catch (error: unknown) {
    return {
      metrics: null,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load performance data",
      period,
    };
  }
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  format = "number",
}: {
  title: string;
  value: number;
  change: number;
  icon: ComponentType<{ className?: string }>;
  format?: "number" | "currency" | "percent" | "rating";
}) {
  const safeValue = safeNumber(value);
  const safeChange = safeNumber(change);
  const isPositive = safeChange >= 0;
  const formattedValue = {
    number: safeValue.toLocaleString(),
    currency: `$${safeValue.toLocaleString()}`,
    percent: `${safeValue.toFixed(2)}%`,
    rating: safeValue.toFixed(1),
  }[format];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            isPositive ? "text-success" : "text-destructive"
          )}>
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(safeChange).toFixed(1)}%
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground">{formattedValue}</p>
      </CardContent>
    </Card>
  );
}

export default function OwnerPerformancePage() {
  const { metrics, error, period } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPeriod, setSelectedPeriod] = useState(period || "30days");

  if (error || !metrics) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error || "Failed to load performance data"}
          </div>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...metrics.monthlyData.map(d => d.revenue), 1);
  const earningsChange = safeNumber(metrics.earnings.change);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/owner" className="text-muted-foreground hover:text-foreground">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
            </div>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                const value = e.target.value;
                if (!ALLOWED_PERIODS.has(value)) {
                  return;
                }
                setSelectedPeriod(value);
                const params = new URLSearchParams(searchParams);
                params.set("period", value);
                setSearchParams(params);
              }}
              className="px-3 py-2 border border-input rounded-lg bg-background text-sm"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Views"
            value={metrics.overview.totalViews}
            change={metrics.overview.viewsChange}
            icon={Eye}
          />
          <MetricCard
            title="Total Bookings"
            value={metrics.overview.totalBookings}
            change={metrics.overview.bookingsChange}
            icon={Calendar}
          />
          <MetricCard
            title="Conversion Rate"
            value={metrics.overview.conversionRate}
            change={metrics.overview.conversionChange}
            icon={TrendingUp}
            format="percent"
          />
          <MetricCard
            title="Average Rating"
            value={metrics.overview.averageRating}
            change={metrics.overview.ratingChange}
            icon={Star}
            format="rating"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Revenue Trend
                </CardTitle>
                <CardDescription>Monthly revenue over the past 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end gap-4">
                  {metrics.monthlyData.map((data) => (
                    <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-primary/80 hover:bg-primary rounded-t transition-colors"
                        style={{
                          height: `${Math.min(
                            Math.max((safeNumber(data.revenue) / maxRevenue) * 200, 0),
                            200
                          )}px`,
                        }}
                      />
                      <span className="text-xs text-muted-foreground">{data.month}</span>
                      <span className="text-xs font-medium">
                        ${(safeNumber(data.revenue) / 1000).toFixed(1)}k
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Listings Table */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Listings</CardTitle>
                <CardDescription>Your best performing listings by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Listing</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Views</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Bookings</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Revenue</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topListings.map((listing) => (
                        <tr key={listing.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <Link to={`/listings/${listing.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                              {listing.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                            {listing.views.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                            {listing.bookings}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                            ${listing.revenue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              {listing.rating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Earnings Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Earnings Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">Total Earnings</span>
                  <span className="text-xl font-bold text-foreground">
                    ${metrics.earnings.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-semibold text-success">
                    ${metrics.earnings.thisMonth.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Last Month</span>
                  <span className="font-semibold text-foreground">
                    ${metrics.earnings.lastMonth.toLocaleString()}
                  </span>
                </div>
                <div className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg",
                  earningsChange >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}>
                  {earningsChange >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(earningsChange).toFixed(1)}% vs last month
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Response Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Response Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Response Time</span>
                    <span className="text-sm font-medium">
                      {safeNumber(metrics.responseMetrics.averageResponseTime)} hrs
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-success h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          Math.max(
                            ((24 - safeNumber(metrics.responseMetrics.averageResponseTime)) /
                              24) *
                              100,
                            0
                          ),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Response Rate</span>
                    <span className="text-sm font-medium">
                      {safeNumber(metrics.responseMetrics.responseRate)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-info h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          Math.max(safeNumber(metrics.responseMetrics.responseRate), 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Acceptance Rate</span>
                    <span className="text-sm font-medium">
                      {safeNumber(metrics.responseMetrics.acceptanceRate)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          Math.max(safeNumber(metrics.responseMetrics.acceptanceRate), 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Performance Tip</h4>
                    <p className="text-sm text-muted-foreground">
                      Listings with response times under 1 hour get 40% more bookings. Try to respond to inquiries quickly!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

