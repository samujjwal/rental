import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import type { EntityConfig, TableState, SortConfig } from '~/lib/admin/entity-framework';

const API_URL = process.env.API_URL || 'http://localhost:3400';

interface UseAdminEntityOptions {
  entity: string;
  initialPageSize?: number;
}

interface FetchEntitiesParams {
  page: number;
  limit: number;
  search?: string;
  sorting?: SortConfig[];
  filters?: Record<string, any>;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

async function fetchEntityConfig(entity: string): Promise<EntityConfig> {
  const response = await authFetch(`${API_URL}/api/admin/schema/${entity}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Entity "${entity}" not found`);
    }
    throw new Error('Failed to load entity configuration');
  }

  const schema = await response.json();
  return transformSchemaToConfig(schema);
}

async function fetchEntities(
  entityConfig: EntityConfig,
  params: FetchEntitiesParams
): Promise<{ data: any[]; total: number; totalPages: number }> {
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
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(`filter[${key}]`, String(value));
    }
  });

  const response = await authFetch(
    `${entityConfig.api.baseEndpoint}?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error('Failed to load data');
  }

  const result = await response.json();

  const possibleKeys = [
    'data',
    entityConfig.slug,
    entityConfig.pluralName?.toLowerCase(),
    `${entityConfig.slug}s`,
  ].filter(Boolean) as string[];

  const data = possibleKeys.reduce<any[]>((acc, key) => {
    if (acc.length) return acc;
    const value = (result as Record<string, any>)[key];
    return Array.isArray(value) ? value : acc;
  }, []);

  const total = result.total ?? result.pagination?.total ?? data.length;
  const totalPages = result.totalPages ?? result.pagination?.totalPages ?? Math.ceil(total / params.limit);

  return { data, total, totalPages };
}

async function fetchEntityDetail(entityConfig: EntityConfig, id: string): Promise<any> {
  const endpoint = entityConfig.api.getEndpoint
    ? entityConfig.api.getEndpoint(id)
    : `${entityConfig.api.baseEndpoint}/${id}`;

  const response = await authFetch(endpoint);

  if (!response.ok) {
    throw new Error('Failed to fetch record');
  }

  const result = await response.json();
  return entityConfig.transformers?.detail
    ? entityConfig.transformers.detail(result)
    : result;
}

async function createEntity(entityConfig: EntityConfig, data: any): Promise<any> {
  const endpoint = entityConfig.api.createEndpoint || entityConfig.api.baseEndpoint;
  const transformedData = entityConfig.transformers?.create
    ? entityConfig.transformers.create(data)
    : data;

  const response = await authFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformedData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create ${entityConfig.name}`);
  }

  return response.json();
}

async function updateEntity(entityConfig: EntityConfig, id: string, data: any): Promise<any> {
  const endpoint = entityConfig.api.updateEndpoint
    ? entityConfig.api.updateEndpoint(id)
    : `${entityConfig.api.baseEndpoint}/${id}`;

  const transformedData = entityConfig.transformers?.update
    ? entityConfig.transformers.update(data)
    : data;

  const response = await authFetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformedData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to update ${entityConfig.name}`);
  }

  return response.json();
}

async function deleteEntity(entityConfig: EntityConfig, id: string): Promise<void> {
  const endpoint = entityConfig.api.deleteEndpoint
    ? entityConfig.api.deleteEndpoint(id)
    : `${entityConfig.api.baseEndpoint}/${id}`;

  const response = await authFetch(endpoint, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Failed to delete ${entityConfig.name}`);
  }
}

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
        ? (id: string) => schema.api.updateEndpoint.replace(':id', id)
        : (id: string) => `${API_URL}/api/admin/${schema.slug}/${id}`,
      deleteEndpoint: schema.api?.deleteEndpoint
        ? (id: string) => schema.api.deleteEndpoint.replace(':id', id)
        : (id: string) => `${API_URL}/api/admin/${schema.slug}/${id}`,
      getEndpoint: schema.api?.getEndpoint
        ? (id: string) => schema.api.getEndpoint.replace(':id', id)
        : (id: string) => `${API_URL}/api/admin/${schema.slug}/${id}`,
    },

    fields: schema.fields.map((field: any) => ({
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
    })),

    columns: schema.columns.map((col: any) => ({
      accessorKey: col.accessorKey || col.name,
      id: col.accessorKey || col.name || String(col.header || col.label || '').toLowerCase().replace(/\s+/g, '_'),
      header: String(col.header || col.label || ''),
      size: parseInt(col.width?.replace('px', '') || '150'),
      enableSorting: col.sortable !== false,
      enableColumnFilter: col.filterable !== false,
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

function mapFieldType(apiType: string): any {
  const typeMap: Record<string, any> = {
    'string': 'text',
    'text': 'text',
    'email': 'email',
    'password': 'password',
    'url': 'url',
    'number': 'number',
    'integer': 'number',
    'float': 'number',
    'decimal': 'number',
    'textarea': 'textarea',
    'text-area': 'textarea',
    'select': 'select',
    'dropdown': 'select',
    'multiselect': 'multiselect',
    'multi-select': 'multiselect',
    'date': 'date',
    'datetime': 'datetime',
    'date-time': 'datetime',
    'boolean': 'boolean',
    'bool': 'boolean',
    'toggle': 'boolean',
    'json': 'json',
    'object': 'json',
    'color': 'color',
    'file': 'file',
    'upload': 'file',
    'reference': 'reference',
    'relation': 'reference',
  };

  return typeMap[apiType?.toLowerCase()] || 'text';
}

export function useAdminEntity({ entity, initialPageSize = 20 }: UseAdminEntityOptions) {
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
    search: '',
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
      search: '',
      selectedIds: [],
    });
  }, [entity, initialPageSize]);

  // Fetch entity configuration
  const configQuery = useQuery({
    queryKey: ['admin', 'entity-config', entity],
    queryFn: () => fetchEntityConfig(entity),
    enabled: !!entity && entity.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 0, // Don't cache config to ensure fresh data on entity change
  });

  // Fetch entity list data
  const entitiesQuery = useQuery({
    queryKey: ['admin', 'entities', entity, tableState.pagination.page, tableState.pagination.limit, tableState.search, tableState.sorting, tableState.filters],
    queryFn: () =>
      configQuery.data
        ? fetchEntities(configQuery.data, {
            page: tableState.pagination.page,
            limit: tableState.pagination.limit,
            search: tableState.search,
            sorting: tableState.sorting,
            filters: tableState.filters,
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
    mutationFn: (data: any) => {
      if (!configQuery.data) throw new Error('Entity config not loaded');
      return createEntity(configQuery.data, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'entities', entity] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => {
      if (!configQuery.data) throw new Error('Entity config not loaded');
      return updateEntity(configQuery.data, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'entities', entity] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!configQuery.data) throw new Error('Entity config not loaded');
      return deleteEntity(configQuery.data, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'entities', entity] });
    },
  });

  // Update table state helper
  const updateTableState = useCallback((updates: Partial<TableState>) => {
    setTableState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Refresh data helper
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'entities', entity] });
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