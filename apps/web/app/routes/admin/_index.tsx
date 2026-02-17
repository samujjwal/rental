import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { requireAdmin } from "~/utils/auth";
import { getAdminAnalytics } from "~/utils/adminAnalytics";
import { adminApi } from "~/lib/api/admin";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Alert,
  AlertTitle,
  Tabs,
  Tab,
} from "@mui/material";
import {
  ArrowForward as ArrowRightIcon,
  Group as UsersIcon,
  House as HomeIcon,
  Event as CalendarIcon,
  AttachMoney as MoneyIcon,
  Security as ShieldIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Dashboard as DashboardIcon,
  Gavel as DisputeIcon,
  Assessment as ReportsIcon,
} from "@mui/icons-material";
import { ActivityFeed, type ActivityItem } from "~/components/admin/ActivityFeed";
import { RouteErrorBoundary } from "~/components/ui";

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  try {
    const [analytics, auditLogs] = await Promise.all([
      getAdminAnalytics(request, "30d"),
      adminApi.getAuditLogs({ limit: 20 }),
    ]);

    // Transform audit logs to activity items
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
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load admin dashboard data",
    };
  }
}

function determineSeverity(action: unknown): "success" | "error" | "warning" | "info" {
  const normalized = String(action || "").toLowerCase();
  if (normalized.includes("delete") || normalized.includes("suspend") || normalized.includes("reject")) {
    return "error";
  }
  if (normalized.includes("flag") || normalized.includes("warning")) {
    return "warning";
  }
  if (normalized.includes("create") || normalized.includes("approve") || normalized.includes("complete")) {
    return "success";
  }
  return "info";
}

