import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { getListingCategoryLoadError } from "./listing-category-load-error";

describe("getListingCategoryLoadError", () => {
  it("preserves backend response messages", () => {
    expect(
      getListingCategoryLoadError({
        response: { data: { message: "Category catalog is rebuilding" } },
      })
    ).toBe("Category catalog is rebuilding");
  });

  it("uses actionable offline copy", () => {
    const online = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getListingCategoryLoadError(new Error("Network Error"))).toBe(
      "You appear to be offline. Reconnect and try loading categories again."
    );

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: online,
    });
  });

  it("uses timeout-specific copy", () => {
    expect(
      getListingCategoryLoadError(new AxiosError("timeout", "ECONNABORTED"))
    ).toBe("Loading categories timed out. Try again.");
  });
});