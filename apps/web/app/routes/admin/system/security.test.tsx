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
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Key: IconStub, Eye: IconStub, CheckCircle: IconStub, XCircle: IconStub,
  Loader2: IconStub, AlertTriangle: IconStub, Save: IconStub, Clock: IconStub,
  UserX: IconStub, Globe: IconStub,
}));

import { clientLoader, clientAction } from "../system/security";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validSave: Record<string, string> = {
  intent: "save",
  minPasswordLength: "8",
  requireUppercase: "true",
  requireLowercase: "true",
  requireNumbers: "true",
  requireSpecialChars: "false",
  passwordExpiryDays: "90",
  sessionTimeoutMinutes: "60",
  maxConcurrentSessions: "5",
  rememberMeDays: "30",
  maxLoginAttempts: "5",
  lockoutDurationMinutes: "15",
  enableCaptcha: "false",
  enableTwoFactor: "false",
  enableIpWhitelist: "false",
  ipWhitelist: "",
  enableRateLimiting: "true",
  rateLimitRequestsPerMinute: "100",
  enableAuditLog: "true",
  auditLogRetentionDays: "90",
};

describe("admin/system/security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  /* loader */
  describe("clientLoader", () => {
    it("returns security settings", async () => {
      const security = { minPasswordLength: 12 };
      m.getSettings.mockResolvedValue({ security });
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.settings).toEqual(security);
      expect(res.error).toBeNull();
    });

    it("falls back to defaults on error", async () => {
      m.getSettings.mockRejectedValue(new Error("fail"));
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.settings).toBeDefined();
      expect(res.error).toBe("fail");
    });
  });

  /* action */
  describe("clientAction", () => {
    it("rejects non-save intent", async () => {
      const res = await clientAction({ request: form({ intent: "reset" }) } as any);
      expect(res.success).toBe(false);
    });

    /* IP whitelist */
    it("rejects invalid IP in whitelist", async () => {
      const res = await clientAction({
        request: form({ ...validSave, ipWhitelist: "not-an-ip" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid.*ip/i);
    });

    it("accepts valid IPs with CIDR", async () => {
      m.updateSettings.mockResolvedValue({});
      const res = await clientAction({
        request: form({ ...validSave, ipWhitelist: "192.168.1.0/24\n10.0.0.1" }),
      } as any);
      expect(res.success).toBe(true);
    });

    /* bounded ints */
    it("rejects minPasswordLength < 6", async () => {
      const res = await clientAction({
        request: form({ ...validSave, minPasswordLength: "3" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/password.*length/i);
    });

    it("rejects minPasswordLength > 128", async () => {
      const res = await clientAction({
        request: form({ ...validSave, minPasswordLength: "200" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/password.*length/i);
    });

    it("rejects session timeout < 5", async () => {
      const res = await clientAction({
        request: form({ ...validSave, sessionTimeoutMinutes: "2" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/session.*timeout/i);
    });

    it("rejects maxConcurrentSessions > 100", async () => {
      const res = await clientAction({
        request: form({ ...validSave, maxConcurrentSessions: "200" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/concurrent.*session/i);
    });

    it("rejects maxLoginAttempts > 20", async () => {
      const res = await clientAction({
        request: form({ ...validSave, maxLoginAttempts: "50" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/login.*attempt/i);
    });

    it("rejects lockoutDuration > 1440", async () => {
      const res = await clientAction({
        request: form({ ...validSave, lockoutDurationMinutes: "2000" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/lockout/i);
    });

    it("rejects rateLimit > 10000", async () => {
      const res = await clientAction({
        request: form({ ...validSave, rateLimitRequestsPerMinute: "99999" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/rate.*limit/i);
    });

    it("rejects auditLogRetention > 3650", async () => {
      const res = await clientAction({
        request: form({ ...validSave, auditLogRetentionDays: "5000" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/audit.*log.*retention/i);
    });

    it("saves successfully", async () => {
      m.updateSettings.mockResolvedValue({});
      const res = await clientAction({ request: form(validSave) } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/updated/i);
    });

    it("handles API error", async () => {
      m.updateSettings.mockRejectedValue({ response: { data: { message: "perm denied" } } });
      const res = await clientAction({ request: form(validSave) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe("perm denied");
    });
  });
});
