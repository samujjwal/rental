import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '~/lib/utils';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface SuccessCheckmarkProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    showRing?: boolean;
    delay?: number;
}

const sizeClasses = {
    sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
    md: { container: 'w-12 h-12', icon: 'w-6 h-6' },
    lg: { container: 'w-16 h-16', icon: 'w-8 h-8' },
    xl: { container: 'w-24 h-24', icon: 'w-12 h-12' },
};

/**
 * SuccessCheckmark - Animated success indicator
 * 
 * Features:
 * - Spring animation on mount
 * - Optional ring animation
 * - Multiple sizes
 * - Respects reduced motion preferences
 */
export function SuccessCheckmark({
    size = 'lg',
    className,
    showRing = true,
    delay = 0,
}: SuccessCheckmarkProps) {
    const shouldReduceMotion = prefersReducedMotion();
    const sizeStyle = sizeClasses[size];

    if (shouldReduceMotion) {
        return (
            <div
                className={cn(
                    'inline-flex items-center justify-center rounded-full bg-success',
                    sizeStyle.container,
                    className
                )}
                role="img"
                aria-label="Success"
            >
                <Check className={cn('text-white', sizeStyle.icon)} />
            </div>
        );
    }

    return (
        <div className={cn('relative inline-flex', className)} role="img" aria-label="Success">
            {showRing && (
                <motion.div
                    className={cn(
                        'absolute inset-0 rounded-full border-4 border-success',
                        sizeStyle.container
                    )}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{
                        delay: delay + 0.2,
                        duration: 0.6,
                        ease: 'easeOut',
                    }}
                />
            )}

            <motion.div
                className={cn(
                    'relative flex items-center justify-center rounded-full bg-success',
                    sizeStyle.container
                )}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                    delay,
                    type: 'spring',
                    stiffness: 260,
                    damping: 20,
                }}
            >
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        delay: delay + 0.15,
                        type: 'spring',
                        stiffness: 400,
                        damping: 15,
                    }}
                >
                    <Check className={cn('text-white', sizeStyle.icon)} strokeWidth={3} />
                </motion.div>
            </motion.div>
        </div>
    );
}

/**
 * SuccessMessage - Success checkmark with accompanying message
 */
export interface SuccessMessageProps extends SuccessCheckmarkProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function SuccessMessage({
    title,
    description,
    action,
    size = 'lg',
    ...checkmarkProps
}: SuccessMessageProps) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <div className="flex flex-col items-center text-center">
            <SuccessCheckmark size={size} {...checkmarkProps} />

            <motion.h2
                className="mt-4 text-xl font-semibold text-foreground"
                initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
            >
                {title}
            </motion.h2>

            {description && (
                <motion.p
                    className="mt-2 text-muted-foreground max-w-md"
                    initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                >
                    {description}
                </motion.p>
            )}

            {action && (
                <motion.div
                    className="mt-6"
                    initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                >
                    {action}
                </motion.div>
            )}
        </div>
    );
}

/**
 * ErrorIndicator - Animated error indicator (X mark)
 */
export interface ErrorIndicatorProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    showRing?: boolean;
    delay?: number;
}

export function ErrorIndicator({
    size = 'lg',
    className,
    showRing = true,
    delay = 0,
}: ErrorIndicatorProps) {
    const shouldReduceMotion = prefersReducedMotion();
    const sizeStyle = sizeClasses[size];

    if (shouldReduceMotion) {
        return (
            <div
                className={cn(
                    'inline-flex items-center justify-center rounded-full bg-destructive',
                    sizeStyle.container,
                    className
                )}
                role="img"
                aria-label="Error"
            >
                <span className={cn('text-white font-bold', size === 'sm' ? 'text-sm' : 'text-lg')}>
                    ✕
                </span>
            </div>
        );
    }

    return (
        <div className={cn('relative inline-flex', className)} role="img" aria-label="Error">
            {showRing && (
                <motion.div
                    className={cn(
                        'absolute inset-0 rounded-full border-4 border-destructive',
                        sizeStyle.container
                    )}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{
                        delay: delay + 0.2,
                        duration: 0.6,
                        ease: 'easeOut',
                    }}
                />
            )}

            <motion.div
                className={cn(
                    'relative flex items-center justify-center rounded-full bg-destructive',
                    sizeStyle.container
                )}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                    delay,
                    type: 'spring',
                    stiffness: 260,
                    damping: 20,
                }}
            >
                <motion.span
                    className={cn('text-white font-bold', size === 'sm' ? 'text-sm' : 'text-lg')}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        delay: delay + 0.15,
                        type: 'spring',
                        stiffness: 400,
                        damping: 15,
                    }}
                >
                    ✕
                </motion.span>
            </motion.div>
        </div>
    );
}

/**
 * WarningIndicator - Animated warning indicator (!)
 */
export interface WarningIndicatorProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    delay?: number;
}

export function WarningIndicator({
    size = 'lg',
    className,
    delay = 0,
}: WarningIndicatorProps) {
    const shouldReduceMotion = prefersReducedMotion();
    const sizeStyle = sizeClasses[size];

    if (shouldReduceMotion) {
        return (
            <div
                className={cn(
                    'inline-flex items-center justify-center rounded-full bg-warning',
                    sizeStyle.container,
                    className
                )}
                role="img"
                aria-label="Warning"
            >
                <span className={cn('text-white font-bold', size === 'sm' ? 'text-sm' : 'text-lg')}>
                    !
                </span>
            </div>
        );
    }

    return (
        <motion.div
            className={cn(
                'inline-flex items-center justify-center rounded-full bg-warning',
                sizeStyle.container,
                className
            )}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
                delay,
                type: 'spring',
                stiffness: 260,
                damping: 20,
            }}
            role="img"
            aria-label="Warning"
        >
            <motion.span
                className={cn('text-white font-bold', size === 'sm' ? 'text-sm' : 'text-lg')}
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{
                    delay: delay + 0.3,
                    duration: 0.4,
                }}
            >
                !
            </motion.span>
        </motion.div>
    );
}

export default SuccessCheckmark;
