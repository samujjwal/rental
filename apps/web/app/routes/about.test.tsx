import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ─── Shared mocks for static pages ─────────────────────────────── */
vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Shield: IconStub,
  Users: IconStub,
  Heart: IconStub,
  Globe: IconStub,
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

/* ================================================================== */
/*  About page                                                         */
/* ================================================================== */
describe("AboutPage", () => {
  it("renders page title and feature cards", async () => {
    const { default: AboutPage } = await import("./about");
    render(<AboutPage />);
    expect(screen.getByText("pages.about.title")).toBeTruthy();
    expect(screen.getByText("pages.about.communityFirst")).toBeTruthy();
    expect(screen.getByText("pages.about.verifiedSecure")).toBeTruthy();
    expect(screen.getByText("pages.about.sustainability")).toBeTruthy();
    expect(screen.getByText("pages.about.forEveryone")).toBeTruthy();
  });

  it("renders CTA section with links", async () => {
    const { default: AboutPage } = await import("./about");
    render(<AboutPage />);
    expect(screen.getByText("pages.about.browseListings")).toBeTruthy();
    expect(screen.getByText("pages.about.becomeOwner")).toBeTruthy();
  });

  it("has correct meta export", async () => {
    const { meta } = await import("./about");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(expect.objectContaining({ title: expect.stringContaining("About") }));
  });
});
