import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useElementPosition, useTooltipPosition, useDropdownPosition } from './useElementPosition';
import { RefObject } from 'react';

describe('useElementPosition - P2.1 Positioning Utility', () => {
  let triggerElement: HTMLDivElement;
  let contentElement: HTMLDivElement;
  let triggerRef: RefObject<HTMLDivElement>;
  let contentRef: RefObject<HTMLDivElement>;

  beforeEach(() => {
    // Create mock elements
    triggerElement = document.createElement('div');
    contentElement = document.createElement('div');
    
    // Mock getBoundingClientRect
    vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 100,
      bottom: 150,
      right: 200,
      width: 100,
      height: 50,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    vi.spyOn(contentElement, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      bottom: 80,
      right: 120,
      width: 120,
      height: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Create refs
    triggerRef = { current: triggerElement };
    contentRef = { current: contentElement };

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Positioning', () => {
    it('should calculate top position correctly', () => {
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'top' })
      );

      expect(result.current).toBeTruthy();
      expect(result.current?.position).toBe('top');
      expect(result.current?.top).toBe(100 - 80 - 8); // trigger.top - content.height - offset
    });

    it('should calculate bottom position correctly', () => {
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'bottom' })
      );

      expect(result.current).toBeTruthy();
      expect(result.current?.position).toBe('bottom');
      expect(result.current?.top).toBe(150 + 8); // trigger.bottom + offset
    });

    it('should calculate left position correctly', () => {
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'left' })
      );

      expect(result.current).toBeTruthy();
      expect(result.current?.position).toBe('right'); // Falls back to right due to insufficient space
      expect(result.current?.left).toBe(200 + 8); // trigger.right + offset
    });

    it('should calculate right position correctly', () => {
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'right' })
      );

      expect(result.current).toBeTruthy();
      expect(result.current?.position).toBe('right');
      expect(result.current?.left).toBe(200 + 8); // trigger.right + offset
    });
  });

  describe('Auto Positioning', () => {
    it('should choose position with most space when auto', () => {
      // Position trigger near top of viewport
      vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
        top: 50,
        left: 100,
        bottom: 100,
        right: 200,
        width: 100,
        height: 50,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'auto' })
      );

      // Should choose right since there's more space on the right
      expect(result.current?.position).toBe('right');
    });

    it('should fallback when insufficient space', () => {
      // Position trigger at bottom of viewport
      vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
        top: 700,
        left: 100,
        bottom: 750,
        right: 200,
        width: 100,
        height: 50,
        x: 100,
        y: 700,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'bottom' })
      );

      // Should fallback to top since not enough space below
      expect(result.current?.position).toBe('top');
    });
  });

  describe('Alignment', () => {
    it('should align to start', () => {
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, {
          position: 'bottom',
          alignment: 'start',
        })
      );

      expect(result.current?.alignment).toBe('start');
      expect(result.current?.left).toBe(100); // Same as trigger.left
    });

    it('should align to center', () => {
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, {
          position: 'bottom',
          alignment: 'center',
        })
      );

      expect(result.current?.alignment).toBe('center');
      // Should center content relative to trigger
      const expectedLeft = 100 + 100 / 2 - 120 / 2; // trigger.left + trigger.width/2 - content.width/2
      expect(result.current?.left).toBe(expectedLeft);
    });

    it('should align to end', () => {
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, {
          position: 'bottom',
          alignment: 'end',
        })
      );

      expect(result.current?.alignment).toBe('end');
      const expectedLeft = 100 + 100 - 120; // trigger.left + trigger.width - content.width
      expect(result.current?.left).toBe(expectedLeft);
    });
  });

  describe('Boundary Constraints', () => {
    it('should keep content within viewport', () => {
      // Position trigger near right edge
      vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 950,
        bottom: 150,
        right: 1000,
        width: 50,
        height: 50,
        x: 950,
        y: 100,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'bottom' })
      );

      // Content should be adjusted to stay within viewport
      expect(result.current?.left).toBeLessThanOrEqual(1024 - 120); // viewport.width - content.width
    });

    it('should respect custom offset', () => {
      const customOffset = 16;
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, {
          position: 'bottom',
          offset: customOffset,
        })
      );

      expect(result.current?.top).toBe(150 + customOffset);
    });
  });

  describe('Null Refs', () => {
    it('should return null when trigger ref is null', () => {
      const nullTriggerRef = { current: null } as unknown as RefObject<HTMLDivElement>;
      const { result } = renderHook(() =>
        useElementPosition(nullTriggerRef, contentRef, { position: 'top' })
      );

      expect(result.current).toBeNull();
    });

    it('should return null when content ref is null', () => {
      const nullContentRef = { current: null } as unknown as RefObject<HTMLDivElement>;
      const { result } = renderHook(() =>
        useElementPosition(triggerRef, nullContentRef, { position: 'top' })
      );

      expect(result.current).toBeNull();
    });

    it('should return null when both refs are null', () => {
      const nullTriggerRef = { current: null } as unknown as RefObject<HTMLDivElement>;
      const nullContentRef = { current: null } as unknown as RefObject<HTMLDivElement>;
      const { result } = renderHook(() =>
        useElementPosition(nullTriggerRef, nullContentRef, { position: 'top' })
      );

      expect(result.current).toBeNull();
    });
  });

  describe('Event Listeners', () => {
    it('should update position on window resize', () => {
      const { result, rerender } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'bottom' })
      );

      const initialPosition = result.current;

      // Change trigger position
      vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
        top: 200,
        left: 200,
        bottom: 250,
        right: 300,
        width: 100,
        height: 50,
        x: 200,
        y: 200,
        toJSON: () => ({}),
      });

      // Trigger resize event
      window.dispatchEvent(new Event('resize'));
      rerender();

      // Position should update
      expect(result.current?.top).not.toBe(initialPosition?.top);
    });

    it('should update position on scroll', () => {
      const { result, rerender } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'bottom' })
      );

      const initialPosition = result.current;

      // Change trigger position (simulating scroll)
      vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
        top: 150,
        left: 100,
        bottom: 200,
        right: 200,
        width: 100,
        height: 50,
        x: 100,
        y: 150,
        toJSON: () => ({}),
      });

      // Trigger scroll event
      window.dispatchEvent(new Event('scroll'));
      rerender();

      // Position should update
      expect(result.current?.top).not.toBe(initialPosition?.top);
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'bottom' })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('Helper Hooks', () => {
    it('useTooltipPosition should use correct defaults', () => {
      const { result } = renderHook(() =>
        useTooltipPosition(triggerRef, contentRef, 'top')
      );

      expect(result.current?.position).toBe('top');
      expect(result.current?.alignment).toBe('center');
    });

    it('useDropdownPosition should use correct defaults', () => {
      const { result } = renderHook(() =>
        useDropdownPosition(triggerRef, contentRef)
      );

      expect(result.current?.position).toBe('bottom');
      expect(result.current?.alignment).toBe('start');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small trigger elements', () => {
      vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 100,
        bottom: 105,
        right: 105,
        width: 5,
        height: 5,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'bottom' })
      );

      expect(result.current).toBeTruthy();
      expect(result.current?.position).toBe('bottom');
    });

    it('should handle very large content elements', () => {
      vi.spyOn(contentElement, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        left: 0,
        bottom: 500,
        right: 500,
        width: 500,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'auto' })
      );

      expect(result.current).toBeTruthy();
      // Should still calculate a position
    });

    it('should handle trigger at viewport edge', () => {
      vi.spyOn(triggerElement, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        left: 0,
        bottom: 50,
        right: 50,
        width: 50,
        height: 50,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() =>
        useElementPosition(triggerRef, contentRef, { position: 'auto' })
      );

      expect(result.current).toBeTruthy();
      // Should choose position with space available
    });
  });
});
