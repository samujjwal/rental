import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ComponentType } from "react";
import { useLoaderData, Link, useSearchParams, redirect, useLocation, useRevalidator } from "react-router";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Banknote,
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
  UnifiedButton,
  RouteErrorBoundary,
} from "~/components/ui";
import { PortalPageLayout } from "~/components/layout";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { getUser } from "~/utils/auth";
import { APP_LOCALE } from "~/config/locale";
import { ownerNavSections } from "~/config/navigation";
import { useTranslation } from "react-i18next";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "Performance Analytics | Owner Dashboard" },
    {
      name: "description",
      content: "Track your listing performance and metrics",
    },
  ];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getOwnerPerformanceLoadError(error: unknown): string {
  return getActionableErrorMessage(error, "Failed to load performance data", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading performance data timed out. Try again.",
  });
}

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
        averageResponseTime: safeNumber(
          rawMetrics?.responseMetrics?.averageResponseTime
        ),
        responseRate: safeNumber(rawMetrics?.responseMetrics?.responseRate),
        acceptanceRate: safeNumber(rawMetrics?.responseMetrics?.acceptanceRate),
      },
    };
    return { metrics, error: null, period };
  } catch (error: unknown) {
    return {
      metrics: null,
      error: getOwnerPerformanceLoadError(error),
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
    number: safeValue.toLocaleString(APP_LOCALE),
    currency: formatCurrency(safeValue),
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
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              isPositive ? "text-success" : "text-destructive"
            )}
          >
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
  const { t } = useTranslation();
  const { metrics, error, period } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPeriod, setSelectedPeriod] = useState(period || "30days");
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const maxRevenue = Math.max(
    ...(metrics?.monthlyData.map((data) => data.revenue) ?? [0]),
    1
  );
  const earningsChange = safeNumber(metrics?.earnings.change);

  const analyticsNav = (
    <div className="flex gap-1 border-b border-border -mb-4">
      {([
        { to: '/dashboard/owner/earnings', label: 'Earnings' },
        { to: '/dashboard/owner/performance', label: 'Performance' },
        { to: '/dashboard/owner/insights', label: 'Insights' },
      ] as const).map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
            pathname === to
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  return (
    <PortalPageLayout
      title={t("dashboard.performance.title")}
      description="Track your listing performance and metrics"
      sidebarSections={ownerNavSections}
      banner={
        error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p>{error}</p>
              <UnifiedButton type="button" variant="outline" onClick={() => revalidate()}>
                Try Again
              </UnifiedButton>
            </div>
          </div>
        ) : null
      }
      actions={
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
          className="w-full min-w-0 px-3 py-2 border border-input rounded-lg bg-background text-sm sm:w-auto sm:min-w-[11rem]"
        >
          <option value="7days">{t("dashboard.performance.last7Days")}</option>
          <option value="30days">
            {t("dashboard.performance.last30Days")}
          </option>
          <option value="90days">
            {t("dashboard.performance.last90Days")}
          </option>
          <option value="year">{t("dashboard.performance.thisYear")}</option>
        </select>
      }
      contentClassName="space-y-8"
    >
      {/* Analytics cross-nav */}
      {analyticsNav}

      {metrics ? (
        <>
          {/* Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title={t("dashboard.performance.totalViews")}
              value={metrics.overview.totalViews}
              change={metrics.overview.viewsChange}
              icon={Eye}
            />
            <MetricCard
              title={t("dashboard.performance.totalBookings")}
              value={metrics.overview.totalBookings}
              change={metrics.overview.bookingsChange}
              icon={Calendar}
            />
            <MetricCard
              title={t("dashboard.performance.conversionRate")}
              value={metrics.overview.conversionRate}
              change={metrics.overview.conversionChange}
              icon={TrendingUp}
              format="percent"
            />
            <MetricCard
              title={t("dashboard.performance.averageRating")}
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
                    {t("dashboard.performance.revenueTrend")}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.performance.revenueTrendDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-end gap-4">
                    {metrics.monthlyData.map((data) => (
                      <div
                        key={data.month}
                        className="flex-1 flex flex-col items-center gap-2"
                      >
                        <div
                          className="w-full bg-primary/80 hover:bg-primary rounded-t transition-colors"
                          style={{
                            height: `${Math.min(
                              Math.max(
                                (safeNumber(data.revenue) / maxRevenue) * 200,
                                0
                              ),
                              200
                            )}px`,
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {data.month}
                        </span>
                        <span className="text-xs font-medium">
                          {formatCurrency(safeNumber(data.revenue) / 1000)}k
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Listings Table */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("dashboard.performance.topListings")}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.performance.topListingsDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                            {t("dashboard.performance.listing")}
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                            {t("dashboard.performance.views")}
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                            {t("dashboard.performance.bookings")}
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                            {t("dashboard.performance.revenue")}
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                            {t("dashboard.performance.rating")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.topListings.map((listing) => (
                          <tr
                            key={listing.id}
                            className="border-b last:border-0 hover:bg-muted/50"
                          >
                            <td className="px-4 py-3">
                              <Link
                                to={`/listings/${listing.id}`}
                                className="text-sm font-medium text-foreground hover:text-primary"
                              >
                                {listing.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                              {listing.views.toLocaleString(APP_LOCALE)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                              {listing.bookings}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                              {formatCurrency(listing.revenue)}
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
                    <Banknote className="w-5 h-5" />
                    {t("dashboard.performance.earningsSummary")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-muted-foreground">
                      {t("dashboard.performance.totalEarnings")}
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {formatCurrency(metrics.earnings.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-muted-foreground">
                      {t("dashboard.performance.thisMonth")}
                    </span>
                    <span className="font-semibold text-success">
                      {formatCurrency(metrics.earnings.thisMonth)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {t("dashboard.performance.lastMonth")}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(metrics.earnings.lastMonth)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-lg",
                      earningsChange >= 0
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {earningsChange >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {t("dashboard.performance.vsLastMonth", {
                        change: Math.abs(earningsChange).toFixed(1),
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Response Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {t("dashboard.performance.responseMetrics")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">
                        {t("dashboard.performance.responseTime")}
                      </span>
                      <span className="text-sm font-medium">
                        {safeNumber(
                          metrics.responseMetrics.averageResponseTime
                        )}{" "}
                        {t("dashboard.performance.hrs")}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-success h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              ((24 -
                                safeNumber(
                                  metrics.responseMetrics.averageResponseTime
                                )) /
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
                      <span className="text-sm text-muted-foreground">
                        {t("dashboard.performance.responseRate")}
                      </span>
                      <span className="text-sm font-medium">
                        {safeNumber(metrics.responseMetrics.responseRate)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-info h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              safeNumber(metrics.responseMetrics.responseRate),
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
                      <span className="text-sm text-muted-foreground">
                        {t("dashboard.performance.acceptanceRate")}
                      </span>
                      <span className="text-sm font-medium">
                        {safeNumber(metrics.responseMetrics.acceptanceRate)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              safeNumber(
                                metrics.responseMetrics.acceptanceRate
                              ),
                              0
                            ),
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
                      <h4 className="font-medium text-foreground mb-1">
                        {t("dashboard.performance.performanceTip")}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {t("dashboard.performance.performanceTipText")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/50 p-10 text-center text-muted-foreground">
          Performance data is currently unavailable.
        </div>
      )}
    </PortalPageLayout>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
