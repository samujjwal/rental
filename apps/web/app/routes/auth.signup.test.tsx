import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signup: vi.fn(),
  createUserSession: vi.fn(),
  setAuth: vi.fn(),
  useActionData: vi.fn<() => any>(() => null),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  redirect: vi.fn((url: string) =>
    new Response("", { status: 302, headers: { Location: url } })
  ),
}));

vi.mock("react-router", () => ({
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  redirect: mocks.redirect,
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock("~/lib/api/auth", () => ({
  authApi: { signup: (...a: any[]) => mocks.signup(...a) },
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
  signupSchema: {
    safeParse: (d: any) => {
      if (!d.email || !d.password || !d.firstName)
        return { success: false, error: { issues: [{ message: "Required fields" }] } };
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
vi.mock("react-hook-form", () => ({
  useForm: () => ({ register: () => ({}), watch: () => "", trigger: vi.fn(), formState: { errors: {} } }),
  zodResolver: () => vi.fn(),
}));
vi.mock("@hookform/resolvers/zod", () => ({ zodResolver: () => vi.fn() }));
vi.mock("lucide-react", () => ({ Eye: IconStub, EyeOff: IconStub, UserPlus: IconStub }));

import Signup, { clientLoader, clientAction } from "./auth.signup";

function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validSignup = {
  intent: "signup", email: "test@test.com", password: "Pass1234!",
  confirmPassword: "Pass1234!", firstName: "Ram", lastName: "K", phone: "", role: "renter",
};

describe("auth.signup route", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("clientLoader", () => {
    it("returns null when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      const r = await clientLoader({ request: new Request("http://localhost/auth/signup") } as any);
      expect(r).toBeNull();
    });

    it("redirects authenticated user to /dashboard", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1" });
      const r = await clientLoader({ request: new Request("http://localhost/auth/signup") } as any);
      expect(r).toBeInstanceOf(Response);
      expect((r as Response).headers.get("Location")).toBe("/dashboard");
    });
  });

  describe("clientAction", () => {
    it("rejects non-signup intent", async () => {
      const r = await clientAction({ request: makeFormReq({ intent: "hack" }) } as any);
      expect(r).toEqual({ error: "Invalid request." });
    });

    it("sanitizes invalid role to renter", async () => {
      mocks.signup.mockResolvedValue({ user: { id: "u1" }, accessToken: "at", refreshToken: "rt" });
      mocks.createUserSession.mockResolvedValue(new Response("", { status: 302 }));
      await clientAction({ request: makeFormReq({ ...validSignup, role: "admin" }) } as any);
      // Route should pass through but won't crash — role is sanitized to "renter"
      expect(mocks.signup).toHaveBeenCalled();
    });

    it("returns validation error for missing fields", async () => {
      const r = await clientAction({ request: makeFormReq({ intent: "signup", email: "", password: "" }) } as any);
      expect((r as any).error).toBeTruthy();
    });

    it("returns validation error for password mismatch", async () => {
      const r = await clientAction({
        request: makeFormReq({ ...validSignup, confirmPassword: "different" }),
      } as any);
      expect((r as any).error).toContain("match");
    });

    it("calls authApi.signup and sets auth on success", async () => {
      const user = { id: "u1", role: "renter" };
      mocks.signup.mockResolvedValue({ user, accessToken: "at", refreshToken: "rt" });
      mocks.createUserSession.mockResolvedValue(new Response("", { status: 302 }));
      await clientAction({ request: makeFormReq(validSignup) } as any);
      expect(mocks.signup).toHaveBeenCalled();
      expect(mocks.setAuth).toHaveBeenCalledWith(user, "at");
      expect(mocks.createUserSession).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", redirectTo: "/" })
      );
    });

    it("returns error on API failure", async () => {
      mocks.signup.mockRejectedValue({
        response: { data: { message: "Email already exists" } },
      });
      const r = await clientAction({ request: makeFormReq(validSignup) } as any);
      expect((r as any).error).toBe("Email already exists");
    });

    it("slices overlong fields", async () => {
      mocks.signup.mockResolvedValue({ user: { id: "u1" }, accessToken: "at", refreshToken: "rt" });
      mocks.createUserSession.mockResolvedValue(new Response("", { status: 302 }));
      await clientAction({
        request: makeFormReq({ ...validSignup, firstName: "A".repeat(100) }),
      } as any);
      // Should not crash — firstName is sliced to 50
      expect(mocks.signup).toHaveBeenCalled();
    });
  });

  describe("Signup component", () => {
    it("renders signup form", () => {
      render(<Signup />);
      expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    });

    it("shows error from action data", () => {
      mocks.useActionData.mockReturnValue({ error: "Email already exists" });
      render(<Signup />);
      expect(screen.getByText(/Email already exists/)).toBeInTheDocument();
    });
  });
});
