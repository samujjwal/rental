import { type LoaderFunctionArgs, useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/utils/auth";
import {
  getAdminAnalytics,
  type AnalyticsRange,
  type AdminAnalyticsPayload,
} from "~/utils/adminAnalytics";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { RouteErrorBoundary } from "~/components/ui";

const RANGE_OPTIONS: AnalyticsRange[] = ["7d", "30d", "90d", "365d"];

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last 12 months",
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(safeNumber(value));
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(safeNumber(value));
}
function formatPercent(value: number) {
  return `${safeNumber(value).toFixed(1)}%`;
}
function formatKpiValue(value: number, unit: "count" | "currency" | "percent") {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percent") return formatPercent(value);
  return formatNumber(value);
}

function AlertBanner({ severity, title, children, action }: { severity: "error" | "warning" | "info"; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 text-red-800 dark:text-red-200",
    warning: "border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200",
    info: "border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 text-blue-800 dark:text-blue-200",
  };
  const icons = { error: AlertCircle, warning: AlertTriangle, info: Info };
  const Icon = icons[severity];
  return (
    <div className={`rounded-md border px-4 py-3 ${styles[severity]}`}>
      <div className="flex items-start gap-2">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <div className="text-sm mt-0.5">{children}</div>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") as AnalyticsRange | null;
  const range = RANGE_OPTIONS.includes(rangeParam as AnalyticsRange) ? (rangeParam as AnalyticsRange) : "30d";
  try {
    const analytics = await getAdminAnalytics(request, range);
    return { analytics, range, error: null };
  } catch (error: unknown) {
    return {
      analytics: null, range,
      error: error && typeof error === "object" && "message" in error ? String((error as { message?: string }).message) : "Failed to load analytics",
    };
  }
}

export default function AdminAnalytics() {
  const { analytics, range, error } = useLoaderData<typeof clientLoader>() as {
    analytics: AdminAnalyticsPayload | null; range: AnalyticsRange; error: string | null;
  };

  if (error || !analytics) {
    return (
      <div className="p-4 md:p-8">
        <AlertBanner severity="error" title="Error">{error || "Failed to load analytics"}</AlertBanner>
      </div>
    );
  }

  const { summary, alerts } = analytics;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Operational pulse for {RANGE_LABELS[range]}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option}
              to={`/admin/analytics?range=${option}`}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                option === range
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted"
              }`}
            >
              {RANGE_LABELS[option]}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {summary.kpis.map((kpi) => (
          <div key={kpi.id} className="rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
            <p className="text-xl font-bold mt-1">{formatKpiValue(kpi.value, kpi.unit)}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.description}</p>
          </div>
        ))}
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bookings */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold mb-2">Bookings</h3>
          <hr className="mb-3" />
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{formatNumber(summary.bookings.total)}</p>
          <div className="space-y-0.5 mt-2 text-sm text-muted-foreground">
            <p>Confirmed: {formatNumber(summary.bookings.confirmed)}</p>
            <p>Cancelled: {formatNumber(summary.bookings.cancelled)}</p>
            <p>Disputes: {formatNumber(summary.bookings.disputes)}</p>
            <p>Avg. duration: {safeNumber(summary.bookings.avgDurationDays).toFixed(1)} days</p>
          </div>
        </div>

        {/* Revenue */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold mb-2">Revenue</h3>
          <hr className="mb-3" />
          <p className="text-sm text-muted-foreground">Gross</p>
          <p className="text-lg font-bold">{formatCurrency(summary.revenue.gross)}</p>
          <div className="space-y-0.5 mt-2 text-sm text-muted-foreground">
            <p>Net: {formatCurrency(summary.revenue.net)}</p>
            <p>Take rate: {formatPercent(summary.revenue.takeRate)}</p>
            <p>Payout volume: {formatCurrency(summary.revenue.payoutVolume)}</p>
          </div>
        </div>

        {/* Operations */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold mb-2">Operations</h3>
          <hr className="mb-3" />
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p>Open disputes: {formatNumber(summary.operations.openDisputes)}</p>
            <p>Moderation backlog: {formatNumber(summary.operations.moderationBacklog)}</p>
            <p>Support SLA: {formatPercent(summary.operations.supportSla)}</p>
            <p>Fraud signals: {formatNumber(summary.operations.fraudSignals)}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Alerts</h2>
        {alerts.length === 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">No alerts for this period.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertBanner
                key={alert.id}
                severity={alert.severity === "critical" ? "error" : alert.severity}
                title={alert.title}
                action={alert.action ? (
                  <Link to={alert.action.to} className="text-sm font-medium hover:underline">{alert.action.label}</Link>
                ) : undefined}
              >
                {alert.description} <strong>{alert.impact}</strong>
              </AlertBanner>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };

