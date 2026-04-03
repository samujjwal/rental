import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRemixStub } from "@remix-run/testing";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
    Link: ({ to, children }: any) => <a href={to}>{children}</a>,
    useLocation: () => ({ pathname: "/admin/system/logs" }),
  };
});

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/components/admin/AdminNavigation", () => ({
  default: () => <nav data-testid="admin-nav">Admin Navigation</nav>,
}));

vi.mock("~/components/admin/AdminErrorBoundary", () => ({
  default: ({ children }: any) => <div data-testid="admin-error">{children}</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { clientLoader, ErrorBoundary } from "./_layout";
import AdminLayout from "./_layout";

describe("admin/_layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  describe("clientLoader", () => {
    it("calls requireAdmin and returns null", async () => {
      const res = await clientLoader({ request: new Request("http://l/admin") } as any);
      expect(m.requireAdmin).toHaveBeenCalled();
      expect(res).toBeNull();
    });
  });

  describe("ErrorBoundary", () => {
    it("renders error boundary", () => {
      render(<ErrorBoundary />);
      expect(screen.getByTestId("admin-error")).toBeInTheDocument();
    });
  });

  describe("AdminLayout", () => {
    it("renders admin layout with navigation", async () => {
      const RemixStub = createRemixStub([
        {
          path: "/admin/*",
          Component: AdminLayout,
          children: [
            {
              path: "",
              Component: () => <div data-testid="child">Child Content</div>,
            },
          ],
        },
      ]);

      render(<RemixStub initialEntries={["/admin"]} />);
      expect(await screen.findByTestId("admin-nav")).toBeInTheDocument();
      expect(await screen.findByTestId("outlet")).toBeInTheDocument();
    });

    it("shows skip to main content link", async () => {
      const RemixStub = createRemixStub([
        {
          path: "/admin/*",
          Component: AdminLayout,
          children: [
            {
              path: "",
              Component: () => <div>Child</div>,
            },
          ],
        },
      ]);

      render(<RemixStub initialEntries={["/admin"]} />);
      const skipLink = await screen.findByText("admin.skipToMainContent");
      expect(skipLink).toBeInTheDocument();
    });

    it("main content has correct attributes", async () => {
      const RemixStub = createRemixStub([
        {
          path: "/admin/*",
          Component: AdminLayout,
          children: [
            {
              path: "",
              Component: () => <div>Child</div>,
            },
          ],
        },
      ]);

      render(<RemixStub initialEntries={["/admin"]} />);
      const main = await screen.findByRole("main");
      expect(main).toHaveAttribute("id", "main-content");
      expect(main).toHaveAttribute("tabIndex", "-1");
    });
  });
});
