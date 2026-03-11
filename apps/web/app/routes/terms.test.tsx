import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

describe("TermsPage", () => {
  it("renders page title", async () => {
    const { default: TermsPage } = await import("./terms");
    render(<TermsPage />);
    expect(screen.getByText("pages.terms.title")).toBeTruthy();
  });

  it("renders section headings", async () => {
    const { default: TermsPage } = await import("./terms");
    render(<TermsPage />);
    expect(screen.getByText("pages.terms.section1")).toBeTruthy();
  });

  it("has correct meta with Terms of Service title", async () => {
    const { meta } = await import("./terms");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Terms") }),
    );
  });
});
