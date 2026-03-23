import { type LoaderFunctionArgs, useLoaderData, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { requireAdmin } from "~/utils/auth";
import {
  getAdminAnalytics,
  type AnalyticsRange,
  type AdminAnalyticsPayload,
} from "~/utils/adminAnalytics";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { RouteErrorBoundary } from "~/components/ui";
import { formatCurrency, formatNumber } from "~/lib/utils";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

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

export function getAdminAnalyticsLoadError(error: unknown): string {
  return getActionableErrorMessage(error, "Failed to load analytics", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading analytics timed out. Try again.",
  });
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
      error: getAdminAnalyticsLoadError(error),
    };
  }
}

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const { analytics, range, error } = useLoaderData<typeof clientLoader>() as {
    analytics: AdminAnalyticsPayload | null; range: AnalyticsRange; error: string | null;
  };

  if (error || !analytics) {
    return (
      <div className="p-4 md:p-8">
        <AlertBanner severity="error" title={t("admin.error")}>{error || t("admin.failedToLoadAnalytics")}</AlertBanner>
      </div>
    );
  }

  const { summary, alerts } = analytics;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.analytics")}</h1>
          <p className="text-muted-foreground">{t("admin.operationalPulse", { range: RANGE_LABELS[range] })}</p>
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
          <h3 className="text-lg font-semibold mb-2">{t("admin.bookings")}</h3>
          <hr className="mb-3" />
          <p className="text-sm text-muted-foreground">{t("admin.total")}</p>
          <p className="text-lg font-bold">{formatNumber(summary.bookings.total)}</p>
          <div className="space-y-0.5 mt-2 text-sm text-muted-foreground">
            <p>{t("admin.confirmed")}: {formatNumber(summary.bookings.confirmed)}</p>
            <p>{t("admin.cancelled")}: {formatNumber(summary.bookings.cancelled)}</p>
            <p>{t("admin.disputes")}: {formatNumber(summary.bookings.disputes)}</p>
            <p>{t("admin.avgDuration")}: {safeNumber(summary.bookings.avgDurationDays).toFixed(1)} {t("admin.days")}</p>
          </div>
        </div>

        {/* Revenue */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold mb-2">{t("admin.revenue")}</h3>
          <hr className="mb-3" />
          <p className="text-sm text-muted-foreground">{t("admin.gross")}</p>
          <p className="text-lg font-bold">{formatCurrency(summary.revenue.gross)}</p>
          <div className="space-y-0.5 mt-2 text-sm text-muted-foreground">
            <p>{t("admin.net")}: {formatCurrency(summary.revenue.net)}</p>
            <p>{t("admin.takeRate")}: {formatPercent(summary.revenue.takeRate)}</p>
            <p>{t("admin.payoutVolume")}: {formatCurrency(summary.revenue.payoutVolume)}</p>
          </div>
        </div>

        {/* Operations */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold mb-2">{t("admin.operations")}</h3>
          <hr className="mb-3" />
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p>{t("admin.openDisputes")}: {formatNumber(summary.operations.openDisputes)}</p>
            <p>{t("admin.moderationBacklog")}: {formatNumber(summary.operations.moderationBacklog)}</p>
            <p>{t("admin.supportSla")}: {formatPercent(summary.operations.supportSla)}</p>
            <p>{t("admin.fraudSignals")}: {formatNumber(summary.operations.fraudSignals)}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("admin.alerts")}</h2>
        {alerts.length === 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("admin.noAlerts")}</p>
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

