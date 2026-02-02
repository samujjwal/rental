import { isAxiosError } from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import type {
  EntityConfig,
  FieldType,
  TableState,
  SortConfig,
} from "~/lib/admin/entity-framework";
import { api } from "~/lib/api-client";
import { getEntityConfig } from "~/lib/admin/configs";

interface UseAdminEntityOptions {
  entity: string;
  initialPageSize?: number;
}

interface FetchEntitiesParams {
  page: number;
  limit: number;
  search?: string;
  sorting?: SortConfig[];
  filters?: Record<string, FilterValue | FilterValue[]>;
}

type FilterValue = string | number | boolean | null;
type UnknownRecord = Record<string, unknown>;
type FieldOption = { value: string; label: string; disabled?: boolean };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toRecord(value: unknown, fallback: UnknownRecord): UnknownRecord {
  return isRecord(value) ? value : fallback;
}

function getErrorMessage(error: unknown): string | null {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (isRecord(data) && typeof data.message === "string") {
      return data.message;
    }
    return error.message || null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return null;
}

function getStatus(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
}

function mapFieldType(apiType: unknown): FieldType {
  if (typeof apiType !== "string") {
    return "text";
  }

  const typeMap: Record<string, FieldType> = {
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

  return typeMap[apiType.toLowerCase()] || "text";
}

async function fetchEntityConfig(entity: string): Promise<EntityConfig> {
  const localConfig = getEntityConfig(entity);
  if (localConfig) {
    return localConfig;
  }

  try {
    const schema = await api.get<UnknownRecord>(`/admin/schema/${entity}`);
    return transformSchemaToConfig(entity, schema);
  } catch (error) {
    if (getStatus(error) === 404) {
      throw new Error(`Entity "${entity}" not found`);
    }
    throw new Error(getErrorMessage(error) || "Failed to load entity configuration");
  }
}

async function fetchEntities(
  entityConfig: EntityConfig,
  params: FetchEntitiesParams
): Promise<{ data: UnknownRecord[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
    ...(params.search && { search: params.search }),
    ...(params.sorting?.length && {
      sortBy: params.sorting[0].field,
      sortOrder: params.sorting[0].direction,
    }),
  });

  Object.entries(params.filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(`filter[${key}]`, String(value));
    }
  });

  let result: UnknownRecord;
  try {
    result = await api.get<UnknownRecord>(
      `${entityConfig.api.baseEndpoint}?${searchParams.toString()}`
    );
  } catch (error) {
    throw new Error(getErrorMessage(error) || "Failed to load data");
  }

  const possibleKeys = [
    "data",
    entityConfig.slug,
    entityConfig.pluralName?.toLowerCase(),
    `${entityConfig.slug}s`,
  ].filter(Boolean) as string[];

  const data = possibleKeys.reduce<UnknownRecord[]>((acc, key) => {
    if (acc.length) return acc;
    const value = result[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is UnknownRecord => isRecord(item));
    }
    return acc;
  }, []);

  const pagination = isRecord(result.pagination) ? result.pagination : undefined;
  const total =
    toNumber(result.total) ??
    toNumber(pagination?.total) ??
    data.length;
  const totalPages =
    toNumber(result.totalPages) ??
    toNumber(pagination?.totalPages) ??
    Math.max(1, Math.ceil(total / params.limit));

  return { data, total, totalPages };
}

async function fetchEntityDetail(
  entityConfig: EntityConfig,
  id: string
): Promise<UnknownRecord> {
  const endpoint = entityConfig.api.getEndpoint
    ? entityConfig.api.getEndpoint(id)
    : `${entityConfig.api.baseEndpoint}/${id}`;

  let result: UnknownRecord;
  try {
    result = await api.get<UnknownRecord>(endpoint);
  } catch (error) {
    throw new Error(getErrorMessage(error) || "Failed to fetch record");
  }

  return entityConfig.transformers?.detail
    ? entityConfig.transformers.detail(result)
    : result;
}

async function createEntity(
  entityConfig: EntityConfig,
  data: UnknownRecord
): Promise<UnknownRecord> {
  const endpoint =
    entityConfig.api.createEndpoint || entityConfig.api.baseEndpoint;
  const transformedData = entityConfig.transformers?.create
    ? entityConfig.transformers.create(data)
    : data;
  const payload = toRecord(transformedData, data);

  try {
    return await api.post<UnknownRecord>(endpoint, payload);
  } catch (error) {
    throw new Error(
      getErrorMessage(error) || `Failed to create ${entityConfig.name}`
    );
  }
}

