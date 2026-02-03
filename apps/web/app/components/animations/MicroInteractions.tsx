import { motion, HTMLMotionProps } from 'framer-motion';
import { prefersReducedMotion } from '~/lib/accessibility';

/**
 * Bounce - Bounces element on mount
 */
export interface BounceProps extends Omit<HTMLMotionProps<'div'>, 'animate'> {
    children: React.ReactNode;
    delay?: number;
}

export function Bounce({ children, delay = 0, ...props }: BounceProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            animate={
                shouldReduceMotion
                    ? {}
                    : {
                        scale: [1, 1.1, 1],
                        transition: {
                            delay,
                            duration: 0.5,
                            ease: 'easeInOut',
                        },
                    }
            }
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * Shake - Shakes element (for errors)
 */
export interface ShakeProps extends Omit<HTMLMotionProps<'div'>, 'animate'> {
    children: React.ReactNode;
    trigger?: boolean;
}

export function Shake({ children, trigger = false, ...props }: ShakeProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            animate={
                shouldReduceMotion || !trigger
                    ? {}
                    : {
                        x: [0, -10, 10, -10, 10, 0],
                        transition: {
                            duration: 0.5,
                            ease: 'easeInOut',
                        },
                    }
            }
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * Pulse - Pulses element (for notifications)
 */
export interface PulseProps extends Omit<HTMLMotionProps<'div'>, 'animate'> {
    children: React.ReactNode;
    repeat?: boolean;
}

export function Pulse({ children, repeat = false, ...props }: PulseProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            animate={
                shouldReduceMotion
                    ? {}
                    : {
                        scale: [1, 1.05, 1],
                        opacity: [1, 0.8, 1],
                    }
            }
            transition={{
                duration: 1.5,
                repeat: repeat ? Infinity : 0,
                ease: 'easeInOut',
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * Wiggle - Wiggles element (for attention)
 */
export interface WiggleProps extends Omit<HTMLMotionProps<'div'>, 'animate'> {
    children: React.ReactNode;
    trigger?: boolean;
}

export function Wiggle({ children, trigger = false, ...props }: WiggleProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            animate={
                shouldReduceMotion || !trigger
                    ? {}
                    : {
                        rotate: [0, -5, 5, -5, 5, 0],
                        transition: {
                            duration: 0.5,
                            ease: 'easeInOut',
                        },
                    }
            }
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * ExpandOnHover - Expands element on hover
 */
export interface ExpandOnHoverProps extends Omit<HTMLMotionProps<'div'>, 'whileHover'> {
    children: React.ReactNode;
    expandBy?: number;
}

export function ExpandOnHover({
    children,
    expandBy = 1.02,
    ...props
}: ExpandOnHoverProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileHover={shouldReduceMotion ? {} : { scale: expandBy }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * RotateOnHover - Rotates element on hover
 */
export interface RotateOnHoverProps extends Omit<HTMLMotionProps<'div'>, 'whileHover'> {
    children: React.ReactNode;
    degrees?: number;
}

export function RotateOnHover({
    children,
    degrees = 5,
    ...props
}: RotateOnHoverProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileHover={shouldReduceMotion ? {} : { rotate: degrees }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * GlowOnHover - Adds glow effect on hover
 */
export interface GlowOnHoverProps extends Omit<HTMLMotionProps<'div'>, 'whileHover'> {
    children: React.ReactNode;
    color?: string;
}

export function GlowOnHover({
    children,
    color = 'rgba(59, 130, 246, 0.5)',
    ...props
}: GlowOnHoverProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileHover={
                shouldReduceMotion
                    ? {}
                    : {
                        boxShadow: `0 0 20px ${color}`,
                    }
            }
            transition={{ duration: 0.3, ease: 'easeOut' }}
            {...props}
        >
            {children}
        </motion.div>
    );
}
