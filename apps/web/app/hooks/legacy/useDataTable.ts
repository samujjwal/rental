import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type {
  UseDataTableOptions,
  UseDataTableReturn,
  FilterState,
  SortState,
  PaginationState,
  Column,
  Action,
  FilterValue,
} from "~/types/admin";

// Simple debounce implementation to avoid external dependency
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Production-grade hook for managing data table state
 * Provides filtering, sorting, pagination, and selection with performance optimizations
 */
export function useDataTable<T extends Record<string, any>>(
  options: UseDataTableOptions<T>
): UseDataTableReturn<T> {
  const {
    data: initialData,
    columns,
    actions = [],
    filters: filterFields = [],
    stats,
    pagination: initialPagination = {},
    sorting: initialSorting = {},
    selection: selectionOptions = {},
    onRowClick,
    onSelectionChange,
    onFiltersChange,
    onSortChange,
    onPageChange,
    onLimitChange,
    initialFilters = {},
    initialSort,
    initialPage = 1,
    initialLimit = 20,
    debounceMs = 300,
    virtualScrolling = false,
    rowHeight = 50,
    maxHeight,
  } = options;

  // State management
  const [data, setData] = useState<T[]>(initialData);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sort, setSort] = useState<SortState<T>>(
    initialSort || {
      key: columns[0]?.key || ("id" as keyof T),
      direction: "asc",
    }
  );
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    limit: initialLimit,
    total: initialData.length,
    totalPages: Math.ceil(initialData.length / initialLimit),
    ...initialPagination,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState({
    filtering: false,
    sorting: false,
    data: false,
  });

  // Refs for performance
  const dataRef = useRef(data);
  const filtersRef = useRef(filters);
  const sortRef = useRef(sort);
  const selectedIdsRef = useRef(selectedIds);

  // Update refs when state changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    sortRef.current = sort;
  }, [sort]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // Update data when initialData changes
  useEffect(() => {
    setData(initialData);
    setPagination((prev) => ({
      ...prev,
      total: initialData.length,
      totalPages: Math.ceil(initialData.length / prev.limit),
    }));
  }, [initialData]);

  // Memoized filtered data
  const filteredData = useMemo(() => {
    setLoading((prev) => ({ ...prev, filtering: true }));

    try {
      return data.filter((row) => {
        return Object.entries(filters).every(([key, value]) => {
          if (!value || (Array.isArray(value) && value.length === 0)) {
            return true;
          }

          const filterField = filterFields.find((f) => f.key === key);
          if (!filterField) return true;

          const cellValue = row[key];

          switch (filterField.type) {
            case "text":
            case "search":
              return cellValue
                ?.toString()
                .toLowerCase()
                .includes(value.toString().toLowerCase());

            case "select":
              return cellValue === value;

            case "multiselect":
              return Array.isArray(value) && value.includes(cellValue);

            case "number":
              return Number(cellValue) === Number(value);

            case "boolean":
              return Boolean(cellValue) === Boolean(value);

            case "date":
              if (!cellValue || !value) return true;
              {
                const cellDate = new Date(cellValue as string);
                const filterDate = new Date(value as string);
                return cellDate.toDateString() === filterDate.toDateString();
              }

            case "daterange":
              if (!cellValue || !value) return true;
              {
                const cellD = new Date(cellValue as string);
                const range = value as { from?: string; to?: string };
                if (range.from && cellD < new Date(range.from)) return false;
                if (range.to && cellD > new Date(range.to)) return false;
                return true;
              }

            default:
              return true;
          }
        });
      });
    } finally {
      setLoading((prev) => ({ ...prev, filtering: false }));
    }
  }, [data, filters, filterFields]);

  // Memoized sorted data
  const sortedData = useMemo(() => {
    if (!sort.key) return filteredData;

    setLoading((prev) => ({ ...prev, sorting: true }));

    try {
      return [...filteredData].sort((a, b) => {
        const aValue = a[sort.key] as unknown;
        const bValue = b[sort.key] as unknown;

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // String comparison
        if (typeof aValue === "string" && typeof bValue === "string") {
          return sort.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        // Number comparison
        if (typeof aValue === "number" && typeof bValue === "number") {
          return sort.direction === "asc" ? aValue - bValue : bValue - aValue;
        }

        // Date comparison
        if (aValue instanceof Date && bValue instanceof Date) {
          return sort.direction === "asc"
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }

        // Date string comparison
        if (typeof aValue === "string" && typeof bValue === "string") {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
            return sort.direction === "asc"
              ? aDate.getTime() - bDate.getTime()
              : bDate.getTime() - aDate.getTime();
          }
        }

        // Boolean comparison
        if (typeof aValue === "boolean" && typeof bValue === "boolean") {
          return sort.direction === "asc"
            ? (aValue ? 1 : 0) - (bValue ? 1 : 0)
            : (bValue ? 1 : 0) - (aValue ? 1 : 0);
        }

        return 0;
      });
    } finally {
      setLoading((prev) => ({ ...prev, sorting: false }));
    }
  }, [filteredData, sort]);

  // Memoized paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, pagination]);

  // Memoized selected rows
  const selectedRows = useMemo(() => {
    return data.filter((row) => selectedIds.has(String(row.id || row.key)));
  }, [data, selectedIds]);

  // Computed values
  const isAllSelected = useMemo(() => {
    if (!selectionOptions.enabled) return false;
    return (
      paginatedData.length > 0 &&
      paginatedData.every((row) => selectedIds.has(String(row.id || row.key)))
    );
  }, [paginatedData, selectedIds, selectionOptions.enabled]);

  const isIndeterminate = useMemo(() => {
    if (!selectionOptions.enabled) return false;
    const selectedCount = paginatedData.filter((row) =>
      selectedIds.has(String(row.id || row.key))
    ).length;
    return selectedCount > 0 && selectedCount < paginatedData.length;
  }, [paginatedData, selectedIds, selectionOptions.enabled]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (!value) return false;
      if (Array.isArray(value)) return value.length > 0;
      return value !== "";
    });
  }, [filters]);

  const totalPages = useMemo(() => {
    return Math.ceil(sortedData.length / pagination.limit);
  }, [sortedData, pagination.limit]);

  // Event handlers
  const handleFilterChange = useCallback(
    (key: string, value: FilterValue) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      onFiltersChange?.(newFilters);

      // Reset to first page when filters change
      if (pagination.page !== 1) {
        setPagination((prev) => ({ ...prev, page: 1 }));
        onPageChange?.(1);
      }
    },
    [filters, onFiltersChange, pagination.page, onPageChange]
  );

  const handleSort = useCallback(
    (key: keyof T) => {
      const newSort: SortState<T> = {
        key,
        direction:
          sort.key === key && sort.direction === "asc" ? "desc" : "asc",
      };
      setSort(newSort);
      onSortChange?.(newSort);
    },
    [sort, onSortChange]
  );

  const setPage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;
      setPagination((prev) => ({ ...prev, page }));
      onPageChange?.(page);
    },
    [totalPages, onPageChange]
  );

  const setLimit = useCallback(
    (limit: number) => {
      const newPage = Math.max(
        1,
        Math.min(pagination.page, Math.ceil(sortedData.length / limit))
      );
      setPagination((prev) => ({
        ...prev,
        limit,
        page: newPage,
        totalPages: Math.ceil(sortedData.length / limit),
      }));
      onLimitChange?.(limit);
      if (newPage !== pagination.page) {
        onPageChange?.(newPage);
      }
    },
    [sortedData.length, pagination.page, onPageChange, onLimitChange]
  );

  const toggleRowSelection = useCallback(
    (id: string) => {
      if (!selectionOptions.enabled) return;

      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          if (!selectionOptions.multiple) {
            newSet.clear();
          }
          newSet.add(id);
        }
        return newSet;
      });
    },
    [selectionOptions.enabled, selectionOptions.multiple]
  );

  const selectAllRows = useCallback(() => {
    if (!selectionOptions.enabled) return;

    const allIds = new Set(
      paginatedData.map((row) => String(row.id || row.key))
    );
    setSelectedIds(allIds);
  }, [paginatedData, selectionOptions.enabled]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const resetFilters = useCallback(() => {
    const emptyFilters: FilterState = {};
    filterFields.forEach((field) => {
      emptyFilters[field.key] = field.defaultValue ?? "";
    });
    setFilters(emptyFilters);
    onFiltersChange?.(emptyFilters);

    // Reset to first page
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
      onPageChange?.(1);
    }
  }, [filterFields, onFiltersChange, pagination.page, onPageChange]);

  const handleRowClick = useCallback(
    (row: T, event: React.MouseEvent) => {
      if (onRowClick) {
        onRowClick(row, event);
      }

      // Toggle selection if selection is enabled and not clicking on an action
      if (
        selectionOptions.enabled &&
        !(event.target as HTMLElement).closest("button") &&
        !(event.target as HTMLElement).closest("a")
      ) {
        toggleRowSelection(String(row.id || row.key));
      }
    },
    [onRowClick, selectionOptions.enabled, toggleRowSelection]
  );

  // Update pagination when data changes
  useEffect(() => {
    const newTotalPages = Math.ceil(sortedData.length / pagination.limit);
    if (newTotalPages !== pagination.totalPages) {
      setPagination((prev) => ({
        ...prev,
        totalPages: newTotalPages,
        page: Math.min(prev.page, newTotalPages || 1),
      }));
    }
  }, [
    sortedData.length,
    pagination.limit,
    pagination.totalPages,
    pagination.page,
  ]);

  // Notify selection change
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedIds), selectedRows);
    }
  }, [selectedIds, selectedRows, onSelectionChange]);

  // Debounced filter change handler
  const debouncedFilterChange = useMemo(
    () => debounce(handleFilterChange, debounceMs),
    [handleFilterChange, debounceMs]
  );

  return {
    // Data
    data,
    filteredData,
    sortedData,
    paginatedData,

    // State
    filters,
    sort,
    pagination,
    selectedIds,
    selectedRows,

    // Loading states
    loading: loading.filtering || loading.sorting || loading.data,
    filtering: loading.filtering,
    sorting: loading.sorting,

    // Actions
    setFilters: (newFilters: FilterState) => {
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    setSort: (newSort: SortState<T>) => {
      setSort(newSort);
      onSortChange?.(newSort);
    },
    setPage,
    setLimit,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    resetFilters,

    // Computed
    isAllSelected,
    isIndeterminate,
    hasActiveFilters,
    totalPages,

    // Event handlers
    handleFilterChange: debouncedFilterChange,
    handleSort,
    handleRowClick,
  };
}
