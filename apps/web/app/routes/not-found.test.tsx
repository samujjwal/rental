import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));

describe("NotFound", () => {
  it("renders 404 heading", async () => {
    const { default: NotFound } = await import("./not-found");
    render(<NotFound />);
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("renders page not found message", async () => {
    const { default: NotFound } = await import("./not-found");
    render(<NotFound />);
    expect(screen.getByText(/page not found/i)).toBeTruthy();
  });

  it("renders a link back to home", async () => {
    const { default: NotFound } = await import("./not-found");
    render(<NotFound />);
    const homeLink = screen.getByText(/go back home/i);
    expect(homeLink).toBeTruthy();
    expect((homeLink as HTMLAnchorElement).href).toContain("/");
  });
});
