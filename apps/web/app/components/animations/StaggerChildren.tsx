import { motion, Variants } from 'framer-motion';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface StaggerChildrenProps {
    children: React.ReactNode;
    staggerDelay?: number;
    initialDelay?: number;
    className?: string;
}

/**
 * StaggerChildren Animation Component
 * Animates children with staggered delays
 */
export function StaggerChildren({
    children,
    staggerDelay = 0.1,
    initialDelay = 0,
    className = '',
}: StaggerChildrenProps) {
    const shouldReduceMotion = prefersReducedMotion();

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                delayChildren: shouldReduceMotion ? 0 : initialDelay,
                staggerChildren: shouldReduceMotion ? 0 : staggerDelay,
            },
        },
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * StaggerItem - Individual item in stagger animation
 */
export interface StaggerItemProps {
    children: React.ReactNode;
    className?: string;
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
    const shouldReduceMotion = prefersReducedMotion();

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: shouldReduceMotion ? 0 : 0.5,
                ease: 'easeOut',
            },
        },
    };

    return (
        <motion.div variants={itemVariants} className={className}>
            {children}
        </motion.div>
    );
}

/**
 * StaggerList - Stagger animation for lists
 */
export interface StaggerListProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    staggerDelay?: number;
    className?: string;
    itemClassName?: string;
}

export function StaggerList<T>({
    items,
    renderItem,
    staggerDelay = 0.1,
    className = '',
    itemClassName = '',
}: StaggerListProps<T>) {
    return (
        <StaggerChildren staggerDelay={staggerDelay} className={className}>
            {items.map((item, index) => (
                <StaggerItem key={index} className={itemClassName}>
                    {renderItem(item, index)}
                </StaggerItem>
            ))}
        </StaggerChildren>
    );
}
