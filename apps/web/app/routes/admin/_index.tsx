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
import { ActivityFeed } from "~/components/admin/ActivityFeed";

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const [analytics, auditLogs] = await Promise.all([
    getAdminAnalytics(request, "30d"),
    adminApi.getAuditLogs({ limit: 20 })
  ]);
  
  // Transform audit logs to activity items
  const activities = auditLogs.logs.map(log => ({
    id: log.id,
    type: log.entity.toLowerCase() as any,
    action: log.action,
    description: `${log.userEmail} ${log.action} on ${log.entity} #${log.entityId}`,
    timestamp: log.createdAt,
    user: { name: log.userEmail },
    severity: determineSeverity(log.action),
    link: getEntityLink(log.entity, log.entityId),
  }));
  
  return { user, analytics, activities };
}

function determineSeverity(action: string): "success" | "error" | "warning" | "info" {
  if (action.includes("delete") || action.includes("suspend") || action.includes("reject")) {
    return "error";
  }
  if (action.includes("flag") || action.includes("warning")) {
    return "warning";
  }
  if (action.includes("create") || action.includes("approve") || action.includes("complete")) {
    return "success";
  }
  return "info";
}

function getEntityLink(entity: string, entityId: string): string | undefined {
  const entityMap: Record<string, string> = {
    user: "/admin/users",
    listing: "/admin/listings",
    booking: "/admin/bookings",
    dispute: "/admin/disputes",
    payment: "/admin/payments",
  };
  return entityMap[entity.toLowerCase()];
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
  const { user, analytics, activities } = useLoaderData<typeof clientLoader>();
  const { summary, alerts } = analytics;
  const [activeTab, setActiveTab] = useState(0);

  const quickLinks = [
    {
      href: "/admin/users",
      label: "User Directory",
      description: "Review accounts & roles",
      icon: <UsersIcon />,
    },
    {
      href: "/admin/listings",
      label: "Listings",
      description: "Moderate submissions",
      icon: <HomeIcon />,
    },
    {
      href: "/admin/bookings",
      label: "Bookings",
      description: "Resolve issues fast",
      icon: <CalendarIcon />,
    },
    {
      href: "/admin/payments",
      label: "Payments",
      description: "Audit payouts & refunds",
      icon: <MoneyIcon />,
    },
    {
      href: "/admin/organizations",
      label: "Organizations",
      description: "Manage business accounts",
      icon: <ShieldIcon />,
    },
    {
      href: "/admin/categories",
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
      <Box sx={{ mb: 4 }}>
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

            return (
              <Card key={kpi.id} sx={{ flex: "1 1 250px", minWidth: 200 }}>
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
