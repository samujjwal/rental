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

describe("PrivacyPage", () => {
  it("renders page title", async () => {
    const { default: PrivacyPage } = await import("./privacy");
    render(<PrivacyPage />);
    expect(screen.getByText("pages.privacy.title")).toBeTruthy();
  });

  it("renders section headings", async () => {
    const { default: PrivacyPage } = await import("./privacy");
    render(<PrivacyPage />);
    expect(screen.getByText("pages.privacy.section1")).toBeTruthy();
    expect(screen.getByText("pages.privacy.section2")).toBeTruthy();
  });

  it("has correct meta with Privacy Policy title", async () => {
    const { meta } = await import("./privacy");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Privacy") }),
    );
  });
});
