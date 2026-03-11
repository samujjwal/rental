import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// mockRestoreSession must be declared before vi.mock since vi.mock is hoisted
// but vi.fn() calls within the factory still work
const mockRestoreSession = vi.fn();

vi.mock("~/lib/store/auth", () => {
  return {
    useAuthStore: Object.assign(
      (selector: (state: any) => any) => selector({ isInitialized: false }),
      {
        getState: () => ({
          restoreSession: mockRestoreSession,
        }),
      }
    ),
  };
});

import { useAuthInit } from "./useAuthInit";

describe("useAuthInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return isInitialized state", () => {
    const { result } = renderHook(() => useAuthInit());

    expect(result.current).toHaveProperty("isInitialized");
  });

  it("should call restoreSession on mount", () => {
    renderHook(() => useAuthInit());

    expect(mockRestoreSession).toHaveBeenCalledTimes(1);
  });

  it("should only call restoreSession once across re-renders", () => {
    const { rerender } = renderHook(() => useAuthInit());

    rerender();
    rerender();

    expect(mockRestoreSession).toHaveBeenCalledTimes(1);
  });
});
