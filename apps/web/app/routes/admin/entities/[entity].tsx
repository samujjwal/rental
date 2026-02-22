
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  useParams,
  type LoaderFunctionArgs,
  useLoaderData,
  Link as RouterLink,
  redirect,
} from "react-router";
import { ChevronRight, Loader2 } from "lucide-react";
import {
  EnhancedDataTable,
  EnhancedForm,
  type FieldConfig as EnhancedFormFieldConfig,
} from "~/components/admin/enhanced";
import { requireAdmin, getSession } from "~/utils/auth";
import { useAuthStore } from "~/lib/store/auth";
import type { User as AuthUser } from "~/types/auth";
import type {
  ViewMode,
  FieldConfig,
  FilterConfig,
} from "~/lib/admin/entity-framework";
import type { ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import { useAdminEntity } from "~/hooks/useAdminEntity";
import { RouteErrorBoundary } from "~/components/ui";

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
  const entity = new URL(request.url).pathname.split("/").pop() || "";
  const allowedEntities = new Set([
    "users",
    "listings",
    "bookings",
    "payments",
    "organizations",
    "categories",
  ]);
  if (!allowedEntities.has(entity)) {
    return redirect("/admin");
  }

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
      setAuth(
        loaderData.user as unknown as AuthUser,
        loaderData.accessToken,
        loaderData.refreshToken
      );
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

  const bulkStatusOptions = useMemo(() => {
    const statusField = entityConfig?.fields.find(
      (field) => String(field.key) === "status" && Array.isArray(field.options)
    );
    if (!statusField?.options) return [];
    return statusField.options.map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }, [entityConfig]);

  const handleBulkDelete = useCallback(
    async (records: EntityRecord[]) => {
      if (!entityConfig) return;
      const ids = records
        .map(getRecordId)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return;
      await Promise.all(ids.map((id) => deleteEntity(id)));
      refresh();
      setRowSelection({});
    },
    [entityConfig, deleteEntity, refresh]
  );

  const handleBulkStatusChange = useCallback(
    async (records: EntityRecord[], status: string) => {
      if (!entityConfig) return;
      const ids = records
        .map(getRecordId)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return;
      await Promise.all(ids.map((id) => update({ id, data: { status } })));
      refresh();
      setRowSelection({});
    },
    [entityConfig, refresh, update]
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
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (errorMessage && !entityConfig) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300 font-medium">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <RouterLink to="/admin" className="hover:text-gray-900 dark:hover:text-gray-200 hover:underline">Admin</RouterLink>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-white">{entityConfig?.pluralName || "Entity"}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {view === "table"
            ? entityConfig?.pluralName
            : view === "form"
              ? selectedRecord
                ? `Edit ${entityConfig?.name}`
                : `Create ${entityConfig?.name}`
              : `${entityConfig?.name} Details`}
        </h1>
        {entityConfig?.description && view === "table" && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{entityConfig.description}</p>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-300 font-medium">{errorMessage}</p>
        </div>
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
          defaultViewMode="table"
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
          onBulkDelete={handleBulkDelete}
          onBulkStatusChange={bulkStatusOptions.length ? handleBulkStatusChange : undefined}
          availableBulkStatuses={bulkStatusOptions}
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
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

