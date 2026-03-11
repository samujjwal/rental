import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import {
  Database,
  HardDrive,
  Search,
  AlertTriangle,
  ChevronDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { adminApi } from "~/lib/api/admin";
import { UnifiedButton } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";
import { RouteErrorBoundary } from "~/components/ui";

interface Operation {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  action: () => Promise<void>;
  danger?: boolean;
  requiresConfirmation?: boolean;
}

interface QueryResult {
  columns: string[];
  rows: Array<Array<unknown>>;
  executionTime: number;
  rowCount: number;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const response = record.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;
    const message = data?.message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return "Unknown error";
}

export default function PowerOperationsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [operationProgress, setOperationProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; operation: Operation | null }>({ open: false, operation: null });
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" | "warning" | "info" } | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }
  }, [toast]);

  const showNotification = (message: string, severity: "success" | "error" | "warning" | "info") => setToast({ message, severity });

  const executeOperation = async (operation: Operation) => {
    if (operation.requiresConfirmation) { setConfirmDialog({ open: true, operation }); return; }
    await performOperation(operation);
  };

  const performOperation = async (operation: Operation) => {
    setLoading(true);
    setActiveOperation(operation.id);
    setOperationProgress(0);
    try {
      const interval = setInterval(() => {
        setOperationProgress((prev) => { if (prev >= 90) { clearInterval(interval); return 90; } return prev + 10; });
      }, 200);
      await operation.action();
      clearInterval(interval);
      setOperationProgress(100);
      showNotification(`${operation.name} completed successfully`, "success");
    } catch (error: unknown) {
      showNotification(`${operation.name} failed: ${getErrorMessage(error)}`, "error");
    } finally {
      setLoading(false);
      setActiveOperation(null);
      setOperationProgress(0);
      setConfirmDialog({ open: false, operation: null });
    }
  };

  const operations: Operation[] = [
    {
      id: "backup-database", name: t("admin.backupDatabase"),
      description: t("admin.backupDatabaseDesc"),
      icon: <HardDrive className="h-4 w-4" />,
      action: async () => { const b = await adminApi.createBackup("full"); if (b?.downloadUrl) window.open(b.downloadUrl, "_blank", "noopener,noreferrer"); },
    },
    {
      id: "optimize-database", name: t("admin.optimizeDatabase"),
      description: t("admin.optimizeDatabaseDesc"),
      icon: <Database className="h-4 w-4" />,
      action: async () => { await adminApi.runDatabaseVacuum(); await adminApi.runDatabaseAnalyze(); },
    },
    {
      id: "clear-cache", name: t("admin.clearAllCache"),
      description: t("admin.clearAllCacheDesc"),
      icon: <Database className="h-4 w-4" />,
      action: async () => { await adminApi.clearCache("all"); },
    },
  ];

  const executeQuery = async () => {
    if (!query.trim()) { showNotification("Please enter a log search term", "warning"); return; }
    setLoading(true);
    setActiveOperation("execute-query");
    try {
      const startedAt = performance.now();
      const logs = await adminApi.getSystemLogs({ limit: 50, search: query.trim() });
      const endedAt = performance.now();
      setQueryResult({
        columns: ["timestamp", "level", "message"],
        rows: logs.logs.map((log) => [log.timestamp, log.level, log.message]),
        executionTime: Math.round(endedAt - startedAt),
        rowCount: logs.logs.length,
      });
      showNotification("Logs fetched successfully", "success");
    } catch (error: unknown) {
      showNotification(`Failed to fetch logs: ${getErrorMessage(error)}`, "error");
      setQueryResult(null);
    } finally { setLoading(false); setActiveOperation(null); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("admin.powerOperations")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.powerOperationsSubtitle")}</p>
      </div>

      {/* Progress Bar */}
      {loading && (
        <div>
          <p className="text-sm mb-1">
            {activeOperation === "execute-query" ? t("admin.executingQuery") : operations.find((op) => op.id === activeOperation)?.name || t("admin.processing")}
          </p>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${operationProgress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Database Operations */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{t("admin.databaseOperations")}</h2>
          <div className="space-y-3">
            {operations.slice(0, 2).map((op) => (
              <div key={op.id}>
                <UnifiedButton fullWidth variant={op.danger ? "destructive" : "primary"} leftIcon={op.icon} onClick={() => executeOperation(op)} disabled={loading}>
                  {op.name}
                </UnifiedButton>
                <p className="text-xs text-muted-foreground mt-1">{op.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System Operations */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{t("admin.systemOperationsSection")}</h2>
          <div className="space-y-3">
            {operations.slice(2).map((op) => (
              <div key={op.id}>
                <UnifiedButton fullWidth variant={op.danger ? "destructive" : "primary"} leftIcon={op.icon} onClick={() => executeOperation(op)} disabled={loading}>
                  {op.name}
                </UnifiedButton>
                <p className="text-xs text-muted-foreground mt-1">{op.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Logs */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Search className="h-5 w-5" /> System Logs
        </h2>
        <div className="space-y-3">
          <textarea
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            placeholder={t("admin.searchLogsPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <div className="flex flex-wrap items-center gap-2">
            <UnifiedButton variant="primary" leftIcon={<Database className="h-4 w-4" />} onClick={executeQuery} disabled={loading || !query.trim()}>
              {t("admin.fetchLogs")}
            </UnifiedButton>
            <UnifiedButton variant="outline" onClick={() => { setQuery(""); setQueryResult(null); }} disabled={loading}>{t("admin.clear")}</UnifiedButton>
            {queryResult && (
              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2.5 py-0.5 text-xs font-medium">
                {queryResult.rowCount} rows ({queryResult.executionTime}ms)
              </span>
            )}
          </div>
        </div>

        {queryResult && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <button type="button" onClick={() => setLogsOpen(!logsOpen)} className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted">
              Log Results ({queryResult.rowCount} rows)
              <ChevronDown className={`h-4 w-4 transition-transform ${logsOpen ? "rotate-180" : ""}`} />
            </button>
            {logsOpen && (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      {queryResult.columns.map((col, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold border-b">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {queryResult.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2">{String(cell ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backup & Restore */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">{t("admin.backupRestore")}</h2>
        <div>
          <p className="text-sm font-medium">{t("admin.manageBackupsLabel")}</p>
          <p className="text-sm text-muted-foreground mt-1 mb-3">{t("admin.manageBackupsDesc")}</p>
          <UnifiedButton asChild variant="primary" disabled={loading}>
            <Link to="/admin/system/backups">{t("admin.openBackupManagement")}</Link>
          </UnifiedButton>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDialog({ open: false, operation: null })}>
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-6 py-4 border-b">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold">{t("admin.confirmDangerousOp")}</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm">{t("admin.aboutToPerformDangerous")}</p>
              <p className="font-semibold">{confirmDialog.operation?.name}</p>
              <p className="text-sm text-muted-foreground">{confirmDialog.operation?.description}</p>
              <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {t("admin.cannotBeUndone")}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <UnifiedButton onClick={() => setConfirmDialog({ open: false, operation: null })} variant="outline">{t("admin.cancel")}</UnifiedButton>
              <UnifiedButton variant="destructive" onClick={() => confirmDialog.operation && performOperation(confirmDialog.operation)} disabled={loading}>{t("admin.proceed")}</UnifiedButton>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm ${
            toast.severity === "success" ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200" :
            toast.severity === "error" ? "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200" :
            toast.severity === "warning" ? "bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200" :
            "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-200"
          }`}>
            {toast.severity === "success" ? <CheckCircle className="h-4 w-4" /> :
             toast.severity === "error" ? <AlertCircle className="h-4 w-4" /> :
             toast.severity === "warning" ? <AlertTriangle className="h-4 w-4" /> :
             <AlertCircle className="h-4 w-4" />}
            {toast.message}
            <button type="button" onClick={() => setToast(null)} className="ml-2 p-0.5 rounded hover:bg-black/10"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

