import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock framer-motion
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockControls = { start: mockStart };

vi.mock("framer-motion", () => ({
  useAnimation: () => mockControls,
}));

// Mock accessibility
vi.mock("~/lib/accessibility", () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

import {
  useAnimation,
  useScrollAnimation,
  useHoverAnimation,
  useStaggerAnimation,
} from "./useAnimation";
import { prefersReducedMotion } from "~/lib/accessibility";

describe("useAnimation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prefersReducedMotion).mockReturnValue(false);
  });

  it("should return controls and animate function", () => {
    const { result } = renderHook(() => useAnimation());

    expect(result.current.controls).toBeDefined();
    expect(result.current.animate).toBeTypeOf("function");
    expect(result.current.shouldReduceMotion).toBe(false);
  });

  it("should call controls.start when animating", async () => {
    const { result } = renderHook(() => useAnimation());

    await act(async () => {
      await result.current.animate({ opacity: 1 });
    });

    expect(mockStart).toHaveBeenCalledWith({ opacity: 1 });
  });

  it("should skip animation when reduced motion is preferred", async () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);

    const { result } = renderHook(() => useAnimation());

    await act(async () => {
      await result.current.animate({ opacity: 1 });
    });

    expect(mockStart).not.toHaveBeenCalled();
    expect(result.current.shouldReduceMotion).toBe(true);
  });
});

describe("useScrollAnimation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prefersReducedMotion).mockReturnValue(false);
  });

  it("should initialize as not visible", () => {
    const { result } = renderHook(() => useScrollAnimation());

    expect(result.current.isVisible).toBe(false);
    expect(result.current.controls).toBeDefined();
  });

  it("should start animation when isVisible becomes true", () => {
    const { result } = renderHook(() => useScrollAnimation());

    act(() => {
      result.current.setIsVisible(true);
    });

    expect(mockStart).toHaveBeenCalledWith("visible");
  });

  it("should not start animation when reduced motion is preferred", () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);

    const { result } = renderHook(() => useScrollAnimation());

    act(() => {
      result.current.setIsVisible(true);
    });

    expect(mockStart).not.toHaveBeenCalledWith("visible");
  });
});

describe("useHoverAnimation", () => {
  beforeEach(() => {
    vi.mocked(prefersReducedMotion).mockReturnValue(false);
  });

  it("should initialize as not hovered", () => {
    const { result } = renderHook(() => useHoverAnimation());

    expect(result.current.isHovered).toBe(false);
    expect(result.current.shouldReduceMotion).toBe(false);
  });

  it("should set isHovered on mouse enter", () => {
    const { result } = renderHook(() => useHoverAnimation());

    act(() => {
      result.current.hoverProps.onMouseEnter();
    });

    expect(result.current.isHovered).toBe(true);
  });

  it("should clear isHovered on mouse leave", () => {
    const { result } = renderHook(() => useHoverAnimation());

    act(() => {
      result.current.hoverProps.onMouseEnter();
    });
    act(() => {
      result.current.hoverProps.onMouseLeave();
    });

    expect(result.current.isHovered).toBe(false);
  });
});

describe("useStaggerAnimation", () => {
  beforeEach(() => {
    vi.mocked(prefersReducedMotion).mockReturnValue(false);
  });

  it("should calculate stagger delays", () => {
    const { result } = renderHook(() => useStaggerAnimation(5, 0.1));

    expect(result.current.getStaggerDelay(0)).toBe(0);
    expect(result.current.getStaggerDelay(1)).toBeCloseTo(0.1);
    expect(result.current.getStaggerDelay(4)).toBeCloseTo(0.4);
  });

  it("should return 0 delay when reduced motion is preferred", () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);

    const { result } = renderHook(() => useStaggerAnimation(5, 0.1));

    expect(result.current.getStaggerDelay(0)).toBe(0);
    expect(result.current.getStaggerDelay(3)).toBe(0);
    expect(result.current.shouldReduceMotion).toBe(true);
  });
});
