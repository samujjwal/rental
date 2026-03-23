import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  Server,
} from "lucide-react";

import { RouteErrorBoundary } from "~/components/ui";
import { adminApi } from "~/lib/api/admin";
import { requireAdmin } from "~/utils/auth";

export { RouteErrorBoundary as ErrorBoundary };

type HealthSnapshot = {
  status: string;
  uptime: number;
  processUptimeSeconds?: number;
  services: Record<string, { status: string; latency?: number; responseTime?: number }>;
};

type DiagnosticsLog = {
  id: string;
  level: string;
  message: string;
  timestamp: string;
};

type DiagnosticsLoaderData = {
  overview: {
    version: string;
    environment: string;
    nodeVersion: string;
    uptime: number;
    connections: number;
    queueBacklog?: number;
    scheduledJobs?: number;
  } | null;
  health: HealthSnapshot | null;
  logs: DiagnosticsLog[];
  telemetryGaps: string[];
};

function formatDiagnosticsUptime(data: DiagnosticsLoaderData) {
  if (typeof data.health?.processUptimeSeconds === "number") {
    const totalSeconds = data.health.processUptimeSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  if (data.health?.uptime) {
    return `${data.health.uptime}%`;
  }

  if (data.overview?.uptime) {
    return `${data.overview.uptime}s`;
  }

  return "n/a";
}

export const meta: MetaFunction = () => {
  return [
    { title: "System Diagnostics | Admin" },
    {
      name: "description",
      content: "Operational diagnostics for health, logs, and telemetry coverage.",
    },
  ];
};

function normalizeHealth(raw: unknown): HealthSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (record.status && record.services) {
    return {
      status: String(record.status),
      uptime: Number(record.uptime || 0),
      processUptimeSeconds: Number(record.processUptimeSeconds || 0) || undefined,
      services: record.services as Record<string, { status: string; latency?: number; responseTime?: number }>,
    };
  }

  if (record.health && typeof record.health === "object") {
    const healthRecord = record.health as Record<string, unknown>;
    const services = Object.entries(healthRecord)
      .filter(([key]) => key !== "uptime")
      .reduce<Record<string, { status: string; latency?: number; responseTime?: number }>>((accumulator, [key, value]) => {
        if (value && typeof value === "object") {
          const service = value as Record<string, unknown>;
          accumulator[key] = {
            status: String(service.status || "unknown"),
            latency: Number(service.latency || 0) || undefined,
            responseTime: Number(service.responseTime || 0) || undefined,
          };
        }
        return accumulator;
      }, {});

    const statuses = Object.values(services).map((service) => service.status.toLowerCase());
    const status = statuses.some((serviceStatus) => serviceStatus === "unhealthy")
      ? "unhealthy"
      : statuses.some((serviceStatus) => serviceStatus === "degraded")
        ? "degraded"
        : "healthy";

    return {
      status,
      uptime: Number(healthRecord.uptime || 0),
      processUptimeSeconds: Number(record.processUptimeSeconds || 0) || undefined,
      services,
    };
  }

  return null;
}

function normalizeLogs(raw: unknown): DiagnosticsLog[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const record = raw as Record<string, unknown>;
  const logs = Array.isArray(record.logs) ? record.logs : [];

  return logs
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => ({
      id: String(entry.id || `log-${index}`),
      level: String(entry.level || "INFO"),
      message: String(entry.message || "Unknown log entry"),
      timestamp: String(entry.timestamp || new Date().toISOString()),
    }));
}

export async function clientLoader({ request }: LoaderFunctionArgs): Promise<DiagnosticsLoaderData> {
  await requireAdmin(request);

  const [overviewResult, healthResult, logsResult] = await Promise.allSettled([
    adminApi.getSystemOverview(),
    adminApi.getSystemHealth(),
    adminApi.getSystemLogs({ limit: 10 }),
  ]);

  const health = healthResult.status === "fulfilled" ? normalizeHealth(healthResult.value) : null;
  const logs = logsResult.status === "fulfilled" ? normalizeLogs(logsResult.value) : [];

  return {
    overview: overviewResult.status === "fulfilled" ? overviewResult.value : null,
    health,
    logs,
    telemetryGaps: [],
  };
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "healthy" || normalized === "ok") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
  if (normalized === "degraded" || normalized === "warning") {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }
  return "text-red-700 bg-red-50 border-red-200";
}

export default function AdminDiagnostics() {
  const data = useLoaderData<typeof clientLoader>();
  const serviceEntries = Object.entries(data.health?.services || {});

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Diagnostics</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Live diagnostics backed by the current admin APIs. This page calls out remaining telemetry blind spots instead of masking them with mock data.
          </p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusTone(data.health?.status || "unknown")}`}>
          {(data.health?.status || "unknown").toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Server className="h-4 w-4" />
            Environment
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{data.overview?.environment || "unknown"}</p>
          <p className="mt-1 text-xs text-gray-500">Version {data.overview?.version || "n/a"}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Clock3 className="h-4 w-4" />
            Uptime
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            {formatDiagnosticsUptime(data)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Node {data.overview?.nodeVersion || "unknown"}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Database className="h-4 w-4" />
            Queue Backlog
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{data.overview?.queueBacklog ?? "n/a"}</p>
          <p className="mt-1 text-xs text-gray-500">Waiting, active, and delayed jobs</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Activity className="h-4 w-4" />
            Scheduled Jobs
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{data.overview?.scheduledJobs ?? "n/a"}</p>
          <p className="mt-1 text-xs text-gray-500">Cron jobs registered in the scheduler</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Service Health</h2>
          <div className="mt-4 space-y-3">
            {serviceEntries.length > 0 ? serviceEntries.map(([name, service]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="font-medium capitalize text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500">
                    {service.latency ? `${service.latency} ms latency` : service.responseTime ? `${service.responseTime} ms response time` : "No latency metric exposed"}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(service.status)}`}>
                  {service.status}
                </span>
              </div>
            )) : (
              <p className="text-sm text-gray-500">No service-level health details are currently exposed by the admin API.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Telemetry Gaps</h2>
          <div className="mt-4 space-y-3">
            {data.telemetryGaps.map((gap) => (
              <div key={gap} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{gap}</span>
              </div>
            ))}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              This route is now live-data backed. Remaining work is to expose reconciliation and webhook-path health with the same fidelity as queue and scheduler metrics.
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent System Logs</h2>
          <span className="text-xs text-gray-500">Last {data.logs.length} entries</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
          {data.logs.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {data.logs.map((log) => (
                <li key={log.id} className="grid gap-2 px-4 py-3 md:grid-cols-[110px_180px_1fr] md:items-center">
                  <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="text-sm text-gray-800">{log.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-sm text-gray-500">No system logs are currently available from the admin API.</div>
          )}
        </div>
      </section>
    </div>
  );
}