async function updateEntity(
  entityConfig: EntityConfig,
  id: string,
  data: UnknownRecord
): Promise<UnknownRecord> {
  const endpoint = entityConfig.api.updateEndpoint
    ? entityConfig.api.updateEndpoint(id)
    : `${entityConfig.api.baseEndpoint}/${id}`;

  const transformedData = entityConfig.transformers?.update
    ? entityConfig.transformers.update(data)
    : data;
  const payload = toRecord(transformedData, data);

  try {
    return await api.put<UnknownRecord>(endpoint, payload);
  } catch (error) {
    throw new Error(
      getErrorMessage(error) || `Failed to update ${entityConfig.name}`
    );
  }
}

async function deleteEntity(
  entityConfig: EntityConfig,
  id: string
): Promise<void> {
  const endpoint = entityConfig.api.deleteEndpoint
    ? entityConfig.api.deleteEndpoint(id)
    : `${entityConfig.api.baseEndpoint}/${id}`;

  try {
    await api.delete<void>(endpoint);
  } catch (error) {
    throw new Error(
      getErrorMessage(error) || `Failed to delete ${entityConfig.name}`
    );
  }
}

function transformSchemaToConfig(entity: string, schema: UnknownRecord): EntityConfig {
  const slug = safeString(schema.slug, entity);
  const name = safeString(schema.name, slug);
  const pluralName = safeString(schema.pluralName, `${name}s`);
  const apiSchema = isRecord(schema.api) ? schema.api : {};

  const createEndpoint =
    typeof apiSchema.createEndpoint === "string"
      ? apiSchema.createEndpoint
      : `/admin/${slug}`;
  const updatePattern =
    typeof apiSchema.updateEndpoint === "string"
      ? apiSchema.updateEndpoint
      : undefined;
  const deletePattern =
    typeof apiSchema.deleteEndpoint === "string"
      ? apiSchema.deleteEndpoint
      : undefined;
  const getPattern =
    typeof apiSchema.getEndpoint === "string"
      ? apiSchema.getEndpoint
      : undefined;

  const buildIdEndpoint = (pattern?: string): ((id: string) => string) => {
    if (typeof pattern === "string" && pattern.includes(":id")) {
      return (id: string) => pattern.replace(":id", id);
    }
    return (id: string) => `/admin/${slug}/${id}`;
  };

  const fields = (Array.isArray(schema.fields) ? schema.fields : [])
    .filter(isRecord)
    .map((field) => {
      const optionList = Array.isArray(field.options)
        ? field.options
            .filter(isRecord)
            .map((option): FieldOption | undefined => {
              const value = safeString(option.value);
              const label = safeString(option.label);
              if (!value || !label) return undefined;
              return {
                value,
                label,
                disabled:
                  typeof option.disabled === "boolean"
                    ? option.disabled
                    : undefined,
              };
            })
            .filter((item): item is FieldOption => Boolean(item))
        : undefined;

      return {
        key: safeString(field.name),
        label: safeString(field.label, safeString(field.name, "")),
        type: mapFieldType(field.type),
        description: safeString(field.description),
        placeholder: safeString(field.placeholder),
        defaultValue: field.defaultValue,
        validation: isRecord(field.validation)
          ? (field.validation as EntityConfig["fields"][number]["validation"])
          : undefined,
        options: optionList,
        hidden: typeof field.hidden === "boolean" ? field.hidden : undefined,
        disabled:
          typeof field.disabled === "boolean" ? field.disabled : undefined,
        readOnly:
          typeof field.readOnly === "boolean" ? field.readOnly : undefined,
        gridColumn:
          typeof field.gridColumn === "number" ? field.gridColumn : undefined,
      };
    });

  const columns = (Array.isArray(schema.columns) ? schema.columns : [])
    .filter(isRecord)
    .map((col) => {
      const accessor = safeString(col.accessorKey, safeString(col.name));
      const header = safeString(
        col.header,
        safeString(col.label, safeString(col.name))
      );
      const width = typeof col.width === "string" ? parseInt(col.width, 10) : 150;
      return {
        accessorKey: accessor,
        id:
          accessor ||
          safeString(col.name) ||
          header
            .toLowerCase()
            .replace(/\s+/g, "_"),
        header,
        size: Number.isFinite(width) && width > 0 ? width : 150,
        enableSorting: col.sortable !== false,
        enableColumnFilter: col.filterable !== false,
      };
    });

  const pageSizeOptions =
    Array.isArray(schema.pageSizeOptions) && schema.pageSizeOptions.length
      ? schema.pageSizeOptions
          .map((option) => (typeof option === "number" ? option : undefined))
          .filter((option): option is number => typeof option === "number")
      : [5, 10, 25, 50, 100];

  return {
    name,
    pluralName,
    slug,
    description: typeof schema.description === "string" ? schema.description : undefined,

    api: {
      baseEndpoint: `/admin/${slug}`,
      createEndpoint,
      updateEndpoint: buildIdEndpoint(updatePattern),
      deleteEndpoint: buildIdEndpoint(deletePattern),
      getEndpoint: buildIdEndpoint(getPattern),
    },

    fields,
    columns,

    defaultPageSize: toNumber(schema.defaultPageSize) ?? 25,
    pageSizeOptions,
    enableRowSelection: safeBoolean(schema.enableRowSelection, true),
    enableColumnFilters: safeBoolean(schema.enableColumnFilters, true),
    enableGlobalFilter: safeBoolean(schema.enableGlobalFilter, true),
    enableSorting: safeBoolean(schema.enableSorting, true),
    enablePagination: safeBoolean(schema.enablePagination, true),
  };
}

