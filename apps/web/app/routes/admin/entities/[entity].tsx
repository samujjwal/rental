/* eslint-disable react-refresh/only-export-components */
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  useParams,
  type LoaderFunctionArgs,
  useLoaderData,
  Link as RouterLink,
} from "react-router";
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  EnhancedDataTable,
  EnhancedForm,
  type FieldConfig as EnhancedFormFieldConfig,
} from "~/components/admin/enhanced";
import { requireAdmin, getSession } from "~/utils/auth";
import { useAuthStore } from "~/lib/store/auth";
import type {
  ViewMode,
  FieldConfig,
  FilterConfig,
} from "~/lib/admin/entity-framework";
import type { ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import { useAdminEntity } from "~/hooks/useAdminEntity";

type EntityRecord = Record<string, unknown> & { id?: unknown };

type FilterFieldType = "number" | "boolean" | "select" | "text" | "date";
type AvailableFilterField = {
  field: string;
  label: string;
  type: FilterFieldType;
  options?: Array<{ value: string; label: string }>;
};

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const message = record.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return null;
}

function getRecordId(record: EntityRecord): string | null {
  const id = record.id;
  if (typeof id === "string" && id.trim().length > 0) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");

  return { user, accessToken, refreshToken };
}

/**
 * Modern Dynamic Admin Page
 *
 * This page loads entity configuration from the API and renders
 * the appropriate admin interface dynamically using the new
 * ModernTanStackTable and ModernTanStackForm components.
 */

