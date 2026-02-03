import { motion, HTMLMotionProps } from 'framer-motion';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface SlideInProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
    children: React.ReactNode;
    direction?: 'up' | 'down' | 'left' | 'right';
    delay?: number;
    duration?: number;
    distance?: number;
    once?: boolean;
}

/**
 * SlideIn Animation Component
 * Slides in content from specified direction
 */
export function SlideIn({
    children,
    direction = 'up',
    delay = 0,
    duration = 0.5,
    distance = 50,
    once = true,
    ...props
}: SlideInProps) {
    const shouldReduceMotion = prefersReducedMotion();

    const getInitialPosition = () => {
        if (shouldReduceMotion) return { opacity: 1 };

        switch (direction) {
            case 'up':
                return { y: distance, opacity: 0 };
            case 'down':
                return { y: -distance, opacity: 0 };
            case 'left':
                return { x: distance, opacity: 0 };
            case 'right':
                return { x: -distance, opacity: 0 };
            default:
                return { opacity: 0 };
        }
    };

    return (
        <motion.div
            initial={getInitialPosition()}
            whileInView={{
                x: 0,
                y: 0,
                opacity: 1,
            }}
            viewport={{ once }}
            transition={{
                duration: shouldReduceMotion ? 0 : duration,
                delay: shouldReduceMotion ? 0 : delay,
                ease: [0.25, 0.1, 0.25, 1],
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}
