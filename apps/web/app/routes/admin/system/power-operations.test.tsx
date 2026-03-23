import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createBackup: vi.fn(),
  runDatabaseVacuum: vi.fn(),
  runDatabaseAnalyze: vi.fn(),
  clearCache: vi.fn(),
  getSystemLogs: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    createBackup: (...a: any[]) => m.createBackup(...a),
    runDatabaseVacuum: (...a: any[]) => m.runDatabaseVacuum(...a),
    runDatabaseAnalyze: (...a: any[]) => m.runDatabaseAnalyze(...a),
    clearCache: (...a: any[]) => m.clearCache(...a),
    getSystemLogs: (...a: any[]) => m.getSystemLogs(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  Dialog: ({ open, title, description, children }: any) =>
    open ? (
      <div role="dialog">
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
    ) : null,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, loading, asChild, fullWidth, leftIcon, ...p }: any) => {
    if (asChild && children?.type) {
      return children;
    }
    return <button {...p} aria-busy={loading ? "true" : undefined}>{children}</button>;
  },
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Database: IconStub, HardDrive: IconStub, Search: IconStub,
  AlertTriangle: IconStub, ChevronDown: IconStub, Loader2: IconStub,
  CheckCircle: IconStub, AlertCircle: IconStub, X: IconStub,
}));

import PowerOperationsPage, {
  clientLoader,
  getPowerOperationsError,
} from "./power-operations";

describe("admin/system/power-operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
    m.createBackup.mockResolvedValue({});
    m.runDatabaseVacuum.mockResolvedValue(undefined);
    m.runDatabaseAnalyze.mockResolvedValue(undefined);
    m.clearCache.mockResolvedValue(undefined);
    m.getSystemLogs.mockResolvedValue({ logs: [] });
  });

  it("calls requireAdmin and returns null", async () => {
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
    expect(res).toBeNull();
  });

  it("uses actionable offline copy in helper", () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getPowerOperationsError(new AxiosError("Network Error", "ERR_NETWORK"), "fallback")).toBe(
      "You appear to be offline. Reconnect and try again."
    );

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("preserves backend response messages in helper", () => {
    expect(
      getPowerOperationsError({ response: { data: { message: "Cache cluster unavailable" } } }, "fallback")
    ).toBe("Cache cluster unavailable");
  });

  it("confirms destructive cache clear with the shared dialog before running the action", async () => {
    render(<PowerOperationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /admin\.clearAllCache/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/admin\.confirmDangerousOp/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /admin\.proceed/i }));

    await waitFor(() => {
      expect(m.clearCache).toHaveBeenCalledWith("all");
    });
  });
});