export default function ModernDynamicEntityPage() {
  const { entity } = useParams<{ entity: string }>();
  const loaderData = useLoaderData<typeof clientLoader>();
  const { setAuth } = useAuthStore();

  const {
    entityConfig,
    isConfigLoading,
    configError,
    data,
    total,
    isDataLoading,
    dataError,
    tableState,
    updateTableState,
    fetchDetail,
    create,
    update,
    delete: deleteEntity,
    refresh,
    isCreating,
    isUpdating,
    isDeleting,
  } = useAdminEntity({ entity: entity ?? "", initialPageSize: 25 });

  const [view, setView] = useState<ViewMode>("table");
  const [selectedRecord, setSelectedRecord] = useState<EntityRecord | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Sync server-side auth to client-side store
  useEffect(() => {
    if (
      loaderData?.user &&
      loaderData?.accessToken &&
      loaderData?.refreshToken
    ) {
      setAuth(loaderData.user, loaderData.accessToken, loaderData.refreshToken);
    }
  }, [loaderData, setAuth]);

  useEffect(() => {
    setView("table");
    setSelectedRecord(null);
    setRowSelection({});
  }, [entity]);

  // Handle create
  const handleCreate = () => {
    setSelectedRecord(null);
    setView("form");
  };

  // Handle edit
  const handleEdit = async (record: EntityRecord) => {
    if (!entityConfig) return;
    const id = getRecordId(record);
    if (!id) return;
    try {
      const detail = await fetchDetail(id);
      setSelectedRecord((detail as EntityRecord | null) ?? record);
      setView("form");
    } catch (err) {
      console.error("Failed to load record:", err);
    }
  };

  // Handle view
  const handleView = useCallback(
    async (record: EntityRecord) => {
      if (!entityConfig) return;
      setSelectedRecord(record);
      setView("detail");
      try {
        const id = getRecordId(record);
        if (!id) return;
        const detail = await fetchDetail(id);
        if (detail) setSelectedRecord(detail as EntityRecord);
      } catch (err) {
        console.warn("Failed to fetch full record details:", err);
      }
    },
    [entityConfig, fetchDetail]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (record: EntityRecord) => {
      if (!entityConfig) return;
      if (!window.confirm(`Are you sure you want to delete this ${entityConfig.name}?`)) {
        return;
      }
      const id = getRecordId(record);
      if (!id) return;
      await deleteEntity(id);
      refresh();
      setView("table");
      setSelectedRecord(null);
    },
    [entityConfig, deleteEntity, refresh]
  );

  // Handle form submit
  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    if (!entityConfig) return;

    const isCreate = !selectedRecord;
    if (isCreate) {
      await create(formData);
    } else {
      const id = getRecordId(selectedRecord);
      if (!id) return;
      await update({ id, data: formData });
    }

    refresh();
    setView("table");
    setSelectedRecord(null);
  };

  // Handle cancel
  const handleCancel = () => {
    setView("table");
    setSelectedRecord(null);
  };

  // Transform entity fields to modern form fields
  const transformFieldsToModernForm = (
    fields: FieldConfig[]
  ): EnhancedFormFieldConfig[] => {
    return fields.map((field) => ({
      name: field.key as string,
      label: field.label,
      type: field.type as EnhancedFormFieldConfig["type"],
      required: field.validation?.required,
      placeholder: field.placeholder,
      helperText: field.helperText,
      options: field.options,
      multiple: field.type === "multiselect",
      multiline: field.type === "textarea",
      rows: field.type === "textarea" ? 4 : undefined,
      defaultValue: field.defaultValue,
      disabled: field.disabled as boolean,
      gridColumn: field.gridColumn,
    }));
  };

  // Transform entity filters to modern form filters
  const transformFiltersToModernForm = (
    filters?: FilterConfig[]
  ): AvailableFilterField[] => {
    return (
      filters?.map((filter) => ({
        field: filter.key as string,
        label: filter.label,
        type: (() => {
          switch (filter.type) {
            case "number":
              return "number";
            case "boolean":
              return "boolean";
            case "select":
            case "multiselect":
              return "select";
            case "date":
            case "datetime":
              return "date";
            default:
              return "text";
          }
        })(),
        options: filter.options,
        operator: filter.operator,
      })) || []
    );
  };

  const errorMessage = getErrorMessage(configError) ?? getErrorMessage(dataError);

  const loading =
    isConfigLoading || isDataLoading || isCreating || isUpdating || isDeleting;

  const sorting: SortingState = useMemo(
    () =>
      tableState.sorting.map((s) => ({
        id: s.field,
        desc: s.direction === "desc",
      })),
    [tableState.sorting]
  );

  const columnFilters: ColumnFiltersState = useMemo(
    () =>
      Object.entries(tableState.filters || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([id, value]) => ({ id, value })),
    [tableState.filters]
  );

  const globalFilter = tableState.search || "";
  const pagination = {
    pageIndex: Math.max(0, (tableState.pagination.page || 1) - 1),
    pageSize: tableState.pagination.limit || 25,
  };

  // Loading state
  if (isConfigLoading) {
    return (
      <Box
        sx={{
          p: 3,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (errorMessage && !entityConfig) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{errorMessage}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          component={RouterLink}
          to="/admin"
          underline="hover"
        >
          Admin
        </Link>
        <Typography color="text.primary">
          {entityConfig?.pluralName || "Entity"}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {view === "table"
            ? entityConfig?.pluralName
            : view === "form"
              ? selectedRecord
                ? `Edit ${entityConfig?.name}`
                : `Create ${entityConfig?.name}`
              : `${entityConfig?.name} Details`}
        </Typography>
        {entityConfig?.description && view === "table" && (
          <Typography variant="body2" color="text.secondary">
            {entityConfig.description}
          </Typography>
        )}
      </Box>

      {/* Error Alert */}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Content */}
      {view === "table" && entityConfig && (
        <EnhancedDataTable
          data={data}
          columns={entityConfig.columns as unknown as ColumnDef<Record<string, unknown>>[]}
          title={entityConfig.pluralName}
          loading={loading}
          error={errorMessage || undefined}
          totalCount={total}
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          onPaginationChange={(p) => {
            updateTableState({
              pagination: {
                ...tableState.pagination,
                page: p.pageIndex + 1,
                limit: p.pageSize,
              },
            });
          }}
          sorting={sorting}
          onSortingChange={(next) => {
            updateTableState({
              sorting: next.map((s) => ({
                field: s.id,
                direction: s.desc ? "desc" : "asc",
              })),
              pagination: { ...tableState.pagination, page: 1 },
            });
          }}
          columnFilters={columnFilters}
          onColumnFiltersChange={(next) => {
            const filtersObject = next.reduce<Record<string, unknown>>((acc, f) => {
              acc[f.id] = f.value;
              return acc;
            }, {});
            updateTableState({
              filters: filtersObject,
              pagination: { ...tableState.pagination, page: 1 },
            });
          }}
          globalFilter={globalFilter}
          onGlobalFilterChange={(filter) => {
            updateTableState({
              search: filter,
              pagination: { ...tableState.pagination, page: 1 },
            });
          }}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          enableSearch
          enableFilters
          enableViewModes
          enableSelection
          enableAdvancedMode
          availableFilterFields={transformFiltersToModernForm(
            entityConfig.filters
          )}
          // filters={activeFilters} // Not supported prop?
          // onFilterAdd={handleFilterAdd}
          // onFilterRemove={handleFilterRemove}
          // onFilterUpdate={handleFilterUpdate}
          onAdd={handleCreate}
          onRefresh={refresh}
          onRowView={handleView}
          onRowEdit={handleEdit}
          onRowDelete={handleDelete}
        />
      )}

      {(view === "form" || view === "detail") && entityConfig && (
        <EnhancedForm
          fields={transformFieldsToModernForm(entityConfig.fields)}
          initialData={selectedRecord ?? undefined}
          mode={view === "detail" ? "view" : selectedRecord ? "edit" : "create"}
          layout="single"
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          title={
            view === "detail"
              ? `${entityConfig.name} Details`
              : selectedRecord
                ? `Edit ${entityConfig.name}`
                : `Create ${entityConfig.name}`
          }
          submitLabel={selectedRecord ? "Save Changes" : "Create"}
          loading={loading}
          enableAutoSave={false}
        />
      )}
    </Box>
  );
}
