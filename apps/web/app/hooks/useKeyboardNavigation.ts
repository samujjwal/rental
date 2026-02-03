import { useEffect, useCallback, useRef, useState } from "react";
import { Keys, isKey } from "~/lib/accessibility";

export interface KeyboardNavigationOptions {
  onEnter?: () => void;
  onSpace?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onTab?: (shiftKey: boolean) => void;
  enabled?: boolean;
}

/**
 * Hook for keyboard navigation
 * Provides consistent keyboard interaction patterns
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    onEnter,
    onSpace,
    onEscape,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onHome,
    onEnd,
    onTab,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.key) {
        case Keys.ENTER:
          if (onEnter) {
            event.preventDefault();
            onEnter();
          }
          break;
        case Keys.SPACE:
          if (onSpace) {
            event.preventDefault();
            onSpace();
          }
          break;
        case Keys.ESCAPE:
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;
        case Keys.ARROW_UP:
          if (onArrowUp) {
            event.preventDefault();
            onArrowUp();
          }
          break;
        case Keys.ARROW_DOWN:
          if (onArrowDown) {
            event.preventDefault();
            onArrowDown();
          }
          break;
        case Keys.ARROW_LEFT:
          if (onArrowLeft) {
            event.preventDefault();
            onArrowLeft();
          }
          break;
        case Keys.ARROW_RIGHT:
          if (onArrowRight) {
            event.preventDefault();
            onArrowRight();
          }
          break;
        case Keys.HOME:
          if (onHome) {
            event.preventDefault();
            onHome();
          }
          break;
        case Keys.END:
          if (onEnd) {
            event.preventDefault();
            onEnd();
          }
          break;
        case Keys.TAB:
          if (onTab) {
            onTab(event.shiftKey);
          }
          break;
      }
    },
    [
      enabled,
      onEnter,
      onSpace,
      onEscape,
      onArrowUp,
      onArrowDown,
      onArrowLeft,
      onArrowRight,
      onHome,
      onEnd,
      onTab,
    ]
  );

  return { handleKeyDown };
}

/**
 * Hook for list keyboard navigation
 */
export function useListNavigation<T>(
  items: T[],
  onSelect: (item: T, index: number) => void,
  options: {
    orientation?: "vertical" | "horizontal";
    loop?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { orientation = "vertical", loop = true, enabled = true } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || items.length === 0) return;

      const isVertical = orientation === "vertical";
      const nextKey = isVertical ? Keys.ARROW_DOWN : Keys.ARROW_RIGHT;
      const prevKey = isVertical ? Keys.ARROW_UP : Keys.ARROW_LEFT;

      if (isKey(event, nextKey)) {
        event.preventDefault();
        setFocusedIndex((prev: number) => {
          const next = prev + 1;
          return next >= items.length ? (loop ? 0 : prev) : next;
        });
      } else if (isKey(event, prevKey)) {
        event.preventDefault();
        setFocusedIndex((prev: number) => {
          const next = prev - 1;
          return next < 0 ? (loop ? items.length - 1 : prev) : next;
        });
      } else if (isKey(event, Keys.HOME)) {
        event.preventDefault();
        setFocusedIndex(0);
      } else if (isKey(event, Keys.END)) {
        event.preventDefault();
        setFocusedIndex(items.length - 1);
      } else if (isKey(event, Keys.ENTER) || isKey(event, Keys.SPACE)) {
        event.preventDefault();
        onSelect(items[focusedIndex], focusedIndex);
      }
    },
    [enabled, items, orientation, loop, focusedIndex, onSelect]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
  };
}

/**
 * Hook for roving tabindex pattern
 */
export function useRovingTabIndex(
  itemCount: number,
  options: {
    orientation?: "vertical" | "horizontal";
    loop?: boolean;
  } = {}
) {
  const { orientation = "vertical", loop = true } = options;
  const [activeIndex, setActiveIndex] = useState(0);

  const getTabIndex = useCallback(
    (index: number) => {
      return index === activeIndex ? 0 : -1;
    },
    [activeIndex]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent, currentIndex: number) => {
      const isVertical = orientation === "vertical";
      const nextKey = isVertical ? Keys.ARROW_DOWN : Keys.ARROW_RIGHT;
      const prevKey = isVertical ? Keys.ARROW_UP : Keys.ARROW_LEFT;

      if (isKey(event, nextKey)) {
        event.preventDefault();
        const next = currentIndex + 1;
        setActiveIndex(next >= itemCount ? (loop ? 0 : currentIndex) : next);
      } else if (isKey(event, prevKey)) {
        event.preventDefault();
        const next = currentIndex - 1;
        setActiveIndex(next < 0 ? (loop ? itemCount - 1 : currentIndex) : next);
      } else if (isKey(event, Keys.HOME)) {
        event.preventDefault();
        setActiveIndex(0);
      } else if (isKey(event, Keys.END)) {
        event.preventDefault();
        setActiveIndex(itemCount - 1);
      }
    },
    [itemCount, orientation, loop]
  );

  return {
    activeIndex,
    setActiveIndex,
    getTabIndex,
    handleKeyDown,
  };
}
