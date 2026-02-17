import { type LoaderFunctionArgs, useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/utils/auth";
import {
  getAdminAnalytics,
  type AnalyticsRange,
  type AdminAnalyticsPayload,
} from "~/utils/adminAnalytics";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  AlertTitle,
  Divider,
} from "@mui/material";
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(safeNumber(value));
}

function formatPercent(value: number): string {
  return `${safeNumber(value).toFixed(1)}%`;
}

function formatKpiValue(value: number, unit: "count" | "currency" | "percent") {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percent") return formatPercent(value);
  return formatNumber(value);
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") as AnalyticsRange | null;
  const range = RANGE_OPTIONS.includes(rangeParam as AnalyticsRange)
    ? (rangeParam as AnalyticsRange)
    : "30d";
  try {
    const analytics = await getAdminAnalytics(request, range);
    return { analytics, range, error: null };
  } catch (error: unknown) {
    return {
      analytics: null,
      range,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load analytics",
    };
  }
}

export default function AdminAnalytics() {
  const { analytics, range, error } = useLoaderData<typeof clientLoader>() as {
    analytics: AdminAnalyticsPayload | null;
    range: AnalyticsRange;
    error: string | null;
  };

  if (error || !analytics) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Alert severity="error">{error || "Failed to load analytics"}</Alert>
      </Box>
    );
  }

  const periodLabel = RANGE_LABELS[range];
  const { summary, alerts } = analytics;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Operational pulse for {periodLabel}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option}
              component={Link}
              to={`/admin/analytics?range=${option}`}
              variant={option === range ? "contained" : "outlined"}
              size="small"
            >
              {RANGE_LABELS[option]}
            </Button>
          ))}
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {summary.kpis.map((kpi) => (
          <Grid key={kpi.id} item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {kpi.label}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>
                  {formatKpiValue(kpi.value, kpi.unit)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {kpi.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Bookings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">Total</Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatNumber(summary.bookings.total)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Confirmed: {formatNumber(summary.bookings.confirmed)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cancelled: {formatNumber(summary.bookings.cancelled)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Disputes: {formatNumber(summary.bookings.disputes)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Avg. duration: {safeNumber(summary.bookings.avgDurationDays).toFixed(1)} days
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Revenue
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">Gross</Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatCurrency(summary.revenue.gross)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Net: {formatCurrency(summary.revenue.net)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Take rate: {formatPercent(summary.revenue.takeRate)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Payout volume: {formatCurrency(summary.revenue.payoutVolume)}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Operations
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Open disputes: {formatNumber(summary.operations.openDisputes)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Moderation backlog: {formatNumber(summary.operations.moderationBacklog)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Support SLA: {formatPercent(summary.operations.supportSla)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fraud signals: {formatNumber(summary.operations.fraudSignals)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Alerts
        </Typography>
        {alerts.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No alerts for this period.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: "grid", gap: 2 }}>
            {alerts.map((alert) => (
              <Alert key={alert.id} severity={alert.severity} variant="outlined">
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.description} <strong>{alert.impact}</strong>
                {alert.action ? (
                  <Button
                    component={Link}
                    to={alert.action.to}
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    {alert.action.label}
                  </Button>
                ) : null}
              </Alert>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
export { RouteErrorBoundary as ErrorBoundary };
