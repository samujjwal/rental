import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/* ─── Icon stubs ─── */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);

vi.mock("lucide-react", () => ({
  Bell: IconStub,
  Building2: IconStub,
  CreditCard: IconStub,
  Heart: IconStub,
  LogOut: IconStub,
  MessageCircle: IconStub,
  Search: IconStub,
  User: IconStub,
  AlertTriangle: IconStub,
  LayoutDashboard: IconStub,
  Settings: IconStub,
  Shield: IconStub,
  ChevronDown: IconStub,
  Plus: IconStub,
  Menu: IconStub,
  X: IconStub,
  Calendar: IconStub,
  Package: IconStub,
  Star: IconStub,
  ShieldAlert: IconStub,
}));

const mocks = vi.hoisted(() => ({
  useLocation: vi.fn(() => ({ pathname: "/dashboard" })),
  isAuthenticated: false as boolean,
  user: null as any,
}));

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  Outlet: () => <div data-testid="outlet" />,
  useLocation: () => mocks.useLocation(),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => ({
    isAuthenticated: mocks.isAuthenticated,
    user: mocks.user,
  }),
}));

vi.mock("~/components/theme", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("~/components/language", () => ({
  LanguageSelector: () => <div data-testid="lang-selector" />,
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import AppLayout from "./_app";

describe("AppLayout (_app)", () => {
  it("renders logo and outlet", () => {
    render(<AppLayout />);
    expect(screen.getByText("GharBatai")).toBeTruthy();
    expect(screen.getByTestId("outlet")).toBeTruthy();
  });

  it("shows login and signup links when unauthenticated", () => {
    mocks.isAuthenticated = false;
    mocks.user = null;
    const { container } = render(<AppLayout />);
    const links = Array.from(container.querySelectorAll("a"));
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs.some((h) => h?.includes("/auth/login"))).toBe(true);
    expect(hrefs).toContain("/auth/signup");
  });

  it("shows favorites, notifications, and logout when authenticated", () => {
    mocks.isAuthenticated = true;
    mocks.user = { firstName: "Ram", lastName: "K", email: "ram@test.np" };
    const { container } = render(<AppLayout />);
    // Open avatar dropdown to reveal logout link
    const avatarBtn = screen.getByLabelText(/Profile menu/i);
    fireEvent.click(avatarBtn);
    // Auth links rendered — check href destinations
    const links = Array.from(container.querySelectorAll("a"));
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/favorites");
    expect(hrefs).toContain("/notifications");
    expect(hrefs).toContain("/auth/logout");
    // Initials badge
    expect(screen.getByText("RK")).toBeTruthy();
  });

  it("renders theme toggle and language selector", () => {
    render(<AppLayout />);
    expect(screen.getByTestId("theme-toggle")).toBeTruthy();
    expect(screen.getByTestId("lang-selector")).toBeTruthy();
  });
});
