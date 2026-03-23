import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
  getMyPolicies: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("lucide-react", () => ({
  Shield: IconStub,
  FileCheck: IconStub,
  AlertCircle: IconStub,
  CheckCircle: IconStub,
  Clock: IconStub,
  X: IconStub,
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, loading, fullWidth, leftIcon, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => mocks.useAuthStore(),
}));
vi.mock("~/lib/api/insurance", () => ({
  insuranceApi: {
    getMyPolicies: (...args: any[]) => mocks.getMyPolicies(...args),
  },
}));
vi.mock("~/lib/utils", () => ({
  formatCurrency: (value: number) => `$${value}`,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuthStore.mockReturnValue({ isAuthenticated: false });
  mocks.getMyPolicies.mockResolvedValue({ data: [] });
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

afterEach(() => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

/* ================================================================== */
/*  Insurance page component                                           */
/* ================================================================== */
describe("InsurancePage", () => {
  it("renders the page title", async () => {
    const { default: InsurancePage } = await import("./insurance");
    render(<InsurancePage />);
    expect(screen.getByText("pages.insurance.title")).toBeTruthy();
  });

  it("renders coverage type cards", async () => {
    const { default: InsurancePage } = await import("./insurance");
    render(<InsurancePage />);
    expect(screen.getByText("pages.insurance.propertyProtection")).toBeTruthy();
    expect(screen.getByText("pages.insurance.liabilityCoverage")).toBeTruthy();
    expect(screen.getByText("pages.insurance.securityDeposits")).toBeTruthy();
  });

  it("renders for-owners and for-renters sections", async () => {
    const { default: InsurancePage } = await import("./insurance");
    render(<InsurancePage />);
    expect(screen.getByText("pages.insurance.forOwners")).toBeTruthy();
    expect(screen.getByText("pages.insurance.forRenters")).toBeTruthy();
  });

  it("renders contact support and help links", async () => {
    const { default: InsurancePage } = await import("./insurance");
    render(<InsurancePage />);
    expect(screen.getByText("pages.insurance.contactSupport")).toBeTruthy();
    expect(screen.getByText("pages.insurance.helpCenter")).toBeTruthy();
  });

  it("shows authenticated users a retryable policies error state", async () => {
    mocks.useAuthStore.mockReturnValue({ isAuthenticated: true });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.getMyPolicies
      .mockRejectedValueOnce(new AxiosError("Network Error"))
      .mockResolvedValueOnce({
        data: [
          {
            id: "policy-1",
            status: "ACTIVE",
            type: "STANDARD",
            policyNumber: "POL-123",
            coverageAmount: 5000,
            premiumAmount: 150,
            startDate: "2026-03-01T00:00:00Z",
            endDate: "2026-03-10T00:00:00Z",
            listing: { title: "Camera Kit" },
          },
        ],
      });

    const { default: InsurancePage } = await import("./insurance");
    render(<InsurancePage />);

    expect(
      await screen.findByText("You appear to be offline. Reconnect and try again.")
    ).toBeInTheDocument();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /errors.tryAgain/i }));

    await waitFor(() => {
      expect(mocks.getMyPolicies).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("Camera Kit")).toBeInTheDocument();
  });

  it("shows timeout-specific recovery copy for authenticated policy loads", async () => {
    mocks.useAuthStore.mockReturnValue({ isAuthenticated: true });
    mocks.getMyPolicies.mockRejectedValueOnce(new AxiosError("timeout", "ECONNABORTED"));

    const { default: InsurancePage } = await import("./insurance");
    render(<InsurancePage />);

    expect(await screen.findByText("Loading policies timed out. Try again.")).toBeInTheDocument();
  });
});
