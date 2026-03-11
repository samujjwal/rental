import { describe, it, expect } from "vitest";
import {
  buttonVariants,
  buttonSizes,
  buttonBase,
} from "./button-variants";

describe("buttonVariants", () => {
  const expectedVariants = [
    "primary",
    "secondary",
    "outline",
    "ghost",
    "destructive",
    "success",
    "link",
  ] as const;

  it("exports all expected variant keys", () => {
    for (const key of expectedVariants) {
      expect(buttonVariants).toHaveProperty(key);
    }
  });

  it.each(expectedVariants)("%s variant is a non-empty string", (variant) => {
    expect(typeof buttonVariants[variant]).toBe("string");
    expect(buttonVariants[variant].length).toBeGreaterThan(0);
  });

  it("primary includes bg-primary", () => {
    expect(buttonVariants.primary).toContain("bg-primary");
  });

  it("destructive includes bg-destructive", () => {
    expect(buttonVariants.destructive).toContain("bg-destructive");
  });

  it("ghost is transparent", () => {
    expect(buttonVariants.ghost).toContain("bg-transparent");
  });

  it("outline has border", () => {
    expect(buttonVariants.outline).toContain("border");
  });

  it("link has underline-offset", () => {
    expect(buttonVariants.link).toContain("underline-offset");
  });

  it("all variants have focus-visible:ring", () => {
    for (const key of expectedVariants) {
      expect(buttonVariants[key]).toContain("focus-visible:ring");
    }
  });
});

describe("buttonSizes", () => {
  const expectedSizes = [
    "xs",
    "sm",
    "md",
    "lg",
    "xl",
    "icon",
    "icon-sm",
    "icon-lg",
  ] as const;

  it("exports all expected size keys", () => {
    for (const key of expectedSizes) {
      expect(buttonSizes).toHaveProperty(key);
    }
  });

  it.each(expectedSizes)("%s size is a non-empty string", (size) => {
    expect(typeof buttonSizes[size]).toBe("string");
    expect(buttonSizes[size].length).toBeGreaterThan(0);
  });

  it("md size includes h-10", () => {
    expect(buttonSizes.md).toContain("h-10");
  });

  it("icon sizes include width", () => {
    expect(buttonSizes.icon).toContain("w-10");
    expect(buttonSizes["icon-sm"]).toContain("w-8");
    expect(buttonSizes["icon-lg"]).toContain("w-12");
  });

  it("all sizes include rounded", () => {
    for (const key of expectedSizes) {
      expect(buttonSizes[key]).toMatch(/rounded/);
    }
  });
});

describe("buttonBase", () => {
  it("is a non-empty string", () => {
    expect(typeof buttonBase).toBe("string");
    expect(buttonBase.length).toBeGreaterThan(0);
  });

  it("includes flex layout", () => {
    expect(buttonBase).toContain("inline-flex");
    expect(buttonBase).toContain("items-center");
    expect(buttonBase).toContain("justify-center");
  });

  it("includes disabled styles", () => {
    expect(buttonBase).toContain("disabled:pointer-events-none");
    expect(buttonBase).toContain("disabled:opacity-50");
  });

  it("includes focus-visible ring", () => {
    expect(buttonBase).toContain("focus-visible:outline-none");
    expect(buttonBase).toContain("focus-visible:ring-2");
  });

  it("includes transition", () => {
    expect(buttonBase).toContain("transition-all");
  });
});
