import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => () => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getMyClaims: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mocks.navigate,
}));

vi.mock("lucide-react", () => ({
  Shield: IconStub,
  AlertCircle: IconStub,
  Clock: IconStub,
  CheckCircle: IconStub,
  X: IconStub,
  ChevronRight: IconStub,
  FileText: IconStub,
  Plus: IconStub,
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => mocks.useAuthStore(),
}));

vi.mock("~/lib/api/insurance", () => ({
  insuranceApi: {
    getMyClaims: (...args: any[]) => mocks.getMyClaims(...args),
  },
}));

vi.mock("~/lib/utils", () => ({
  formatCurrency: (value: number) => `$${value}`,
}));

import InsuranceClaimsPage from "./insurance.claims";

describe("insurance.claims route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthStore.mockReturnValue({ isAuthenticated: true });
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.useAuthStore.mockReturnValue({ isAuthenticated: false });
    mocks.getMyClaims.mockResolvedValue({ data: [] });
    render(<InsuranceClaimsPage />);
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/auth/login?redirect=/insurance/claims");
    });
  });

  it("renders claims after loading", async () => {
    mocks.getMyClaims.mockResolvedValue({
      data: [
        {
          id: "claim-1",
          status: "SUBMITTED",
          incidentType: "DAMAGE",
          description: "Broken lens",
          incidentDate: "2026-03-01T00:00:00Z",
          submittedAt: "2026-03-02T00:00:00Z",
          claimAmount: 250,
        },
      ],
    });
    render(<InsuranceClaimsPage />);
    expect(await screen.findByText("My Insurance Claims")).toBeInTheDocument();
    expect(await screen.findByText("Broken lens")).toBeInTheDocument();
  });

  it("shows retryable error state", async () => {
    mocks.getMyClaims.mockRejectedValue(new Error("boom"));
    render(<InsuranceClaimsPage />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(mocks.getMyClaims).toHaveBeenCalledTimes(2);
    });
  });

  it("shows timeout-specific recovery copy", async () => {
    mocks.getMyClaims.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    render(<InsuranceClaimsPage />);
    expect(await screen.findByText("Loading claims timed out. Try again.")).toBeInTheDocument();
  });
});
