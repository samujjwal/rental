import { useNavigate, useSearchParams } from "react-router";
import { useState, useCallback, useMemo } from "react";

interface UseDataTableOptions {
  basePath?: string;
  defaultLimit?: number;
}

export function useDataTable({
  basePath,
  defaultLimit = 25,
}: UseDataTableOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Sync state with URL search params
  const page = useMemo(
    () => parseInt(searchParams.get("page") || "1"),
    [searchParams]
  );
  const limit = useMemo(
    () => parseInt(searchParams.get("limit") || defaultLimit.toString()),
    [searchParams, defaultLimit]
  );
  const search = useMemo(
    () => searchParams.get("search") || "",
    [searchParams]
  );

  const updateParams = useCallback(
    (newParams: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams);

      Object.entries(newParams).forEach(([key, value]) => {
        if (value === null || value === "") {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      });

      // Always reset to page 1 on filter/search change unless page is explicitly provided
      if (
        !newParams.page &&
        (newParams.search !== undefined ||
          Object.keys(newParams).some((k) => k !== "page" && k !== "limit"))
      ) {
        nextParams.set("page", "1");
      }

      if (basePath) {
        navigate(`${basePath}?${nextParams.toString()}`);
      } else {
        setSearchParams(nextParams);
      }
    },
    [searchParams, setSearchParams, navigate, basePath]
  );

  const handlePaginationChange = useCallback(
    ({ pageIndex, pageSize }: { pageIndex: number; pageSize: number }) => {
      updateParams({
        page: (pageIndex + 1).toString(),
        limit: pageSize.toString(),
      });
    },
    [updateParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ search: value });
    },
    [updateParams]
  );

  const handleFilterChange = useCallback(
    (filters: Record<string, string | null>) => {
      updateParams(filters);
    },
    [updateParams]
  );

  return {
    // State
    page,
    limit,
    search,
    selectedRows,
    setSelectedRows,

    // Handlers
    handlePaginationChange,
    handleSearchChange,
    handleFilterChange,
    updateParams,

    // Raw params
    searchParams,
  };
}
