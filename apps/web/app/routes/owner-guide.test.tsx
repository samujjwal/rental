import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/components/StaticPage", () => ({
  StaticPage: ({ title, description, callToAction }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {callToAction && <a href={callToAction.href}>{callToAction.label}</a>}
    </div>
  ),
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

describe("OwnerGuidePage", () => {
  it("renders title via StaticPage", async () => {
    const { default: OwnerGuidePage } = await import("./owner-guide");
    render(<OwnerGuidePage />);
    expect(screen.getByText("pages.ownerGuide.title")).toBeTruthy();
  });

  it("renders list an item CTA linking to /listings/new", async () => {
    const { default: OwnerGuidePage } = await import("./owner-guide");
    render(<OwnerGuidePage />);
    const link = screen.getByText("pages.ownerGuide.listAnItem");
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("/listings/new");
  });

  it("has correct meta with Owner Guide title", async () => {
    const { meta } = await import("./owner-guide");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Owner Guide") }),
    );
  });
});
