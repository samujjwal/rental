import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock shared-types
vi.mock("@rental-portal/shared-types", () => ({
  SUPPORTED_CURRENCIES: ["NPR", "USD", "INR"] as const,
  CURRENCY_CONFIG: {},
  getCurrencySymbol: (code: string) => code,
}));

// Mock the locale store
const mockSetCurrency = vi.fn();
const currentCurrency = "NPR";

vi.mock("~/lib/store/locale", () => ({
  useLocaleStore: vi.fn((selector) => {
    const state = {
      currency: currentCurrency,
      setCurrency: mockSetCurrency,
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

const { CurrencySelector } = await import("~/components/CurrencySelector");

describe("CurrencySelector", () => {
  it("should render a select element", () => {
    render(<CurrencySelector />);
    const select = screen.getByRole("combobox", { name: /select currency/i });
    expect(select).toBeDefined();
  });

  it("should show all supported currencies", () => {
    render(<CurrencySelector />);
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(3);
  });

  it("should have NPR selected by default", () => {
    render(<CurrencySelector />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("NPR");
  });

  it("should call setCurrency on change", () => {
    render(<CurrencySelector />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "USD" } });
    expect(mockSetCurrency).toHaveBeenCalledWith("USD");
  });

  it("should accept className prop", () => {
    const { container } = render(<CurrencySelector className="my-class" />);
    const select = container.querySelector("select");
    expect(select?.className).toContain("my-class");
  });
});