export function useAdminEntity({
  entity,
  initialPageSize = 25,
}: UseAdminEntityOptions) {
  const queryClient = useQueryClient();
  const [tableState, setTableState] = useState<TableState>({
    pagination: {
      page: 1,
      limit: initialPageSize,
      total: 0,
      totalPages: 1,
    },
    sorting: [],
    filters: {},
    search: "",
    selectedIds: [],
  });

  // Reset table state when entity changes
  useEffect(() => {
    setTableState({
      pagination: {
        page: 1,
        limit: initialPageSize,
        total: 0,
        totalPages: 1,
      },
      sorting: [],
      filters: {},
      search: "",
      selectedIds: [],
    });
  }, [entity, initialPageSize]);

  // Fetch entity configuration
  const configQuery = useQuery({
    queryKey: ["admin", "entity-config", entity],
    queryFn: () => fetchEntityConfig(entity),
    enabled: !!entity && entity.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 0, // Don't cache config to ensure fresh data on entity change
  });

  // Fetch entity list data
  const entitiesQuery = useQuery({
    queryKey: [
      "admin",
      "entities",
      entity,
      tableState.pagination.page,
      tableState.pagination.limit,
      tableState.search,
      tableState.sorting,
      tableState.filters,
    ],
    queryFn: () =>
      configQuery.data
        ? fetchEntities(configQuery.data, {
            page: tableState.pagination.page,
            limit: tableState.pagination.limit,
            search: tableState.search,
            sorting: tableState.sorting,
            filters: tableState.filters as Record<string, FilterValue | FilterValue[]>,
          })
        : Promise.resolve({ data: [], total: 0, totalPages: 1 }),
    enabled: !!configQuery.data && !!entity,
  });

  // Fetch single entity detail
  const fetchDetail = useCallback(
    async (id: string) => {
      if (!configQuery.data) return null;
      return fetchEntityDetail(configQuery.data, id);
    },
    [configQuery.data]
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: UnknownRecord) => {
      if (!configQuery.data) throw new Error("Entity config not loaded");
      return createEntity(configQuery.data, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "entities", entity],
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UnknownRecord }) => {
      if (!configQuery.data) throw new Error("Entity config not loaded");
      return updateEntity(configQuery.data, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "entities", entity],
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!configQuery.data) throw new Error("Entity config not loaded");
      return deleteEntity(configQuery.data, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "entities", entity],
      });
    },
  });

  // Update table state helper
  const updateTableState = useCallback((updates: Partial<TableState>) => {
    setTableState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Refresh data helper
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "entities", entity] });
  }, [queryClient, entity]);

  return {
    // Config
    entityConfig: configQuery.data,
    isConfigLoading: configQuery.isLoading,
    configError: configQuery.error,

    // Data
    data: entitiesQuery.data?.data ?? [],
    total: entitiesQuery.data?.total ?? 0,
    totalPages: entitiesQuery.data?.totalPages ?? 1,
    isDataLoading: entitiesQuery.isLoading,
    dataError: entitiesQuery.error,

    // Table state
    tableState,
    updateTableState,

    // Actions
    fetchDetail,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    refresh,

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export default useAdminEntity;
