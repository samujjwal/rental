import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi, mockHandleApiError, mockToast } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  mockHandleApiError: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./api-client", () => ({ api: mockApi }));
vi.mock("./error-handler", () => ({ handleApiError: mockHandleApiError }));
vi.mock("./toast", () => ({ toast: mockToast }));

import { withRetry, apiGet, apiPost, apiPut, apiPatch, apiDelete, apiBatch } from "./api-enhanced";

describe("withRetry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on network error and succeeds", async () => {
    const networkError = Object.assign(new Error("network"), {
      isAxiosError: true,
      code: "ERR_NETWORK",
    });
    const fn = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { retryDelay: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on retryable status code", async () => {
    const err = { isAxiosError: true, response: { status: 503 } };
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { retryDelay: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on non-retryable status", async () => {
    const err = { isAxiosError: true, response: { status: 404 } };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryDelay: 1 })).rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry non-Axios errors (TypeError, etc.)", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("undefined is not a function"));
    await expect(withRetry(fn, { retryDelay: 1 })).rejects.toThrow("undefined is not a function");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after maxRetries exhausted", async () => {
    const networkError = Object.assign(new Error("fail"), {
      isAxiosError: true,
      code: "ERR_NETWORK",
    });
    const fn = vi.fn().mockRejectedValue(networkError);
    await expect(withRetry(fn, { maxRetries: 2, retryDelay: 1 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("uses exponential backoff", async () => {
    const mkNetErr = (msg: string) =>
      Object.assign(new Error(msg), { isAxiosError: true, code: "ERR_NETWORK" });
    const fn = vi.fn()
      .mockRejectedValueOnce(mkNetErr("e1"))
      .mockRejectedValueOnce(mkNetErr("e2"))
      .mockResolvedValue("ok");
    const start = Date.now();
    await withRetry(fn, { maxRetries: 3, retryDelay: 10 });
    // delay=10*2^0=10, delay=10*2^1=20 → ~30ms minimum
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(20);
  });
});

describe("apiGet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns data from api.get", async () => {
    mockApi.get.mockResolvedValue({ id: 1 });
    const result = await apiGet("/test");
    expect(result).toEqual({ id: 1 });
    expect(mockApi.get).toHaveBeenCalledWith("/test");
  });

  it("calls handleApiError on failure by default", async () => {
    const err = Object.assign(new Error("fail"), { response: { status: 400 } });
    mockApi.get.mockRejectedValue(err);
    await expect(apiGet("/test")).rejects.toThrow("fail");
    expect(mockHandleApiError).toHaveBeenCalled();
  });

  it("skips error toast when showErrorToast=false", async () => {
    const err = Object.assign(new Error("fail"), { response: { status: 400 } });
    mockApi.get.mockRejectedValue(err);
    await expect(apiGet("/test", { showErrorToast: false })).rejects.toThrow();
    expect(mockHandleApiError).not.toHaveBeenCalled();
  });
});

describe("apiPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts data and returns result", async () => {
    mockApi.post.mockResolvedValue({ id: 2 });
    const result = await apiPost("/items", { name: "x" });
    expect(result).toEqual({ id: 2 });
    expect(mockApi.post).toHaveBeenCalledWith("/items", { name: "x" });
  });

  it("shows success toast when enabled", async () => {
    mockApi.post.mockResolvedValue({});
    await apiPost("/items", {}, { showSuccessToast: true, successMessage: "Created!" });
    expect(mockToast.success).toHaveBeenCalledWith("Created!");
  });

  it("does not show success toast by default", async () => {
    mockApi.post.mockResolvedValue({});
    await apiPost("/items", {});
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("handles error with toast", async () => {
    const err = Object.assign(new Error("err"), { response: { status: 422 } });
    mockApi.post.mockRejectedValue(err);
    await expect(apiPost("/items")).rejects.toThrow();
    expect(mockHandleApiError).toHaveBeenCalled();
  });
});

describe("apiPut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts data and returns result", async () => {
    mockApi.put.mockResolvedValue({ updated: true });
    const result = await apiPut("/items/1", { name: "y" });
    expect(result).toEqual({ updated: true });
  });

  it("shows success toast when enabled", async () => {
    mockApi.put.mockResolvedValue({});
    await apiPut("/items/1", {}, { showSuccessToast: true, successMessage: "Updated!" });
    expect(mockToast.success).toHaveBeenCalledWith("Updated!");
  });
});

describe("apiPatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("patches data and returns result", async () => {
    mockApi.patch.mockResolvedValue({ patched: true });
    const result = await apiPatch("/items/1", { status: "active" });
    expect(result).toEqual({ patched: true });
  });
});

describe("apiDelete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes and returns result", async () => {
    mockApi.delete.mockResolvedValue({ deleted: true });
    const result = await apiDelete("/items/1");
    expect(result).toEqual({ deleted: true });
  });

  it("shows success toast when enabled", async () => {
    mockApi.delete.mockResolvedValue({});
    await apiDelete("/items/1", { showSuccessToast: true, successMessage: "Deleted!" });
    expect(mockToast.success).toHaveBeenCalledWith("Deleted!");
  });
});

describe("apiBatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs all requests and returns results", async () => {
    const reqs = [() => Promise.resolve(1), () => Promise.resolve(2), () => Promise.resolve(3)];
    const results = await apiBatch(reqs);
    expect(results).toEqual([1, 2, 3]);
  });

  it("calls onProgress callback", async () => {
    const onProgress = vi.fn();
    const reqs = [() => Promise.resolve("a"), () => Promise.resolve("b")];
    await apiBatch(reqs, { onProgress, concurrency: 1 });
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it("respects concurrency limit", async () => {
    let maxConcurrent = 0;
    let current = 0;
    const makeReq = () => async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, 10));
      current--;
      return current;
    };
    const reqs = Array(6).fill(null).map(() => makeReq());
    await apiBatch(reqs, { concurrency: 2 });
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("returns empty array for empty requests", async () => {
    const results = await apiBatch([]);
    expect(results).toEqual([]);
  });
});
