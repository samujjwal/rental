import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Search: IconStub,
  MessageCircle: IconStub,
  Shield: IconStub,
  CreditCard: IconStub,
  Package: IconStub,
  AlertTriangle: IconStub,
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

describe("HelpPage", () => {
  it("renders page title", async () => {
    const { default: HelpPage } = await import("./help");
    render(<HelpPage />);
    expect(screen.getByText("pages.help.title")).toBeTruthy();
  });

  it("renders FAQ section heading", async () => {
    const { default: HelpPage } = await import("./help");
    render(<HelpPage />);
    expect(screen.getByText("pages.help.faq")).toBeTruthy();
  });

  it("renders support contact prompt", async () => {
    const { default: HelpPage } = await import("./help");
    render(<HelpPage />);
    expect(screen.getByText("pages.help.stillNeedHelp")).toBeTruthy();
  });

  it("has correct meta with Help Center title", async () => {
    const { meta } = await import("./help");
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Help") }),
    );
  });
});