function getEntityLink(entity: unknown): string | undefined {
  const entityMap: Record<string, string> = {
    user: "/admin/entities/users",
    listing: "/admin/entities/listings",
    booking: "/admin/entities/bookings",
    dispute: "/admin/disputes",
    payment: "/admin/entities/payments",
  };
  return entityMap[String(entity || "").toLowerCase()];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AdminDashboard() {
  const { user, analytics, activities, error } = useLoaderData<typeof clientLoader>();
  const [activeTab, setActiveTab] = useState(0);

  if (error || !analytics) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Unable to load admin dashboard</AlertTitle>
          {error || "Failed to load admin dashboard data"}
        </Alert>
      </Box>
    );
  }
  const { summary, alerts } = analytics;

  const quickLinks = [
    {
      href: "/admin/entities/users",
      label: "User Directory",
      description: "Review accounts & roles",
      icon: <UsersIcon />,
    },
    {
      href: "/admin/entities/listings",
      label: "Listings",
      description: "Moderate submissions",
      icon: <HomeIcon />,
    },
    {
      href: "/admin/entities/bookings",
      label: "Bookings",
      description: "Resolve issues fast",
      icon: <CalendarIcon />,
    },
    {
      href: "/admin/disputes",
      label: "Disputes",
      description: "Review and resolve disputes",
      icon: <ShieldIcon />,
    },
    {
      href: "/admin/entities/payments",
      label: "Payments",
      description: "Audit payouts & refunds",
      icon: <MoneyIcon />,
    },
    {
      href: "/admin/entities/organizations",
      label: "Organizations",
      description: "Manage business accounts",
      icon: <ShieldIcon />,
    },
    {
      href: "/admin/entities/categories",
      label: "Categories",
      description: "Configure property types",
      icon: <ShieldIcon />,
    },
    {
      href: "/admin/system/power-operations",
      label: "Power Operations",
      description: "System maintenance",
      icon: <ShieldIcon />,
    },
  ];

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");

  return (
    <Box sx={{ p: 3 }}>
      {/* Top Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          aria-label="Admin dashboard tabs"
        >
          <Tab icon={<DashboardIcon />} label="Overview" iconPosition="start" />
          <Tab icon={<DisputeIcon />} label="Disputes" iconPosition="start" component={Link} to="/admin/disputes" />
          <Tab icon={<ReportsIcon />} label="Reports" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Welcome Section */}
      <Paper
        sx={{
          p: 4,
          mb: 4,
          background:
            "linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.1) 100%)",
          border: "1px solid rgba(25, 118, 210, 0.2)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 600, letterSpacing: 1 }}
            >
              ADMIN CONTROL CENTER
            </Typography>
            <Typography variant="h4" gutterBottom>
              Welcome back, {user.firstName ?? user.email}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Keep the marketplace healthy by monitoring activity, triaging
              issues, and guiding partners.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              component={Link}
              to="/admin/system/power-operations"
              sx={{ borderRadius: 2 }}
            >
              System Operations
            </Button>
            <Button
              variant="contained"
              component={Link}
              to="/admin/analytics"
              endIcon={<ArrowRightIcon />}
              sx={{ borderRadius: 2 }}
            >
              Full Analytics
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Critical Alerts */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Active Alerts
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {criticalAlerts.map((alert) => (
              <Alert
                key={alert.id}
                severity="error"
                action={
                  alert.action && (
                    <Button
                      component={Link}
                      to={alert.action.to}
                      size="small"
                      color="inherit"
                    >
                      {alert.action.label}
                    </Button>
                  )
                }
              >
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.description}
              </Alert>
            ))}
            {warningAlerts.map((alert) => (
              <Alert
                key={alert.id}
                severity="warning"
                action={
                  alert.action && (
                    <Button
                      component={Link}
                      to={alert.action.to}
                      size="small"
                      color="inherit"
                    >
                      {alert.action.label}
                    </Button>
                  )
                }
              >
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.description}
              </Alert>
            ))}
          </Box>
        </Box>
      )}

      {/* Live KPI Cards */}
      <Box sx={{ mb: 4 }} data-testid="platform-stats">
        <Typography variant="h6" gutterBottom>
          Key Metrics (Last 30 Days)
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {summary.kpis.map((kpi) => {
            const trendColor =
              kpi.trend === "up"
                ? "success"
                : kpi.trend === "down"
                  ? "error"
                  : "default";
            const Icon =
              kpi.trend === "up"
                ? TrendingUpIcon
                : kpi.trend === "down"
                  ? TrendingUpIcon
                  : CheckCircleIcon;
            const formattedValue =
              kpi.unit === "currency"
                ? formatCurrency(kpi.value)
                : formatNumber(kpi.value);
            
            // Map KPI IDs to test IDs for compatibility
            const testIdMap: Record<string, string> = {
              activeUsers: "total-users",
              listings: "total-listings",
              bookings: "total-bookings",
              revenue: "total-revenue",
              disputes: "active-disputes",
            };
            const testId = testIdMap[kpi.id] || kpi.id;

            return (
              <Card key={kpi.id} sx={{ flex: "1 1 250px", minWidth: 200 }} data-testid={testId}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <Icon sx={{ color: `${trendColor}.main`, mr: 1 }} />
                    <Typography
                      variant="overline"
                      sx={{ color: `${trendColor}.main` }}
                    >
                      {kpi.trend === "up"
                        ? "↑"
                        : kpi.trend === "down"
                          ? "↓"
                          : "→"}
                    </Typography>
                  </Box>
                  <Typography variant="h4" gutterBottom>
                    {formattedValue}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {kpi.label}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {quickLinks.map((link) => (
            <Card
              key={link.href}
              sx={{
                flex: "1 1 280px",
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: 3,
                },
              }}
              component={Link}
              to={link.href}
            >
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "primary.100",
                      color: "primary.main",
                      mr: 2,
                    }}
                  >
                    {link.icon}
                  </Box>
                  <Typography variant="h6">{link.label}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {link.description}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      {/* Activity Feed Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6">
            Recent Activity
          </Typography>
          <Button
            variant="text"
            component={Link}
            to="/admin/system/audit"
            endIcon={<ArrowRightIcon />}
          >
            View All
          </Button>
        </Box>
        <Paper sx={{ p: 2 }}>
          <ActivityFeed 
            activities={activities}
            maxItems={5}
            showViewAll={false}
          />
        </Paper>
      </Box>
    </Box>
  );
}
export { RouteErrorBoundary as ErrorBoundary };
