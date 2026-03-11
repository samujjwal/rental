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
  Bell: IconStub, Mail: IconStub, MessageSquare: IconStub, Smartphone: IconStub,
  Save: IconStub, CheckCircle: IconStub, XCircle: IconStub, Loader2: IconStub,
  AlertTriangle: IconStub, Volume2: IconStub, VolumeX: IconStub,
}));

import { clientLoader, clientAction } from "../system/notifications";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validSave: Record<string, string> = {
  intent: "save",
  adminDigestTime: "09:00",
  maxEmailsPerHour: "100",
  maxPushPerHour: "50",
  emailEnabled: "true",
  pushEnabled: "false",
  smsEnabled: "false",
  welcomeEmailEnabled: "true",
  bookingConfirmationEnabled: "true",
  paymentNotificationEnabled: "true",
  reviewRequestEnabled: "true",
  newUserNotification: "true",
  newListingNotification: "true",
  disputeNotification: "true",
  paymentFailureNotification: "true",
  dailyDigestEnabled: "false",
  weeklyReportEnabled: "true",
};

describe("admin/system/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  /* loader */
  describe("clientLoader", () => {
    it("returns notification settings", async () => {
      const notifications = { emailEnabled: true, pushEnabled: false };
      m.getSettings.mockResolvedValue({ notifications });
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.settings).toEqual(notifications);
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
      const res = await clientAction({ request: form({ intent: "delete" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });

    it("rejects invalid digest time format", async () => {
      const res = await clientAction({
        request: form({ ...validSave, adminDigestTime: "9am" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/HH:MM/i);
    });

    it("rejects out-of-range digest time", async () => {
      const res = await clientAction({
        request: form({ ...validSave, adminDigestTime: "25:00" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/valid.*time/i);
    });

    it("rejects notification limits out of range", async () => {
      const res = await clientAction({
        request: form({ ...validSave, maxEmailsPerHour: "99999" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/range/i);
    });

    it("saves successfully", async () => {
      m.updateSettings.mockResolvedValue({});
      const res = await clientAction({ request: form(validSave) } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/updated/i);
    });

    it("handles API error", async () => {
      m.updateSettings.mockRejectedValue({ response: { data: { message: "DB err" } } });
      const res = await clientAction({ request: form(validSave) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe("DB err");
    });
  });
});
