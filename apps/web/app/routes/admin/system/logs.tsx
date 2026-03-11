import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Search,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";
import { formatDateTime } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "System Logs | Admin" },
    { name: "description", content: "View and manage application logs" },
  ];
};

const safeDateTimeLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : formatDateTime(date);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};
const safeLogLevel = (value: unknown): string =>
  safeText(value, "info").toLowerCase();
const humanize = (value: unknown): string => {
  const text = safeText(value, "Info");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  try {
    const logs = await adminApi.getSystemLogs({ limit: 100 });
    return {
      logs: logs.logs || [],
      error: null,
    };
  } catch (error: unknown) {
    return {
      logs: [],
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load system logs",
    };
  }
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: unknown;
}

export default function SystemLogsPage() {
  const { t } = useTranslation();
  const { logs, error } = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const query = searchQuery.toLowerCase();

  const getLevelIcon = (level: string) => {
    switch (safeLogLevel(level)) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warn":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      case "debug":
        return <Bug className="w-4 h-4 text-gray-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (safeLogLevel(level)) {
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "warn":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "debug":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredLogs = logs.filter((log: LogEntry) => {
    const matchesLevel = selectedLevel === "all" || safeLogLevel(log.level) === selectedLevel;
    const matchesSearch =
      query === "" ||
      safeText(log.message).toLowerCase().includes(query);
    return matchesLevel && matchesSearch;
  });

  const logCounts = {
    all: logs.length,
    error: logs.filter((l: LogEntry) => safeLogLevel(l.level) === "error").length,
    warn: logs.filter((l: LogEntry) => safeLogLevel(l.level) === "warn").length,
    info: logs.filter((l: LogEntry) => safeLogLevel(l.level) === "info").length,
    debug: logs.filter((l: LogEntry) => safeLogLevel(l.level) === "debug").length,
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">{t("admin.errorLoadingLogs")}</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/admin/system"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            {t("admin.backToSystemSettings")}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t("admin.systemLogs")}</h1>
          <p className="text-gray-600 mt-1">
            {t("admin.systemLogsSubtitle")}
          </p>
        </div>
        <div className="flex gap-3">
          <UnifiedButton variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            {t("admin.exportLogs")}
          </UnifiedButton>
          <UnifiedButton variant="outline" size="sm" onClick={() => revalidator.revalidate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("admin.refresh")}
          </UnifiedButton>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("admin.searchLogs")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t("admin.searchLogs")}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex gap-1">
              {(["all", "error", "warn", "info", "debug"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedLevel === level
                      ? "bg-blue-100 text-blue-700 border border-blue-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {humanize(level)}
                  <span className="ml-1 text-xs">({logCounts[level]})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>{t("admin.noLogsFound")}</p>
            </div>
          ) : (
            filteredLogs.map((log: LogEntry, index: number) => (
              <div
                key={index}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(
                          log.level
                        )}`}
                      >
                        {safeLogLevel(log.level).toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {safeDateTimeLabel(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-900 font-mono text-sm break-all">
                      {safeText(log.message)}
                    </p>
                    {log.meta != null && typeof log.meta === 'object' && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                          {t("admin.viewMetadata")}
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        {t("admin.showingLogs", { filtered: filteredLogs.length, total: logs.length })}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

