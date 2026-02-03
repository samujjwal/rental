import { motion, HTMLMotionProps } from 'framer-motion';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface ScaleOnHoverProps extends Omit<HTMLMotionProps<'div'>, 'whileHover' | 'whileTap'> {
    children: React.ReactNode;
    scale?: number;
    tapScale?: number;
    duration?: number;
}

/**
 * ScaleOnHover Animation Component
 * Scales element on hover and tap
 */
export function ScaleOnHover({
    children,
    scale = 1.05,
    tapScale = 0.95,
    duration = 0.2,
    ...props
}: ScaleOnHoverProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileHover={shouldReduceMotion ? {} : { scale }}
            whileTap={shouldReduceMotion ? {} : { scale: tapScale }}
            transition={{
                duration: shouldReduceMotion ? 0 : duration,
                ease: 'easeInOut',
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * PressableScale - Scale down on press (for buttons)
 */
export function PressableScale({
    children,
    scale = 0.95,
    duration = 0.1,
    ...props
}: Omit<ScaleOnHoverProps, 'tapScale'>) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileTap={shouldReduceMotion ? {} : { scale }}
            transition={{
                duration: shouldReduceMotion ? 0 : duration,
                ease: 'easeInOut',
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * FloatOnHover - Subtle float effect on hover
 */
export function FloatOnHover({
    children,
    distance = -5,
    duration = 0.3,
    ...props
}: Omit<ScaleOnHoverProps, 'scale' | 'tapScale'> & { distance?: number }) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileHover={shouldReduceMotion ? {} : { y: distance }}
            transition={{
                duration: shouldReduceMotion ? 0 : duration,
                ease: 'easeOut',
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}
