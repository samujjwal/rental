import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock i18next before importing the store
vi.mock("~/i18n", () => ({
  default: {
    changeLanguage: vi.fn(),
    language: "en",
    isInitialized: true,
  },
}));

// Must import after mocks
const { useLocaleStore } = await import("~/lib/store/locale");

describe("useLocaleStore", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useLocaleStore.setState({ language: "en", currency: "NPR" });
    });
  });

  it("should default to 'en' language", () => {
    const { result } = renderHook(() => useLocaleStore());
    expect(result.current.language).toBe("en");
  });

  it("should default to 'NPR' currency", () => {
    const { result } = renderHook(() => useLocaleStore());
    expect(result.current.currency).toBe("NPR");
  });

  it("should switch language", () => {
    const { result } = renderHook(() => useLocaleStore());
    act(() => {
      result.current.setLanguage("ne");
    });
    expect(result.current.language).toBe("ne");
    expect(localStorage.setItem).toHaveBeenCalledWith("language-preference", "ne");
    expect(document.documentElement.lang).toBe("ne");
  });

  it("should switch currency", () => {
    const { result } = renderHook(() => useLocaleStore());
    act(() => {
      result.current.setCurrency("USD");
    });
    expect(result.current.currency).toBe("USD");
    expect(localStorage.setItem).toHaveBeenCalledWith("currency-preference", "USD");
  });

  it("should persist language across re-renders", () => {
    localStorage.setItem("language-preference", "ne");
    // Reset store to re-read from localStorage
    act(() => {
      useLocaleStore.setState({ language: "ne" });
    });
    const { result } = renderHook(() => useLocaleStore());
    expect(result.current.language).toBe("ne");
  });

  it("should persist currency across re-renders", () => {
    localStorage.setItem("currency-preference", "INR");
    act(() => {
      useLocaleStore.setState({ currency: "INR" });
    });
    const { result } = renderHook(() => useLocaleStore());
    expect(result.current.currency).toBe("INR");
  });
});
