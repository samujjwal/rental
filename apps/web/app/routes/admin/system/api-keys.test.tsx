import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted stubs ─────────────────────────────────────────────────────── */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  regenerateApiKey: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ apiKeys: [], error: null })),
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
    getApiKeys: (...a: any[]) => m.getApiKeys(...a),
    createApiKey: (...a: any[]) => m.createApiKey(...a),
    revokeApiKey: (...a: any[]) => m.revokeApiKey(...a),
    regenerateApiKey: (...a: any[]) => m.regenerateApiKey(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Key: IconStub, Plus: IconStub, Trash2: IconStub, Copy: IconStub,
  CheckCircle: IconStub, XCircle: IconStub, Loader2: IconStub,
  AlertTriangle: IconStub, Eye: IconStub, EyeOff: IconStub,
  RefreshCw: IconStub, Clock: IconStub, Shield: IconStub,
}));

/* ── import after mocks ───────────────────────────────────────────────── */
import { clientLoader, clientAction, getAdminApiKeysError } from "../system/api-keys";

/* ── helpers ───────────────────────────────────────────────────────────── */
function req(url = "http://localhost/admin/system/api-keys") {
  return new Request(url);
}
function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.append(k, v);
  }
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}
const VALID_UUID = "11111111-1111-1111-8111-111111111111";

/* ── tests ─────────────────────────────────────────────────────────────── */
describe("admin/system/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  /* ── loader ──────────────────────────────────────────────────────────── */
  describe("clientLoader", () => {
    it("returns api keys on success", async () => {
      const keys = [{ id: "k1", name: "Test Key" }];
      m.getApiKeys.mockResolvedValue({ keys });
      const res = await clientLoader({ request: req() } as any);
      expect(res.apiKeys).toEqual(keys);
      expect(res.error).toBeNull();
    });

    it("returns empty array with error on failure", async () => {
      m.getApiKeys.mockRejectedValue(new Error("boom"));
      const res = await clientLoader({ request: req() } as any);
      expect(res.apiKeys).toEqual([]);
      expect(res.error).toBe("boom");
    });

    it("uses generic message when error has no message", async () => {
      m.getApiKeys.mockRejectedValue("string-error");
      const res = await clientLoader({ request: req() } as any);
      expect(res.error).toBe("An unexpected error occurred. Please try again.");
    });

    it("uses actionable offline copy on loader failure", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      m.getApiKeys.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const res = await clientLoader({ request: req() } as any);

      expect(res.error).toBe("You appear to be offline. Reconnect and try again.");

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });
  });

  /* ── action ──────────────────────────────────────────────────────────── */
  describe("clientAction", () => {
    it("rejects unknown intent", async () => {
      const res = await clientAction({ request: form({ intent: "nope" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unknown/i);
    });

    /* create */
    describe("create", () => {
      it("requires name", async () => {
        const res = await clientAction({
          request: form({ intent: "create", name: "", scopes: "read:users", expiresInDays: "30" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/name.*required/i);
      });

      it("requires at least one valid scope", async () => {
        const res = await clientAction({
          request: form({ intent: "create", name: "k", scopes: "invalid:scope", expiresInDays: "30" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/scope/i);
      });

      it("rejects out-of-range expiresInDays", async () => {
        const res = await clientAction({
          request: form({ intent: "create", name: "k", scopes: ["read:users"], expiresInDays: "9999" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/expir/i);
      });

      it("creates key successfully", async () => {
        m.createApiKey.mockResolvedValue({ key: "sk-abc123" });
        const res = await clientAction({
          request: form({ intent: "create", name: "My Key", scopes: ["read:users", "write:users"], expiresInDays: "30" }),
        } as any);
        expect(res.success).toBe(true);
        expect((res as any).newKey).toBe("sk-abc123");
        expect(m.createApiKey).toHaveBeenCalledWith({
          name: "My Key",
          scopes: ["read:users", "write:users"],
          expiresInDays: 30,
        });
      });

      it("handles API error on create", async () => {
        m.createApiKey.mockRejectedValue({ response: { data: { message: "Limit reached" } } });
        const res = await clientAction({
          request: form({ intent: "create", name: "k", scopes: ["admin"], expiresInDays: "7" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe("Limit reached");
      });

      it("uses actionable offline copy on create failure", async () => {
        const previousOnline = navigator.onLine;
        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          value: false,
        });
        m.createApiKey.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

        const res = await clientAction({
          request: form({ intent: "create", name: "k", scopes: ["admin"], expiresInDays: "7" }),
        } as any);

        expect(res.success).toBe(false);
        expect(res.error).toBe("You appear to be offline. Reconnect and try again.");

        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          value: previousOnline,
        });
      });
    });

    /* revoke */
    describe("revoke", () => {
      it("rejects invalid UUID", async () => {
        const res = await clientAction({
          request: form({ intent: "revoke", keyId: "bad" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/key.*id.*required/i);
      });

      it("revokes successfully", async () => {
        m.revokeApiKey.mockResolvedValue({});
        const res = await clientAction({
          request: form({ intent: "revoke", keyId: VALID_UUID }),
        } as any);
        expect(res.success).toBe(true);
        expect(res.message).toMatch(/revoked/i);
      });

      it("handles API error on revoke", async () => {
        m.revokeApiKey.mockRejectedValue(new Error("oops"));
        const res = await clientAction({
          request: form({ intent: "revoke", keyId: VALID_UUID }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe("oops");
      });
    });

    /* regenerate */
    describe("regenerate", () => {
      it("rejects invalid UUID", async () => {
        const res = await clientAction({
          request: form({ intent: "regenerate", keyId: "nope" }),
        } as any);
        expect(res.success).toBe(false);
      });

      it("regenerates successfully", async () => {
        m.regenerateApiKey.mockResolvedValue({ key: "sk-new456" });
        const res = await clientAction({
          request: form({ intent: "regenerate", keyId: VALID_UUID }),
        } as any);
        expect(res.success).toBe(true);
        expect((res as any).newKey).toBe("sk-new456");
      });

      it("handles API error on regenerate", async () => {
        m.regenerateApiKey.mockRejectedValue({ response: { data: { message: "Expired" } } });
        const res = await clientAction({
          request: form({ intent: "regenerate", keyId: VALID_UUID }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe("Expired");
      });
    });

    it("preserves backend response messages in helper", () => {
      expect(
        getAdminApiKeysError({ response: { data: { message: "Quota exceeded" } } }, "fallback")
      ).toBe("Quota exceeded");
    });
  });
});
