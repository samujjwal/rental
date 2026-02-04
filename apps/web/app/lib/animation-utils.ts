/**
 * Animation Performance Utilities
 *
 * Best practices for 60fps animations:
 * - Use transform and opacity (GPU accelerated)
 * - Avoid animating layout properties (width, height, top, left)
 * - Use will-change sparingly
 * - Respect reduced motion preferences
 */

import { prefersReducedMotion } from "./accessibility";

/**
 * Animation presets optimized for performance
 * All use transform/opacity for GPU acceleration
 */
export const animationPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },

  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3, ease: "easeOut" },
  },

  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: "easeOut" },
  },

  fadeInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3, ease: "easeOut" },
  },

  fadeInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: "easeOut" },
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.2, ease: "easeOut" },
  },

  scaleInBounce: {
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },

  slideInFromBottom: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },

  slideInFromTop: {
    initial: { y: "-100%" },
    animate: { y: 0 },
    exit: { y: "-100%" },
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },

  slideInFromLeft: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },

  slideInFromRight: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
} as const;

/**
 * Get animation props with reduced motion support
 */
export function getAnimationProps<T extends keyof typeof animationPresets>(
  preset: T,
  options?: { delay?: number; duration?: number }
) {
  const shouldReduceMotion = prefersReducedMotion();
  const animation = animationPresets[preset];

  if (shouldReduceMotion) {
    return {
      initial: {},
      animate: {},
      exit: {},
      transition: { duration: 0 },
    };
  }

  return {
    ...animation,
    transition: {
      ...animation.transition,
      ...(options?.delay && { delay: options.delay }),
      ...(options?.duration && { duration: options.duration }),
    },
  };
}

/**
 * Stagger children animation configuration
 */
export function getStaggerConfig(staggerDelay = 0.05) {
  const shouldReduceMotion = prefersReducedMotion();

  if (shouldReduceMotion) {
    return {
      container: {},
      item: {},
    };
  }

  return {
    container: {
      initial: "hidden",
      animate: "visible",
      variants: {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      },
    },
    item: {
      variants: {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      },
    },
  };
}

/**
 * Hover animation presets (for interactive elements)
 */
export const hoverPresets = {
  lift: {
    whileHover: { y: -4, transition: { duration: 0.2 } },
    whileTap: { y: 0, transition: { duration: 0.1 } },
  },

  scale: {
    whileHover: { scale: 1.02, transition: { duration: 0.2 } },
    whileTap: { scale: 0.98, transition: { duration: 0.1 } },
  },

  glow: {
    whileHover: {
      boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)",
      transition: { duration: 0.3 },
    },
  },

  liftAndScale: {
    whileHover: { y: -4, scale: 1.02, transition: { duration: 0.2 } },
    whileTap: { y: 0, scale: 0.98, transition: { duration: 0.1 } },
  },

  button: {
    whileHover: { scale: 1.02, transition: { duration: 0.15 } },
    whileTap: { scale: 0.98, transition: { duration: 0.1 } },
  },
} as const;

/**
 * Get hover props with reduced motion support
 */
export function getHoverProps<T extends keyof typeof hoverPresets>(preset: T) {
  const shouldReduceMotion = prefersReducedMotion();

  if (shouldReduceMotion) {
    return {};
  }

  return hoverPresets[preset];
}

/**
 * Spring configurations for different use cases
 */
export const springConfigs = {
  gentle: { type: "spring", stiffness: 120, damping: 14 },
  wobbly: { type: "spring", stiffness: 180, damping: 12 },
  stiff: { type: "spring", stiffness: 400, damping: 30 },
  slow: { type: "spring", stiffness: 80, damping: 20 },
  molasses: { type: "spring", stiffness: 60, damping: 25 },
} as const;

/**
 * CSS classes for will-change optimization
 * Use sparingly - only on elements that will definitely animate
 */
export const willChangeClasses = {
  transform: "will-change-transform",
  opacity: "will-change-[opacity]",
  transformAndOpacity: "will-change-[transform,opacity]",
} as const;

/**
 * Performance monitoring for animations (dev only)
 */
export function measureAnimationPerformance(name: string) {
  if (process.env.NODE_ENV !== "development") {
    return { start: () => {}, end: () => {} };
  }

  let startTime: number;

  return {
    start: () => {
      startTime = performance.now();
    },
    end: () => {
      const duration = performance.now() - startTime;
      if (duration > 16.67) {
        console.warn(
          `Animation "${name}" took ${duration.toFixed(2)}ms (> 16.67ms for 60fps)`
        );
      }
    },
  };
}
