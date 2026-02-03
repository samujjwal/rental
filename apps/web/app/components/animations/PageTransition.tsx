import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface PageTransitionProps {
    children: React.ReactNode;
    mode?: 'fade' | 'slide' | 'scale' | 'none';
    duration?: number;
}

/**
 * PageTransition Component
 * Animates page transitions in Remix/React Router
 */
export function PageTransition({
    children,
    mode = 'fade',
    duration = 0.3,
}: PageTransitionProps) {
    const location = useLocation();
    const shouldReduceMotion = prefersReducedMotion();

    const getVariants = () => {
        if (shouldReduceMotion || mode === 'none') {
            return {
                initial: { opacity: 1 },
                animate: { opacity: 1 },
                exit: { opacity: 1 },
            };
        }

        switch (mode) {
            case 'fade':
                return {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                };
            case 'slide':
                return {
                    initial: { opacity: 0, x: -20 },
                    animate: { opacity: 1, x: 0 },
                    exit: { opacity: 0, x: 20 },
                };
            case 'scale':
                return {
                    initial: { opacity: 0, scale: 0.95 },
                    animate: { opacity: 1, scale: 1 },
                    exit: { opacity: 0, scale: 1.05 },
                };
            default:
                return {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                };
        }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                variants={getVariants()}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{
                    duration: shouldReduceMotion ? 0 : duration,
                    ease: 'easeInOut',
                }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}

/**
 * FadeTransition - Simple fade transition
 */
export function FadeTransition({ children }: { children: React.ReactNode }) {
    return <PageTransition mode="fade">{children}</PageTransition>;
}

/**
 * SlideTransition - Slide transition
 */
export function SlideTransition({ children }: { children: React.ReactNode }) {
    return <PageTransition mode="slide">{children}</PageTransition>;
}
