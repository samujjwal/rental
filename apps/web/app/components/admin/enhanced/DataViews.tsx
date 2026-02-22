/**
 * Data View Components
 * Multiple view modes: Table, Cards, List — pure Tailwind
 */

import React from "react";
import { List, LayoutGrid, Table2, Eye, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

export type ViewMode = "table" | "cards" | "list";

type DataRow = Record<string, unknown> & { id?: string | number };

interface DataViewProps<T extends DataRow> {
  data: T[];
  columns: ColumnDef<T>[];
  viewMode: ViewMode;
  onRowClick?: (row: T) => void;
  onRowEdit?: (row: T) => void;
  onRowDelete?: (row: T) => void;
  onRowView?: (row: T) => void;
}

const getColumnId = <T extends DataRow>(col?: ColumnDef<T>): string | undefined => {
  if (!col) return undefined;
  if (typeof col.id === "string") return col.id;
  if ("accessorKey" in col && typeof (col as { accessorKey?: unknown }).accessorKey === "string") {
    return (col as { accessorKey: string }).accessorKey;
  }
  return undefined;
};

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  availableModes?: ViewMode[];
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  value,
  onChange,
  availableModes = ["table", "cards", "list"],
}) => {
  const modes = [
    { key: "table" as ViewMode, icon: Table2, label: "Table View" },
    { key: "cards" as ViewMode, icon: LayoutGrid, label: "Card View" },
    { key: "list" as ViewMode, icon: List, label: "List View" },
  ].filter((m) => availableModes.includes(m.key));

  return (
    <div className="inline-flex rounded-md border" role="group" aria-label="view mode">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = value === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={`inline-flex items-center justify-center h-8 w-8 text-sm first:rounded-l-md last:rounded-r-md border-r last:border-r-0 transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "bg-background hover:bg-muted text-muted-foreground"
            }`}
            title={m.label}
            aria-label={m.label}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
};

export const CardView = <T extends DataRow>({
  data,
  columns,
  onRowClick,
  onRowEdit,
  onRowDelete,
  onRowView,
}: DataViewProps<T>) => {
  const getDisplayValue = (row: T, columnId: string) => {
    const value = row[columnId as keyof T];
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getPrimaryField = () => {
    const nameField = columns.find((col) => {
      const id = getColumnId(col);
      return id ? ["name", "title", "label"].includes(id) : false;
    });
    return getColumnId(nameField ?? columns[0]) || "id";
  };

  const getSecondaryFields = () =>
    columns.slice(0, 4).filter((col) => {
      const id = getColumnId(col);
      return id !== getPrimaryField() && id !== "id" && id !== "actions";
    });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {data.map((row, index) => {
        const primaryField = getPrimaryField();
        const secondaryFields = getSecondaryFields();
        return (
          <div
            key={String(row.id ?? index)}
            className={`flex flex-col rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
              onRowClick ? "cursor-pointer" : ""
            }`}
            onClick={() => onRowClick?.(row)}
          >
            <div className="flex-1 p-4">
              <h3 className="text-base font-semibold truncate">
                {getDisplayValue(row, primaryField)}
              </h3>
              <div className="flex flex-col gap-1.5 mt-3">
                {secondaryFields.map((col) => {
                  const id = getColumnId(col);
                  if (!id) return null;
                  return (
                    <div key={id}>
                      <span className="text-xs text-muted-foreground">{String(col.header || id)}</span>
                      <p className="text-sm truncate">{getDisplayValue(row, id)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-1 px-3 pb-3">
              {onRowView && (
                <button type="button" className="p-1.5 rounded-md hover:bg-muted" aria-label="view" onClick={(e) => { e.stopPropagation(); onRowView(row); }}>
                  <Eye className="h-4 w-4" />
                </button>
              )}
              {onRowEdit && (
                <button type="button" className="p-1.5 rounded-md hover:bg-muted" aria-label="edit" onClick={(e) => { e.stopPropagation(); onRowEdit(row); }}>
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onRowDelete && (
                <button type="button" className="p-1.5 rounded-md hover:bg-muted text-destructive" aria-label="delete" onClick={(e) => { e.stopPropagation(); onRowDelete(row); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ListView = <T extends DataRow>({
  data,
  columns,
  onRowClick,
  onRowEdit,
  onRowDelete,
  onRowView,
}: DataViewProps<T>) => {
  const getDisplayValue = (row: T, columnId: string) => {
    const value = row[columnId as keyof T];
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getPrimaryField = () => {
    const nameField = columns.find((col) => {
      const id = getColumnId(col);
      return id ? ["name", "title", "label"].includes(id) : false;
    });
    return getColumnId(nameField ?? columns[0]) || "id";
  };

  const getSecondaryField = () => {
    const secondary = columns.filter((col) => {
      const id = getColumnId(col);
      return id !== getPrimaryField() && id !== "id" && id !== "actions";
    });
    return getColumnId(secondary[0]);
  };

  const getStatusField = () => {
    const statusField = columns.find((col) => {
      const id = getColumnId(col);
      return id ? ["status", "state", "active"].includes(id) : false;
    });
    return getColumnId(statusField);
  };

  return (
    <ul className="w-full divide-y rounded-lg border bg-card">
      {data.map((row, index) => {
        const primaryField = getPrimaryField();
        const secondaryField = getSecondaryField();
        const statusField = getStatusField();
        return (
          <li
            key={String(row.id ?? index)}
            className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
              onRowClick ? "cursor-pointer" : ""
            }`}
            onClick={() => onRowClick?.(row)}
          >
            {/* Avatar */}
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
              {getDisplayValue(row, primaryField).charAt(0).toUpperCase()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {getDisplayValue(row, primaryField)}
                </span>
                {statusField && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    getDisplayValue(row, statusField).toLowerCase() === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {getDisplayValue(row, statusField)}
                  </span>
                )}
              </div>
              {secondaryField && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {getDisplayValue(row, secondaryField)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-0.5 shrink-0">
              {onRowView && (
                <button type="button" className="p-1.5 rounded-md hover:bg-muted" aria-label="view" onClick={(e) => { e.stopPropagation(); onRowView(row); }}>
                  <Eye className="h-4 w-4" />
                </button>
              )}
              {onRowEdit && (
                <button type="button" className="p-1.5 rounded-md hover:bg-muted" aria-label="edit" onClick={(e) => { e.stopPropagation(); onRowEdit(row); }}>
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onRowDelete && (
                <button type="button" className="p-1.5 rounded-md hover:bg-muted text-destructive" aria-label="delete" onClick={(e) => { e.stopPropagation(); onRowDelete(row); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export const DataViews = {
  CardView,
  ListView,
  ViewModeToggle,
};

export default DataViews;
