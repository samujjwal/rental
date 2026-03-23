import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ settings: {}, error: null })),
  useActionData: vi.fn(() => null),
  useNavigation: vi.fn(() => ({ state: "idle", formData: null })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getSettings: (...a: any[]) => m.getSettings(...a),
    updateSettings: (...a: any[]) => m.updateSettings(...a),
  },
  SystemSettings: {},
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Settings: IconStub, Globe: IconStub, Clock: IconStub, Banknote: IconStub,
  Save: IconStub, CheckCircle: IconStub, XCircle: IconStub, Loader2: IconStub,
}));

import { clientLoader, clientAction, getGeneralSettingsError } from "../system/general";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validSave: Record<string, string> = {
  intent: "save",
  siteName: "GharBatai",
  supportEmail: "s@example.com",
  defaultCurrency: "USD",
  timezone: "UTC",
  maintenanceMode: "false",
  allowRegistration: "true",
  requireEmailVerification: "true",
  maxListingsPerUser: "10",
  commissionRate: "10",
  minRentalDays: "1",
  maxRentalDays: "30",
};

describe("admin/system/general", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  /* loader */
  describe("clientLoader", () => {
    it("returns settings", async () => {
      const settings = { siteName: "Test" };
      m.getSettings.mockResolvedValue({ settings });
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.settings).toEqual(settings);
      expect(res.error).toBeNull();
    });

    it("falls back to defaults on error", async () => {
      m.getSettings.mockRejectedValue(new Error("down"));
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.settings).toBeDefined();
      expect(res.error).toBe("down");
    });

    it("uses actionable offline copy on loader failure", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      m.getSettings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const res = await clientLoader({ request: new Request("http://l/") } as any);

      expect(res.error).toBe("You appear to be offline. Reconnect and try again.");

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });
  });

  /* action */
  describe("clientAction", () => {
    it("rejects non-save intent", async () => {
      const res = await clientAction({ request: form({ intent: "delete" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });

    it("rejects short siteName", async () => {
      const res = await clientAction({
        request: form({ ...validSave, siteName: "X" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/site.*name/i);
    });

    it("rejects invalid supportEmail", async () => {
      const res = await clientAction({
        request: form({ ...validSave, supportEmail: "bad" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/email/i);
    });

    it("rejects invalid currency", async () => {
      const res = await clientAction({
        request: form({ ...validSave, defaultCurrency: "BTC" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/currency/i);
    });

    it("rejects invalid timezone", async () => {
      const res = await clientAction({
        request: form({ ...validSave, timezone: "Mars/Olympus" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/timezone/i);
    });

    it("saves successfully", async () => {
      m.updateSettings.mockResolvedValue({});
      const res = await clientAction({ request: form(validSave) } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/updated/i);
    });

    it("clamps bounded ints", async () => {
      m.updateSettings.mockResolvedValue({});
      const res = await clientAction({
        request: form({ ...validSave, maxListingsPerUser: "9999", minRentalDays: "0" }),
      } as any);
      expect(res.success).toBe(true);
      // values are clamped, not rejected
      expect(m.updateSettings).toHaveBeenCalled();
    });

    it("handles API error", async () => {
      m.updateSettings.mockRejectedValue({ response: { data: { message: "DB down" } } });
      const res = await clientAction({ request: form(validSave) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe("DB down");
    });

    it("uses actionable offline copy when save fails offline", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      m.updateSettings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const res = await clientAction({ request: form(validSave) } as any);

      expect(res.success).toBe(false);
      expect(res.error).toBe("You appear to be offline. Reconnect and try again.");

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });

    it("preserves backend response messages in helper", () => {
      expect(
        getGeneralSettingsError({ response: { data: { message: "Validation failed" } } }, "fallback")
      ).toBe("Validation failed");
    });
  });
});
