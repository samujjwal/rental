import { describe, expect, it } from "vitest";

import { getListingImageUploadError } from "./listing-image-upload-error";

describe("getListingImageUploadError", () => {
  it("preserves backend response messages", () => {
    expect(
      getListingImageUploadError(
        { response: { data: { message: "Upload quota exceeded" } } },
        "fallback"
      )
    ).toBe("Upload quota exceeded");
  });

  it("uses actionable offline copy", () => {
    const online = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getListingImageUploadError(new Error("Network Error"), "fallback")).toBe(
      "You appear to be offline. Reconnect and try uploading the images again."
    );

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: online,
    });
  });

  it("falls back to the shared default message", () => {
    expect(getListingImageUploadError(null)).toBe("Image upload failed. Please try again.");
  });
});