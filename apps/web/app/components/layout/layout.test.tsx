import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PageHeader } from "~/components/layout/PageHeader";
import { PageContainer } from "~/components/layout/PageContainer";
import { AuthLayout } from "~/components/layout/AuthLayout";

/* ================================================================== */
/*  PageHeader                                                         */
/* ================================================================== */
describe("PageHeader", () => {
  it("renders title as h1", () => {
    render(<PageHeader title="My Page" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Page");
  });

  it("renders description when provided", () => {
    render(<PageHeader title="T" description="A description" />);
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("does not render description paragraph when omitted", () => {
    const { container } = render(<PageHeader title="T" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders children as action slot", () => {
    render(
      <PageHeader title="T">
        <button>Create</button>
      </PageHeader>
    );
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <PageHeader title="T" className="my-custom-class" />
    );
    expect(container.firstElementChild).toHaveClass("my-custom-class");
  });
});

/* ================================================================== */
/*  PageContainer                                                      */
/* ================================================================== */
describe("PageContainer", () => {
  it("renders children", () => {
    render(<PageContainer>Hello</PageContainer>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("applies max-w-7xl for default size", () => {
    const { container } = render(<PageContainer>X</PageContainer>);
    expect(container.firstElementChild).toHaveClass("max-w-7xl");
  });

  it("applies max-w-4xl for small size", () => {
    const { container } = render(<PageContainer size="small">X</PageContainer>);
    expect(container.firstElementChild).toHaveClass("max-w-4xl");
  });

  it("applies max-w-screen-2xl for large size", () => {
    const { container } = render(<PageContainer size="large">X</PageContainer>);
    expect(container.firstElementChild).toHaveClass("max-w-screen-2xl");
  });

  it("applies max-w-none for full size", () => {
    const { container } = render(<PageContainer size="full">X</PageContainer>);
    expect(container.firstElementChild).toHaveClass("max-w-none");
  });

  it("merges custom className", () => {
    const { container } = render(
      <PageContainer className="extra">X</PageContainer>
    );
    expect(container.firstElementChild).toHaveClass("extra");
    expect(container.firstElementChild).toHaveClass("max-w-7xl");
  });
});

/* ================================================================== */
/*  AuthLayout                                                         */
/* ================================================================== */
describe("AuthLayout", () => {
  it("renders GharBatai brand link", () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    const brandLink = screen.getByText("GharBatai");
    expect(brandLink).toBeInTheDocument();
    expect(brandLink.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders Terms and Privacy footer links", () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
  });

  it("renders copyright notice", () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
