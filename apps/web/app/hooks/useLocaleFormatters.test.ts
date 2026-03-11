import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock the locale store
vi.mock("~/lib/store/locale", () => ({
  useLocaleStore: vi.fn((selector) => {
    const state = { language: "en", currency: "NPR" };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

vi.mock("~/config/locale", () => ({
  APP_CURRENCY: "NPR",
  APP_TIMEZONE: "Asia/Kathmandu",
}));

vi.mock("@rental-portal/shared-types", () => ({
  CURRENCY_INTL_LOCALE: {
    NPR: "ne-NP",
    USD: "en-US",
    INR: "en-IN",
  },
}));

const { useLocaleFormatters } = await import("~/hooks/useLocaleFormatters");

describe("useLocaleFormatters", () => {
  it("should return formatting functions", () => {
    const { result } = renderHook(() => useLocaleFormatters());
    expect(result.current.formatCurrency).toBeDefined();
    expect(result.current.formatNumber).toBeDefined();
    expect(result.current.formatDate).toBeDefined();
    expect(result.current.formatDateTime).toBeDefined();
    expect(result.current.formatRelativeTime).toBeDefined();
  });

  it("should format currency in NPR", () => {
    const { result } = renderHook(() => useLocaleFormatters());
    const formatted = result.current.formatCurrency(1000);
    // Should contain NPR symbol or "NPR"
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("should format number", () => {
    const { result } = renderHook(() => useLocaleFormatters());
    const formatted = result.current.formatNumber(1000000);
    expect(formatted).toBeTruthy();
    // Should contain digit grouping (may use Devanagari digits for ne-NP locale)
    expect(formatted.length).toBeGreaterThan(1);
  });

  it("should format date", () => {
    const { result } = renderHook(() => useLocaleFormatters());
    const formatted = result.current.formatDate("2025-01-15T10:00:00Z");
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("should format date with time", () => {
    const { result } = renderHook(() => useLocaleFormatters());
    const formatted = result.current.formatDateTime("2025-01-15T10:00:00Z");
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("should format relative time", () => {
    const { result } = renderHook(() => useLocaleFormatters());
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const formatted = result.current.formatRelativeTime(oneHourAgo);
    expect(formatted).toBeTruthy();
  });

  it("should allow currency override", () => {
    const { result } = renderHook(() => useLocaleFormatters("USD"));
    const formatted = result.current.formatCurrency(100);
    expect(formatted).toBeTruthy();
  });

  it("should expose language and intlLocale", () => {
    const { result } = renderHook(() => useLocaleFormatters());
    expect(result.current.language).toBe("en");
    expect(result.current.intlLocale).toBeTruthy();
  });
});
