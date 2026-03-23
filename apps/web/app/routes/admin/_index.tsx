import { type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { requireAdmin } from "~/utils/auth";
import { getAdminAnalytics } from "~/utils/adminAnalytics";
import { adminApi } from "~/lib/api/admin";
import { formatCurrency, formatNumber } from "~/lib/utils";
import {
  ArrowRight,
  Users,
  Home,
  Calendar,
  Banknote,
  Shield,
  TrendingUp,
  CheckCircle,
  LayoutDashboard,
  Gavel,
  BarChart3,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { ActivityFeed, type ActivityItem } from "~/components/admin/ActivityFeed";
import { RouteErrorBoundary } from "~/components/ui";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => [{ title: "Admin Dashboard | GharBatai Rentals" }];

export function getAdminDashboardLoadError(error: unknown): string {
  return getActionableErrorMessage(error, "Failed to load admin dashboard data", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading admin dashboard data timed out. Try again.",
  });
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  try {
    const [analytics, auditLogs] = await Promise.all([
      getAdminAnalytics(request, "30d"),
      adminApi.getAuditLogs({ limit: 20 }),
    ]);

    const auditItems = Array.isArray(auditLogs?.logs) ? auditLogs.logs : [];
    const activities = auditItems.map((log) => {
      const entity = String(log.entity || "").toLowerCase();
      const type: ActivityItem["type"] = (
        ["system", "listing", "user", "booking", "payment", "dispute", "review"] as const
      ).includes(entity as ActivityItem["type"])
        ? (entity as ActivityItem["type"])
        : "system";
      return {
        id: log.id,
        type,
        action: log.action,
        description: `${log.userEmail} ${log.action} on ${log.entity} #${log.entityId}`,
        timestamp: log.createdAt,
        user: { name: log.userEmail },
        severity: determineSeverity(log.action),
        link: getEntityLink(log.entity),
      };
    });

    return { user, analytics, activities, error: null };
  } catch (error: unknown) {
    return {
      user,
      analytics: null,
      activities: [],
      error: getAdminDashboardLoadError(error),
    };
  }
}

function determineSeverity(action: unknown): "success" | "error" | "warning" | "info" {
  const normalized = String(action || "").toLowerCase();
  if (normalized.includes("delete") || normalized.includes("suspend") || normalized.includes("reject")) return "error";
  if (normalized.includes("flag") || normalized.includes("warning")) return "warning";
  if (normalized.includes("create") || normalized.includes("approve") || normalized.includes("complete")) return "success";
  return "info";
}

function getEntityLink(entity: unknown): string | undefined {
  const m: Record<string, string> = {
    user: "/admin/entities/users",
    listing: "/admin/entities/listings",
    booking: "/admin/entities/bookings",
    dispute: "/admin/disputes",
    payment: "/admin/entities/payments",
  };
  return m[String(entity || "").toLowerCase()];
}

const iconMap: Record<string, React.ReactNode> = {
  "/admin/entities/users": <Users className="h-5 w-5" />,
  "/admin/entities/listings": <Home className="h-5 w-5" />,
  "/admin/entities/bookings": <Calendar className="h-5 w-5" />,
  "/admin/disputes": <Shield className="h-5 w-5" />,
  "/admin/entities/payments": <Banknote className="h-5 w-5" />,
  "/admin/entities/organizations": <Shield className="h-5 w-5" />,
  "/admin/entities/categories": <Shield className="h-5 w-5" />,
  "/admin/system/power-operations": <Shield className="h-5 w-5" />,
};

const tabItems = [
  { label: "overview", icon: LayoutDashboard, href: "#" },
  { label: "disputes", icon: Gavel, href: "/admin/disputes" },
  { label: "reports", icon: BarChart3, href: "#" },
];

export default function AdminDashboard() {
  const { user, analytics, activities, error } = useLoaderData<typeof clientLoader>();
  const [activeTab, setActiveTab] = useState(0);
  const { t } = useTranslation();

  if (error || !analytics) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4">
          <p className="font-semibold text-red-800 dark:text-red-200">{t("admin.unableToLoadDashboard")}</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error || t("admin.failedToLoadDashboardData")}</p>
        </div>
      </div>
    );
  }

  const { summary, alerts } = analytics;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");

  const quickLinks = [
    { href: "/admin/entities/users", label: t("admin.userDirectory"), description: t("admin.reviewAccountsRoles") },
    { href: "/admin/entities/listings", label: t("admin.listings"), description: t("admin.moderateSubmissions") },
    { href: "/admin/entities/bookings", label: t("admin.bookings"), description: t("admin.resolveIssuesFast") },
    { href: "/admin/disputes", label: t("admin.disputes"), description: t("admin.reviewResolveDisputes") },
    { href: "/admin/entities/payments", label: t("admin.payments"), description: t("admin.auditPayoutsRefunds") },
    { href: "/admin/entities/organizations", label: t("admin.organizations"), description: t("admin.manageBusinessAccounts") },
    { href: "/admin/entities/categories", label: t("admin.categories"), description: t("admin.configurePropertyTypes") },
    { href: "/admin/system/power-operations", label: t("admin.powerOperations"), description: t("admin.systemMaintenance") },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1" role="tablist">
          {tabItems.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === idx;
            return tab.href !== "#" ? (
              <Link
                key={tab.label}
                to={tab.href}
                role="tab"
                aria-selected={false}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                <Icon className="h-4 w-4" /> {t(`admin.${tab.label}`)}
              </Link>
            ) : (
              <button
                key={tab.label}
                type="button"
                role="tab"
                onClick={() => setActiveTab(idx)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" /> {t(`admin.${tab.label}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Welcome */}
      <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("admin.controlCenter")}</p>
            <h1 className="text-2xl font-bold mt-1">{t("admin.welcomeBack", { name: user.firstName ?? user.email })}</h1>
            <p className="text-muted-foreground mt-1">{t("admin.dashboardDescription")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/system/power-operations" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted">{t("admin.systemOperations")}</Link>
            <Link to="/admin/analytics" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              {t("admin.fullAnalytics")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("admin.activeAlerts")}</h2>
          {criticalAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 px-4 py-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-800 dark:text-red-200">{alert.title}</p>
                <p className="text-sm text-red-700 dark:text-red-300">{alert.description}</p>
              </div>
              {alert.action && (
                <Link to={alert.action.to} className="text-sm font-medium text-red-700 dark:text-red-300 hover:underline shrink-0">{alert.action.label}</Link>
              )}
            </div>
          ))}
          {warningAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">{alert.title}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{alert.description}</p>
              </div>
              {alert.action && (
                <Link to={alert.action.to} className="text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:underline shrink-0">{alert.action.label}</Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div data-testid="platform-stats">
        <h2 className="text-lg font-semibold mb-3">{t("admin.keyMetrics")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {summary.kpis.map((kpi) => {
            const trendColor = kpi.trend === "up" ? "text-green-600" : kpi.trend === "down" ? "text-red-600" : "text-muted-foreground";
            const trendArrow = kpi.trend === "up" ? "\u2191" : kpi.trend === "down" ? "\u2193" : "\u2192";
            const formattedValue = kpi.unit === "currency" ? formatCurrency(kpi.value) : formatNumber(kpi.value);
            const testIdMap: Record<string, string> = { activeUsers: "total-users", listings: "total-listings", bookings: "total-bookings", revenue: "total-revenue", disputes: "active-disputes" };
            return (
              <div key={kpi.id} className="rounded-lg border bg-card p-4 shadow-sm" data-testid={testIdMap[kpi.id] || kpi.id}>
                <div className="flex items-center gap-1 mb-1">
                  {kpi.trend === "up" ? <TrendingUp className={`h-4 w-4 ${trendColor}`} /> : <CheckCircle className={`h-4 w-4 ${trendColor}`} />}
                  <span className={`text-xs font-medium ${trendColor}`}>{trendArrow}</span>
                </div>
                <p className="text-2xl font-bold">{formattedValue}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{kpi.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("admin.quickActions")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="rounded-md bg-primary/10 text-primary p-2">{iconMap[link.href]}</div>
              <div>
                <p className="font-semibold">{link.label}</p>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t("admin.recentActivity")}</h2>
          <Link to="/admin/system/audit" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {t("admin.viewAll")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <ActivityFeed activities={activities} maxItems={5} showViewAll={false} />
        </div>
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };

