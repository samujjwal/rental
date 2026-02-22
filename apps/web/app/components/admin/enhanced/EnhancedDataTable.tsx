/**
 * Enhanced Data Table Component
 * World-class admin table with all features integrated — pure Tailwind
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type OnChangeFn,
  type PaginationState,
} from "@tanstack/react-table";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { SmartSearch } from "./SmartSearch";
import { FilterChips, type FilterChip } from "./FilterChips";
import { CardView, ListView, ViewModeToggle, type ViewMode } from "./DataViews";
import { useResponsiveMode } from "./ResponsiveLayout";
import { BulkActionsToolbar } from "~/components/admin/BulkActions";

interface EnhancedDataTableProps<T extends Record<string, unknown> = Record<string, unknown>> {
  data: T[];
  columns: ColumnDef<T>[];
  totalCount?: number;
  loading?: boolean;
  error?: string;
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  globalFilter?: string;
  onGlobalFilterChange?: (filter: string) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  enableSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onRowClick?: (row: T) => void;
  onRowEdit?: (row: T) => void;
  onRowDelete?: (row: T) => void;
  onRowView?: (row: T) => void;
  onAdd?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onBulkDelete?: (rows: T[]) => void;
  onBulkStatusChange?: (rows: T[], status: string) => void;
  availableBulkStatuses?: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  title?: string;
  enableSearch?: boolean;
  enableFilters?: boolean;
  enableViewModes?: boolean;
  availableViewModes?: ViewMode[];
  defaultViewMode?: ViewMode;
  availableFilterFields?: Array<{
    field: string;
    label: string;
    type: FilterChip["type"];
    options?: Array<{ value: string; label: string }>;
  }>;
  enableAdvancedMode?: boolean;
  searchSuggestions?: string[];
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

export function EnhancedDataTable<T extends Record<string, unknown> = Record<string, unknown>>({
  data,
  columns,
  totalCount,
  loading = false,
  error,
  pageIndex = 0,
  pageSize = 25,
  onPaginationChange,
  sorting = [],
  onSortingChange,
  globalFilter = "",
  onGlobalFilterChange,
  columnFilters = [],
  onColumnFiltersChange,
  enableSelection = false,
  rowSelection = {},
  onRowSelectionChange,
  onRowClick,
  onRowEdit,
  onRowDelete,
  onRowView,
  onAdd,
  onRefresh,
  onExport,
  onBulkDelete,
  onBulkStatusChange,
  availableBulkStatuses = [],
  title,
  enableSearch = true,
  enableFilters = true,
  enableViewModes = true,
  availableViewModes = ["table", "cards", "list"],
  defaultViewMode,
  availableFilterFields = [],
  enableAdvancedMode = true,
  searchSuggestions = [],
}: EnhancedDataTableProps<T>) {
  const stableSerialize = useCallback((value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      return `{${entries.map(([key, nested]) => `${key}:${stableSerialize(nested)}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }, []);

  const responsiveMode = useResponsiveMode();
  const onColumnFiltersChangeRef = useRef(onColumnFiltersChange);
  const lastEmittedFiltersRef = useRef<string>("");

  useEffect(() => { onColumnFiltersChangeRef.current = onColumnFiltersChange; }, [onColumnFiltersChange]);

  const [viewMode, setViewMode] = useState<ViewMode>(
    defaultViewMode || (responsiveMode === "mobile" ? "cards" : responsiveMode === "tablet" ? "list" : "table")
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterChips, setFilterChips] = useState<FilterChip[]>([]);

  useEffect(() => {
    if (!defaultViewMode) {
      if (responsiveMode === "mobile") setViewMode("cards");
      else if (responsiveMode === "tablet") setViewMode("list");
      else setViewMode("table");
    }
  }, [responsiveMode, defaultViewMode]);

  useEffect(() => {
    const onChange = onColumnFiltersChangeRef.current;
    if (!onChange) return;
    const filters = filterChips.map((chip) => ({
      id: chip.field,
      value: { value: chip.value, operator: chip.operator || "equals" },
    }));
    const serialized = stableSerialize(filters);
    if (serialized === lastEmittedFiltersRef.current) return;
    lastEmittedFiltersRef.current = serialized;
    onChange(filters);
  }, [filterChips, stableSerialize]);

  // Table change handlers
  const handleSortingChange: OnChangeFn<SortingState> | undefined = onSortingChange
    ? (updater) => { const next = typeof updater === "function" ? updater(sorting) : updater; onSortingChange(next); }
    : undefined;

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> | undefined = onColumnFiltersChange
    ? (updater) => { const next = typeof updater === "function" ? updater(columnFilters) : updater; onColumnFiltersChange(next); }
    : undefined;

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> | undefined = onRowSelectionChange
    ? (updater) => { const next = typeof updater === "function" ? updater(rowSelection) : updater; onRowSelectionChange(next); }
    : undefined;

  const handlePaginationChange: OnChangeFn<PaginationState> | undefined = onPaginationChange
    ? (updater) => { const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater; onPaginationChange({ pageIndex: next.pageIndex, pageSize: next.pageSize }); }
    : undefined;

  const handleGlobalFilterChange: OnChangeFn<string> | undefined = onGlobalFilterChange
    ? (updater) => { const next = typeof updater === "function" ? updater(globalFilter) : updater; onGlobalFilterChange(next); }
    : undefined;

  const table = useReactTable({
    data,
    columns,
    pageCount: totalCount ? Math.ceil(totalCount / pageSize) : -1,
    state: { sorting, columnFilters, globalFilter, rowSelection, pagination: { pageIndex, pageSize } },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onRowSelectionChange: handleRowSelectionChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!totalCount,
    manualSorting: !!onSortingChange,
    manualFiltering: !!onColumnFiltersChange,
    enableRowSelection: enableSelection,
  });

  const handleSearchChange = useCallback(
    (value: string) => { onGlobalFilterChange?.(value); },
    [onGlobalFilterChange]
  );

  const handleFilterAdd = useCallback((filter: FilterChip) => { setFilterChips((prev) => [...prev, filter]); }, []);
  const handleFilterRemove = useCallback((filterId: string) => { setFilterChips((prev) => prev.filter((f) => f.id !== filterId)); }, []);
  const handleFilterUpdate = useCallback((filterId: string, value: unknown) => {
    setFilterChips((prev) => prev.map((f) => (f.id === filterId ? { ...f, value } : f)));
  }, []);

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedCount = selectedRows.length;
  const totalItems = totalCount || data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const hasActions = !!(onRowView || onRowEdit || onRowDelete);

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-card shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 px-4 py-4 border-b">
        {/* Title and Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-xl font-semibold">{title}</h2>}
            {selectedCount > 0 && (
              <p className="text-sm text-muted-foreground">{selectedCount} selected</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {enableViewModes && (
              <ViewModeToggle value={viewMode} onChange={setViewMode} availableModes={availableViewModes} />
            )}
            {onRefresh && (
              <button type="button" onClick={onRefresh} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {onExport && (
              <button type="button" onClick={onExport} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted" title="Export">
                <Download className="h-4 w-4" />
              </button>
            )}
            {onAdd && (
              <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Add New
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-2">
          {enableSearch && (
            <SmartSearch value={globalFilter} onChange={handleSearchChange} suggestions={searchSuggestions} placeholder="Search..." fullWidth />
          )}
          {enableFilters && (
            <FilterChips filters={filterChips} onFilterAdd={handleFilterAdd} onFilterRemove={handleFilterRemove} onFilterUpdate={handleFilterUpdate} availableFields={availableFilterFields} />
          )}
        </div>

        {/* Advanced Mode Toggle */}
        {enableAdvancedMode && (
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAdvanced ? "Hide" : "Show"} Advanced Options
            </button>
            {showAdvanced && (
              <div className="mt-2 p-4 bg-muted/50 rounded-lg border grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Active Filters ({filterChips.length})</h4>
                  {filterChips.length > 0 ? (
                    <div className="space-y-1.5">
                      {filterChips.map((chip) => (
                        <div key={chip.id} className="bg-background p-2 rounded border text-sm">
                          <strong>{chip.field}</strong> {chip.operator} {String(chip.value)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No filters applied</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Table Statistics</h4>
                  <div className="space-y-1">
                    {[
                      ["Total Records", totalItems],
                      ["Displayed", data.length],
                      ["Selected", selectedCount],
                      ["Page Size", pageSize],
                    ].map(([label, val]) => (
                      <div key={String(label)} className="flex justify-between text-sm">
                        <span>{label}:</span>
                        <span className="font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk actions */}
      <div className="px-3 pt-2">
        <BulkActionsToolbar
          selectedCount={selectedCount}
          onClearSelection={() => table.resetRowSelection()}
          onDelete={onBulkDelete ? () => onBulkDelete(selectedRows) : undefined}
          onStatusChange={onBulkStatusChange ? (status) => onBulkStatusChange(selectedRows, status) : undefined}
          availableStatuses={availableBulkStatuses}
          isLoading={loading}
        />
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="h-1 w-full bg-muted overflow-hidden">
          <div className="h-full bg-primary animate-[indeterminate_1.5s_ease-in-out_infinite] w-1/3" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 my-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Data Display */}
      <div className="px-3 pb-3">
        {viewMode === "cards" && (
          <CardView data={data} columns={columns} viewMode={viewMode} onRowClick={onRowClick} onRowEdit={onRowEdit} onRowDelete={onRowDelete} onRowView={onRowView} />
        )}
        {viewMode === "list" && (
          <ListView data={data} columns={columns} viewMode={viewMode} onRowClick={onRowClick} onRowEdit={onRowEdit} onRowDelete={onRowDelete} onRowView={onRowView} />
        )}
        {viewMode === "table" && (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto" data-testid="data-table">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {enableSelection && (
                      <th className="w-10 px-2 py-3 border-b-2 text-left">
                        <input
                          type="checkbox"
                          checked={table.getIsAllRowsSelected()}
                          ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected(); }}
                          onChange={table.getToggleAllRowsSelectedHandler()}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                        />
                      </th>
                    )}
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={`px-3 py-3 border-b-2 text-left font-semibold whitespace-nowrap ${
                          header.column.getCanSort() ? "cursor-pointer select-none hover:bg-muted" : ""
                        }`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                    {hasActions && (
                      <th className="w-[120px] px-3 py-3 border-b-2 text-right font-semibold">Actions</th>
                    )}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-muted/50 ${
                      row.getIsSelected() ? "bg-primary/5" : "even:bg-muted/20"
                    }`}
                  >
                    {enableSelection && (
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={row.getIsSelected()}
                          onChange={row.getToggleSelectedHandler()}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                        />
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    {hasActions && (
                      <td className="px-3 py-2 align-top">
                        <div className="flex gap-1 justify-end">
                          {onRowView && (
                            <button type="button" onClick={() => onRowView(row.original)} className="p-1 rounded hover:bg-muted text-primary" title="View">
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          {onRowEdit && (
                            <button type="button" onClick={() => onRowEdit(row.original)} className="p-1 rounded hover:bg-muted text-blue-600" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {onRowDelete && (
                            <button type="button" onClick={() => onRowDelete(row.original)} className="p-1 rounded hover:bg-muted text-destructive" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPaginationChange?.({ pageIndex: 0, pageSize: parseInt(e.target.value, 10) })}
            className="rounded border bg-background px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {pageIndex * pageSize + 1}-{Math.min((pageIndex + 1) * pageSize, totalItems)} of {totalItems}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => onPaginationChange?.({ pageIndex: pageIndex - 1, pageSize })}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => onPaginationChange?.({ pageIndex: pageIndex + 1, pageSize })}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnhancedDataTable;
