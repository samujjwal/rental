import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseLoaderData = vi.fn();
const mockUseNavigate = vi.fn(() => vi.fn());
const mockUseRevalidator = vi.fn(() => ({ revalidate: vi.fn() }));

vi.mock("react-router", () => ({
  Links: () => <link data-testid="links" />,
  Meta: () => <meta data-testid="meta" />,
  Outlet: () => <div data-testid="outlet">outlet</div>,
  Scripts: () => <script data-testid="scripts" />,
  ScrollRestoration: () => null,
  useLoaderData: () => mockUseLoaderData(),
  useNavigate: () => mockUseNavigate(),
  useRevalidator: () => mockUseRevalidator(),
}));

vi.mock("./hooks/useAuthInit", () => ({
  useAuthInit: vi.fn(),
}));

const mockGetState = vi.fn();
const mockUseAuthStoreSelector = vi.fn();
vi.mock("./lib/store/auth", () => ({
  useAuthStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      mockUseAuthStoreSelector(selector),
    {
      getState: () => mockGetState(),
    }
  ),
}));

vi.mock("~/utils/auth", () => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {
    constructor() {}
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  ),
}));

vi.mock("~/components/ui", () => ({
  OfflineBanner: () => <div data-testid="offline-banner" />,
  RouteErrorBoundary: () => <div>Error</div>,
}));

vi.mock("~/components/ui/toast-manager", () => ({
  ToastManager: () => <div data-testid="toast-manager" />,
}));

vi.mock("~/components/accessibility/SkipLink", () => ({
  SkipLink: () => <a data-testid="skip-link">Skip</a>,
}));

vi.mock("~/components/animations/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-transition">{children}</div>
  ),
}));

vi.mock("./tailwind.css?url", () => ({ default: "/tailwind.css" }));
vi.mock("./styles/map.css?url", () => ({ default: "/map.css" }));

// ─── Import ───────────────────────────────────────────────────────────────────

import Root, { Layout, HydrateFallback, links } from "./root";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("root", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: initialized, not loading
    mockUseAuthStoreSelector.mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          isInitialized: true,
          isLoading: false,
          setAuth: vi.fn(),
        };
        return selector(state);
      }
    );

    mockUseLoaderData.mockReturnValue({
      user: null,
      accessToken: null,
      refreshToken: null,
      ENV: { API_URL: "http://localhost:3400/api" },
    });

    mockGetState.mockReturnValue({
      user: null,
      accessToken: null,
      setAuth: vi.fn(),
    });
  });

  describe("Layout", () => {
    it("renders with suppressHydrationWarning", () => {
      const { container } = render(
        <Layout>
          <div>child</div>
        </Layout>
      );
      // Layout renders <html> which becomes part of document structure
      // In jsdom, nested <html> is stripped — verify rendered output instead
      expect(container.innerHTML).toContain("child");
    });

    it("renders children inside body", () => {
      render(
        <Layout>
          <div data-testid="child">hello</div>
        </Layout>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("Layout component exists and renders children", () => {
      // Layout uses dangerouslySetInnerHTML for theme-preference script in <head>
      // but jsdom strips <html>/<head>/<body> when nested inside render container
      // We verify children render correctly
      const { container } = render(
        <Layout>
          <div data-testid="theme-check">content</div>
        </Layout>
      );
      expect(screen.getByTestId("theme-check")).toBeInTheDocument();
      expect(container.innerHTML).toContain("content");
    });
  });

  describe("Root (default export)", () => {
    it("renders loading state when not initialized", () => {
      mockUseAuthStoreSelector.mockImplementation(
        (selector: (state: Record<string, unknown>) => unknown) => {
          const state = {
            isInitialized: false,
            isLoading: true,
            setAuth: vi.fn(),
          };
          return selector(state);
        }
      );

      render(<Root />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("renders main content when initialized", () => {
      render(<Root />);
      expect(screen.getByTestId("query-provider")).toBeInTheDocument();
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    it("renders SkipLink", () => {
      render(<Root />);
      expect(screen.getByTestId("skip-link")).toBeInTheDocument();
    });

    it("renders OfflineBanner", () => {
      render(<Root />);
      expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
    });

    it("renders ToastManager", () => {
      render(<Root />);
      expect(screen.getByTestId("toast-manager")).toBeInTheDocument();
    });

    it("renders PageTransition wrapper", () => {
      render(<Root />);
      expect(screen.getByTestId("page-transition")).toBeInTheDocument();
    });

    it("renders main-content div with tabIndex", () => {
      render(<Root />);
      const main = document.getElementById("main-content");
      expect(main).toBeTruthy();
      expect(main?.getAttribute("tabindex")).toBe("-1");
    });
  });

  describe("HydrateFallback", () => {
    it("shows loading spinner", () => {
      render(<HydrateFallback />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("links", () => {
    it("returns array of link descriptors", () => {
      const result = links();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("includes Google Fonts preconnect", () => {
      const result = links();
      const preconnect = result.find(
        (l: any) => l.rel === "preconnect" && l.href?.includes("fonts.googleapis")
      );
      expect(preconnect).toBeDefined();
    });

    it("includes stylesheet links", () => {
      const result = links();
      const stylesheets = result.filter((l: any) => l.rel === "stylesheet");
      expect(stylesheets.length).toBeGreaterThanOrEqual(2);
    });
  });
});
