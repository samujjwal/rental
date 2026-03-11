import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React, { useState } from "react";

/* ---------- mock dependencies ---------- */
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled ?? false}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="icon-alert" />,
  RefreshCw: () => <span />,
  Home: () => <span />,
  Bug: () => <span />,
}));

vi.mock("~/lib/navigation", () => ({
  requestNavigation: vi.fn(),
  requestRevalidate: vi.fn(),
}));

import { ErrorBoundary, type AppError } from "~/components/ErrorBoundary";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

/* ---------- helpers ---------- */

/**
 * Component that throws on demand — only after user clicks a trigger button.
 * This avoids React 19's synchronous rethrow during initial render.
 */
function ThrowOnDemand({
  msg = "boom",
  errorName,
}: {
  msg?: string;
  errorName?: string;
}) {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    const err = new Error(msg);
    if (errorName) err.name = errorName;
    throw err;
  }

  return (
    <button data-testid="trigger-error" onClick={() => setShouldThrow(true)}>
      Trigger
    </button>
  );
}

/** Trigger the error by clicking the "Trigger" button */
function triggerError() {
  // The state update + re-render will throw. React error boundary should catch.
  // React 19 may rethrow via reportError; suppress it.
  const handler = (e: ErrorEvent) => e.preventDefault();
  window.addEventListener("error", handler);
  const origReport = window.reportError;
  window.reportError = () => {};

  act(() => {
    fireEvent.click(screen.getByTestId("trigger-error"));
  });

  window.removeEventListener("error", handler);
  window.reportError = origReport;
}

/* ================================================================== */
/*  ErrorBoundary                                                      */
/* ================================================================== */
describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">OK</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders default fallback UI on error", () => {
    render(
      <ErrorBoundary>
        <ThrowOnDemand />
      </ErrorBoundary>
    );
    triggerError();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByTestId("icon-alert")).toBeInTheDocument();
  });

  it("calls onError callback with AppError", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowOnDemand />
      </ErrorBoundary>
    );
    triggerError();
    expect(onError).toHaveBeenCalledTimes(1);

    const appErr: AppError = onError.mock.calls[0][0];
    expect(appErr.name).toBe("Error");
    expect(appErr.message).toBe("boom");
    expect(appErr.severity).toBeDefined();
    expect(appErr.id).toBeDefined();
    expect(appErr.timestamp).toBeInstanceOf(Date);
  });

  it("renders custom fallback component", () => {
    const Custom = ({ error }: { error: AppError; retry: () => void }) => (
      <div data-testid="custom">{error.message}</div>
    );
    render(
      <ErrorBoundary fallback={Custom}>
        <ThrowOnDemand />
      </ErrorBoundary>
    );
    triggerError();
    expect(screen.getByTestId("custom")).toHaveTextContent("boom");
  });

  it("classifies ChunkLoadError as medium severity + recoverable", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowOnDemand msg="Loading chunk 123 failed" errorName="ChunkLoadError" />
      </ErrorBoundary>
    );
    triggerError();
    const appErr = onError.mock.calls[0][0];
    expect(appErr.severity).toBe("medium");
    expect(appErr.recoverable).toBe(true);
    expect(appErr.retryable).toBe(true);
  });

  it("classifies ReferenceError as critical severity", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowOnDemand msg="x is not defined" errorName="ReferenceError" />
      </ErrorBoundary>
    );
    triggerError();
    expect(onError.mock.calls[0][0].severity).toBe("critical");
  });

  it("classifies TypeError with 'Cannot read property' as high", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowOnDemand
          msg="Cannot read property 'x' of undefined"
          errorName="TypeError"
        />
      </ErrorBoundary>
    );
    triggerError();
    expect(onError.mock.calls[0][0].severity).toBe("high");
  });

  it("shows Go Home button in default fallback", () => {
    render(
      <ErrorBoundary>
        <ThrowOnDemand />
      </ErrorBoundary>
    );
    triggerError();
    expect(screen.getByText("Go Home")).toBeInTheDocument();
  });

  it("stores error in localStorage", () => {
    const setItem = vi.fn();
    const getItem = vi.fn().mockReturnValue("[]");
    Object.defineProperty(window, "localStorage", {
      value: { getItem, setItem, removeItem: vi.fn(), clear: vi.fn() },
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowOnDemand />
      </ErrorBoundary>
    );
    triggerError();
    expect(setItem).toHaveBeenCalledWith(
      "app_errors",
      expect.stringContaining("boom")
    );
  });

  it("includes context.action = render in captured error", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowOnDemand />
      </ErrorBoundary>
    );
    triggerError();
    const ctx = onError.mock.calls[0][0].context;
    expect(ctx.action).toBe("render");
    expect(ctx.url).toBeDefined();
  });
});
