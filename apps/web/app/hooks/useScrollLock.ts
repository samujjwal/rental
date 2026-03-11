import { useEffect } from "react";

/**
 * Locks body scroll when `locked` is true.
 * Used by mobile drawer overlay to prevent background scrolling.
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [locked]);
}
