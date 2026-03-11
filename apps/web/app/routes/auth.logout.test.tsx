import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  clearAuth: vi.fn(),
  getSession: vi.fn(),
  destroySession: vi.fn(),
  redirect: vi.fn((url: string, init?: any) =>
    new Response("", { status: 302, headers: { Location: url, ...(init?.headers || {}) } })
  ),
}));

vi.mock("react-router", () => ({ redirect: mocks.redirect }));
vi.mock("~/lib/api/auth", () => ({
  authApi: { logout: (...a: any[]) => mocks.logout(...a) },
}));
vi.mock("~/lib/store/auth", () => {
  const state = { clearAuth: mocks.clearAuth };
  const useAuthStore: any = (sel?: (s: any) => any) => sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});
vi.mock("~/utils/auth", () => ({
  getSession: (...a: any[]) => mocks.getSession(...a),
  sessionStorage: { destroySession: (...a: any[]) => mocks.destroySession(...a) },
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import LogoutPage, { clientLoader, clientAction } from "./auth.logout";

describe("auth.logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({});
    mocks.destroySession.mockResolvedValue("destroyed-cookie");
    mocks.logout.mockResolvedValue(undefined);
  });

  describe("clientAction", () => {
    it("calls logout API with no arguments (httpOnly cookie handles auth)", async () => {
      await clientAction({ request: new Request("http://localhost/auth/logout") } as any);
      expect(mocks.logout).toHaveBeenCalledWith();
    });

    it("clears auth store", async () => {
      await clientAction({ request: new Request("http://localhost/auth/logout") } as any);
      expect(mocks.clearAuth).toHaveBeenCalled();
    });

    it("destroys server session", async () => {
      await clientAction({ request: new Request("http://localhost/auth/logout") } as any);
      expect(mocks.destroySession).toHaveBeenCalled();
    });

    it("redirects to /auth/login", async () => {
      const result = await clientAction({ request: new Request("http://localhost/auth/logout") } as any);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).headers.get("Location")).toBe("/auth/login");
    });

    it("handles logout API error gracefully", async () => {
      mocks.logout.mockRejectedValue(new Error("Network error"));
      // Should still clear auth and redirect
      const result = await clientAction({ request: new Request("http://localhost/auth/logout") } as any);
      expect(mocks.clearAuth).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
    });
  });

  describe("clientLoader", () => {
    it("performs logout and redirects", async () => {
      const result = await clientLoader({ request: new Request("http://localhost/auth/logout") } as any);
      expect(mocks.clearAuth).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).headers.get("Location")).toBe("/auth/login");
    });
  });

  describe("LogoutPage component", () => {
    it("renders logging out message", () => {
      render(<LogoutPage />);
      expect(screen.getByText(/logging out/i)).toBeInTheDocument();
    });
  });
});
