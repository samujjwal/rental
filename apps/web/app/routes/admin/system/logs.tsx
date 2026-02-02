import type { MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams, useRevalidator } from "react-router";
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
import { Button } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "System Logs | Admin" },
    { name: "description", content: "View and manage application logs" },
  ];
};

export async function clientLoader() {
  try {
    const logs = await adminApi.getSystemLogs({ limit: 100 });
    return {
      logs: logs.logs || [],
      error: null,
    };
  } catch (error: any) {
    return {
      logs: [],
      error: error?.message || "Failed to load system logs",
    };
  }
}

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: unknown;
}

export default function SystemLogsPage() {
  const { logs, error } = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
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
    switch (level.toLowerCase()) {
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
    const matchesLevel = selectedLevel === "all" || log.level.toLowerCase() === selectedLevel;
    const matchesSearch =
      searchQuery === "" ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const logCounts = {
    all: logs.length,
    error: logs.filter((l: LogEntry) => l.level.toLowerCase() === "error").length,
    warn: logs.filter((l: LogEntry) => l.level.toLowerCase() === "warn").length,
    info: logs.filter((l: LogEntry) => l.level.toLowerCase() === "info").length,
    debug: logs.filter((l: LogEntry) => l.level.toLowerCase() === "debug").length,
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Logs</h3>
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
            ← Back to System Settings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
          <p className="text-gray-600 mt-1">
            View and search application logs
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outlined" size="small">
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
          <Button variant="outlined" size="small" onClick={() => revalidator.revalidate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
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
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                  {level.charAt(0).toUpperCase() + level.slice(1)}
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
              <p>No logs found matching your criteria</p>
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
                        {log.level.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-900 font-mono text-sm break-all">
                      {log.message}
                    </p>
                    {log.meta != null && typeof log.meta === 'object' && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                          View metadata
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
        Showing {filteredLogs.length} of {logs.length} log entries
      </div>
    </div>
  );
}
