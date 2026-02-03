import { useEffect, useState } from "react";
import { useAnimation as useFramerAnimation } from "framer-motion";
import { prefersReducedMotion } from "~/lib/accessibility";

/**
 * Hook for controlling animations
 */
export function useAnimation() {
  const controls = useFramerAnimation();
  const shouldReduceMotion = prefersReducedMotion();

  const animate = async (animation: any) => {
    if (shouldReduceMotion) return;
    return controls.start(animation);
  };

  return { controls, animate, shouldReduceMotion };
}

/**
 * Hook for scroll-triggered animations
 */
export function useScrollAnimation(threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const controls = useFramerAnimation();
  const shouldReduceMotion = prefersReducedMotion();

  useEffect(() => {
    if (isVisible && !shouldReduceMotion) {
      controls.start("visible");
    }
  }, [isVisible, controls, shouldReduceMotion]);

  return { isVisible, setIsVisible, controls };
}

/**
 * Hook for hover animations
 */
export function useHoverAnimation() {
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = prefersReducedMotion();

  const hoverProps = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  };

  return { isHovered, hoverProps, shouldReduceMotion };
}

/**
 * Hook for sequential animations
 */
export function useSequentialAnimation(steps: any[], delay = 0.5) {
  const controls = useFramerAnimation();
  const shouldReduceMotion = prefersReducedMotion();

  const playSequence = async () => {
    if (shouldReduceMotion) return;

    for (const step of steps) {
      await controls.start(step);
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  };

  return { controls, playSequence };
}

/**
 * Hook for stagger animations
 */
export function useStaggerAnimation(itemCount: number, staggerDelay = 0.1) {
  const shouldReduceMotion = prefersReducedMotion();

  const getStaggerDelay = (index: number) => {
    return shouldReduceMotion ? 0 : index * staggerDelay;
  };

  return { getStaggerDelay, shouldReduceMotion };
}

/**
 * Hook for entrance animations
 */
export function useEntranceAnimation(delay = 0) {
  const controls = useFramerAnimation();
  const shouldReduceMotion = prefersReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      controls.start({ opacity: 1 });
    } else {
      const timer = setTimeout(() => {
        controls.start({
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: "easeOut" },
        });
      }, delay * 1000);

      return () => clearTimeout(timer);
    }
  }, [controls, delay, shouldReduceMotion]);

  return controls;
}
