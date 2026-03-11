import { describe, it, expect } from "vitest";
import designTokens, { spacing, responsive } from "./designTokens";

describe("designTokens", () => {
  describe("colors", () => {
    it("has primary color palette", () => {
      expect(designTokens.colors.primary.main).toBe("#4f46e5");
      expect(designTokens.colors.primary.contrastText).toBe("#ffffff");
    });

    it("has success/warning/error/info palettes", () => {
      for (const key of ["success", "warning", "error", "info"] as const) {
        expect(designTokens.colors[key]).toHaveProperty("main");
        expect(designTokens.colors[key]).toHaveProperty("light");
        expect(designTokens.colors[key]).toHaveProperty("dark");
        expect(designTokens.colors[key]).toHaveProperty("contrastText");
      }
    });

    it("has text colors", () => {
      expect(designTokens.colors.text.primary).toBeDefined();
      expect(designTokens.colors.text.secondary).toBeDefined();
      expect(designTokens.colors.text.disabled).toBeDefined();
    });

    it("has border colors", () => {
      expect(designTokens.colors.border.main).toBeDefined();
      expect(designTokens.colors.border.light).toBeDefined();
    });
  });

  describe("spacing", () => {
    it("has expected spacing scale", () => {
      expect(designTokens.spacing.xs).toBe(4);
      expect(designTokens.spacing.sm).toBe(8);
      expect(designTokens.spacing.md).toBe(16);
      expect(designTokens.spacing.lg).toBe(24);
      expect(designTokens.spacing.xl).toBe(32);
      expect(designTokens.spacing.xxl).toBe(48);
    });
  });

  describe("typography", () => {
    it("has font family", () => {
      expect(designTokens.typography.fontFamily).toContain("Inter");
    });

    it("has font size scale", () => {
      expect(designTokens.typography.fontSize.xs).toBe("0.75rem");
      expect(designTokens.typography.fontSize.md).toBe("1rem");
    });

    it("has font weight scale", () => {
      expect(designTokens.typography.fontWeight.normal).toBe(400);
      expect(designTokens.typography.fontWeight.bold).toBe(700);
    });
  });

  describe("shadows", () => {
    it("has shadow scale from none to elevated", () => {
      expect(designTokens.shadows.none).toBe("none");
      expect(designTokens.shadows.subtle).toContain("rgba");
      expect(designTokens.shadows.elevated).toContain("rgba");
    });
  });

  describe("borderRadius", () => {
    it("has radius scale", () => {
      expect(designTokens.borderRadius.none).toBe(0);
      expect(designTokens.borderRadius.full).toBe(9999);
    });
  });

  describe("transitions", () => {
    it("has duration values as numbers", () => {
      expect(designTokens.transitions.duration.standard).toBe(300);
      expect(typeof designTokens.transitions.duration.shortest).toBe("number");
    });

    it("has easing functions as strings", () => {
      expect(designTokens.transitions.easing.easeInOut).toContain(
        "cubic-bezier"
      );
    });
  });

  describe("breakpoints", () => {
    it("has ascending breakpoint values", () => {
      const { xs, sm, md, lg, xl } = designTokens.breakpoints.values;
      expect(xs).toBeLessThan(sm);
      expect(sm).toBeLessThan(md);
      expect(md).toBeLessThan(lg);
      expect(lg).toBeLessThan(xl);
    });
  });

  describe("zIndex", () => {
    it("has ascending z-index values", () => {
      expect(designTokens.zIndex.drawer).toBeGreaterThan(
        designTokens.zIndex.appBar
      );
      expect(designTokens.zIndex.modal).toBeGreaterThan(
        designTokens.zIndex.drawer
      );
      expect(designTokens.zIndex.tooltip).toBeGreaterThan(
        designTokens.zIndex.snackbar
      );
    });
  });
});

describe("spacing helper", () => {
  it("multiplies base spacing (md = 16) by factor", () => {
    expect(spacing(1)).toBe(16);
    expect(spacing(2)).toBe(32);
    expect(spacing(0.5)).toBe(8);
  });

  it("returns 0 for factor 0", () => {
    expect(spacing(0)).toBe(0);
  });
});

describe("responsive helper", () => {
  it("mobile uses max-width with sm breakpoint", () => {
    expect(responsive.mobile).toContain("max-width");
    expect(responsive.mobile).toContain(
      String(designTokens.breakpoints.values.sm)
    );
  });

  it("tablet uses min-width sm and max-width md", () => {
    expect(responsive.tablet).toContain("min-width");
    expect(responsive.tablet).toContain("max-width");
  });

  it("desktop uses min-width md", () => {
    expect(responsive.desktop).toContain("min-width");
    expect(responsive.desktop).toContain(
      String(designTokens.breakpoints.values.md)
    );
  });

  it("wide uses min-width lg", () => {
    expect(responsive.wide).toContain(
      String(designTokens.breakpoints.values.lg)
    );
  });
});
