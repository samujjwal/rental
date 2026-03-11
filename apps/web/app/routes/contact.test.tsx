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

describe("ContactPage", () => {
  it("renders title via StaticPage", async () => {
    const { default: ContactPage } = await import("./contact");
    render(<ContactPage />);
    expect(screen.getByText("pages.contact.title")).toBeTruthy();
  });

  it("renders CTA link", async () => {
    const { default: ContactPage } = await import("./contact");
    render(<ContactPage />);
    expect(screen.getByText("pages.contact.browseListings")).toBeTruthy();
  });

  it("has correct meta with Contact title", async () => {
    const { meta } = await import("./contact");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Contact") }),
    );
  });
});
