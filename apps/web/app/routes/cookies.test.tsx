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

describe("CookiesPage", () => {
  it("renders title via StaticPage", async () => {
    const { default: CookiesPage } = await import("./cookies");
    render(<CookiesPage />);
    expect(screen.getByText("pages.cookies.title")).toBeTruthy();
  });

  it("renders privacy policy CTA link", async () => {
    const { default: CookiesPage } = await import("./cookies");
    render(<CookiesPage />);
    const link = screen.getByText("pages.cookies.privacyPolicy");
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("/privacy");
  });

  it("has correct meta with Cookie Policy title", async () => {
    const { meta } = await import("./cookies");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Cookie") }),
    );
  });
});
