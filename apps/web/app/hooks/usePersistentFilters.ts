import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * Search Filter State Persistence Hook
 *
 * Persists search filter state to URL parameters and session storage,
 * ensuring filters survive navigation and page reloads.
 */

type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null
  | undefined;

interface UsePersistentFiltersOptions {
  /**
   * Namespace for session storage keys
   */
  namespace?: string;

  /**
   * Whether to sync with URL parameters
   */
  syncWithUrl?: boolean;

  /**
   * Filter keys to exclude from persistence
   */
  excludeKeys?: string[];

  /**
   * Debounce delay for URL updates (ms)
   */
  debounceMs?: number;

  /**
   * Session storage key prefix
   */
  storageKey?: string;
}

interface PersistentFiltersState {
  filters: Record<string, FilterValue>;
  isLoading: boolean;
  hasRestored: boolean;
}

interface PersistentFiltersReturn extends PersistentFiltersState {
  setFilter: (key: string, value: FilterValue) => void;
  setFilters: (filters: Record<string, FilterValue>) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
  resetToDefaults: (defaults?: Record<string, FilterValue>) => void;
  getActiveFilterCount: () => number;
}

export function usePersistentFilters(
  options: UsePersistentFiltersOptions = {}
): PersistentFiltersReturn {
  const {
    namespace = "search",
    syncWithUrl = true,
    excludeKeys = [],
    debounceMs = 300,
    storageKey = `${namespace}-filters`,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<PersistentFiltersState>({
    filters: {},
    isLoading: true,
    hasRestored: false,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Serialize filter value for storage/URL
  const serializeValue = useCallback((value: FilterValue): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(",");
    return String(value);
  }, []);

  // Deserialize filter value from storage/URL
  const deserializeValue = useCallback(
    (value: string, key: string): FilterValue => {
      if (!value) return undefined;

      // Try to parse as array
      if (value.includes(",")) {
        const items = value.split(",");
        // Check if numeric array
        if (items.every((item) => !isNaN(Number(item)))) {
          return items.map(Number);
        }
        return items;
      }

      // Try to parse as number
      if (!isNaN(Number(value)) && value !== "") {
        return Number(value);
      }

      // Try to parse as boolean
      if (value === "true") return true;
      if (value === "false") return false;

      return value;
    },
    []
  );

  // Load filters from session storage and URL on mount
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    const loadFilters = () => {
      const loadedFilters: Record<string, FilterValue> = {};

      // First, try to load from URL parameters
      if (syncWithUrl) {
        searchParams.forEach((value, key) => {
          if (!excludeKeys.includes(key)) {
            loadedFilters[key] = deserializeValue(value, key);
          }
        });
      }

      // Then, supplement with session storage (URL takes precedence)
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.entries(parsed).forEach(([key, value]) => {
            if (!excludeKeys.includes(key) && !(key in loadedFilters)) {
              loadedFilters[key] = value as FilterValue;
            }
          });
        }
      } catch (error) {
        console.warn("Failed to load filters from session storage:", error);
      }

      setState({
        filters: loadedFilters,
        isLoading: false,
        hasRestored: true,
      });
    };

    loadFilters();
  }, [searchParams, syncWithUrl, excludeKeys, storageKey, deserializeValue]);

  // Persist filters to session storage whenever they change
  useEffect(() => {
    if (!state.hasRestored) return;

    try {
      const storableFilters: Record<string, FilterValue> = {};
      Object.entries(state.filters).forEach(([key, value]) => {
        if (
          !excludeKeys.includes(key) &&
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          storableFilters[key] = value;
        }
      });

      sessionStorage.setItem(storageKey, JSON.stringify(storableFilters));
    } catch (error) {
      console.warn("Failed to persist filters to session storage:", error);
    }
  }, [state.filters, state.hasRestored, excludeKeys, storageKey]);

  // Sync filters to URL with debouncing
  useEffect(() => {
    if (!syncWithUrl || !state.hasRestored) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      const newParams = new URLSearchParams();

      // Add current filters
      Object.entries(state.filters).forEach(([key, value]) => {
        if (
          !excludeKeys.includes(key) &&
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          const serialized = serializeValue(value);
          if (serialized) {
            newParams.set(key, serialized);
          }
        }
      });

      // Update URL (shallow navigation)
      setSearchParams(newParams, { replace: true });
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    state.filters,
    state.hasRestored,
    syncWithUrl,
    excludeKeys,
    debounceMs,
    setSearchParams,
    serializeValue,
  ]);

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setState((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value,
      },
    }));
  }, []);

  const setFilters = useCallback((newFilters: Record<string, FilterValue>) => {
    setState((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        ...newFilters,
      },
    }));
  }, []);

  const removeFilter = useCallback((key: string) => {
    setState((prev) => {
      const newFilters = { ...prev.filters };
      delete newFilters[key];
      return {
        ...prev,
        filters: newFilters,
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filters: {},
    }));
  }, []);

  const resetToDefaults = useCallback(
    (defaults: Record<string, FilterValue> = {}) => {
      setState((prev) => ({
        ...prev,
        filters: { ...defaults },
      }));
    },
    []
  );

  const getActiveFilterCount = useCallback(() => {
    return Object.entries(state.filters).filter(([key, value]) => {
      if (excludeKeys.includes(key)) return false;
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }).length;
  }, [state.filters, excludeKeys]);

  return {
    ...state,
    setFilter,
    setFilters,
    removeFilter,
    clearFilters,
    resetToDefaults,
    getActiveFilterCount,
  };
}

