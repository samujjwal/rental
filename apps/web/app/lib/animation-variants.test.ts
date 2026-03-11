import { describe, it, expect } from "vitest";
import {
  fadeInVariants,
  slideUpVariants,
  slideDownVariants,
  slideLeftVariants,
  slideRightVariants,
  scaleInVariants,
  scaleOutVariants,
  staggerContainerVariants,
  staggerItemVariants,
  modalVariants,
  backdropVariants,
  drawerVariants,
  accordionVariants,
  cardHoverVariants,
  buttonPressVariants,
  pulseVariants,
  shakeVariants,
  bounceVariants,
  rotateVariants,
  flipVariants,
  pageTransitionVariants,
  spinnerVariants,
  notificationVariants,
} from "~/lib/animation-variants";

describe("animation-variants", () => {
  describe("fadeInVariants", () => {
    it("hidden starts at opacity 0", () => {
      expect(fadeInVariants.hidden).toEqual({ opacity: 0 });
    });
    it("visible ends at opacity 1 with 0.5s ease", () => {
      expect(fadeInVariants.visible).toMatchObject({ opacity: 1 });
    });
  });

  describe("slide variants", () => {
    it("slideUp hidden has y:20", () => {
      expect(slideUpVariants.hidden).toEqual({ opacity: 0, y: 20 });
    });
    it("slideDown hidden has y:-20", () => {
      expect(slideDownVariants.hidden).toEqual({ opacity: 0, y: -20 });
    });
    it("slideLeft hidden has x:20", () => {
      expect(slideLeftVariants.hidden).toEqual({ opacity: 0, x: 20 });
    });
    it("slideRight hidden has x:-20", () => {
      expect(slideRightVariants.hidden).toEqual({ opacity: 0, x: -20 });
    });
    it("all slide visible states reset to 0", () => {
      expect(slideUpVariants.visible).toMatchObject({ opacity: 1, y: 0 });
      expect(slideDownVariants.visible).toMatchObject({ opacity: 1, y: 0 });
      expect(slideLeftVariants.visible).toMatchObject({ opacity: 1, x: 0 });
      expect(slideRightVariants.visible).toMatchObject({ opacity: 1, x: 0 });
    });
  });

  describe("scale variants", () => {
    it("scaleIn hidden is scaled down", () => {
      expect(scaleInVariants.hidden).toEqual({ opacity: 0, scale: 0.9 });
    });
    it("scaleOut visible fades and scales out", () => {
      expect(scaleOutVariants.visible).toMatchObject({ opacity: 0, scale: 0.9 });
    });
  });

  describe("stagger variants", () => {
    it("container uses staggerChildren", () => {
      const visible = staggerContainerVariants.visible as Record<string, unknown>;
      expect(visible).toMatchObject({
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 },
      });
    });
    it("stagger item uses slideUp pattern", () => {
      expect(staggerItemVariants.hidden).toEqual({ opacity: 0, y: 20 });
    });
  });

  describe("modal & backdrop variants", () => {
    it("modal has hidden/visible/exit states", () => {
      expect(modalVariants.hidden).toMatchObject({ opacity: 0, scale: 0.9 });
      expect(modalVariants.visible).toMatchObject({ opacity: 1, scale: 1, y: 0 });
      expect(modalVariants.exit).toMatchObject({ opacity: 0, scale: 0.9 });
    });
    it("backdrop has three states", () => {
      expect(backdropVariants.hidden).toEqual({ opacity: 0 });
      expect(backdropVariants.visible).toMatchObject({ opacity: 1 });
      expect(backdropVariants.exit).toMatchObject({ opacity: 0 });
    });
  });

  describe("drawerVariants", () => {
    it("hidden is off-screen right", () => {
      expect(drawerVariants.hidden).toEqual({ x: "100%" });
    });
    it("visible slides in with spring", () => {
      const visible = drawerVariants.visible as Record<string, unknown>;
      expect(visible).toMatchObject({
        x: 0,
        transition: { type: "spring", damping: 30, stiffness: 300 },
      });
    });
  });

  describe("accordionVariants", () => {
    it("collapsed has zero height and opacity", () => {
      expect(accordionVariants.collapsed).toEqual({ height: 0, opacity: 0 });
    });
    it("expanded is auto height with opacity 1", () => {
      expect(accordionVariants.expanded).toMatchObject({
        height: "auto",
        opacity: 1,
      });
    });
  });

  describe("interactive variants", () => {
    it("cardHover rest is scale 1", () => {
      expect(cardHoverVariants.rest).toMatchObject({ scale: 1 });
    });
    it("cardHover hover scales up slightly", () => {
      expect(cardHoverVariants.hover).toMatchObject({ scale: 1.02 });
    });
    it("buttonPress pressed scales down", () => {
      expect(buttonPressVariants.pressed).toMatchObject({ scale: 0.95 });
    });
  });

  describe("effect variants", () => {
    it("pulse uses infinite repeat", () => {
      const pulse = pulseVariants.pulse as Record<string, unknown>;
      expect(pulse).toMatchObject({
        scale: [1, 1.05, 1],
        transition: { repeat: Infinity },
      });
    });
    it("shake oscillates x", () => {
      const shake = shakeVariants.shake as Record<string, unknown>;
      expect(shake).toMatchObject({ x: [0, -10, 10, -10, 10, 0] });
    });
    it("bounce oscillates y", () => {
      const bounce = bounceVariants.bounce as Record<string, unknown>;
      expect(bounce).toMatchObject({ y: [0, -10, 0] });
    });
  });

  describe("rotateVariants", () => {
    it("rest is 0 degrees", () => {
      expect(rotateVariants.rest).toEqual({ rotate: 0 });
    });
    it("hover rotates 5 degrees", () => {
      expect(rotateVariants.hover).toMatchObject({ rotate: 5 });
    });
  });

  describe("flipVariants", () => {
    it("front is 0 Y rotation", () => {
      expect(flipVariants.front).toEqual({ rotateY: 0 });
    });
    it("back is 180 Y rotation", () => {
      expect(flipVariants.back).toMatchObject({ rotateY: 180 });
    });
  });

  describe("pageTransitionVariants", () => {
    it("initial slides from left", () => {
      expect(pageTransitionVariants.initial).toEqual({ opacity: 0, x: -20 });
    });
    it("animate resets position", () => {
      expect(pageTransitionVariants.animate).toMatchObject({ opacity: 1, x: 0 });
    });
    it("exit slides right", () => {
      expect(pageTransitionVariants.exit).toMatchObject({ opacity: 0, x: 20 });
    });
  });

  describe("spinnerVariants", () => {
    it("spins 360 degrees infinitely", () => {
      const spin = spinnerVariants.spin as Record<string, unknown>;
      expect(spin).toMatchObject({
        rotate: 360,
        transition: { repeat: Infinity, ease: "linear" },
      });
    });
  });

  describe("notificationVariants", () => {
    it("hidden drops from above", () => {
      expect(notificationVariants.hidden).toEqual({ opacity: 0, y: -50, scale: 0.9 });
    });
    it("visible settles with spring", () => {
      const visible = notificationVariants.visible as Record<string, unknown>;
      expect(visible).toMatchObject({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring" },
      });
    });
    it("exit returns upward", () => {
      expect(notificationVariants.exit).toMatchObject({ opacity: 0, y: -50 });
    });
  });
});
