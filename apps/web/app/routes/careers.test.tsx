import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ─── Shared mocks ────────────────────────────────────────────────── */
vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Code2: IconStub,
  Palette: IconStub,
  BarChart3: IconStub,
  Headphones: IconStub,
  Briefcase: IconStub,
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

/* ─── Careers page ────────────────────────────────────────────────── */
describe("CareersPage", () => {
  it("renders page heading", async () => {
    const { default: CareersPage } = await import("./careers");
    render(<CareersPage />);
    expect(screen.getByText("pages.careers.title")).toBeTruthy();
  });

  it("renders department cards", async () => {
    const { default: CareersPage } = await import("./careers");
    render(<CareersPage />);
    // The careers page renders department cards with translation keys
    expect(screen.getByText("pages.careers.deptEngineering")).toBeTruthy();
  });

  it("has correct meta export", async () => {
    const { meta } = await import("./careers");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Careers") }),
    );
  });
});
