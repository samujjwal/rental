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

describe("SafetyPage", () => {
  it("renders title via StaticPage", async () => {
    const { default: SafetyPage } = await import("./safety");
    render(<SafetyPage />);
    expect(screen.getByText("pages.safety.title")).toBeTruthy();
  });

  it("renders get support CTA linking to /help", async () => {
    const { default: SafetyPage } = await import("./safety");
    render(<SafetyPage />);
    const link = screen.getByText("pages.safety.getSupport");
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("/help");
  });

  it("has correct meta with Safety Guidelines title", async () => {
    const { meta } = await import("./safety");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Safety") }),
    );
  });
});
