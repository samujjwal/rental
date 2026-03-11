import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const { mockApi, mockUserConfig } = vi.hoisted(() => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  const mockUserConfig = {
    name: "User",
    pluralName: "Users",
    slug: "users",
    api: {
      baseEndpoint: "/admin/users",
      createEndpoint: "/admin/users",
      updateEndpoint: (id: string) => `/admin/users/${id}`,
      deleteEndpoint: (id: string) => `/admin/users/${id}`,
      getEndpoint: (id: string) => `/admin/users/${id}`,
    },
    fields: [
      { key: "name", label: "Name", type: "text" as const },
      { key: "email", label: "Email", type: "email" as const },
    ],
    columns: [
      { accessorKey: "name", id: "name", header: "Name", size: 200, enableSorting: true, enableColumnFilter: true },
      { accessorKey: "email", id: "email", header: "Email", size: 200, enableSorting: true, enableColumnFilter: true },
    ],
    defaultPageSize: 25,
    pageSizeOptions: [5, 10, 25, 50],
    enableRowSelection: true,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableSorting: true,
    enablePagination: true,
  };

  return { mockApi, mockUserConfig };
});

vi.mock("~/lib/api-client", () => ({ api: mockApi }));

vi.mock("~/lib/admin/configs", () => ({
  getEntityConfig: vi.fn((entity: string) =>
    entity === "users" ? mockUserConfig : null
  ),
}));

vi.mock("axios", () => ({
  isAxiosError: vi.fn(() => false),
}));

import { useAdminEntity } from "./useAdminEntity";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useAdminEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default table state", () => {
    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    expect(result.current.tableState.pagination.page).toBe(1);
    expect(result.current.tableState.pagination.limit).toBe(25);
    expect(result.current.tableState.sorting).toEqual([]);
    expect(result.current.tableState.filters).toEqual({});
    expect(result.current.tableState.search).toBe("");
    expect(result.current.tableState.selectedIds).toEqual([]);
  });

  it("uses custom initialPageSize", () => {
    const { result } = renderHook(
      () => useAdminEntity({ entity: "users", initialPageSize: 10 }),
      { wrapper: createWrapper() },
    );

    expect(result.current.tableState.pagination.limit).toBe(10);
  });

  it("loads entity config from local config", async () => {
    mockApi.get.mockResolvedValue({
      data: [{ id: "1", name: "Alice" }],
      total: 1,
      totalPages: 1,
    });

    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.entityConfig).toBeDefined()
    );
    expect(result.current.entityConfig?.name).toBe("User");
    expect(result.current.entityConfig?.slug).toBe("users");
  });

  it("fetches entity list after config loads", async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { id: "1", name: "Alice", email: "alice@test.com" },
        { id: "2", name: "Bob", email: "bob@test.com" },
      ],
      total: 2,
      totalPages: 1,
    });

    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.total).toBe(2);
  });

  it("updates table state via updateTableState", async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, totalPages: 1 });

    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.updateTableState({ search: "alice" });
    });

    expect(result.current.tableState.search).toBe("alice");
  });

  it("does not update state when values are identical", async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, totalPages: 1 });

    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    const prevState = result.current.tableState;

    act(() => {
      result.current.updateTableState({ search: "" });
    });

    // Same reference since nothing changed
    expect(result.current.tableState).toBe(prevState);
  });

  it("creates entity via create mutation", async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, totalPages: 1 });
    mockApi.post.mockResolvedValue({ id: "new-1", name: "Charlie" });

    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.entityConfig).toBeDefined()
    );

    await act(async () => {
      await result.current.create({ name: "Charlie", email: "c@test.com" });
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      "/admin/users",
      expect.objectContaining({ name: "Charlie" }),
    );
  });

  it("updates entity via update mutation", async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, totalPages: 1 });
    mockApi.put.mockResolvedValue({ id: "1", name: "Updated" });

    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.entityConfig).toBeDefined()
    );

    await act(async () => {
      await result.current.update({ id: "1", data: { name: "Updated" } });
    });

    expect(mockApi.put).toHaveBeenCalledWith(
      "/admin/users/1",
      expect.objectContaining({ name: "Updated" }),
    );
  });

  it("deletes entity via delete mutation", async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, totalPages: 1 });
    mockApi.delete.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useAdminEntity({ entity: "users" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.entityConfig).toBeDefined()
    );

    await act(async () => {
      await result.current.delete("1");
    });

    expect(mockApi.delete).toHaveBeenCalledWith("/admin/users/1");
  });

  it("returns empty data when entity is empty string", () => {
    const { result } = renderHook(
      () => useAdminEntity({ entity: "" }),
      { wrapper: createWrapper() },
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.entityConfig).toBeUndefined();
  });

  it("falls back to API schema when no local config", async () => {
    // getEntityConfig returns null for "listings"
    mockApi.get.mockResolvedValue({
      name: "Listing",
      slug: "listings",
      fields: [{ name: "title", label: "Title", type: "string" }],
      columns: [{ name: "title", header: "Title" }],
    });

    const { result } = renderHook(
      () => useAdminEntity({ entity: "listings" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.entityConfig).toBeDefined()
    );

    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining("/admin/schema/listings"),
    );
    expect(result.current.entityConfig?.slug).toBe("listings");
  });
});
