import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  forgotPassword: vi.fn(),
  useActionData: vi.fn<() => any>(() => null),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useSubmit: vi.fn(() => vi.fn()),
  redirect: vi.fn((url: string) =>
    new Response("", { status: 302, headers: { Location: url } })
  ),
}));

vi.mock("react-router", () => ({
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  useSubmit: () => mocks.useSubmit(),
  redirect: mocks.redirect,
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock("~/lib/api/auth", () => ({
  authApi: { forgotPassword: (...a: any[]) => mocks.forgotPassword(...a) },
}));
vi.mock("~/utils/auth", () => ({ getUser: (...a: any[]) => mocks.getUser(...a) }));
vi.mock("~/lib/validation/auth", () => ({
  forgotPasswordSchema: {
    safeParse: (d: any) => {
      if (!d.email || !/\S+@\S+\.\S+/.test(d.email))
        return { success: false, error: { issues: [{ message: "Invalid email" }] } };
      return { success: true, data: d };
    },
  },
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/lib/utils", () => ({ cn: (...a: any[]) => a.filter(Boolean).join(" ") }));
vi.mock("react-hook-form", () => ({
  useForm: () => ({ register: () => ({}), handleSubmit: (fn: any) => fn, formState: { errors: {} } }),
  zodResolver: () => vi.fn(),
}));
vi.mock("@hookform/resolvers/zod", () => ({ zodResolver: () => vi.fn() }));
vi.mock("lucide-react", () => ({ Mail: IconStub, ArrowLeft: IconStub }));

import ForgotPassword, { clientLoader, clientAction } from "./auth.forgot-password";

function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

describe("auth.forgot-password route", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("clientLoader", () => {
    it("returns null when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      expect(await clientLoader({ request: new Request("http://localhost") } as any)).toBeNull();
    });

    it("redirects authenticated user", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const r = await clientLoader({ request: new Request("http://localhost") } as any);
      expect((r as Response).headers.get("Location")).toBe("/dashboard");
    });
  });

  describe("clientAction", () => {
    it("rejects invalid intent", async () => {
      const r = await clientAction({ request: makeFormReq({ intent: "x" }) } as any);
      expect(r).toEqual({ success: false, error: "Invalid request." });
    });

    it("rejects overlong email", async () => {
      const r = await clientAction({
        request: makeFormReq({ intent: "forgot-password", email: "a".repeat(321) }),
      } as any);
      expect(r.success).toBe(false);
    });

    it("rejects invalid email format", async () => {
      const r = await clientAction({
        request: makeFormReq({ intent: "forgot-password", email: "bad" }),
      } as any);
      expect(r.success).toBe(false);
    });

    it("returns success on valid request", async () => {
      mocks.forgotPassword.mockResolvedValue({ message: "Email sent" });
      const r = await clientAction({
        request: makeFormReq({ intent: "forgot-password", email: "a@b.com" }),
      } as any);
      expect(r).toEqual({ success: true, message: "Email sent" });
    });

    it("handles API error", async () => {
      mocks.forgotPassword.mockRejectedValue(new Error("fail"));
      const r = await clientAction({
        request: makeFormReq({ intent: "forgot-password", email: "a@b.com" }),
      } as any);
      expect(r.success).toBe(false);
      expect(r.error).toContain("Failed to send");
    });
  });

  describe("ForgotPassword component", () => {
    it("renders form", () => {
      render(<ForgotPassword />);
      expect(screen.getByText('Forgot Password')).toBeInTheDocument();
    });

    it("shows success state", () => {
      mocks.useActionData.mockReturnValue({ success: true, message: "Done" });
      render(<ForgotPassword />);
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
    });
  });
});
