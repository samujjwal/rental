/**
 * Export Data Component
 * Export table data to CSV, Excel, JSON formats — pure Tailwind
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Code, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export type ExportFormat = "csv" | "excel" | "json";

interface ExportDataProps {
  data: Array<Record<string, unknown>>;
  columns?: Array<{ id: string; header: string }>;
  filename?: string;
  onExport?: (format: ExportFormat) => Promise<void> | void;
}

export const ExportData: React.FC<ExportDataProps> = ({
  data,
  columns,
  filename = "export",
  onExport,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), toast.type === "success" ? 3000 : 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const exportToCSV = useCallback(() => {
    try {
      const headers = columns?.map((col) => col.header) || Object.keys(data[0] || {});
      const columnIds = columns?.map((col) => col.id) || Object.keys(data[0] || {});
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          columnIds
            .map((id) => {
              const value = row[id];
              if (value === null || value === undefined) return "";
              if (typeof value === "string" && value.includes(",")) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(",")
        ),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      setToast({ type: "success", message: "Export completed successfully!" });
    } catch {
      setToast({ type: "error", message: "Failed to export CSV" });
    }
  }, [data, columns, filename]);

  const exportToJSON = useCallback(() => {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setToast({ type: "success", message: "Export completed successfully!" });
    } catch {
      setToast({ type: "error", message: "Failed to export JSON" });
    }
  }, [data, filename]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setMenuOpen(false);
      setExporting(true);
      try {
        if (onExport) {
          await onExport(format);
        } else {
          switch (format) {
            case "csv": exportToCSV(); break;
            case "json": exportToJSON(); break;
            case "excel":
              setToast({ type: "error", message: "Excel export requires additional setup" });
              break;
          }
        }
      } catch (error) {
        setToast({ type: "error", message: error instanceof Error ? error.message : "Export failed" });
      } finally {
        setExporting(false);
      }
    },
    [onExport, exportToCSV, exportToJSON]
  );

  return (
    <>
      <div ref={menuRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={exporting || data.length === 0}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
          title="Export"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-1 w-44 rounded-md border bg-popover shadow-lg">
            <button
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleExport("csv")}
            >
              <FileText className="h-4 w-4" />
              Export as CSV
            </button>
            <button
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleExport("json")}
            >
              <Code className="h-4 w-4" />
              Export as JSON
            </button>
            <button
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground cursor-not-allowed opacity-50"
              disabled
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export as Excel
            </button>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm ${
              toast.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {toast.message}
            <button type="button" onClick={() => setToast(null)} className="ml-2 p-0.5 rounded hover:bg-black/10">
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ExportData;
