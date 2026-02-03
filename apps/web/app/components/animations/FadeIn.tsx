import { motion, HTMLMotionProps } from 'framer-motion';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    direction?: 'up' | 'down' | 'left' | 'right' | 'none';
    distance?: number;
    once?: boolean;
}

/**
 * FadeIn Animation Component
 * Fades in content with optional directional slide
 */
export function FadeIn({
    children,
    delay = 0,
    duration = 0.5,
    direction = 'none',
    distance = 20,
    once = true,
    ...props
}: FadeInProps) {
    const shouldReduceMotion = prefersReducedMotion();

    const getDirectionOffset = () => {
        if (shouldReduceMotion || direction === 'none') return {};

        switch (direction) {
            case 'up':
                return { y: distance };
            case 'down':
                return { y: -distance };
            case 'left':
                return { x: distance };
            case 'right':
                return { x: -distance };
            default:
                return {};
        }
    };

    return (
        <motion.div
            initial={{
                opacity: 0,
                ...getDirectionOffset(),
            }}
            whileInView={{
                opacity: 1,
                x: 0,
                y: 0,
            }}
            viewport={{ once }}
            transition={{
                duration: shouldReduceMotion ? 0 : duration,
                delay: shouldReduceMotion ? 0 : delay,
                ease: 'easeOut',
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * FadeInWhenVisible - Fades in when element enters viewport
 */
export function FadeInWhenVisible({
    children,
    delay = 0,
    duration = 0.5,
    ...props
}: Omit<FadeInProps, 'direction' | 'distance'>) {
    return (
        <FadeIn delay={delay} duration={duration} direction="none" {...props}>
            {children}
        </FadeIn>
    );
}
