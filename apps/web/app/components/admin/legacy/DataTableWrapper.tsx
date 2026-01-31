import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";

interface DataTableWrapperProps<T = any> {
  entityConfig: any;
  data: T[];
  loading?: boolean;
  error?: string | null;
  state: any;
  apiPagination?: { total: number; totalPages: number };
  onStateChange: (updates: any) => void;
  onCreate?: () => void;
  onEdit?: (record: T) => void;
  onView?: (record: T) => void;
  onDelete?: (record: T) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

export function DataTableWrapper<T = any>({
  entityConfig,
  data,
  loading = false,
  error,
  state,
  apiPagination,
  onStateChange,
  onCreate,
  onEdit,
  onView,
  onDelete,
  onRefresh,
  onExport,
}: DataTableWrapperProps<T>) {
  if (!entityConfig) {
    return <div>No entity configuration available</div>;
  }

  return (
    <Box sx={{ width: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          {entityConfig.pluralName}
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          {onRefresh && (
            <Button onClick={onRefresh} variant="outlined" disabled={loading}>
              Refresh
            </Button>
          )}
          {onExport && (
            <Button onClick={onExport} variant="outlined" disabled={loading}>
              Export
            </Button>
          )}
          {onCreate && (
            <Button onClick={onCreate} variant="contained" disabled={loading}>
              Create {entityConfig.name}
            </Button>
          )}
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ mb: 2 }} role="alert" aria-live="assertive">
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* Data Table */}
      <MaterialReactTable
        columns={entityConfig.columns}
        data={data as any[]}
        rowCount={apiPagination?.total ?? data.length}
        muiTableProps={{
          "aria-label": `${entityConfig.pluralName || "Entity"} data table`,
        }}
        state={{
          isLoading: loading,
          pagination: {
            pageIndex: state.pagination.page - 1,
            pageSize: state.pagination.limit,
          },
          sorting: state.sorting.map((s: any) => ({
            id: s.field,
            desc: s.direction === "desc",
          })),
          globalFilter: state.search,
        }}
        enableRowSelection={entityConfig.enableRowSelection ?? true}
        enableMultiRowSelection={true}
        enableColumnFilters={entityConfig.enableColumnFilters ?? true}
        enableGlobalFilter={entityConfig.enableGlobalFilter ?? true}
        enableSorting={entityConfig.enableSorting ?? true}
        enablePagination={entityConfig.enablePagination ?? true}
        onPaginationChange={(updater) => {
          const newPagination =
            typeof updater === "function"
              ? updater({ pageIndex: 0, pageSize: 20 })
              : updater;

          onStateChange({
            pagination: {
              page: newPagination.pageIndex + 1,
              limit: newPagination.pageSize,
            },
          });
        }}
        onSortingChange={(updater) => {
          const newSorting =
            typeof updater === "function" ? updater([]) : updater;

          onStateChange({
            sorting: newSorting.map((s: any) => ({
              field: s.id,
              direction: s.desc ? "desc" : "asc",
            })),
          });
        }}
        onGlobalFilterChange={(value) => {
          onStateChange({ search: value });
        }}
      />
    </Box>
  );
}
