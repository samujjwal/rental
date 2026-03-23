import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getBackups: vi.fn(),
  createBackup: vi.fn(),
  restoreBackup: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ backups: [], error: null })),
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
    getBackups: (...a: any[]) => m.getBackups(...a),
    createBackup: (...a: any[]) => m.createBackup(...a),
    restoreBackup: (...a: any[]) => m.restoreBackup(...a),
  },
  SystemBackup: {},
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  HardDrive: IconStub, Download: IconStub, Upload: IconStub, Clock: IconStub,
  CheckCircle: IconStub, XCircle: IconStub, Loader2: IconStub,
  AlertTriangle: IconStub, RefreshCw: IconStub,
}));

import { clientLoader, clientAction, getAdminBackupsError } from "../system/backups";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}
const VALID_UUID = "11111111-1111-1111-8111-111111111111";

describe("admin/system/backups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  /* loader */
  describe("clientLoader", () => {
    it("returns backups", async () => {
      m.getBackups.mockResolvedValue({ backups: [{ id: "b1" }] });
      const res = await clientLoader({ request: new Request("http://l/admin/system/backups") } as any);
      expect(res.backups).toEqual([{ id: "b1" }]);
      expect(res.error).toBeNull();
    });

    it("handles error", async () => {
      m.getBackups.mockRejectedValue(new Error("fail"));
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.backups).toEqual([]);
      expect(res.error).toBe("fail");
    });

    it("returns actionable offline loader copy", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      m.getBackups.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.error).toBe("You appear to be offline. Reconnect and try again.");
    });
  });

  /* action */
  describe("clientAction", () => {
    it("rejects unknown intent", async () => {
      const res = await clientAction({ request: form({ intent: "nope" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unknown/i);
    });

    /* create */
    it("create rejects invalid type", async () => {
      const res = await clientAction({ request: form({ intent: "create", type: "bad" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid.*backup.*type/i);
    });

    it("create full backup succeeds", async () => {
      m.createBackup.mockResolvedValue({});
      const res = await clientAction({ request: form({ intent: "create", type: "full" }) } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/full.*backup/i);
    });

    it("create incremental backup succeeds", async () => {
      m.createBackup.mockResolvedValue({});
      const res = await clientAction({ request: form({ intent: "create", type: "incremental" }) } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/incremental/i);
    });

    it("create handles API error", async () => {
      m.createBackup.mockRejectedValue({ response: { data: { message: "Quota exceeded" } } });
      const res = await clientAction({ request: form({ intent: "create", type: "full" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Quota exceeded");
    });

    /* restore */
    it("restore rejects invalid backupId", async () => {
      const res = await clientAction({
        request: form({ intent: "restore", backupId: "bad", confirmed: "true" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/backup.*id/i);
    });

    it("restore requires confirmation", async () => {
      const res = await clientAction({
        request: form({ intent: "restore", backupId: VALID_UUID, confirmed: "false" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/confirm/i);
    });

    it("restore succeeds", async () => {
      m.restoreBackup.mockResolvedValue({});
      const res = await clientAction({
        request: form({ intent: "restore", backupId: VALID_UUID, confirmed: "true" }),
      } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/restore/i);
    });

    it("restore handles API error", async () => {
      m.restoreBackup.mockRejectedValue(new Error("oops"));
      const res = await clientAction({
        request: form({ intent: "restore", backupId: VALID_UUID, confirmed: "true" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe("oops");
    });

    it("returns actionable offline action copy", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      m.createBackup.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
      const res = await clientAction({ request: form({ intent: "create", type: "full" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe("You appear to be offline. Reconnect and try again.");
    });
  });

  describe("error helper", () => {
    it("preserves backend response messages", () => {
      expect(
        getAdminBackupsError({ response: { data: { message: "Quota exceeded" } } }, "Failed to create backup")
      ).toBe("Quota exceeded");
    });
  });
});
