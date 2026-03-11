import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

/* ---------- mock auth store ---------- */
const mockStore = { user: null as any, accessToken: null as string | null };

vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => mockStore,
}));

import { ProtectedRoute } from "~/components/ProtectedRoute";

function renderWithRouter(
  element: React.ReactNode,
  { path = "/protected" } = {}
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/login" element={<div data-testid="login">Login</div>} />
        <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        <Route path="/protected" element={element} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockStore.user = null;
  mockStore.accessToken = null;
});

describe("ProtectedRoute", () => {
  it("redirects to /auth/login when unauthenticated", () => {
    renderWithRouter(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    );
    expect(screen.getByTestId("login")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("redirects when accessToken is present but user is null", () => {
    mockStore.accessToken = "tok";
    renderWithRouter(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    );
    expect(screen.getByTestId("login")).toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    mockStore.user = { id: "1", role: "renter" };
    mockStore.accessToken = "tok";
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("allows access when role matches requiredRole", () => {
    mockStore.user = { id: "1", role: "owner" };
    mockStore.accessToken = "tok";
    renderWithRouter(
      <ProtectedRoute requiredRole="owner">
        <div>Owner area</div>
      </ProtectedRoute>
    );
    expect(screen.getByText("Owner area")).toBeInTheDocument();
  });

  it("redirects to /dashboard when role does not match requiredRole", () => {
    mockStore.user = { id: "1", role: "renter" };
    mockStore.accessToken = "tok";
    renderWithRouter(
      <ProtectedRoute requiredRole="admin">
        <div>Admin only</div>
      </ProtectedRoute>
    );
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Admin only")).not.toBeInTheDocument();
  });

  it("renders without requiredRole for any authenticated user", () => {
    mockStore.user = { id: "1", role: "admin" };
    mockStore.accessToken = "tok";
    renderWithRouter(
      <ProtectedRoute>
        <div>Any user</div>
      </ProtectedRoute>
    );
    expect(screen.getByText("Any user")).toBeInTheDocument();
  });
});
