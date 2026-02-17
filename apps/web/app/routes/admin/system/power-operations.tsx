import React, { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Backup as BackupIcon,
  Storage as DatabaseIcon,
  QueryStats as QueryIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
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
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const response = record.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;
    const message = data?.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "Unknown error";
}

export default function PowerOperationsPage() {
  const [loading, setLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [operationProgress, setOperationProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    operation: Operation | null;
  }>({ open: false, operation: null });
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({ open: false, message: "", severity: "info" });

  const showNotification = (
    message: string,
    severity: "success" | "error" | "warning" | "info"
  ) => {
    setNotification({ open: true, message, severity });
  };

  const executeOperation = async (operation: Operation) => {
    if (operation.requiresConfirmation) {
      setConfirmDialog({ open: true, operation });
      return;
    }

    await performOperation(operation);
  };

  const performOperation = async (operation: Operation) => {
    setLoading(true);
    setActiveOperation(operation.id);
    setOperationProgress(0);

    try {
      // Start progress indicator
      const progressInterval = setInterval(() => {
        setOperationProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await operation.action();

      clearInterval(progressInterval);
      setOperationProgress(100);

      showNotification(`${operation.name} completed successfully`, "success");
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      showNotification(`${operation.name} failed: ${errorMessage}`, "error");
    } finally {
      setLoading(false);
      setActiveOperation(null);
      setOperationProgress(0);
      setConfirmDialog({ open: false, operation: null });
    }
  };

  const operations: Operation[] = [
    {
      id: "backup-database",
      name: "Backup Database",
      description:
        "Create a complete backup of the database including all tables and data",
      icon: <BackupIcon />,
      action: async () => {
        const backup = await adminApi.createBackup("full");
        if (backup?.downloadUrl) {
          window.open(backup.downloadUrl, "_blank", "noopener,noreferrer");
        }
      },
    },
    {
      id: "optimize-database",
      name: "Optimize Database",
      description: "Optimize database performance and clean up unused data",
      icon: <DatabaseIcon />,
      action: async () => {
        await adminApi.runDatabaseVacuum();
        await adminApi.runDatabaseAnalyze();
      },
    },
    {
      id: "clear-cache",
      name: "Clear Cache",
      description: "Clear all application caches and temporary data",
      icon: <DatabaseIcon />,
      action: async () => {
        await adminApi.clearCache("all");
      },
    },
  ];

  const executeQuery = async () => {
    if (!query.trim()) {
      showNotification("Please enter a log search term", "warning");
      return;
    }

    setLoading(true);
    setActiveOperation("execute-query");

    try {
      const startedAt = performance.now();
      const logs = await adminApi.getSystemLogs({ limit: 50, search: query.trim() });
      const endedAt = performance.now();

      const result: QueryResult = {
        columns: ["timestamp", "level", "message"],
        rows: logs.logs.map((log) => [log.timestamp, log.level, log.message]),
        executionTime: Math.round(endedAt - startedAt),
        rowCount: logs.logs.length,
      };

      setQueryResult(result);
      showNotification("Logs fetched successfully", "success");
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      showNotification(`Failed to fetch logs: ${errorMessage}`, "error");
      setQueryResult(null);
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Power Operations
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Advanced administrative operations for system maintenance and management
      </Typography>

      {/* Progress Bar */}
      {loading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            {activeOperation === "execute-query"
              ? "Executing Query..."
              : operations.find((op) => op.id === activeOperation)?.name ||
              "Processing..."}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={operationProgress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {/* Database Operations */}
        <Box sx={{ flex: "1 1 500px", minWidth: 300 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Database Operations
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {operations.slice(0, 2).map((operation) => (
                <Box key={operation.id}>
                  <UnifiedButton
                    fullWidth
                    variant={operation.danger ? "destructive" : "primary"}
                    leftIcon={operation.icon}
                    onClick={() => executeOperation(operation)}
                    disabled={loading}
                  >
                    {operation.name}
                  </UnifiedButton>
                  <Typography variant="caption" color="text.secondary">
                    {operation.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        {/* System Operations */}
        <Box sx={{ flex: "1 1 500px", minWidth: 300 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Operations
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {operations.slice(2).map((operation) => (
                <Box key={operation.id}>
                  <UnifiedButton
                    fullWidth
                    variant={operation.danger ? "destructive" : "primary"}
                    leftIcon={operation.icon}
                    onClick={() => executeOperation(operation)}
                    disabled={loading}
                  >
                    {operation.name}
                  </UnifiedButton>
                  <Typography variant="caption" color="text.secondary">
                    {operation.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        {/* System Logs */}
        <Box sx={{ flex: "1 1 100%", minWidth: 300 }}>
          <Paper sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <QueryIcon />
              System Logs
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                multiline
                rows={4}
                placeholder="Search logs (message contains)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                fullWidth
                sx={{ fontFamily: "monospace" }}
              />
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <UnifiedButton
                  variant="primary"
                  leftIcon={<DatabaseIcon />}
                  onClick={executeQuery}
                  disabled={loading || !query.trim()}
                >
                  Fetch Logs
                </UnifiedButton>
                <UnifiedButton
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setQueryResult(null);
                  }}
                  disabled={loading}
                >
                  Clear
                </UnifiedButton>
                {queryResult && (
                  <Chip
                    label={`${queryResult.rowCount} rows (${queryResult.executionTime}ms)`}
                    color="success"
                    size="small"
                  />
                )}
              </Box>
            </Box>

            {/* Logs Results */}
            {queryResult && (
              <Box sx={{ mt: 3 }}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      Log Results ({queryResult.rowCount} rows)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ overflowX: "auto" }}>
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: "#f5f5f5" }}>
                            {queryResult.columns.map((col, index) => (
                              <th
                                key={index}
                                style={{
                                  padding: "8px",
                                  textAlign: "left",
                                  borderBottom: "1px solid #ddd",
                                  fontWeight: "bold",
                                }}
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  style={{
                                    padding: "8px",
                                    borderBottom: "1px solid #eee",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {String(cell ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Backup/Restore */}
        <Box sx={{ flex: "1 1 100%", minWidth: 300 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Backup & Restore
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
              <Box sx={{ flex: "1 1 300px" }}>
                <Typography variant="subtitle2" gutterBottom>
                  Manage Backups
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create, download, and restore backups from the dedicated backups console.
                </Typography>
                <UnifiedButton asChild variant="primary" disabled={loading}>
                  <Link to="/admin/system/backups">Open Backup Management</Link>
                </UnifiedButton>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, operation: null })}
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WarningIcon color="error" />
            Confirm Dangerous Operation
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            You are about to perform a potentially dangerous operation:
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: "bold" }}>
            {confirmDialog.operation?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {confirmDialog.operation?.description}
          </Typography>
          <Alert severity="error" sx={{ mt: 2 }}>
            This action cannot be undone. Please confirm you want to proceed.
          </Alert>
        </DialogContent>
        <DialogActions>
          <UnifiedButton
            onClick={() => setConfirmDialog({ open: false, operation: null })}
            variant="outline"
          >
            Cancel
          </UnifiedButton>
          <UnifiedButton
            variant="destructive"
            onClick={() =>
              confirmDialog.operation &&
              performOperation(confirmDialog.operation)
            }
            disabled={loading}
          >
            Proceed
          </UnifiedButton>
        </DialogActions>
      </Dialog>

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
