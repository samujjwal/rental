import React, { useState, useCallback, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type ColumnSizingState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TablePagination,
  Checkbox,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Alert,
  Collapse,
} from "@mui/material";
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  OpenInNew as ViewIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

// Enhanced interfaces
interface FilterField {
  id: string;
  label: string;
  type: "text" | "select" | "number" | "date" | "boolean";
  options?: Array<{ value: string; label: string }>;
  operator?:
    | "eq"
    | "neq"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in";
}

interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: "primary" | "secondary" | "success" | "error" | "warning" | "info";
  variant?: "contained" | "outlined" | "text";
  requiresSelection?: boolean;
  confirmation?: string;
  handler: (
    selectedIds: string[],
    selectedRecords: any[]
  ) => Promise<void> | void;
}

interface RowAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: "primary" | "secondary" | "success" | "error" | "warning" | "info";
  handler: (record: any) => Promise<void> | void;
}

interface EditableCellProps {
  value: any;
  row: any;
  column: any;
  onUpdate: (value: any) => void;
  type: string;
}

// Editable Cell Component
const EditableCell: React.FC<EditableCellProps> = ({
  value,
  row,
  column,
  onUpdate,
  type,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onUpdate(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {type === "boolean" ? (
          <Select
            value={String(editValue)}
            onChange={(e) => setEditValue(e.target.value === "true")}
            size="small"
            sx={{ minWidth: 100 }}
            autoFocus
          >
            <MenuItem value="true">True</MenuItem>
            <MenuItem value="false">False</MenuItem>
          </Select>
        ) : type === "select" ? (
          <Select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            size="small"
            sx={{ minWidth: 120 }}
            autoFocus
          >
            {column.columnDef.meta?.options?.map((option: any) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <TextField
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            type={
              type === "number" ? "number" : type === "date" ? "date" : "text"
            }
            size="small"
            sx={{ minWidth: 100 }}
            autoFocus
            onKeyDown={handleKeyDown}
          />
        )}
        <IconButton size="small" onClick={handleSave} color="primary">
          <VisibilityIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleCancel}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{ cursor: "pointer", "&:hover": { backgroundColor: "action.hover" } }}
      onClick={() => setIsEditing(true)}
    >
      {column.columnDef.cell?.({ getValue: () => value, row, column }) ||
        String(value || "")}
    </Box>
  );
};

interface ModernTanStackTableProps<T extends Record<string, any>> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  error?: string | null;
  totalCount?: number;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
  enableColumnVisibility?: boolean;
  enableRowSelection?: boolean;
  enableMultiRowSelection?: boolean;
  enableInlineEditing?: boolean;
  manualPagination?: boolean;
  manualSorting?: boolean;
  manualFiltering?: boolean;

  // Enhanced features
  filterFields?: FilterField[];
  bulkActions?: BulkAction[];
  rowActions?: RowAction[];

  // Event handlers
  onSortingChange?: (sorting: SortingState) => void;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  onPaginationChange?: (pagination: {
    pageIndex: number;
    pageSize: number;
  }) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  onRowEdit?: (
    rowId: string,
    field: string,
    value: any
  ) => Promise<void> | void;
  onRowView?: (record: T) => void;
  onRowDelete?: (record: T) => Promise<void> | void;
  onRefresh?: () => void;

  initialState?: {
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    columnVisibility?: VisibilityState;
    rowSelection?: RowSelectionState;
    pagination?: {
      pageIndex: number;
      pageSize: number;
    };
  };
  className?: string;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function ModernTanStackTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error,
  totalCount,
  enableSorting = true,
  enableFiltering = true,
  enablePagination = true,
  enableColumnVisibility = true,
  enableRowSelection = true,
  enableMultiRowSelection = true,
  enableInlineEditing = false,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  filterFields = [],
  bulkActions = [],
  rowActions = [],
  onSortingChange,
  onColumnFiltersChange,
  onPaginationChange,
  onRowSelectionChange,
  onColumnVisibilityChange,
  onRowEdit,
  onRowView,
  onRowDelete,
  onRefresh,
  initialState,
  className,
  emptyState,
  errorState,
  headerActions,
}: ModernTanStackTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(
    initialState?.sorting ?? []
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    initialState?.columnFilters ?? []
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialState?.columnVisibility ?? {}
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<{
    pageIndex: number;
    pageSize: number;
  }>(initialState?.pagination ?? { pageIndex: 0, pageSize: 10 });

  // UI State
  const [columnVisibilityAnchorEl, setColumnVisibilityAnchorEl] =
    useState<null | HTMLElement>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [rowActionsAnchorEl, setRowActionsAnchorEl] =
    useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: string;
  } | null>(null);

  // Enhanced columns with actions and inline editing
  const enhancedColumns = useMemo(() => {
    const cols = [...columns];

    // Add selection column
    if (enableRowSelection) {
      cols.unshift({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            indeterminate={table.getIsSomeRowsSelected()}
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 50,
      } as ColumnDef<T>);
    }

    // Add actions column
    if (rowActions.length > 0) {
      cols.push({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            {rowActions.map((action) => (
              <Tooltip key={action.id} title={action.label}>
                <IconButton
                  size="small"
                  onClick={() => action.handler(row.original)}
                  color={action.color as any}
                >
                  {action.icon}
                </IconButton>
              </Tooltip>
            ))}
            <Tooltip title="More Actions">
              <IconButton
                size="small"
                onClick={(e) => {
                  setRowActionsAnchorEl(e.currentTarget);
                  setSelectedRow(row.original);
                }}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 120,
      } as ColumnDef<T>);
    }

    // Enable inline editing for cells
    if (enableInlineEditing) {
      return cols.map((col) => ({
        ...col,
        cell: ({ getValue, row, column }: any) => {
          const isEditing =
            editingCell?.rowId === row.id && editingCell?.field === column.id;

          if (isEditing && onRowEdit) {
            return (
              <EditableCell
                value={getValue()}
                row={row}
                column={column}
                onUpdate={(newValue) => {
                  onRowEdit(row.id, column.id, newValue);
                  setEditingCell(null);
                }}
                type={column.columnDef.meta?.type || "text"}
              />
            );
          }

          const originalCell = col.cell;
          if (originalCell && typeof originalCell === "function") {
            return originalCell({
              getValue,
              row,
              column,
              cell: column as any,
              renderValue: getValue,
              table: table as any,
            });
          }

          return (
            <Box
              sx={{
                cursor:
                  enableInlineEditing && onRowEdit ? "pointer" : "default",
              }}
              onClick={() => {
                if (enableInlineEditing && onRowEdit) {
                  setEditingCell({ rowId: row.id, field: column.id });
                }
              }}
            >
              {String(getValue() || "")}
            </Box>
          );
        },
      }));
    }

    return cols;
  }, [
    columns,
    enableRowSelection,
    rowActions,
    enableInlineEditing,
    onRowEdit,
    editingCell,
  ]);

  // Handle sorting changes
  const handleSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      onSortingChange?.(newSorting);
    },
    [sorting, onSortingChange]
  );

  // Handle column filter changes
  const handleColumnFiltersChange = useCallback(
    (
      updater:
        | ColumnFiltersState
        | ((prev: ColumnFiltersState) => ColumnFiltersState)
    ) => {
      const newFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);
      onColumnFiltersChange?.(newFilters);
    },
    [columnFilters, onColumnFiltersChange]
  );

  // Handle pagination changes
  const handlePaginationChange = useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          })
    ) => {
      const newPagination =
        typeof updater === "function" ? updater(pagination) : updater;
      setPagination(newPagination);
      onPaginationChange?.(newPagination);
    },
    [pagination, onPaginationChange]
  );

  // Handle row selection changes
  const handleRowSelectionChange = useCallback(
    (
      updater:
        | RowSelectionState
        | ((prev: RowSelectionState) => RowSelectionState)
    ) => {
      const newSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(newSelection);
      onRowSelectionChange?.(newSelection);
    },
    [rowSelection, onRowSelectionChange]
  );

  // Handle column visibility changes
  const handleColumnVisibilityChange = useCallback(
    (
      updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)
    ) => {
      const newVisibility =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      onColumnVisibilityChange?.(newVisibility);
    },
    [columnVisibility, onColumnVisibilityChange]
  );

  // Handle bulk action execution
  const handleBulkAction = async (action: BulkAction) => {
    const selectedIds = Object.keys(rowSelection);
    const selectedRecords = selectedIds
      .map((id) => data.find((row) => row.id === id))
      .filter(Boolean);

    if (action.requiresSelection && selectedIds.length === 0) {
      return;
    }

    if (action.confirmation) {
      const confirmed = window.confirm(action.confirmation);
      if (!confirmed) return;
    }

    try {
      await action.handler(selectedIds, selectedRecords as T[]);
      // Clear selection after successful action
      setRowSelection({});
    } catch (error) {
      console.error("Bulk action failed:", error);
    }
  };

  // Create the table instance
  const table = useReactTable({
    data,
    columns: enhancedColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
      globalFilter,
      pagination,
    },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination,
    manualSorting,
    manualFiltering,
    pageCount: manualPagination
      ? Math.ceil((totalCount ?? data.length) / pagination.pageSize)
      : undefined,
    rowCount: manualPagination ? (totalCount ?? data.length) : undefined,
    enableSorting,
    enableColumnFilters: enableFiltering,
    enableRowSelection,
    enableMultiRowSelection,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    initialState,
  });

  // Render empty state
  if (!loading && data.length === 0 && !error) {
    return (
      <Box className={className}>
        {emptyState || (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No data available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              There are no records to display at this time.
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box className={className}>
        {errorState || (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="error" gutterBottom>
              Error loading data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
            {onRefresh && (
              <Button onClick={onRefresh} variant="outlined" sx={{ mt: 2 }}>
                Try Again
              </Button>
            )}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box className={className}>
      {/* Header with controls */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Global Search */}
          {enableFiltering && (
            <TextField
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            />
          )}

          {/* Filter Toggle */}
          {filterFields.length > 0 && (
            <Button
              variant={showFilters ? "contained" : "outlined"}
              leftIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
              {columnFilters.length > 0 && (
                <Badge
                  badgeContent={columnFilters.length}
                  color="primary"
                  sx={{ ml: 1 }}
                >
                  <Box />
                </Badge>
              )}
            </Button>
          )}

          {/* Column Visibility */}
          {enableColumnVisibility && (
            <Button
              variant="outlined"
              leftIcon={<VisibilityIcon />}
              onClick={(e) => setColumnVisibilityAnchorEl(e.currentTarget)}
            >
              Columns
            </Button>
          )}

          {/* Refresh */}
          {onRefresh && (
            <IconButton onClick={onRefresh} title="Refresh">
              <RefreshIcon />
            </IconButton>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          {/* Selected rows count */}
          {Object.keys(rowSelection).length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {Object.keys(rowSelection).length} selected
            </Typography>
          )}

          {/* Bulk Actions */}
          {bulkActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || "outlined"}
              color={action.color as any}
              onClick={() => handleBulkAction(action)}
              disabled={
                action.requiresSelection &&
                Object.keys(rowSelection).length === 0
              }
              leftIcon={action.icon}
            >
              {action.label}
            </Button>
          ))}

          {headerActions}
        </Box>
      </Box>

      {/* Advanced Filters Panel */}
      {showFilters && filterFields.length > 0 && (
        <Collapse in={showFilters}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Advanced Filters
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {filterFields.map((field) => (
                <Box key={field.id} sx={{ minWidth: 200 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{field.label}</InputLabel>
                    {field.type === "select" ? (
                      <Select
                        value={
                          columnFilters.find((f) => f.id === field.id)?.value ||
                          ""
                        }
                        onChange={(e) => {
                          const existingFilter = columnFilters.find(
                            (f) => f.id === field.id
                          );
                          if (existingFilter) {
                            handleColumnFiltersChange(
                              columnFilters.map((f) =>
                                f.id === field.id
                                  ? { ...f, value: e.target.value }
                                  : f
                              )
                            );
                          } else {
                            handleColumnFiltersChange([
                              ...columnFilters,
                              { id: field.id, value: e.target.value },
                            ]);
                          }
                        }}
                      >
                        {field.options?.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    ) : (
                      <TextField
                        type={
                          field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        value={
                          columnFilters.find((f) => f.id === field.id)?.value ||
                          ""
                        }
                        onChange={(e) => {
                          const existingFilter = columnFilters.find(
                            (f) => f.id === field.id
                          );
                          if (existingFilter) {
                            handleColumnFiltersChange(
                              columnFilters.map((f) =>
                                f.id === field.id
                                  ? { ...f, value: e.target.value }
                                  : f
                              )
                            );
                          } else {
                            handleColumnFiltersChange([
                              ...columnFilters,
                              { id: field.id, value: e.target.value },
                            ]);
                          }
                        }}
                        label={field.label}
                      />
                    )}
                  </FormControl>
                </Box>
              ))}
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Button
                  variant="outlined"
                  leftIcon={<ClearIcon />}
                  onClick={() => handleColumnFiltersChange([])}
                  size="small"
                >
                  Clear All
                </Button>
              </Box>
            </Box>
          </Paper>
        </Collapse>
      )}

      {/* Loading indicator */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    style={{ width: header.getSize() }}
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.50",
                      cursor: header.column.getCanSort()
                        ? "pointer"
                        : "default",
                      userSelect: "none",
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                          <ArrowUpwardIcon
                            sx={{
                              fontSize: 12,
                              color:
                                header.column.getIsSorted() === "asc"
                                  ? "primary.main"
                                  : "grey.400",
                              opacity:
                                header.column.getIsSorted() === "desc"
                                  ? 0.3
                                  : 1,
                            }}
                          />
                          <ArrowDownwardIcon
                            sx={{
                              fontSize: 12,
                              color:
                                header.column.getIsSorted() === "desc"
                                  ? "primary.main"
                                  : "grey.400",
                              opacity:
                                header.column.getIsSorted() === "asc" ? 0.3 : 1,
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                sx={{
                  "&:hover": { backgroundColor: "action.hover" },
                  backgroundColor: row.getIsSelected()
                    ? "action.selected"
                    : "inherit",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {enablePagination && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Showing {table.getRowModel().rows.length} of{" "}
            {manualPagination
              ? totalCount
              : table.getFilteredRowModel().rows.length}{" "}
            results
            {manualPagination && totalCount && ` (${totalCount} total)`}
          </Typography>
          <TablePagination
            component="div"
            count={
              manualPagination
                ? (totalCount ?? data.length)
                : table.getFilteredRowModel().rows.length
            }
            page={
              manualPagination
                ? pagination.pageIndex
                : table.getState().pagination.pageIndex
            }
            onPageChange={(_, page) => {
              if (manualPagination) {
                handlePaginationChange({
                  pageIndex: page,
                  pageSize: pagination.pageSize,
                });
              } else {
                table.setPageIndex(page);
              }
            }}
            rowsPerPage={table.getState().pagination.pageSize}
            onRowsPerPageChange={(e) => {
              const pageSize = Number(e.target.value);
              if (manualPagination) {
                handlePaginationChange({ pageIndex: 0, pageSize });
              } else {
                table.setPageSize(pageSize);
              }
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Box>
      )}

      {/* Column Visibility Menu */}
      <Menu
        anchorEl={columnVisibilityAnchorEl}
        open={Boolean(columnVisibilityAnchorEl)}
        onClose={() => setColumnVisibilityAnchorEl(null)}
      >
        <MenuList dense>
          <MenuItemComponent
            onClick={() => {
              Object.keys(columnVisibility).forEach((key) => {
                handleColumnVisibilityChange({
                  ...columnVisibility,
                  [key]: true,
                });
              });
              setColumnVisibilityAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Show All</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={() => {
              Object.keys(columnVisibility).forEach((key) => {
                handleColumnVisibilityChange({
                  ...columnVisibility,
                  [key]: false,
                });
              });
              setColumnVisibilityAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Hide All</ListItemText>
          </MenuItemComponent>
          <Divider />
          {table.getAllColumns().map((column) => (
            <MenuItemComponent
              key={column.id}
              onClick={() => {
                handleColumnVisibilityChange({
                  ...columnVisibility,
                  [column.id]: !column.getIsVisible(),
                });
              }}
            >
              <ListItemIcon>
                {column.getIsVisible() ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <VisibilityOffIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>{column.id}</ListItemText>
            </MenuItemComponent>
          ))}
        </MenuList>
      </Menu>

      {/* Row Actions Menu */}
      <Menu
        anchorEl={rowActionsAnchorEl}
        open={Boolean(rowActionsAnchorEl)}
        onClose={() => {
          setRowActionsAnchorEl(null);
          setSelectedRow(null);
        }}
      >
        <MenuList dense>
          {onRowView && (
            <MenuItemComponent
              onClick={() => {
                if (selectedRow) onRowView(selectedRow);
                setRowActionsAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <ViewIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>View Details</ListItemText>
            </MenuItemComponent>
          )}
          {onRowDelete && (
            <MenuItemComponent
              onClick={() => {
                if (
                  selectedRow &&
                  window.confirm("Are you sure you want to delete this record?")
                ) {
                  onRowDelete(selectedRow);
                }
                setRowActionsAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItemComponent>
          )}
        </MenuList>
      </Menu>
    </Box>
  );
}
