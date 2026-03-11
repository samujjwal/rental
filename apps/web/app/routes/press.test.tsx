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

describe("PressPage", () => {
  it("renders title via StaticPage", async () => {
    const { default: PressPage } = await import("./press");
    render(<PressPage />);
    expect(screen.getByText("pages.press.title")).toBeTruthy();
  });

  it("renders contact press CTA linking to /contact", async () => {
    const { default: PressPage } = await import("./press");
    render(<PressPage />);
    const link = screen.getByText("pages.press.contactPress");
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("/contact");
  });

  it("has correct meta with Press title", async () => {
    const { meta } = await import("./press");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Press") }),
    );
  });
});
