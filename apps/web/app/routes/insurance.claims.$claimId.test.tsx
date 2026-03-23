import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => () => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getClaim: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ claimId: "claim-1" }),
}));

vi.mock("lucide-react", () => ({
  Shield: IconStub,
  AlertCircle: IconStub,
  Clock: IconStub,
  CheckCircle: IconStub,
  X: IconStub,
  ArrowLeft: IconStub,
  FileText: IconStub,
  Image: IconStub,
  Video: IconStub,
  ExternalLink: IconStub,
  Calendar: IconStub,
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
    getClaim: (...args: any[]) => mocks.getClaim(...args),
  },
}));

vi.mock("~/lib/utils", () => ({
  formatCurrency: (value: number) => `$${value}`,
  formatDate: (value: string) => value,
}));

import InsuranceClaimDetailPage from "./insurance.claims.$claimId";

describe("insurance.claims.$claimId route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthStore.mockReturnValue({ isAuthenticated: true });
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.useAuthStore.mockReturnValue({ isAuthenticated: false });
    mocks.getClaim.mockResolvedValue(null);
    render(<InsuranceClaimDetailPage />);
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/auth/login?redirect=/insurance/claims/claim-1");
    });
  });

  it("renders claim details after loading", async () => {
    mocks.getClaim.mockResolvedValue({
      id: "claim-1",
      status: "SUBMITTED",
      incidentType: "THEFT",
      description: "Missing bike",
      incidentDate: "2026-03-01T00:00:00Z",
      submittedAt: "2026-03-02T00:00:00Z",
      claimAmount: 800,
      approvedAmount: 700,
      evidence: [],
      timeline: [
        {
          status: "SUBMITTED",
          date: "2026-03-02T00:00:00Z",
          note: "Claim filed",
        },
      ],
      booking: {
        id: "booking-1",
        listing: {
          title: "City Bike",
        },
      },
    });
    render(<InsuranceClaimDetailPage />);
    expect(await screen.findByText("Theft Claim")).toBeInTheDocument();
    expect(await screen.findByText("Missing bike")).toBeInTheDocument();
    expect(screen.getByText("$800")).toBeInTheDocument();
  });

  it("shows retry action when loading fails", async () => {
    mocks.getClaim.mockRejectedValue(new Error("boom"));
    render(<InsuranceClaimDetailPage />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(mocks.getClaim).toHaveBeenCalledTimes(2);
    });
  });

  it("shows timeout-specific recovery copy when the claim detail load stalls", async () => {
    mocks.getClaim.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    render(<InsuranceClaimDetailPage />);
    expect(await screen.findByText("Loading the claim timed out. Try again.")).toBeInTheDocument();
  });
});
