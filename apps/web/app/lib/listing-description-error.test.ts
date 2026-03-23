import { describe, expect, it } from "vitest";

import { getListingDescriptionGenerationError } from "./listing-description-error";

describe("getListingDescriptionGenerationError", () => {
  it("preserves backend response messages", () => {
    expect(
      getListingDescriptionGenerationError(
        { response: { data: { message: "AI quota exceeded" } } },
        "fallback"
      )
    ).toBe("AI quota exceeded");
  });

  it("uses actionable offline copy", () => {
    const online = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getListingDescriptionGenerationError(new Error("Network Error"), "fallback")).toBe(
      "You appear to be offline. Reconnect and try generating the description again."
    );

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: online,
    });
  });
});