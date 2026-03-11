import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  sendTestEmail: vi.fn(),
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
    sendTestEmail: (...a: any[]) => m.sendTestEmail(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Mail: IconStub, Server: IconStub, CheckCircle: IconStub, XCircle: IconStub,
  Loader2: IconStub, AlertTriangle: IconStub, Save: IconStub, Send: IconStub,
  Eye: IconStub, EyeOff: IconStub,
}));

import { clientLoader, clientAction } from "../system/email";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

/* base valid save fields */
const validSave: Record<string, string> = {
  intent: "save",
  provider: "smtp",
  fromEmail: "noreply@example.com",
  fromName: "GharBatai",
  replyToEmail: "support@example.com",
  smtpPort: "587",
  templateEngine: "handlebars",
  smtpHost: "smtp.example.com",
  apiKey: "",
};

describe("admin/system/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  /* loader */
  describe("clientLoader", () => {
    it("returns email settings", async () => {
      const email = { provider: "smtp", smtpHost: "h" };
      m.getSettings.mockResolvedValue({ email });
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.settings).toEqual(email);
      expect(res.error).toBeNull();
    });

    it("falls back to defaults on error", async () => {
      m.getSettings.mockRejectedValue(new Error("oops"));
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.settings).toBeDefined();
      expect(res.error).toBe("oops");
    });
  });

  /* action */
  describe("clientAction", () => {
    it("rejects invalid intent", async () => {
      const res = await clientAction({ request: form({ intent: "delete" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });

    /* test intent */
    describe("test", () => {
      it("rejects invalid email", async () => {
        const res = await clientAction({
          request: form({ intent: "test", testEmailRecipient: "bad" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/valid.*email/i);
      });

      it("sends test email successfully", async () => {
        m.sendTestEmail.mockResolvedValue({});
        const res = await clientAction({
          request: form({ intent: "test", testEmailRecipient: "a@b.com" }),
        } as any);
        expect(res.success).toBe(true);
        expect(res.message).toMatch(/test.*email.*sent/i);
      });

      it("handles test email API error", async () => {
        m.sendTestEmail.mockRejectedValue({ response: { data: { message: "Bounced" } } });
        const res = await clientAction({
          request: form({ intent: "test", testEmailRecipient: "a@b.com" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe("Bounced");
      });
    });

    /* save intent */
    describe("save", () => {
      it("rejects invalid provider", async () => {
        const res = await clientAction({ request: form({ ...validSave, provider: "bad" }) } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/provider/i);
      });

      it("rejects invalid fromEmail", async () => {
        const res = await clientAction({ request: form({ ...validSave, fromEmail: "bad" }) } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/from.*email/i);
      });

      it("rejects invalid replyToEmail", async () => {
        const res = await clientAction({
          request: form({ ...validSave, replyToEmail: "bad" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/reply.*email/i);
      });

      it("rejects empty fromName", async () => {
        const res = await clientAction({ request: form({ ...validSave, fromName: "" }) } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/name.*required/i);
      });

      it("rejects invalid templateEngine", async () => {
        const res = await clientAction({
          request: form({ ...validSave, templateEngine: "nunjucks" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/template/i);
      });

      it("requires smtpHost for smtp provider", async () => {
        const res = await clientAction({
          request: form({ ...validSave, smtpHost: "" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/smtp.*host/i);
      });

      it("requires apiKey for non-smtp providers", async () => {
        const res = await clientAction({
          request: form({ ...validSave, provider: "sendgrid", apiKey: "short" }),
        } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/api.*key/i);
      });

      it("saves successfully", async () => {
        m.updateSettings.mockResolvedValue({});
        const res = await clientAction({ request: form(validSave) } as any);
        expect(res.success).toBe(true);
        expect(res.message).toMatch(/updated/i);
      });

      it("handles save API error", async () => {
        m.updateSettings.mockRejectedValue(new Error("boom"));
        const res = await clientAction({ request: form(validSave) } as any);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/update/i);
      });
    });
  });
});
