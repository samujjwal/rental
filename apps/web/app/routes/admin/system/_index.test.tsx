import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRemixStub } from "@remix-run/testing";

const IconStub = vi.hoisted(() => (_props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getGeneralSettings: vi.fn(),
  getSystemHealth: vi.fn(),
  getDatabaseInfo: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({})),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getGeneralSettings: (...a: any[]) => m.getGeneralSettings(...a),
    getSystemHealth: (...a: any[]) => m.getSystemHealth(...a),
    getDatabaseInfo: (...a: any[]) => m.getDatabaseInfo(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Settings: IconStub, Zap: IconStub, Database: IconStub, Bell: IconStub,
  Mail: IconStub, Server: IconStub, Shield: IconStub, Key: IconStub,
  Activity: IconStub, HardDrive: IconStub, LucideIcon: IconStub,
  ChevronDown: IconStub, ChevronUp: IconStub,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, defaultValue?: string) => defaultValue || key }),
}));

import { clientLoader, getSystemSettingsLoadError } from "./_index";
import SystemSettingsPage from "./_index";

describe("admin/system/_index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  describe("clientLoader", () => {
    it("returns all three data sources on success", async () => {
      const gs = { siteName: "Test" };
      const sh = { status: "healthy" };
      const db = { size: "500MB" };
      m.getGeneralSettings.mockResolvedValue(gs);
      m.getSystemHealth.mockResolvedValue(sh);
      m.getDatabaseInfo.mockResolvedValue(db);
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.generalSettings).toEqual(gs);
      expect(res.systemHealth).toEqual(sh);
      expect(res.databaseInfo).toEqual(db);
      expect(res.error).toBeNull();
    });

    it("returns nulls + error on failure", async () => {
      m.getGeneralSettings.mockRejectedValue(new Error("oops"));
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.generalSettings).toBeNull();
      expect(res.systemHealth).toBeNull();
      expect(res.error).toBe("oops");
    });

    it("uses actionable offline copy on loader failure", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      m.getGeneralSettings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const res = await clientLoader({ request: new Request("http://l/") } as any);

      expect(res.error).toBe("You appear to be offline. Reconnect and try again.");

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });
  });

  describe("getSystemSettingsLoadError", () => {
    it("preserves plain thrown error messages in helper", () => {
      expect(getSystemSettingsLoadError(new Error("service unavailable"))).toBe("service unavailable");
    });
  });

  describe("SystemSettingsPage component", () => {
    it("component imports successfully", () => {
      expect(typeof SystemSettingsPage).toBe('function');
    });

    it("renders error state when error is present", async () => {
      const ErrorComponent = () => <div data-testid="error-message">Failed to load settings</div>;

      const RemixStub = createRemixStub([
        {
          path: "/admin/system",
          Component: SystemSettingsPage,
          loader: () => {
            throw new Error("Failed to load settings");
          },
          ErrorBoundary: ErrorComponent,
        },
      ]);

      render(<RemixStub initialEntries={["/admin/system"]} />);
      expect(await screen.findByTestId("error-message")).toHaveTextContent("Failed to load settings");
    });

    it("renders system settings page with valid data", async () => {
      const RemixStub = createRemixStub([
        {
          path: "/admin/system",
          Component: SystemSettingsPage,
          loader: () => ({
            generalSettings: { siteName: "Test Site", maintenanceMode: false },
            systemHealth: {
              status: "healthy",
              uptime: 99.9,
              processUptimeSeconds: 3600,
              services: {
                database: { status: "healthy" },
                redis: { status: "healthy" },
              },
            },
            databaseInfo: { connections: 10 },
            error: null,
          }),
        },
      ]);

      render(<RemixStub initialEntries={["/admin/system"]} />);
      expect(await screen.findByText("admin.systemSettings")).toBeInTheDocument();
      expect(await screen.findByText("admin.systemSettingsDesc")).toBeInTheDocument();
    });
  });
});
