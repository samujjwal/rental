import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useMapSync } from "./useMapSync";

describe("useMapSync", () => {
  it("should initialize with undefined state", () => {
    const { result } = renderHook(() => useMapSync());

    expect(result.current.highlightedListingId).toBeUndefined();
    expect(result.current.mapBounds).toBeUndefined();
  });

  describe("handleListingHover", () => {
    it("should set highlighted listing id", () => {
      const { result } = renderHook(() => useMapSync());

      act(() => {
        result.current.handleListingHover("listing-1");
      });

      expect(result.current.highlightedListingId).toBe("listing-1");
    });

    it("should clear highlighted listing id", () => {
      const { result } = renderHook(() => useMapSync());

      act(() => {
        result.current.handleListingHover("listing-1");
      });
      act(() => {
        result.current.handleListingHover(undefined);
      });

      expect(result.current.highlightedListingId).toBeUndefined();
    });
  });

  describe("handleBoundsChange", () => {
    it("should set map bounds", () => {
      const { result } = renderHook(() => useMapSync());

      const bounds: [[number, number], [number, number]] = [
        [27.6, 85.2],
        [27.8, 85.4],
      ];

      act(() => {
        result.current.handleBoundsChange(bounds);
      });

      expect(result.current.mapBounds).toEqual(bounds);
    });

    it("should call onBoundsChange callback", () => {
      const onBoundsChange = vi.fn();
      const { result } = renderHook(() => useMapSync({ onBoundsChange }));

      const bounds: [[number, number], [number, number]] = [
        [27.6, 85.2],
        [27.8, 85.4],
      ];

      act(() => {
        result.current.handleBoundsChange(bounds);
      });

      expect(onBoundsChange).toHaveBeenCalledWith(bounds);
    });
  });

  describe("isListingInBounds", () => {
    it("should return true when no bounds are set", () => {
      const { result } = renderHook(() => useMapSync());

      expect(result.current.isListingInBounds(27.7, 85.3)).toBe(true);
    });

    it("should return true when listing is within bounds", () => {
      const { result } = renderHook(() => useMapSync());

      const bounds: [[number, number], [number, number]] = [
        [27.6, 85.2],
        [27.8, 85.4],
      ];

      act(() => {
        result.current.handleBoundsChange(bounds);
      });

      expect(result.current.isListingInBounds(27.7, 85.3)).toBe(true);
    });

    it("should return false when listing is outside bounds", () => {
      const { result } = renderHook(() => useMapSync());

      const bounds: [[number, number], [number, number]] = [
        [27.6, 85.2],
        [27.8, 85.4],
      ];

      act(() => {
        result.current.handleBoundsChange(bounds);
      });

      expect(result.current.isListingInBounds(28.0, 85.3)).toBe(false);
      expect(result.current.isListingInBounds(27.7, 86.0)).toBe(false);
    });

    it("should return true for listings exactly on boundary", () => {
      const { result } = renderHook(() => useMapSync());

      const bounds: [[number, number], [number, number]] = [
        [27.6, 85.2],
        [27.8, 85.4],
      ];

      act(() => {
        result.current.handleBoundsChange(bounds);
      });

      expect(result.current.isListingInBounds(27.6, 85.2)).toBe(true);
      expect(result.current.isListingInBounds(27.8, 85.4)).toBe(true);
    });
  });
});
