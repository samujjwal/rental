import { useState, useMemo, useCallback } from "react";
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
  type PaginationState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
  MoreVertical,
  RefreshCw,
  Download,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Show global search input */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Show row selection checkboxes */
  selectable?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Callback when row selection changes */
  onSelectionChange?: (rows: TData[]) => void;
  /** Toolbar actions (bulk actions, export, etc.) */
  toolbarActions?: React.ReactNode;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Total count for server-side pagination */
  totalCount?: number;
  /** Server-side pagination handler */
  onPaginationChange?: (page: number, pageSize: number) => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Export handler */
  onExport?: () => void;
}

// ─── Component ──────────────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Search...",
  selectable = false,
  loading = false,
  onSelectionChange,
  toolbarActions,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  emptyMessage = "No data found.",
  onRowClick,
  totalCount,
  onPaginationChange,
  onRefresh,
  onExport,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  const tableColumns = useMemo(() => {
    if (!selectable) return columns;

    const selectColumn: ColumnDef<TData, any> = {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label="Select row"
        />
      ),
      size: 40,
      enableSorting: false,
    };

    return [selectColumn, ...columns];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, columnFilters, globalFilter, rowSelection, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: selectable,
  });

  // Notify parent of selection changes
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  useMemo(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedRows.map((r) => r.original));
    }
  }, [selectedRows.length]);

  const pageCount = totalCount
    ? Math.ceil(totalCount / pagination.pageSize)
    : table.getPageCount();

  return (
    <div className="w-full space-y-3">
      {/* ─── Toolbar ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          {searchable && (
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              {globalFilter && (
                <button
                  onClick={() => setGlobalFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {selectable && selectedRows.length > 0 && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {selectedRows.length} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {toolbarActions}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}

          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Export"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Table ──────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {loading && (
          <div className="absolute inset-x-0 top-0 z-10 h-1 bg-primary/20 overflow-hidden">
            <div className="h-full w-1/3 bg-primary animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1 ${
                            header.column.getCanSort()
                              ? "cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-200"
                              : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="ml-1">
                              {header.column.getIsSorted() === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5" />
                              ) : header.column.getIsSorted() === "desc" ? (
                                <ArrowDown className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      emptyMessage
                    )}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`
                      ${row.getIsSelected() ? "bg-primary/5 dark:bg-primary/10" : ""}
                      ${onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : ""}
                      transition-colors
                    `}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 text-gray-700 dark:text-gray-300"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Pagination ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Rows per page</span>
          <select
            value={pagination.pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              setPagination({ pageIndex: 0, pageSize: newSize });
              onPaginationChange?.(0, newSize);
            }}
            className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <span className="ml-2">
            {totalCount
              ? `${pagination.pageIndex * pagination.pageSize + 1}–${Math.min(
                  (pagination.pageIndex + 1) * pagination.pageSize,
                  totalCount
                )} of ${totalCount}`
              : `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )} of ${table.getFilteredRowModel().rows.length}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              table.setPageIndex(0);
              onPaginationChange?.(0, pagination.pageSize);
            }}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              table.previousPage();
              onPaginationChange?.(pagination.pageIndex - 1, pagination.pageSize);
            }}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 text-sm font-medium">
            Page {pagination.pageIndex + 1} of {pageCount || 1}
          </span>

          <button
            onClick={() => {
              table.nextPage();
              onPaginationChange?.(pagination.pageIndex + 1, pagination.pageSize);
            }}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              table.setPageIndex(pageCount - 1);
              onPaginationChange?.(pageCount - 1, pagination.pageSize);
            }}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
