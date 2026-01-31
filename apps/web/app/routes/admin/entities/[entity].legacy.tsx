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
import { TanStackTable } from "~/components/admin/TanStackTable";
import { DataTableWrapper } from "~/components/admin/DataTableWrapper";
import { EntityForm } from "~/components/admin/EntityForm";
import { requireAdmin, getSession } from "~/utils/auth.server";
import { useAuthStore } from "~/lib/store/auth";
import type { MRT_ColumnDef } from "material-react-table";
import type {
  EntityConfig,
  TableState,
  ViewMode,
  FieldConfig,
} from "~/lib/admin/entity-framework";

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
 * Dynamic Admin Page
 *
 * This page loads entity configuration from the API and renders
 * the appropriate admin interface dynamically. No entity-specific
 * files are needed - everything is driven by the API response.
 *
 * API Response Format:
 * {
 *   name: 'User',
 *   pluralName: 'Users',
 *   slug: 'users',
 *   description: 'Manage users',
 *   fields: [...],
 *   columns: [...],
 *   stats: [...],
 *   actions: [...]
 * }
 */

export default function DynamicEntityPage() {
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

  const [tableState, setTableState] = useState<TableState>({
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    },
    sorting: [],
    filters: {},
    search: "",
    selectedIds: [],
  });

  // Separate state for API response pagination to prevent loops
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
      setTableState({
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        sorting: [],
        filters: {},
        search: "",
        selectedIds: [],
      });
      setApiPagination({ total: 0, totalPages: 1 });
      setCurrentEntity(entity);
      // Don't trigger refresh here - let the config fetching useEffect handle it
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
            page: tableState.pagination.page.toString(),
            limit: tableState.pagination.limit.toString(),
            ...(tableState.search && { search: tableState.search }),
            ...(tableState.sorting.length > 0 && {
              sortBy: tableState.sorting[0].field,
              sortOrder: tableState.sorting[0].direction,
            }),
          });

          Object.entries(tableState.filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              params.append(`filter[${key}]`, String(value));
            }
          });

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
            (totalCount || 1) / tableState.pagination.limit
          );

          // Only update API pagination, not tableState pagination
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
    tableState.pagination.page,
    tableState.pagination.limit,
    tableState.search,
    JSON.stringify(tableState.sorting),
    JSON.stringify(tableState.filters),
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

      columns: schema.columns.map(
        (col: any): MRT_ColumnDef<any> => ({
          accessorKey: col.accessorKey || col.name,
          id:
            col.accessorKey ||
            col.name ||
            String(col.header || col.label || "")
              .toLowerCase()
              .replace(/\s+/g, "_"),
          header: String(col.header || col.label || ""),
          size: parseInt(col.width?.replace("px", "") || "150"),
          enableSorting: col.sortable !== false,
          enableColumnFilter: col.filterable !== false,
          // Add Cell renderer for common types
          Cell: ({ cell }) => {
            const value = cell.getValue();

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
      ),

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
          if (!response.ok) throw new Error("Action failed");
        },
      })),

      rowActions: schema.rowActions?.map((action: any) => ({
        id: action.id,
        label: action.label,
        color: action.color,
        visible: action.visibleCondition
          ? (record: any) => evaluateCondition(action.visibleCondition, record)
          : undefined,
        handler: async (record: any) => {
          if (action.endpoint) {
            const response = await authFetch(
              action.endpoint.replace(":id", record.id),
              {
                method: action.method || "POST",
                headers: { "Content-Type": "application/json" },
              }
            );
            if (!response.ok) throw new Error("Action failed");
          }
        },
      })),

      defaultPageSize: schema.defaultPageSize || 20,
      pageSizeOptions: schema.pageSizeOptions || [10, 20, 50, 100],
      enableRowSelection: schema.enableRowSelection !== false,
      enableColumnFilters: schema.enableColumnFilters !== false,
      enableGlobalFilter: schema.enableGlobalFilter !== false,
      enableSorting: schema.enableSorting !== false,
      enablePagination: schema.enablePagination !== false,
    };
  }

  // Map API field types to framework types
  function mapFieldType(apiType: string): FieldConfig["type"] {
    const typeMap: Record<string, FieldConfig["type"]> = {
      string: "text",
      text: "text",
      email: "email",
      password: "password",
      url: "url",
      number: "number",
      integer: "number",
      float: "number",
      decimal: "number",
      textarea: "textarea",
      "text-area": "textarea",
      select: "select",
      dropdown: "select",
      multiselect: "multiselect",
      "multi-select": "multiselect",
      date: "date",
      datetime: "datetime",
      "date-time": "datetime",
      boolean: "boolean",
      bool: "boolean",
      toggle: "boolean",
      json: "json",
      object: "json",
      color: "color",
      file: "file",
      upload: "file",
      reference: "reference",
      relation: "reference",
    };

    return typeMap[apiType?.toLowerCase()] || "text";
  }

  // Evaluate visibility condition
  function evaluateCondition(condition: any, record: any): boolean {
    if (!condition) return true;

    // Simple field value check
    if (condition.field && condition.value) {
      return record[condition.field] === condition.value;
    }

    // Complex expression (could use a safe eval library)
    return true;
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
  const handleView = async (record: any) => {
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
      setView("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load record");
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (record: any) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setLoading(false);
    }
  };

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

  // Handle table state change
  const handleTableStateChange = useCallback(
    (newState: Partial<TableState>) => {
      setTableState((prev) => ({ ...prev, ...newState }));
    },
    []
  );

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
      {view === "table" && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h4" gutterBottom>
            {entityConfig?.pluralName || entity}
          </Typography>

          <Typography variant="body2" sx={{ mb: 2 }}>
            Debug: loading={loading ? "true" : "false"}, error={error || "null"}
            , data.length={data.length}, entityConfig.columns.length=
            {entityConfig?.columns?.length || 0}
          </Typography>

          {loading && <Typography>Loading...</Typography>}

          {error && <Typography color="error">{error}</Typography>}

          {!loading && !error && data.length > 0 && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Debug: Data length: {data.length}, Columns:{" "}
                {entityConfig?.columns?.length || 0}
              </Typography>
              <TanStackTable
                data={data}
                columns={entityConfig?.columns || []}
                totalCount={apiPagination.total}
              />
            </>
          )}

          {!loading && !error && data.length === 0 && (
            <Typography>No data available</Typography>
          )}
        </Box>
      )}

      {(view === "form" || view === "detail") && (
        <EntityForm
          entityConfig={entityConfig!}
          mode={view === "detail" ? "view" : selectedRecord ? "edit" : "create"}
          data={selectedRecord}
          loading={loading}
          error={error}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
        />
      )}
    </Box>
  );
}