/**
 * Hook for managing search query persistence
 */
interface UsePersistentSearchQueryReturn {
  query: string;
  setQuery: (query: string) => void;
  isLoading: boolean;
}

export function usePersistentSearchQuery(
  storageKey = "search-query",
  debounceMs = 500
): UsePersistentSearchQueryReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQueryState] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load query from URL and session storage on mount
  useEffect(() => {
    const urlQuery = searchParams.get("q") || searchParams.get("query") || "";

    if (urlQuery) {
      setQueryState(urlQuery);
    } else {
      // Try session storage
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          setQueryState(stored);
        }
      } catch (error) {
        console.warn(
          "Failed to load search query from session storage:",
          error
        );
      }
    }

    setIsLoading(false);
  }, [searchParams, storageKey]);

  // Persist to URL and session storage with debounce
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Persist to session storage immediately
      try {
        sessionStorage.setItem(storageKey, newQuery);
      } catch (error) {
        console.warn("Failed to persist search query:", error);
      }

      // Debounce URL update
      debounceTimerRef.current = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        if (newQuery) {
          newParams.set("q", newQuery);
        } else {
          newParams.delete("q");
          newParams.delete("query");
        }
        setSearchParams(newParams, { replace: true });
      }, debounceMs);
    },
    [searchParams, setSearchParams, storageKey, debounceMs]
  );

  return { query, setQuery, isLoading };
}

/**
 * Hook for managing sort order persistence
 */
interface UsePersistentSortReturn {
  sortBy: string;
  sortOrder: "asc" | "desc";
  setSort: (sortBy: string, sortOrder?: "asc" | "desc") => void;
  isLoading: boolean;
}

export function usePersistentSort(
  defaultSortBy = "relevance",
  defaultSortOrder: "asc" | "desc" = "desc",
  storageKey = "search-sort"
): UsePersistentSortReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultSortOrder);
  const [isLoading, setIsLoading] = useState(true);

  // Load sort from URL and session storage
  useEffect(() => {
    const urlSortBy = searchParams.get("sort") || searchParams.get("sortBy");
    const urlSortOrder =
      searchParams.get("order") ||
      (searchParams.get("sortOrder") as "asc" | "desc");

    if (urlSortBy) {
      setSortBy(urlSortBy);
    }
    if (urlSortOrder && (urlSortOrder === "asc" || urlSortOrder === "desc")) {
      setSortOrder(urlSortOrder);
    }

    // Try session storage if URL doesn't have it
    if (!urlSortBy) {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.sortBy) setSortBy(parsed.sortBy);
          if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
        }
      } catch (error) {
        console.warn("Failed to load sort from session storage:", error);
      }
    }

    setIsLoading(false);
  }, [searchParams, storageKey, defaultSortBy, defaultSortOrder]);

  // Persist sort changes
  const setSort = useCallback(
    (newSortBy: string, newSortOrder?: "asc" | "desc") => {
      const finalSortOrder = newSortOrder || sortOrder;

      setSortBy(newSortBy);
      setSortOrder(finalSortOrder);

      // Persist to session storage
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            sortBy: newSortBy,
            sortOrder: finalSortOrder,
          })
        );
      } catch (error) {
        console.warn("Failed to persist sort:", error);
      }

      // Update URL
      const newParams = new URLSearchParams(searchParams);
      newParams.set("sort", newSortBy);
      newParams.set("order", finalSortOrder);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams, sortOrder, storageKey]
  );

  return { sortBy, sortOrder, setSort, isLoading };
}

export default {
  usePersistentFilters,
  usePersistentSearchQuery,
  usePersistentSort,
};
