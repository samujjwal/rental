/**
 * Enhanced Data Table Component
 * World-class admin table with all features integrated
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  IconButton,
  Collapse,
  Button,
  Toolbar,
  Typography,
  Tooltip,
  LinearProgress,
  Alert,
} from "@mui/material";
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
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  Settings as SettingsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";

import { SmartSearch } from "./SmartSearch";
import { FilterChips, type FilterChip } from "./FilterChips";
import { CardView, ListView, ViewModeToggle, type ViewMode } from "./DataViews";
import { useResponsiveMode } from "./ResponsiveLayout";

interface EnhancedDataTableProps<T = any> {
  // Data
  data: T[];
  columns: ColumnDef<T>[];
  totalCount?: number;

  // State
  loading?: boolean;
  error?: string;

  // Pagination
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (pagination: {
    pageIndex: number;
    pageSize: number;
  }) => void;

  // Sorting
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;

  // Filtering
  globalFilter?: string;
  onGlobalFilterChange?: (filter: string) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;

  // Selection
  enableSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;

  // Actions
  onRowClick?: (row: T) => void;
  onRowEdit?: (row: T) => void;
  onRowDelete?: (row: T) => void;
  onRowView?: (row: T) => void;
  onAdd?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;

  // Customization
  title?: string;
  enableSearch?: boolean;
  enableFilters?: boolean;
  enableViewModes?: boolean;
  availableViewModes?: ViewMode[];
  defaultViewMode?: ViewMode;

  // Filter configuration
  availableFilterFields?: Array<{
    field: string;
    label: string;
    type: FilterChip["type"];
    options?: Array<{ value: string; label: string }>;
  }>;

  // Advanced features
  enableAdvancedMode?: boolean;
  searchSuggestions?: string[];
}

export function EnhancedDataTable<T = any>({
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
  const responsiveMode = useResponsiveMode();

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>(
    defaultViewMode ||
      (responsiveMode === "mobile"
        ? "cards"
        : responsiveMode === "tablet"
          ? "list"
          : "table")
  );

  // Advanced mode state
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filter chips state
  const [filterChips, setFilterChips] = useState<FilterChip[]>([]);

  // Auto-switch view mode based on screen size
  useEffect(() => {
    if (!defaultViewMode) {
      if (responsiveMode === "mobile") setViewMode("cards");
      else if (responsiveMode === "tablet") setViewMode("list");
      else setViewMode("table");
    }
  }, [responsiveMode, defaultViewMode]);

  // Convert filter chips to column filters
  useEffect(() => {
    if (onColumnFiltersChange) {
      const filters = filterChips.map((chip) => ({
        id: chip.field,
        value: {
          value: chip.value,
          operator: chip.operator || "equals",
        },
      }));
      onColumnFiltersChange(filters);
    }
  }, [filterChips, onColumnFiltersChange]);

  // Table instance
  const table = useReactTable({
    data,
    columns,
    pageCount: totalCount ? Math.ceil(totalCount / pageSize) : -1,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: onSortingChange as any,
    onColumnFiltersChange: onColumnFiltersChange as any,
    onGlobalFilterChange,
    onRowSelectionChange: onRowSelectionChange as any,
    onPaginationChange: onPaginationChange as any,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!totalCount,
    manualSorting: !!onSortingChange,
    manualFiltering: !!onColumnFiltersChange,
    enableRowSelection: enableSelection,
  });

  // Handle search change
  const handleSearchChange = useCallback(
    (value: string) => {
      if (onGlobalFilterChange) {
        onGlobalFilterChange(value);
      }
    },
    [onGlobalFilterChange]
  );

  // Handle filter add
  const handleFilterAdd = useCallback((filter: FilterChip) => {
    setFilterChips((prev) => [...prev, filter]);
  }, []);

  // Handle filter remove
  const handleFilterRemove = useCallback((filterId: string) => {
    setFilterChips((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  // Handle filter update
  const handleFilterUpdate = useCallback((filterId: string, value: any) => {
    setFilterChips((prev) =>
      prev.map((f) => (f.id === filterId ? { ...f, value } : f))
    );
  }, []);

  // Selected rows count
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <Paper elevation={1} sx={{ width: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <Toolbar
        sx={{
          pl: { xs: 2, sm: 3 },
          pr: { xs: 1, sm: 2 },
          py: { xs: 2, sm: 3 },
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, sm: 3 },
          alignItems: "stretch",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {/* Title and Actions Row */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: { xs: "100%", sm: "auto" } }}>
            {title && (
              <Typography
                variant="h5"
                component="div"
                fontWeight={600}
                sx={{ mb: 0.5 }}
              >
                {title}
              </Typography>
            )}
            {selectedCount > 0 && (
              <Typography variant="body2" color="text.secondary">
                {selectedCount} selected
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {enableViewModes && (
              <ViewModeToggle
                value={viewMode}
                onChange={setViewMode}
                availableModes={availableViewModes}
              />
            )}

            {onRefresh && (
              <Tooltip title="Refresh">
                <IconButton onClick={onRefresh} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}

            {onExport && (
              <Tooltip title="Export">
                <IconButton onClick={onExport} size="small">
                  <ExportIcon />
                </IconButton>
              </Tooltip>
            )}

            {onAdd && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAdd}
                size="medium"
              >
                Add New
              </Button>
            )}
          </Box>
        </Box>

        {/* Search and Filters Row */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            width: "100%",
          }}
        >
          {enableSearch && (
            <SmartSearch
              value={globalFilter}
              onChange={handleSearchChange}
              suggestions={searchSuggestions}
              placeholder="Search..."
              fullWidth
            />
          )}

          {enableFilters && (
            <FilterChips
              filters={filterChips}
              onFilterAdd={handleFilterAdd}
              onFilterRemove={handleFilterRemove}
              onFilterUpdate={handleFilterUpdate}
              availableFields={availableFilterFields}
            />
          )}
        </Box>

        {/* Advanced Mode Toggle */}
        {enableAdvancedMode && (
          <Box>
            <Button
              size="small"
              startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowAdvanced(!showAdvanced)}
              sx={{ alignSelf: "flex-start" }}
            >
              {showAdvanced ? "Hide" : "Show"} Advanced Options
            </Button>

            <Collapse in={showAdvanced}>
              <Box
                sx={{
                  mt: 2,
                  p: 3,
                  bgcolor: "grey.50",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 3,
                  }}
                >
                  {/* Active Filters Info */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      fontWeight={600}
                    >
                      Active Filters ({filterChips.length})
                    </Typography>
                    {filterChips.length > 0 ? (
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 1.5,
                        }}
                      >
                        {filterChips.map((chip) => (
                          <Box
                            key={chip.id}
                            sx={{
                              bgcolor: "white",
                              p: 1.5,
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="body2" component="div">
                              <strong>{chip.field}</strong> {chip.operator}{" "}
                              {String(chip.value)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: "italic" }}
                      >
                        No filters applied
                      </Typography>
                    )}
                  </Box>

                  {/* Table Stats */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      fontWeight={600}
                    >
                      Table Statistics
                    </Typography>
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          py: 0.5,
                        }}
                      >
                        <Typography variant="body2">Total Records:</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {totalCount || data.length}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          py: 0.5,
                        }}
                      >
                        <Typography variant="body2">Displayed:</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {data.length}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          py: 0.5,
                        }}
                      >
                        <Typography variant="body2">Selected:</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {selectedCount}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          py: 0.5,
                        }}
                      >
                        <Typography variant="body2">Page Size:</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {pageSize}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Collapse>
          </Box>
        )}
      </Toolbar>

      {/* Loading Bar */}
      {loading && <LinearProgress />}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Data Display */}
      <Box sx={{ px: { xs: 1, sm: 2 }, pb: { xs: 1, sm: 2 } }}>
        {viewMode === "cards" && (
          <CardView
            data={data}
            columns={columns}
            viewMode={viewMode}
            onRowClick={onRowClick}
            onRowEdit={onRowEdit}
            onRowDelete={onRowDelete}
            onRowView={onRowView}
          />
        )}

        {viewMode === "list" && (
          <ListView
            data={data}
            columns={columns}
            viewMode={viewMode}
            onRowClick={onRowClick}
            onRowEdit={onRowEdit}
            onRowDelete={onRowDelete}
            onRowView={onRowView}
          />
        )}

        {viewMode === "table" && (
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table
              size="medium"
              sx={{ "& .MuiTableCell-root": { py: 1.5, px: 2 } }}
            >
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {enableSelection && (
                      <TableCell
                        padding="checkbox"
                        sx={{
                          borderBottom: "2px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Checkbox
                          checked={table.getIsAllRowsSelected()}
                          indeterminate={table.getIsSomeRowsSelected()}
                          onChange={table.getToggleAllRowsSelectedHandler()}
                        />
                      </TableCell>
                    )}
                    {headerGroup.headers.map((header) => (
                      <TableCell
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        sx={{
                          cursor: header.column.getCanSort()
                            ? "pointer"
                            : "default",
                          fontWeight: 600,
                          borderBottom: "2px solid",
                          borderColor: "divider",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </TableCell>
                    ))}
                    {(onRowView || onRowEdit || onRowDelete) && (
                      <TableCell
                        align="right"
                        sx={{
                          width: 120,
                          borderBottom: "2px solid",
                          borderColor: "divider",
                        }}
                      >
                        Actions
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    selected={row.getIsSelected()}
                    sx={{
                      "&:hover": { bgcolor: "action.hover" },
                      "&:nth-of-type(even)": { bgcolor: "grey.50" },
                      "&:nth-of-type(even):hover": { bgcolor: "action.hover" },
                    }}
                  >
                    {enableSelection && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={row.getIsSelected()}
                          onChange={row.getToggleSelectedHandler()}
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} sx={{ verticalAlign: "top" }}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                    {(onRowView || onRowEdit || onRowDelete) && (
                      <TableCell align="right" sx={{ verticalAlign: "top" }}>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            justifyContent: "flex-end",
                          }}
                        >
                          {onRowView && (
                            <Tooltip title="View">
                              <IconButton
                                size="small"
                                onClick={() => onRowView(row.original)}
                                color="primary"
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onRowEdit && (
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => onRowEdit(row.original)}
                                color="info"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onRowDelete && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => onRowDelete(row.original)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Pagination */}
      <Box
        sx={{
          borderTop: "1px solid",
          borderColor: "divider",
          px: { xs: 1, sm: 2 },
          py: 2,
          display: "flex",
          justifyContent: "center",
          bgcolor: "grey.50",
        }}
      >
        <TablePagination
          component="div"
          count={totalCount || data.length}
          page={pageIndex}
          onPageChange={(_, page) =>
            onPaginationChange?.({ pageIndex: page, pageSize })
          }
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) =>
            onPaginationChange?.({
              pageIndex: 0,
              pageSize: parseInt(e.target.value, 10),
            })
          }
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          sx={{
            "& .MuiTablePagination-toolbar": {
              padding: 0,
              minHeight: "auto",
            },
            "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
              {
                margin: 0,
              },
          }}
        />
      </Box>
    </Paper>
  );
}

export default EnhancedDataTable;
