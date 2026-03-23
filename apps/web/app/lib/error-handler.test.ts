import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockRequestNavigation = vi.hoisted(() => vi.fn());

vi.mock("./toast", () => ({
  toast: mockToast,
}));

vi.mock("./navigation", () => ({
  requestNavigation: mockRequestNavigation,
}));

import {
  getErrorMessage,
  getHttpErrorMessage,
  handleApiError,
  handleValidationError,
  handleAuthError,
  handlePaymentError,
  withErrorHandler,
} from "./error-handler";

describe("getErrorMessage", () => {
  it("extracts message from Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns string as-is", () => {
    expect(getErrorMessage("string error")).toBe("string error");
  });

  it("extracts message from object", () => {
    expect(getErrorMessage({ message: "obj error" })).toBe("obj error");
  });

  it("returns default for unknown", () => {
    expect(getErrorMessage(42)).toBe("An unexpected error occurred. Please try again.");
  });
});

describe("getHttpErrorMessage", () => {
  it("returns custom message from error data", () => {
    expect(getHttpErrorMessage(400, { message: "Email required" })).toBe("Email required");
  });

  it("returns mapped message for 401", () => {
    expect(getHttpErrorMessage(401)).toContain("session has expired");
  });

  it("returns mapped message for 403", () => {
    expect(getHttpErrorMessage(403)).toContain("permission");
  });

  it("returns mapped message for 404", () => {
    expect(getHttpErrorMessage(404)).toContain("could not be found");
  });

  it("returns mapped message for 429", () => {
    expect(getHttpErrorMessage(429)).toContain("too many requests");
  });

  it("returns mapped message for 500", () => {
    expect(getHttpErrorMessage(500)).toContain("servers");
  });

  it("returns default for unmapped status", () => {
    expect(getHttpErrorMessage(418)).toContain("unexpected error");
  });
});

describe("handleApiError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows toast by default", () => {
    handleApiError(new Error("generic"));
    expect(mockToast.error).toHaveBeenCalled();
  });

  it("does not show toast when showToast=false", () => {
    handleApiError(new Error("generic"), { showToast: false });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("uses customMessage when provided", () => {
    const msg = handleApiError(new Error("original"), { customMessage: "Custom" });
    expect(msg).toBe("Custom");
  });

  it("extracts status from error object", () => {
    const err = { status: 404, message: "Not found" };
    handleApiError(err);
    expect(mockToast.error).toHaveBeenCalled();
  });

  it("handles network/fetch errors", () => {
    const err = new TypeError("Failed to fetch");
    const msg = handleApiError(err);
    expect(msg).toBe("Unable to connect to the server");
  });

  it("provides retry action when onRetry given", () => {
    const onRetry = vi.fn();
    handleApiError(new Error("fail"), { onRetry });
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ label: "Retry" }),
    );
  });

  it("returns the error message", () => {
    const msg = handleApiError(new Error("oops"), { showToast: false });
    expect(msg).toBe("oops");
  });
});

describe("handleValidationError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("handles array of errors", () => {
    handleValidationError(["Field required", "Too short"]);
    expect(mockToast.error).toHaveBeenCalledWith(
      "Validation Error",
      "Field required",
    );
  });

  it("handles record of errors", () => {
    handleValidationError({ email: ["Invalid email"], name: ["Required"] });
    expect(mockToast.error).toHaveBeenCalledWith(
      "Validation Error",
      "Invalid email",
    );
  });
});

describe("handleAuthError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("handles session expired error", () => {
    handleAuthError(new Error("Your session has expired"));
    expect(mockToast.error).toHaveBeenCalledWith(
      "Session Expired",
      expect.any(String),
      expect.objectContaining({ label: "Log In" }),
    );

    const action = mockToast.error.mock.calls[0][2] as { onClick: () => void };
    action.onClick();

    expect(mockRequestNavigation).toHaveBeenCalledWith("/auth/login", { replace: true });
  });

  it("handles generic auth error", () => {
    handleAuthError(new Error("Wrong password"));
    expect(mockToast.error).toHaveBeenCalledWith(
      "Authentication Error",
      "Wrong password",
    );
  });
});

describe("handlePaymentError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows payment failure toast", () => {
    handlePaymentError(new Error("Card declined"));
    expect(mockToast.error).toHaveBeenCalledWith(
      "Payment Failed",
      "Card declined",
      undefined,
    );
  });

  it("provides try again action", () => {
    const onRetry = vi.fn();
    handlePaymentError(new Error("fail"), onRetry);
    expect(mockToast.error).toHaveBeenCalledWith(
      "Payment Failed",
      expect.any(String),
      expect.objectContaining({ label: "Try Again" }),
    );
  });
});

describe("withErrorHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns result on success", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const wrapped = withErrorHandler(fn as any);
    const result = await wrapped();
    expect(result).toBe("result");
  });

  it("handles error and re-throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const wrapped = withErrorHandler(fn as any);
    await expect(wrapped()).rejects.toThrow("fail");
    expect(mockToast.error).toHaveBeenCalled();
  });
});
