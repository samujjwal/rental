/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useOptimisticMutation,
  useOptimisticAdd,
  useOptimisticUpdate,
  useOptimisticRemove,
  useOptimisticToggle,
  prefetchQuery,
  invalidateQueries,
} from "./optimistic-updates";

/* ── toast mock ── */
vi.mock("./toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { toast } from "./toast";

/* ── helpers ── */

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

/* ═══════════════════════════════════════════════════════════════════════ */

describe("useOptimisticMutation", () => {
  it("mutates and calls onSuccess", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["items"], [{ id: "1", name: "A" }]);
    const mutationFn = vi.fn().mockResolvedValue({ id: "1", name: "B" });

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          queryKey: ["items"],
          mutationFn,
          updateFn: (old: any) => [{ ...old?.[0], name: "B" }],
          successMessage: "Saved!",
        }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ name: "B" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mutationFn).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Saved!");
  });

  it("rolls back on error and shows error toast", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["items"], [{ id: "1", name: "A" }]);
    const mutationFn = vi.fn().mockRejectedValue(new Error("boom"));

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          queryKey: ["items"],
          mutationFn,
          updateFn: (old: any) => [{ ...old?.[0], name: "Z" }],
          errorMessage: "Oops!",
        }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ name: "Z" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Oops!");
    // Check rollback
    expect(qc.getQueryData(["items"])).toEqual([{ id: "1", name: "A" }]);
  });

  it("calls custom onError callback", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["items"], ["x"]);
    const onError = vi.fn();
    const mutationFn = vi.fn().mockRejectedValue(new Error("fail"));

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          queryKey: ["items"],
          mutationFn,
          updateFn: () => ["y"],
          onError,
        }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

/* ── useOptimisticAdd ── */

describe("useOptimisticAdd", () => {
  it("optimistically adds an item with temp id", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["list"], [{ id: "1", name: "A" }]);
    const addFn = vi.fn().mockResolvedValue({ id: "2", name: "B" });

    const { result } = renderHook(
      () => useOptimisticAdd(["list"], addFn, { successMessage: "Added!" }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ name: "B" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addFn).toHaveBeenCalledWith({ name: "B" }, expect.anything());
    expect(toast.success).toHaveBeenCalledWith("Added!");
  });

  it("rolls back list on add failure", async () => {
    const qc = createQueryClient();
    const original = [{ id: "1", name: "A" }];
    qc.setQueryData(["list"], original);
    const addFn = vi.fn().mockRejectedValue(new Error("err"));

    const { result } = renderHook(
      () => useOptimisticAdd(["list"], addFn, { errorMessage: "Failed!" }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ name: "X" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed!");
    expect(qc.getQueryData(["list"])).toEqual(original);
  });
});

/* ── useOptimisticUpdate ── */

describe("useOptimisticUpdate", () => {
  it("optimistically updates an item in the list", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["items"], [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
    ]);
    const updateFn = vi.fn().mockResolvedValue({ id: "1", name: "Z" });

    const { result } = renderHook(
      () => useOptimisticUpdate<{ id: string; name: string }>([
"items"], updateFn),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ id: "1", updates: { name: "Z" } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateFn).toHaveBeenCalledWith("1", { name: "Z" });
  });

  it("rolls back on update failure", async () => {
    const qc = createQueryClient();
    const original = [{ id: "1", name: "A" }];
    qc.setQueryData(["items"], original);
    const updateFn = vi.fn().mockRejectedValue(new Error("err"));

    const { result } = renderHook(
      () =>
        useOptimisticUpdate<{ id: string; name: string }>(["items"], updateFn, { errorMessage: "Oops" }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ id: "1", updates: { name: "Z" } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(["items"])).toEqual(original);
  });
});

/* ── useOptimisticRemove ── */

describe("useOptimisticRemove", () => {
  it("optimistically removes an item", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["items"], [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
    ]);
    const removeFn = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useOptimisticRemove(["items"], removeFn, {
          successMessage: "Removed!",
        }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate("1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(removeFn).toHaveBeenCalledWith("1", expect.anything());
    expect(toast.success).toHaveBeenCalledWith("Removed!");
  });

  it("rolls back on remove failure", async () => {
    const qc = createQueryClient();
    const original = [{ id: "1" }, { id: "2" }];
    qc.setQueryData(["items"], original);
    const removeFn = vi.fn().mockRejectedValue(new Error("err"));

    const { result } = renderHook(
      () =>
        useOptimisticRemove(["items"], removeFn, { errorMessage: "Failed" }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate("1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(["items"])).toEqual(original);
  });
});

/* ── useOptimisticToggle ── */

describe("useOptimisticToggle", () => {
  it("toggles a boolean property optimistically", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["items"], [{ id: "1", active: true }]);
    const toggleFn = vi
      .fn()
      .mockResolvedValue({ id: "1", active: false });

    const { result } = renderHook(
      () => useOptimisticToggle(["items"], toggleFn),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ id: "1", property: "active" as any });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toggleFn).toHaveBeenCalledWith("1", "active");
  });

  it("rolls back toggle on error", async () => {
    const qc = createQueryClient();
    const original = [{ id: "1", active: true }];
    qc.setQueryData(["items"], original);
    const toggleFn = vi.fn().mockRejectedValue(new Error("err"));

    const { result } = renderHook(
      () =>
        useOptimisticToggle(["items"], toggleFn, { errorMessage: "Err!" }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      result.current.mutate({ id: "1", property: "active" as any });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(["items"])).toEqual(original);
  });
});

/* ── prefetchQuery ── */

describe("prefetchQuery", () => {
  it("prefetches data into query client", async () => {
    const qc = createQueryClient();
    const queryFn = vi.fn().mockResolvedValue({ data: "test" });

    await prefetchQuery(qc, ["prefetch-key"], queryFn);

    expect(queryFn).toHaveBeenCalled();
    expect(qc.getQueryData(["prefetch-key"])).toEqual({ data: "test" });
  });
});

/* ── invalidateQueries ── */

describe("invalidateQueries", () => {
  it("invalidates multiple query keys", async () => {
    const qc = createQueryClient();
    qc.setQueryData(["a"], 1);
    qc.setQueryData(["b"], 2);
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateQueries(qc, [["a"], ["b"]]);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["a"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["b"] });
  });
});
