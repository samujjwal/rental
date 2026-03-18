import { useState, useEffect, useCallback, RefObject } from 'react';

export type Position = 'top' | 'bottom' | 'left' | 'right' | 'auto';
export type Alignment = 'start' | 'center' | 'end';

export interface PositionConfig {
  position?: Position;
  alignment?: Alignment;
  offset?: number;
  boundary?: 'viewport' | 'scrollParent' | HTMLElement;
}

export interface CalculatedPosition {
  top: number;
  left: number;
  position: Exclude<Position, 'auto'>;
  alignment: Alignment;
  transform?: string;
}

/**
 * P2.1 FIX: Decoupled positioning logic for tooltips, popovers, and dropdowns
 * Automatically handles viewport boundaries and optimal positioning
 */
export function useElementPosition(
  triggerRef: RefObject<HTMLElement>,
  contentRef: RefObject<HTMLElement>,
  config: PositionConfig = {}
): CalculatedPosition | null {
  const {
    position = 'auto',
    alignment = 'center',
    offset = 8,
    boundary = 'viewport',
  } = config;

  const [calculatedPosition, setCalculatedPosition] = useState<CalculatedPosition | null>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !contentRef.current) {
      return null;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get boundary dimensions
    let boundaryRect: DOMRect;
    if (boundary === 'viewport') {
      boundaryRect = new DOMRect(0, 0, viewportWidth, viewportHeight);
    } else if (boundary === 'scrollParent') {
      const scrollParent = getScrollParent(triggerRef.current);
      boundaryRect = scrollParent.getBoundingClientRect();
    } else {
      boundaryRect = boundary.getBoundingClientRect();
    }

    // Calculate available space in each direction
    const spaceAbove = triggerRect.top - boundaryRect.top;
    const spaceBelow = boundaryRect.bottom - triggerRect.bottom;
    const spaceLeft = triggerRect.left - boundaryRect.left;
    const spaceRight = boundaryRect.right - triggerRect.right;

    // Determine optimal position
    let finalPosition: Exclude<Position, 'auto'>;
    if (position === 'auto') {
      // Choose position with most space
      const spaces = {
        top: spaceAbove,
        bottom: spaceBelow,
        left: spaceLeft,
        right: spaceRight,
      };
      finalPosition = Object.entries(spaces).reduce((a, b) =>
        spaces[a[0] as keyof typeof spaces] > spaces[b[0] as keyof typeof spaces] ? a : b
      )[0] as Exclude<Position, 'auto'>;
    } else {
      finalPosition = position;
    }

    // Check if chosen position has enough space, fallback if needed
    const requiredSpace = finalPosition === 'top' || finalPosition === 'bottom'
      ? contentRect.height + offset
      : contentRect.width + offset;

    const availableSpace = {
      top: spaceAbove,
      bottom: spaceBelow,
      left: spaceLeft,
      right: spaceRight,
    }[finalPosition];

    if (availableSpace < requiredSpace) {
      // Fallback to opposite position
      const opposites: Record<string, Exclude<Position, 'auto'>> = {
        top: 'bottom',
        bottom: 'top',
        left: 'right',
        right: 'left',
      };
      finalPosition = opposites[finalPosition];
    }

    // Calculate base position
    let top = 0;
    let left = 0;
    let transform = '';

    switch (finalPosition) {
      case 'top':
        top = triggerRect.top - contentRect.height - offset;
        left = calculateAlignedPosition(
          triggerRect.left,
          triggerRect.width,
          contentRect.width,
          alignment,
          boundaryRect.left,
          boundaryRect.right
        );
        break;

      case 'bottom':
        top = triggerRect.bottom + offset;
        left = calculateAlignedPosition(
          triggerRect.left,
          triggerRect.width,
          contentRect.width,
          alignment,
          boundaryRect.left,
          boundaryRect.right
        );
        break;

      case 'left':
        left = triggerRect.left - contentRect.width - offset;
        top = calculateAlignedPosition(
          triggerRect.top,
          triggerRect.height,
          contentRect.height,
          alignment,
          boundaryRect.top,
          boundaryRect.bottom
        );
        break;

      case 'right':
        left = triggerRect.right + offset;
        top = calculateAlignedPosition(
          triggerRect.top,
          triggerRect.height,
          contentRect.height,
          alignment,
          boundaryRect.top,
          boundaryRect.bottom
        );
        break;
    }

    // Ensure content stays within boundary
    const adjustedLeft = Math.max(
      boundaryRect.left,
      Math.min(left, boundaryRect.right - contentRect.width)
    );
    const adjustedTop = Math.max(
      boundaryRect.top,
      Math.min(top, boundaryRect.bottom - contentRect.height)
    );

    return {
      top: adjustedTop,
      left: adjustedLeft,
      position: finalPosition,
      alignment,
      transform,
    };
  }, [triggerRef, contentRef, position, alignment, offset, boundary]);

  useEffect(() => {
    const updatePosition = () => {
      const newPosition = calculatePosition();
      setCalculatedPosition(newPosition);
    };

    updatePosition();

    // Update on scroll and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [calculatePosition]);

  return calculatedPosition;
}

/**
 * Calculate aligned position along an axis
 */
function calculateAlignedPosition(
  triggerStart: number,
  triggerSize: number,
  contentSize: number,
  alignment: Alignment,
  boundaryStart: number,
  boundaryEnd: number
): number {
  let position: number;

  switch (alignment) {
    case 'start':
      position = triggerStart;
      break;
    case 'center':
      position = triggerStart + triggerSize / 2 - contentSize / 2;
      break;
    case 'end':
      position = triggerStart + triggerSize - contentSize;
      break;
  }

  // Ensure within boundary
  return Math.max(boundaryStart, Math.min(position, boundaryEnd - contentSize));
}

/**
 * Find the nearest scrollable parent
 */
function getScrollParent(element: HTMLElement): HTMLElement {
  let parent = element.parentElement;

  while (parent) {
    const { overflow, overflowY, overflowX } = window.getComputedStyle(parent);
    if (/(auto|scroll)/.test(overflow + overflowY + overflowX)) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return document.documentElement;
}

/**
 * Hook for simple tooltip positioning (common use case)
 */
export function useTooltipPosition(
  triggerRef: RefObject<HTMLElement>,
  contentRef: RefObject<HTMLElement>,
  preferredPosition: Position = 'top'
) {
  return useElementPosition(triggerRef, contentRef, {
    position: preferredPosition,
    alignment: 'center',
    offset: 8,
    boundary: 'viewport',
  });
}

/**
 * Hook for dropdown positioning (common use case)
 */
export function useDropdownPosition(
  triggerRef: RefObject<HTMLElement>,
  contentRef: RefObject<HTMLElement>
) {
  return useElementPosition(triggerRef, contentRef, {
    position: 'bottom',
    alignment: 'start',
    offset: 4,
    boundary: 'viewport',
  });
}
