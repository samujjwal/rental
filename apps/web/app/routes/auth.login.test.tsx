import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  login: vi.fn(),
  createUserSession: vi.fn(),
  setAuth: vi.fn(),
  useActionData: vi.fn<() => any>(() => null),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  redirect: vi.fn((url: string, init?: any) =>
    new Response("", { status: 302, headers: { Location: url, ...(init?.headers || {}) } })
  ),
}));

vi.mock("react-router", () => ({
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  useSearchParams: () => mocks.useSearchParams(),
  redirect: mocks.redirect,
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock("~/lib/api/auth", () => ({
  authApi: { login: (...a: any[]) => mocks.login(...a) },
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
  createUserSession: (...a: any[]) => mocks.createUserSession(...a),
}));
vi.mock("~/lib/store/auth", () => {
  const state = { user: null, isAuthenticated: false, setAuth: mocks.setAuth, clearAuth: vi.fn() };
  const useAuthStore: any = (sel?: (s: any) => any) => sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});
vi.mock("~/lib/utils", () => ({ cn: (...a: any[]) => a.filter(Boolean).join(" ") }));
vi.mock("~/lib/validation/auth", () => ({
  loginSchema: {
    safeParse: (d: any) => {
      if (!d.email || !d.password) return { success: false, error: { issues: [{ message: "Required" }] } };
      if (!/\S+@\S+\.\S+/.test(d.email)) return { success: false, error: { issues: [{ message: "Invalid email" }] } };
      return { success: true, data: d };
    },
  },
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("react-hook-form", () => ({
  useForm: () => ({ register: () => ({}), formState: { errors: {} }, trigger: vi.fn() }),
  zodResolver: () => vi.fn(),
}));
vi.mock("@hookform/resolvers/zod", () => ({ zodResolver: () => vi.fn() }));
vi.mock("lucide-react", () => ({ Eye: IconStub, EyeOff: IconStub, LogIn: IconStub }));

import Login, { clientLoader, clientAction } from "./auth.login";

function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

describe("auth.login route", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── sanitizeRedirectPath (tested indirectly via clientLoader) ─────

  describe("clientLoader", () => {
    it("returns null when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      const result = await clientLoader({ request: new Request("http://localhost/auth/login") } as any);
      expect(result).toBeNull();
    });

    it("redirects authenticated user to /", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const result = await clientLoader({ request: new Request("http://localhost/auth/login") } as any);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).headers.get("Location")).toBe("/");
    });

    it("redirects to valid redirectTo param", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const result = await clientLoader({
        request: new Request("http://localhost/auth/login?redirectTo=/listings"),
      } as any);
      expect((result as Response).headers.get("Location")).toBe("/listings");
    });

    it("sanitizes //evil.com redirect to /", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const result = await clientLoader({
        request: new Request("http://localhost/auth/login?redirectTo=//evil.com"),
      } as any);
      expect((result as Response).headers.get("Location")).toBe("/");
    });

    it("sanitizes /auth/... redirect to /", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const result = await clientLoader({
        request: new Request("http://localhost/auth/login?redirectTo=/auth/login"),
      } as any);
      expect((result as Response).headers.get("Location")).toBe("/");
    });

    it("sanitizes too-long redirect", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const long = "/" + "a".repeat(600);
      const result = await clientLoader({
        request: new Request(`http://localhost/auth/login?redirectTo=${encodeURIComponent(long)}`),
      } as any);
      expect((result as Response).headers.get("Location")).toBe("/");
    });

    it("sanitizes redirect with control chars", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const result = await clientLoader({
        request: new Request("http://localhost/auth/login?redirectTo=/foo%0d%0abar"),
      } as any);
      expect((result as Response).headers.get("Location")).toBe("/");
    });
  });

  // ── clientAction ──────────────────────────────────────────────────

  describe("clientAction", () => {
    it("rejects non-login intent", async () => {
      const result = await clientAction({ request: makeFormReq({ intent: "hack" }) } as any);
      expect(result).toEqual({ error: "Invalid request." });
    });

    it("rejects overlong email", async () => {
      const result = await clientAction({
        request: makeFormReq({ intent: "login", email: "a".repeat(321), password: "pass1234" }),
      } as any);
      expect(result).toEqual({ error: "Invalid credentials." });
    });

    it("rejects overlong password", async () => {
      const result = await clientAction({
        request: makeFormReq({ intent: "login", email: "x@y.com", password: "a".repeat(1025) }),
      } as any);
      expect(result).toEqual({ error: "Invalid credentials." });
    });

    it("returns validation error for invalid email", async () => {
      const result = await clientAction({
        request: makeFormReq({ intent: "login", email: "bad", password: "pass1234" }),
      } as any);
      expect((result as any).error).toBeTruthy();
    });

    it("calls authApi.login and createUserSession on success", async () => {
      const user = { id: "u1", role: "renter" };
      mocks.login.mockResolvedValue({ user, accessToken: "at", refreshToken: "rt" });
      mocks.createUserSession.mockResolvedValue(
        new Response("", { status: 302, headers: { Location: "/dashboard" } })
      );
      const result = await clientAction({
        request: makeFormReq({ intent: "login", email: "test@test.com", password: "Password1!" }),
      } as any);
      expect(mocks.login).toHaveBeenCalledWith({ email: "test@test.com", password: "Password1!" });
      expect(mocks.setAuth).toHaveBeenCalledWith(user, "at");
      expect(mocks.createUserSession).toHaveBeenCalled();
    });

    it("passes remember=true when checked", async () => {
      mocks.login.mockResolvedValue({ user: { id: "u1" }, accessToken: "at", refreshToken: "rt" });
      mocks.createUserSession.mockResolvedValue(new Response("", { status: 302 }));
      await clientAction({
        request: makeFormReq({ intent: "login", email: "a@b.com", password: "Pass1234!", remember: "on" }),
      } as any);
      expect(mocks.createUserSession).toHaveBeenCalledWith(
        expect.objectContaining({ remember: true })
      );
    });

    it("returns error on API failure", async () => {
      mocks.login.mockRejectedValue(new Error("Network error"));
      const result = await clientAction({
        request: makeFormReq({ intent: "login", email: "a@b.com", password: "Pass1234!" }),
      } as any);
      expect((result as any).error).toContain("Network error");
    });

    it("extracts nested response error message", async () => {
      mocks.login.mockRejectedValue({
        response: { data: { message: "Invalid credentials" } },
      });
      const result = await clientAction({
        request: makeFormReq({ intent: "login", email: "a@b.com", password: "Pass1234!" }),
      } as any);
      expect((result as any).error).toBe("Invalid credentials");
    });
  });

  // ── Component ─────────────────────────────────────────────────────

  describe("Login component", () => {
    it("renders login form", () => {
      render(<Login />);
      expect(screen.getAllByText(/sign in|log in|login/i).length).toBeGreaterThan(0);
    });

    it("shows error from action data", () => {
      mocks.useActionData.mockReturnValue({ error: "Bad credentials" });
      render(<Login />);
      expect(screen.getByText(/Bad credentials/)).toBeInTheDocument();
    });
  });
});
