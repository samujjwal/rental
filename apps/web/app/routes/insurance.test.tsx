import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);

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
}));

beforeEach(() => vi.clearAllMocks());

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
});
