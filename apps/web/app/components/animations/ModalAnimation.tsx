import { motion, AnimatePresence } from 'framer-motion';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface ModalAnimationProps {
    children: React.ReactNode;
    isOpen: boolean;
    variant?: 'fade' | 'scale' | 'slideUp' | 'slideDown';
    duration?: number;
}

/**
 * ModalAnimation Component
 * Animates modal/dialog entrance and exit
 */
export function ModalAnimation({
    children,
    isOpen,
    variant = 'scale',
    duration = 0.3,
}: ModalAnimationProps) {
    const shouldReduceMotion = prefersReducedMotion();

    const getVariants = () => {
        if (shouldReduceMotion) {
            return {
                initial: { opacity: 1 },
                animate: { opacity: 1 },
                exit: { opacity: 1 },
            };
        }

        switch (variant) {
            case 'fade':
                return {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                };
            case 'scale':
                return {
                    initial: { opacity: 0, scale: 0.9 },
                    animate: { opacity: 1, scale: 1 },
                    exit: { opacity: 0, scale: 0.9 },
                };
            case 'slideUp':
                return {
                    initial: { opacity: 0, y: 50 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, y: 50 },
                };
            case 'slideDown':
                return {
                    initial: { opacity: 0, y: -50 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, y: -50 },
                };
            default:
                return {
                    initial: { opacity: 0, scale: 0.9 },
                    animate: { opacity: 1, scale: 1 },
                    exit: { opacity: 0, scale: 0.9 },
                };
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={getVariants()}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{
                        duration: shouldReduceMotion ? 0 : duration,
                        ease: [0.4, 0, 0.2, 1],
                    }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * BackdropAnimation - Animated backdrop for modals
 */
export interface BackdropAnimationProps {
    isOpen: boolean;
    onClick?: () => void;
    duration?: number;
}

export function BackdropAnimation({
    isOpen,
    onClick,
    duration = 0.2,
}: BackdropAnimationProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        duration: shouldReduceMotion ? 0 : duration,
                    }}
                    onClick={onClick}
                    className="fixed inset-0 bg-black/50 z-40"
                    aria-hidden="true"
                />
            )}
        </AnimatePresence>
    );
}
