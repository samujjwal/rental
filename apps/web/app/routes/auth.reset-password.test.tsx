import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  resetPassword: vi.fn(),
  useLoaderData: vi.fn(() => ({ token: "valid-token-12345" })),
  useActionData: vi.fn(() => null),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useSubmit: vi.fn(() => vi.fn()),
  redirect: vi.fn((url: string) =>
    new Response("", { status: 302, headers: { Location: url } })
  ),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  useSubmit: () => mocks.useSubmit(),
  redirect: mocks.redirect,
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock("~/lib/api/auth", () => ({
  authApi: { resetPassword: (...a: any[]) => mocks.resetPassword(...a) },
}));
vi.mock("~/utils/auth", () => ({ getUser: (...a: any[]) => mocks.getUser(...a) }));
vi.mock("~/lib/validation/auth", () => ({
  resetPasswordSchema: {
    safeParse: (d: any) => {
      if (!d.password || d.password.length < 8)
        return { success: false, error: { issues: [{ message: "Password too short" }] } };
      if (d.password !== d.confirmPassword)
        return { success: false, error: { issues: [{ message: "Passwords do not match" }] } };
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
  useForm: () => ({ register: () => ({}), handleSubmit: (fn: any) => fn, watch: () => "", formState: { errors: {} } }),
  zodResolver: () => vi.fn(),
}));
vi.mock("@hookform/resolvers/zod", () => ({ zodResolver: () => vi.fn() }));
vi.mock("lucide-react", () => ({ Eye: IconStub, EyeOff: IconStub, CheckCircle: IconStub, Info: IconStub }));

import ResetPassword, { clientLoader, clientAction } from "./auth.reset-password";

function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

describe("auth.reset-password route", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("clientLoader", () => {
    it("redirects authenticated user", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const r = await clientLoader({ request: new Request("http://localhost/auth/reset-password?token=validtoken1234") } as any);
      expect((r as Response).headers.get("Location")).toBe("/dashboard");
    });

    it("redirects on missing token", async () => {
      mocks.getUser.mockResolvedValue(null);
      const r = await clientLoader({ request: new Request("http://localhost/auth/reset-password") } as any);
      expect((r as Response).headers.get("Location")).toBe("/auth/forgot-password");
    });

    it("redirects on short token", async () => {
      mocks.getUser.mockResolvedValue(null);
      const r = await clientLoader({ request: new Request("http://localhost/auth/reset-password?token=abc") } as any);
      expect((r as Response).headers.get("Location")).toBe("/auth/forgot-password");
    });

    it("redirects on too-long token", async () => {
      mocks.getUser.mockResolvedValue(null);
      const r = await clientLoader({
        request: new Request(`http://localhost/auth/reset-password?token=${"a".repeat(513)}`),
      } as any);
      expect((r as Response).headers.get("Location")).toBe("/auth/forgot-password");
    });

    it("returns token for valid request", async () => {
      mocks.getUser.mockResolvedValue(null);
      const r = await clientLoader({
        request: new Request("http://localhost/auth/reset-password?token=validtoken1234"),
      } as any);
      expect(r).toEqual({ token: "validtoken1234" });
    });
  });

  describe("clientAction", () => {
    it("rejects invalid intent", async () => {
      const r = await clientAction({ request: makeFormReq({ intent: "x" }) } as any);
      expect(r).toEqual({ success: false, error: "Invalid request." });
    });

    it("rejects missing token", async () => {
      const r = await clientAction({
        request: makeFormReq({ intent: "reset-password", password: "Pass1234!", confirmPassword: "Pass1234!" }),
      } as any);
      expect(r.success).toBe(false);
      expect(r.error).toContain("token");
    });

    it("rejects password mismatch", async () => {
      const r = await clientAction({
        request: makeFormReq({
          intent: "reset-password", token: "validtoken1234",
          password: "Pass1234!", confirmPassword: "different",
        }),
      } as any);
      expect(r.success).toBe(false);
    });

    it("calls resetPassword API on success", async () => {
      mocks.resetPassword.mockResolvedValue({ message: "Password updated" });
      const r = await clientAction({
        request: makeFormReq({
          intent: "reset-password", token: "validtoken1234",
          password: "NewPass123!", confirmPassword: "NewPass123!",
        }),
      } as any);
      expect(r).toEqual({ success: true, message: "Password updated" });
      expect(mocks.resetPassword).toHaveBeenCalledWith({
        token: "validtoken1234",
        newPassword: "NewPass123!",
      });
    });

    it("returns error on API failure", async () => {
      mocks.resetPassword.mockRejectedValue(new Error("Token expired"));
      const r = await clientAction({
        request: makeFormReq({
          intent: "reset-password", token: "validtoken1234",
          password: "NewPass123!", confirmPassword: "NewPass123!",
        }),
      } as any);
      expect(r.success).toBe(false);
    });
  });

  describe("ResetPassword component", () => {
    it("renders form", () => {
      render(<ResetPassword />);
      expect(screen.getAllByText(/reset|new password|set/i).length).toBeGreaterThan(0);
    });
  });
});
