import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ─── Shared mocks for all static pages ─────────────────────────── */
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
  Code2: IconStub,
  Palette: IconStub,
  BarChart3: IconStub,
  Headphones: IconStub,
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/StaticPage", () => ({
  StaticPage: ({ titleKey, sections }: any) => (
    <div>
      <h1>{titleKey}</h1>
      {sections?.map((s: any, i: number) => (
        <section key={i}>
          <h2>{s.titleKey}</h2>
          <p>{s.contentKey}</p>
        </section>
      ))}
    </div>
  ),
}));

/* ================================================================== */
/*  Terms                                                              */
/* ================================================================== */
describe("TermsPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./terms");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Terms") }),
    );
  });
});

/* ================================================================== */
/*  Privacy                                                            */
/* ================================================================== */
describe("PrivacyPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./privacy");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Privacy") }),
    );
  });
});

/* ================================================================== */
/*  Contact                                                            */
/* ================================================================== */
describe("ContactPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./contact");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Contact") }),
    );
  });
});

/* ================================================================== */
/*  Help                                                               */
/* ================================================================== */
describe("HelpPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./help");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Help") }),
    );
  });
});

/* ================================================================== */
/*  How It Works                                                       */
/* ================================================================== */
describe("HowItWorksPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./how-it-works");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("How") }),
    );
  });
});

/* ================================================================== */
/*  Cookies                                                            */
/* ================================================================== */
describe("CookiesPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./cookies");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Cookie") }),
    );
  });
});

/* ================================================================== */
/*  Safety                                                             */
/* ================================================================== */
describe("SafetyPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./safety");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Safety") }),
    );
  });
});

/* ================================================================== */
/*  Owner Guide                                                        */
/* ================================================================== */
describe("OwnerGuidePage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./owner-guide");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Owner") }),
    );
  });
});

/* ================================================================== */
/*  Press                                                              */
/* ================================================================== */
describe("PressPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./press");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Press") }),
    );
  });
});

/* ================================================================== */
/*  Careers                                                            */
/* ================================================================== */
describe("CareersPage", () => {
  it("renders and exports meta", async () => {
    const mod = await import("./careers");
    const { default: Page, meta } = mod;
    render(<Page />);
    const metaData = meta({} as any);
    expect(metaData).toContainEqual(
      expect.objectContaining({ title: expect.stringContaining("Career") }),
    );
  });
});
