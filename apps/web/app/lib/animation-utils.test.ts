import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/accessibility", () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

import {
  animationPresets,
  getAnimationProps,
  getStaggerConfig,
  hoverPresets,
  getHoverProps,
  springConfigs,
  willChangeClasses,
  measureAnimationPerformance,
} from "~/lib/animation-utils";
import { prefersReducedMotion } from "~/lib/accessibility";

const mockedPrefersReducedMotion = vi.mocked(prefersReducedMotion);

describe("animation-utils", () => {
  beforeEach(() => {
    mockedPrefersReducedMotion.mockReturnValue(false);
  });

  describe("animationPresets", () => {
    it("has all expected preset keys", () => {
      const keys = Object.keys(animationPresets);
      expect(keys).toHaveLength(11);
      expect(keys).toContain("fadeIn");
      expect(keys).toContain("scaleInBounce");
      expect(keys).toContain("slideInFromRight");
    });

    it("each preset has initial, animate, exit, transition", () => {
      for (const [, preset] of Object.entries(animationPresets)) {
        expect(preset).toHaveProperty("initial");
        expect(preset).toHaveProperty("animate");
        expect(preset).toHaveProperty("exit");
        expect(preset).toHaveProperty("transition");
      }
    });

    it("fadeIn uses opacity only", () => {
      expect(animationPresets.fadeIn.initial).toEqual({ opacity: 0 });
      expect(animationPresets.fadeIn.animate).toEqual({ opacity: 1 });
    });

    it("slideInFromBottom uses spring transition", () => {
      expect(animationPresets.slideInFromBottom.transition).toMatchObject({
        type: "spring",
      });
    });
  });

  describe("getAnimationProps", () => {
    it("returns preset props with no options", () => {
      const result = getAnimationProps("fadeIn");
      expect(result.initial).toEqual({ opacity: 0 });
      expect(result.animate).toEqual({ opacity: 1 });
      expect(result.transition).toMatchObject({ duration: 0.2 });
    });

    it("merges custom delay", () => {
      const result = getAnimationProps("fadeIn", { delay: 0.5 });
      expect((result.transition as Record<string, unknown>).delay).toBe(0.5);
    });

    it("merges custom duration", () => {
      const result = getAnimationProps("fadeInUp", { duration: 1 });
      expect(result.transition.duration).toBe(1);
    });

    it("returns empty props when reduced motion is preferred", () => {
      mockedPrefersReducedMotion.mockReturnValue(true);
      const result = getAnimationProps("fadeInUp");
      expect(result.initial).toEqual({});
      expect(result.animate).toEqual({});
      expect(result.exit).toEqual({});
      expect(result.transition).toEqual({ duration: 0 });
    });
  });

  describe("getStaggerConfig", () => {
    it("returns container and item with default stagger delay", () => {
      const config = getStaggerConfig();
      expect(config.container).toMatchObject({
        initial: "hidden",
        animate: "visible",
      });
      expect(config.container.variants!.visible.transition.staggerChildren).toBe(0.05);
    });

    it("uses custom stagger delay", () => {
      const config = getStaggerConfig(0.2);
      expect(config.container.variants!.visible.transition.staggerChildren).toBe(0.2);
    });

    it("returns empty config when reduced motion is preferred", () => {
      mockedPrefersReducedMotion.mockReturnValue(true);
      const config = getStaggerConfig();
      expect(config).toEqual({ container: {}, item: {} });
    });

    it("item has hidden/visible variants", () => {
      const config = getStaggerConfig();
      expect(config.item.variants!.hidden).toEqual({ opacity: 0, y: 20 });
      expect(config.item.variants!.visible).toEqual({ opacity: 1, y: 0 });
    });
  });

  describe("hoverPresets", () => {
    it("has 5 preset keys", () => {
      expect(Object.keys(hoverPresets)).toHaveLength(5);
    });

    it("lift moves up on hover", () => {
      expect(hoverPresets.lift.whileHover).toMatchObject({ y: -4 });
    });

    it("scale enlarges on hover", () => {
      expect(hoverPresets.scale.whileHover).toMatchObject({ scale: 1.02 });
    });

    it("glow adds box shadow", () => {
      expect(hoverPresets.glow.whileHover).toHaveProperty("boxShadow");
    });
  });

  describe("getHoverProps", () => {
    it("returns preset when motion is allowed", () => {
      const result = getHoverProps("lift");
      expect(result).toEqual(hoverPresets.lift);
    });

    it("returns empty object when reduced motion preferred", () => {
      mockedPrefersReducedMotion.mockReturnValue(true);
      const result = getHoverProps("scale");
      expect(result).toEqual({});
    });
  });

  describe("springConfigs", () => {
    it("has 5 configs", () => {
      expect(Object.keys(springConfigs)).toHaveLength(5);
    });

    it("all configs are spring type", () => {
      for (const config of Object.values(springConfigs)) {
        expect(config.type).toBe("spring");
      }
    });

    it("stiff has highest stiffness", () => {
      expect(springConfigs.stiff.stiffness).toBe(400);
      expect(springConfigs.molasses.stiffness).toBe(60);
    });
  });

  describe("willChangeClasses", () => {
    it("has transform, opacity, and transformAndOpacity", () => {
      expect(willChangeClasses.transform).toBe("will-change-transform");
      expect(willChangeClasses.opacity).toBe("will-change-[opacity]");
      expect(willChangeClasses.transformAndOpacity).toBe("will-change-[transform,opacity]");
    });
  });

  describe("measureAnimationPerformance", () => {
    it("returns start and end functions", () => {
      const perf = measureAnimationPerformance("test");
      expect(typeof perf.start).toBe("function");
      expect(typeof perf.end).toBe("function");
    });

    it("returns no-ops in non-development env", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const perf = measureAnimationPerformance("noop");
      perf.start();
      perf.end();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("warns when animation exceeds 16.67ms", () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      let callCount = 0;
      vi.spyOn(performance, "now").mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 20; // 20ms > 16.67ms threshold
      });

      const perf = measureAnimationPerformance("slow-anim");
      perf.start();
      perf.end();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("slow-anim")
      );

      warnSpy.mockRestore();
      vi.restoreAllMocks();
      process.env.NODE_ENV = origEnv;
    });

    it("does not warn when animation is fast enough", () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      let callCount = 0;
      vi.spyOn(performance, "now").mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 10; // 10ms < 16.67ms
      });

      const perf = measureAnimationPerformance("fast-anim");
      perf.start();
      perf.end();

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      vi.restoreAllMocks();
      process.env.NODE_ENV = origEnv;
    });
  });
});
