import { useEffect, useRef, useState } from "react";

export interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

/**
 * Hook for Intersection Observer
 * Useful for lazy loading, infinite scroll, and visibility tracking
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLElement>, boolean] {
  const {
    threshold = 0,
    root = null,
    rootMargin = "0px",
    freezeOnceVisible = false,
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // If already visible and frozen, don't observe
    if (freezeOnceVisible && isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting;
        setIsVisible(isIntersecting);

        if (freezeOnceVisible && isIntersecting) {
          observer.disconnect();
        }
      },
      {
        threshold,
        root,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, freezeOnceVisible, isVisible]);

  return [elementRef, isVisible];
}

/**
 * Hook for infinite scroll
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options: {
    threshold?: number;
    rootMargin?: string;
    hasMore?: boolean;
    isLoading?: boolean;
  } = {}
) {
  const {
    threshold = 0.8,
    rootMargin = "100px",
    hasMore = true,
    isLoading = false,
  } = options;

  const [sentinelRef, isVisible] = useIntersectionObserver({
    threshold,
    rootMargin,
  });

  useEffect(() => {
    if (isVisible && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [isVisible, hasMore, isLoading, onLoadMore]);

  return sentinelRef;
}
