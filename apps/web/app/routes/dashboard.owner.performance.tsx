import type { MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  DollarSign,
  Star,
  Users,
  Eye,
  Package,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import { analyticsApi, type PerformanceMetrics } from "~/lib/api/analytics";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui";
import { UnifiedButton } from "~/components/ui";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Performance Analytics | Owner Dashboard" },
    { name: "description", content: "Track your listing performance and metrics" },
  ];
};

export async function clientLoader() {
  try {
    const metrics = await analyticsApi.getPerformanceMetrics();
    return { metrics, error: null };
  } catch (error: any) {
    return {
      metrics: null,
      error: error?.message || "Failed to load performance data",
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
  icon: any;
  format?: "number" | "currency" | "percent" | "rating";
}) {
  const isPositive = change >= 0;
  const formattedValue = {
    number: value.toLocaleString(),
    currency: `$${value.toLocaleString()}`,
    percent: `${value.toFixed(2)}%`,
    rating: value.toFixed(1),
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
            isPositive ? "text-green-600" : "text-red-600"
          )}>
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(change).toFixed(1)}%
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground">{formattedValue}</p>
      </CardContent>
    </Card>
  );
}

export default function OwnerPerformancePage() {
  const { metrics, error } = useLoaderData<typeof clientLoader>();
  const [selectedPeriod, setSelectedPeriod] = useState("30days");

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

  const maxRevenue = Math.max(...metrics.monthlyData.map(d => d.revenue));

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
              onChange={(e) => setSelectedPeriod(e.target.value)}
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
                        style={{ height: `${(data.revenue / maxRevenue) * 200}px` }}
                      />
                      <span className="text-xs text-muted-foreground">{data.month}</span>
                      <span className="text-xs font-medium">${(data.revenue / 1000).toFixed(1)}k</span>
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
                  <span className="font-semibold text-green-600">
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
                  metrics.earnings.change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  {metrics.earnings.change >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(metrics.earnings.change).toFixed(1)}% vs last month
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
                    <span className="text-sm font-medium">{metrics.responseMetrics.averageResponseTime} hrs</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.min((24 - metrics.responseMetrics.averageResponseTime) / 24 * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Response Rate</span>
                    <span className="text-sm font-medium">{metrics.responseMetrics.responseRate}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${metrics.responseMetrics.responseRate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Acceptance Rate</span>
                    <span className="text-sm font-medium">{metrics.responseMetrics.acceptanceRate}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${metrics.responseMetrics.acceptanceRate}%` }}
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
