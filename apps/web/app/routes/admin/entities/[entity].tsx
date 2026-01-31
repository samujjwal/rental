import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  useNavigate,
  useParams,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  EnhancedDataTable,
  EnhancedForm,
  type FormStep,
} from "~/components/admin/enhanced";
import { requireAdmin, getSession } from "~/utils/auth.server";
import { useAuthStore } from "~/lib/store/auth";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import type {
  EntityConfig,
  TableState,
  ViewMode,
  FieldConfig,
  FilterConfig,
} from "~/lib/admin/entity-framework";
import type { ColumnDef } from "@tanstack/react-table";

// API URL configuration - should match the API server port
const API_URL = process.env.API_URL || "http://localhost:3400";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");

  return { user, accessToken, refreshToken };
}

/**
 * Authenticated fetch helper
 * Includes Authorization header from localStorage and credentials for cookies
 */
async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include", // Include cookies for __session auth
  });
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
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const { setAuth } = useAuthStore();

  // State
  const [view, setView] = useState<ViewMode>("table");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityConfig, setEntityConfig] = useState<EntityConfig | null>(null);
  const [currentEntity, setCurrentEntity] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Force component to remount when entity changes
  const entityKey = `entity-${entity}`;

  // Table state for ModernTanStackTable
  const [sorting, setSorting] = useState<ColumnDef<any>[]>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnDef<any>[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState("");

  // Filter state for FilterChips
  const [activeFilters, setActiveFilters] = useState<any[]>([]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });

  // API pagination state
  const [apiPagination, setApiPagination] = useState({
    total: 0,
    totalPages: 1,
  });

  // Sync server-side auth to client-side store
  useEffect(() => {
    if (
      loaderData?.user &&
      loaderData?.accessToken &&
      loaderData?.refreshToken
    ) {
      setAuth(loaderData.user, loaderData.accessToken, loaderData.refreshToken);
      setIsAuthReady(true);
    } else {
      setIsAuthReady(true);
    }
  }, [loaderData, setAuth]);

  // Handle entity changes - separate from data fetching
  useEffect(() => {
    console.log(
      "[Entity Change] entity:",
      entity,
      "currentEntity:",
      currentEntity,
      "isAuthReady:",
      isAuthReady
    );
    if (entity && entity !== currentEntity && isAuthReady) {
      console.log("[Entity Change] Resetting state for new entity:", entity);
      // Reset state for new entity
      setView("table");
      setSelectedRecord(null);
      setData([]);
      setLoading(false);
      setConfigLoading(true);
      setError(null);
      setEntityConfig(null);
      setSorting([]);
      setColumnFilters([]);
      setColumnVisibility({});
      setRowSelection({});
      setGlobalFilter("");
      setPagination({ pageIndex: 0, pageSize: 25 });
      setApiPagination({ total: 0, totalPages: 1 });
      setCurrentEntity(entity);
    }
  }, [entity, currentEntity, isAuthReady]);

  // Fetch entity config when entity changes
  useEffect(() => {
    console.log(
      "[Config Fetch] entity:",
      entity,
      "currentEntity:",
      currentEntity,
      "isAuthReady:",
      isAuthReady,
      "entityConfig.slug:",
      entityConfig?.slug
    );
    if (entity && currentEntity === entity && isAuthReady) {
      // Always fetch config if we don't have one or if it doesn't match the current entity
      if (!entityConfig || entityConfig.slug !== entity) {
        console.log("[Config Fetch] Fetching config for entity:", entity);
        const fetchConfig = async () => {
          setConfigLoading(true);
          setError(null);

          try {
            const response = await authFetch(
              `${API_URL}/api/admin/schema/${entity}`
            );

            if (!response.ok) {
              if (response.status === 404) {
                throw new Error(`Entity "${entity}" not found`);
              }
              throw new Error("Failed to load entity configuration");
            }

            const schema = await response.json();
            const config = transformSchemaToConfig(schema);
            setEntityConfig(config);
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to load configuration"
              );
            }
          } finally {
            setConfigLoading(false);
          }
        };

        fetchConfig();
      }
    }
  }, [entity, currentEntity, isAuthReady, entityConfig]);

  // Fetch data when entity config is available and table state changes
  useEffect(() => {
    const shouldFetch =
      entityConfig &&
      entity &&
      isAuthReady &&
      !configLoading &&
      entityConfig.slug === entity;
    console.log(
      "[Data Fetch] Check - entity:",
      entity,
      "shouldFetch:",
      shouldFetch,
      "entityConfig.slug:",
      entityConfig?.slug,
      "configLoading:",
      configLoading
    );
    if (shouldFetch) {
      console.log("[Data Fetch] Starting fetch for entity:", entity);
      const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
          const params = new URLSearchParams({
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            ...(globalFilter && { search: globalFilter }),
            ...(sorting.length > 0 && {
              sortBy: sorting[0].id,
              sortOrder: sorting[0].desc ? "desc" : "asc",
            }),
          });

          // Add column filters
          columnFilters.forEach((filter) => {
            if (
              filter.id &&
              filter.value !== undefined &&
              filter.value !== null &&
              filter.value !== ""
            ) {
              params.append(`filter[${filter.id}]`, String(filter.value));
            }
          });

          // Add active filters from FilterChips
          if (activeFilters.length > 0) {
            const filterJson = JSON.stringify(
              activeFilters.map((filter) => ({
                field: filter.field,
                operator: filter.operator,
                value: filter.value,
                values: filter.values,
              }))
            );
            params.append("filters", encodeURIComponent(filterJson));
          }

          const response = await authFetch(
            `${entityConfig.api.baseEndpoint}?${params.toString()}`
          );

          if (!response.ok) {
            throw new Error("Failed to load data");
          }

          const result = await response.json();

          const possibleKeys = [
            "data",
            entityConfig.slug,
            entityConfig.pluralName?.toLowerCase(),
            `${entityConfig.slug}s`,
          ].filter(Boolean) as string[];

          const resolvedData = possibleKeys.reduce<any[]>((acc, key) => {
            if (acc.length) return acc;
            const value = (result as Record<string, any>)[key];
            return Array.isArray(value) ? value : acc;
          }, []);

          setData(resolvedData);

          const totalCount =
            result.total ?? result.pagination?.total ?? resolvedData.length;
          console.log(
            "[Data Fetch] Completed - entity:",
            entity,
            "rows:",
            resolvedData.length,
            "total:",
            totalCount
          );
          const totalPagesFromResponse =
            result.totalPages ?? result.pagination?.totalPages;
          const computedTotalPages = Math.ceil(
            (totalCount || 1) / pagination.pageSize
          );

          setApiPagination({
            total: totalCount,
            totalPages: totalPagesFromResponse ?? computedTotalPages,
          });
        } catch (err) {
          if (err instanceof Error && err.name !== "AbortError") {
            setError(err instanceof Error ? err.message : "An error occurred");
          }
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [
    entityConfig,
    entity,
    isAuthReady,
    configLoading,
    pagination.pageIndex,
    pagination.pageSize,
    globalFilter,
    JSON.stringify(sorting),
    JSON.stringify(columnFilters),
    JSON.stringify(activeFilters),
  ]);

  // Simple refresh function
  const refresh = () => {
    // Reset entityConfig to trigger re-fetch
    setEntityConfig(null);
  };

  // Transform API schema to EntityConfig
  function transformSchemaToConfig(schema: any): EntityConfig {
    return {
      name: schema.name,
      pluralName: schema.pluralName,
      slug: schema.slug,
      description: schema.description,

      api: {
        baseEndpoint: `${API_URL}/api/admin/${schema.slug}`,
        createEndpoint: `${API_URL}/api/admin/${schema.slug}`,
        updateEndpoint: schema.api?.updateEndpoint
          ? (id: string) => schema.api.updateEndpoint.replace(":id", id)
          : (id: string) => `${API_URL}/api/admin/${schema.slug}/${id}`,
        deleteEndpoint: schema.api?.deleteEndpoint
          ? (id: string) => schema.api.deleteEndpoint.replace(":id", id)
          : (id: string) => `${API_URL}/api/admin/${schema.slug}/${id}`,
        getEndpoint: schema.api?.getEndpoint
          ? (id: string) => schema.api.getEndpoint.replace(":id", id)
          : (id: string) => `${API_URL}/api/admin/${schema.slug}/${id}`,
      },

      fields: schema.fields.map(
        (field: any): FieldConfig => ({
          key: field.name,
          label: field.label,
          type: mapFieldType(field.type),
          description: field.description,
          placeholder: field.placeholder,
          defaultValue: field.defaultValue,
          validation: field.validation,
          options: field.options,
          hidden: field.hidden,
          disabled: field.disabled,
          readOnly: field.readOnly,
          gridColumn: field.gridColumn,
        })
      ),

      columns: transformSchemaToTanStackColumns(schema.columns),

      formSections: schema.sections?.map((section: any) => ({
        title: section.title,
        description: section.description,
        fields: section.fields,
        defaultExpanded: section.defaultExpanded,
        collapsible: section.collapsible,
      })),

      stats: schema.stats?.map((stat: any) => ({
        id: stat.id,
        label: stat.label,
        value: stat.value,
        color: stat.color || "primary",
      })),

      filters: schema.filters || [],

      bulkActions: schema.bulkActions?.map((action: any) => ({
        id: action.id,
        label: action.label,
        color: action.color,
        variant: action.variant,
        requiresSelection: action.requiresSelection,
        confirmation: action.confirmation,
        handler: async (ids: string[]) => {
          // Call API endpoint
          const response = await authFetch(action.endpoint, {
            method: action.method || "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });

          if (!response.ok) {
            throw new Error(`Failed to execute ${action.label}`);
          }

          refresh();
        },
      })),

      rowActions: schema.rowActions?.map((action: any) => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        visible: action.visible,
        disabled: action.disabled,
        confirmation: action.confirmation,
        handler: async (record: any) => {
          if (action.confirmation) {
            const message =
              typeof action.confirmation.message === "function"
                ? action.confirmation.message(record)
                : action.confirmation.message;
            if (!window.confirm(message)) {
              return;
            }
          }

          const endpoint =
            action.endpoint?.replace(":id", record.id) ||
            `${entityConfig?.api.baseEndpoint}/${record.id}/${action.id}`;

          const response = await authFetch(endpoint, {
            method: action.method || "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              action.body ? { ...action.body, record } : { record }
            ),
          });

          if (!response.ok) {
            throw new Error(`Failed to execute ${action.label}`);
          }

          refresh();
        },
      })),
    };
  }

  // Transform schema columns to TanStack Table columns
  function transformSchemaToTanStackColumns(
    schemaColumns: any[]
  ): ColumnDef<any>[] {
    return schemaColumns.map(
      (col: any): ColumnDef<any> => ({
        id:
          col.accessorKey ||
          col.name ||
          String(col.header || col.label || "")
            .toLowerCase()
            .replace(/\s+/g, "_"),
        accessorKey: col.accessorKey || col.name,
        header: String(col.header || col.label || ""),
        size: parseInt(col.width?.replace("px", "") || "150"),
        enableSorting: col.sortable !== false,
        enableColumnFilter: col.filterable !== false,
        cell: ({ getValue, row }: any) => {
          const value = getValue();

          // Handle status chips
          if (col.accessorKey === "status" || col.name === "status") {
            const colorMap: Record<string, any> = {
              ACTIVE: "success",
              ENABLED: "success",
              VERIFIED: "success",
              COMPLETED: "success",
              PENDING: "warning",
              PROCESSING: "warning",
              PENDING_REVIEW: "warning",
              INACTIVE: "default",
              DISABLED: "default",
              DRAFT: "default",
              FAILED: "error",
              CANCELLED: "error",
              BANNED: "error",
              REFUNDED: "info",
            };
            return (
              <Box component="span">
                <Chip
                  label={String(value)}
                  color={colorMap[String(value)] || "default"}
                  size="small"
                  variant="outlined"
                />
              </Box>
            );
          }

          // Handle boolean values
          if (typeof value === "boolean") {
            return (
              <Box component="span">
                <Chip
                  label={value ? "Yes" : "No"}
                  color={value ? "success" : "default"}
                  size="small"
                />
              </Box>
            );
          }

          // Handle dates
          if (
            col.accessorKey?.includes("At") ||
            col.accessorKey?.includes("Date") ||
            col.name?.includes("At") ||
            col.name?.includes("Date")
          ) {
            if (
              value &&
              typeof value === "string" &&
              !isNaN(new Date(value).getTime())
            ) {
              return new Date(value).toLocaleDateString();
            }
          }

          return String(value || "");
        },
      })
    );
  }

  // Map field types
  function mapFieldType(type: string): FieldConfig["type"] {
    const typeMap: Record<string, FieldConfig["type"]> = {
      string: "text",
      email: "email",
      url: "url",
      number: "number",
      boolean: "boolean",
      date: "date",
      datetime: "date",
      textarea: "textarea",
      select: "select",
      multiselect: "select",
      password: "text",
      json: "textarea",
      color: "text",
      file: "text",
      reference: "select",
    };
    return typeMap[type] || "text";
  }

  // Handle create
  const handleCreate = () => {
    setSelectedRecord(null);
    setView("form");
  };

  // Handle edit
  const handleEdit = async (record: any) => {
    try {
      if (entityConfig?.api.getEndpoint) {
        setLoading(true);
        const response = await authFetch(
          entityConfig.api.getEndpoint(record.id)
        );
        if (!response.ok) throw new Error("Failed to fetch record");
        const result = await response.json();

        const transformedData = entityConfig.transformers?.detail
          ? entityConfig.transformers.detail(result)
          : result;

        setSelectedRecord(transformedData);
      } else {
        setSelectedRecord(record);
      }
      setView("form");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load record");
    } finally {
      setLoading(false);
    }
  };

  // Handle view
  const handleView = useCallback(
    async (record: any) => {
      try {
        if (!entityConfig) return;

        // For now, just set the selected record for viewing without API call
        setSelectedRecord(record);
        setView("detail");

        // Optional: If you have a getEndpoint, you can fetch full details
        if (entityConfig?.api.getEndpoint) {
          try {
            setLoading(true);
            const response = await authFetch(
              entityConfig.api.getEndpoint(record.id)
            );
            if (!response.ok) {
              console.warn(
                "Could not fetch full record details, using current data"
              );
              return;
            }
            const result = await response.json();
            const transformedData = entityConfig.transformers?.detail
              ? entityConfig.transformers.detail(result)
              : result;
            setSelectedRecord(transformedData);
          } catch (error) {
            console.warn("Failed to fetch full record details:", error);
            // Continue with current record data
          } finally {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Failed to view record:", error);
        setError("Failed to view record");
      }
    },
    [entityConfig, authFetch]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (record: any) => {
      if (!entityConfig) return;

      if (
        !window.confirm(
          `Are you sure you want to delete this ${entityConfig.name}?`
        )
      ) {
        return;
      }

      try {
        setLoading(true);

        const endpoint = entityConfig.api.deleteEndpoint
          ? entityConfig.api.deleteEndpoint(record.id)
          : `${entityConfig.api.baseEndpoint}/${record.id}`;

        const response = await authFetch(endpoint, { method: "DELETE" });

        if (!response.ok) {
          throw new Error(`Failed to delete ${entityConfig.name}`);
        }

        refresh();
        setView("table");
        setSelectedRecord(null);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to delete record"
        );
      } finally {
        setLoading(false);
      }
    },
    [entityConfig, authFetch, refresh]
  );

  // Filter handlers
  const handleFilterAdd = useCallback((filter: any) => {
    setActiveFilters((prev) => [...prev, filter]);
    // Reset to first page when filter is added
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const handleFilterRemove = useCallback((filterId: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== filterId));
    // Reset to first page when filter is removed
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const handleFilterUpdate = useCallback((filterId: string, value: any) => {
    setActiveFilters((prev) =>
      prev.map((f) =>
        f.id === filterId ? { ...f, value, label: `${f.field}: ${value}` } : f
      )
    );
    // Reset to first page when filter is updated
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  // Handle form submit
  const handleFormSubmit = async (formData: any) => {
    if (!entityConfig) return;

    try {
      setLoading(true);

      const isCreate = !selectedRecord;

      // Transform data if transformer is defined
      const transformedData =
        isCreate && entityConfig.transformers?.create
          ? entityConfig.transformers.create(formData)
          : !isCreate && entityConfig.transformers?.update
            ? entityConfig.transformers.update(formData)
            : formData;

      let response;

      if (isCreate) {
        const endpoint =
          entityConfig.api.createEndpoint || entityConfig.api.baseEndpoint;
        response = await authFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transformedData),
        });
      } else {
        const endpoint = entityConfig.api.updateEndpoint
          ? entityConfig.api.updateEndpoint(selectedRecord.id)
          : `${entityConfig.api.baseEndpoint}/${selectedRecord.id}`;

        response = await authFetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transformedData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to ${isCreate ? "create" : "update"} ${entityConfig.name}`
        );
      }

      refresh();
      setView("table");
      setSelectedRecord(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setView("table");
    setSelectedRecord(null);
    setError(null);
  };

  // Transform entity fields to modern form fields
  const transformFieldsToModernForm = (fields: FieldConfig[]): any[] => {
    return fields.map((field) => ({
      name: field.key as string,
      label: field.label,
      type: mapFieldType(field.type),
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
  const transformFiltersToModernForm = (filters?: FilterConfig[]): any[] => {
    return (
      filters?.map((filter) => ({
        field: filter.key as string,
        label: filter.label,
        type: mapFieldType(filter.type),
        options: filter.options,
        operator: filter.operator,
      })) || []
    );
  };

  // Transform entity sections to modern form sections
  const transformSectionsToModernForm = (sections?: any[]): any[] => {
    return (
      sections?.map((section) => ({
        title: section.title,
        description: section.description,
        fields: section.fields,
        defaultExpanded: section.defaultExpanded,
        collapsible: section.collapsible,
      })) || []
    );
  };

  // Loading state
  if (configLoading) {
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
  if (error && !entityConfig) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box key={entityKey} sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link color="inherit" href="/admin" underline="hover">
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
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Content */}
      {view === "table" && entityConfig && (
        <EnhancedDataTable
          data={data}
          columns={entityConfig.columns}
          title={entityConfig.pluralName}
          loading={loading}
          error={error}
          totalCount={apiPagination.total}
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          onPaginationChange={(p) => setPagination(p)}
          sorting={sorting}
          onSortingChange={setSorting}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
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
          filters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onFilterUpdate={handleFilterUpdate}
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
          initialData={selectedRecord}
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
