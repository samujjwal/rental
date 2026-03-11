import { describe, it, expect, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  parseApiError,
  isRetryableError,
  getErrorMessage,
  withRetry,
  CircuitBreaker,
  ApiErrorType,
} from "~/lib/api-error";

/* ---------- helpers ---------- */

function axiosError(
  status: number | null,
  data?: Record<string, unknown>,
  code?: string
): AxiosError {
  const headers = new AxiosHeaders();
  const err = new AxiosError(
    "Request failed",
    code ?? "ERR_BAD_REQUEST",
    { headers } as any,
    {},
    status
      ? ({ status, data, headers, config: { headers }, statusText: "err" } as any)
      : undefined
  );
  if (!status) {
    delete (err as any).response;
  }
  return err;
}

/* ================================================================== */
/*  parseApiError                                                      */
/* ================================================================== */
describe("parseApiError", () => {
  it("classifies network errors (no response) as NETWORK_ERROR", () => {
    const err = axiosError(null);
    const result = parseApiError(err);
    expect(result.type).toBe(ApiErrorType.NETWORK_ERROR);
    expect(result.retryable).toBe(true);
  });

  it("classifies ECONNABORTED as TIMEOUT_ERROR", () => {
    const err = axiosError(null, undefined, "ECONNABORTED");
    const result = parseApiError(err);
    expect(result.type).toBe(ApiErrorType.TIMEOUT_ERROR);
    expect(result.retryable).toBe(true);
  });

  it("classifies ETIMEDOUT as TIMEOUT_ERROR", () => {
    const err = axiosError(null, undefined, "ETIMEDOUT");
    const result = parseApiError(err);
    expect(result.type).toBe(ApiErrorType.TIMEOUT_ERROR);
  });

  it("classifies 401 as UNAUTHORIZED", () => {
    const result = parseApiError(axiosError(401));
    expect(result.type).toBe(ApiErrorType.UNAUTHORIZED);
    expect(result.statusCode).toBe(401);
    expect(result.retryable).toBe(false);
  });

  it("prefers server message for 401", () => {
    const result = parseApiError(axiosError(401, { message: "Token expired" }));
    expect(result.message).toBe("Token expired");
  });

  it("classifies 403 as FORBIDDEN", () => {
    const result = parseApiError(axiosError(403));
    expect(result.type).toBe(ApiErrorType.FORBIDDEN);
    expect(result.retryable).toBe(false);
  });

  it("classifies 404 as NOT_FOUND", () => {
    const result = parseApiError(axiosError(404));
    expect(result.type).toBe(ApiErrorType.NOT_FOUND);
    expect(result.retryable).toBe(false);
  });

  it.each([400, 422])("classifies %d as VALIDATION_ERROR", (status) => {
    const result = parseApiError(
      axiosError(status, { errors: { email: ["required"] } })
    );
    expect(result.type).toBe(ApiErrorType.VALIDATION_ERROR);
    expect(result.details).toEqual({ email: ["required"] });
    expect(result.retryable).toBe(false);
  });

  it.each([500, 502, 503, 504])(
    "classifies %d as SERVER_ERROR (retryable)",
    (status) => {
      const result = parseApiError(axiosError(status));
      expect(result.type).toBe(ApiErrorType.SERVER_ERROR);
      expect(result.retryable).toBe(true);
    }
  );

  it("classifies unknown status as UNKNOWN_ERROR", () => {
    const result = parseApiError(axiosError(418));
    expect(result.type).toBe(ApiErrorType.UNKNOWN_ERROR);
    expect(result.retryable).toBe(true);
  });

  it("handles a plain Error", () => {
    const result = parseApiError(new Error("boom"));
    expect(result.type).toBe(ApiErrorType.UNKNOWN_ERROR);
    expect(result.message).toBe("boom");
  });

  it("handles a non-Error value", () => {
    const result = parseApiError("something");
    expect(result.type).toBe(ApiErrorType.UNKNOWN_ERROR);
    expect(result.retryable).toBe(true);
  });
});

/* ================================================================== */
/*  isRetryableError                                                   */
/* ================================================================== */
describe("isRetryableError", () => {
  it("returns true for retryable", () => {
    expect(
      isRetryableError({
        type: ApiErrorType.NETWORK_ERROR,
        message: "",
        retryable: true,
      })
    ).toBe(true);
  });

  it("returns false for non-retryable", () => {
    expect(
      isRetryableError({
        type: ApiErrorType.UNAUTHORIZED,
        message: "",
        retryable: false,
      })
    ).toBe(false);
  });
});

/* ================================================================== */
/*  getErrorMessage                                                    */
/* ================================================================== */
describe("getErrorMessage", () => {
  it("returns user-friendly message for AxiosError", () => {
    const msg = getErrorMessage(axiosError(500));
    expect(msg).toContain("Something went wrong");
  });

  it("returns message from plain Error", () => {
    expect(getErrorMessage(new Error("custom msg"))).toBe("custom msg");
  });
});

/* ================================================================== */
/*  withRetry                                                          */
/* ================================================================== */
describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors and succeeds on later attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(axiosError(500))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, { maxRetries: 2, delayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(axiosError(401));
    await expect(withRetry(fn, { maxRetries: 3, delayMs: 1 })).rejects.toMatchObject({
      type: ApiErrorType.UNAUTHORIZED,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry callback with attempt number", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(axiosError(503))
      .mockResolvedValueOnce("done");

    await withRetry(fn, { maxRetries: 2, delayMs: 1, onRetry });
    expect(onRetry).toHaveBeenCalledWith(1, expect.objectContaining({ type: ApiErrorType.SERVER_ERROR }));
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(axiosError(500));
    await expect(withRetry(fn, { maxRetries: 2, delayMs: 1 })).rejects.toMatchObject({
      type: ApiErrorType.SERVER_ERROR,
    });
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

/* ================================================================== */
/*  CircuitBreaker                                                     */
/* ================================================================== */
describe("CircuitBreaker", () => {
  it("executes successfully in CLOSED state", async () => {
    const cb = new CircuitBreaker(3, 100);
    const result = await cb.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("opens after reaching failure threshold", async () => {
    const cb = new CircuitBreaker(2, 100000);
    const fail = () => Promise.reject(new Error("fail"));

    await expect(cb.execute(fail)).rejects.toThrow("fail");
    await expect(cb.execute(fail)).rejects.toThrow("fail");
    // Now circuit should be OPEN
    await expect(cb.execute(fail)).rejects.toThrow("Circuit breaker is OPEN");
  });

  it("transitions to HALF_OPEN after reset timeout", async () => {
    const cb = new CircuitBreaker(1, 10); // 10ms timeout
    await expect(cb.execute(() => Promise.reject(new Error("x")))).rejects.toThrow();

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 20));

    // Should allow one call through (HALF_OPEN)
    const result = await cb.execute(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
  });

  it("resets to CLOSED on success after HALF_OPEN", async () => {
    const cb = new CircuitBreaker(1, 10);
    await expect(cb.execute(() => Promise.reject(new Error("x")))).rejects.toThrow();

    await new Promise((r) => setTimeout(r, 20));

    // Success in HALF_OPEN → CLOSED
    await cb.execute(() => Promise.resolve("ok"));
    // Should remain CLOSED
    const result = await cb.execute(() => Promise.resolve("ok2"));
    expect(result).toBe("ok2");
  });
});
