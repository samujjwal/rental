import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '~/lib/utils';
import { prefersReducedMotion } from '~/lib/accessibility';
import {
    buttonVariants,
    buttonSizes,
    buttonBase,
    type ButtonVariant,
    type ButtonSize,
} from './button-variants';

export interface UnifiedButtonProps
    extends Omit<HTMLMotionProps<'button'>, 'children'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    children: React.ReactNode;
    asChild?: boolean;
}

/**
 * UnifiedButton - A comprehensive button component with all states
 * 
 * Features:
 * - Multiple variants (primary, secondary, outline, ghost, destructive, success, link)
 * - Multiple sizes (xs, sm, md, lg, xl, icon variants)
 * - Loading state with spinner
 * - Disabled state with visual feedback
 * - Hover lift and shadow effects
 * - Press animation (scale down)
 * - Focus ring for accessibility
 * - Respects reduced motion preferences
 */
export const UnifiedButton = forwardRef<HTMLButtonElement, UnifiedButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            loading = false,
            disabled = false,
            fullWidth = false,
            leftIcon,
            rightIcon,
            children,
            className,
            ...props
        },
        ref
    ) => {
        const shouldReduceMotion = prefersReducedMotion();
        const isDisabled = disabled || loading;

        return (
            <motion.button
                ref={ref}
                className={cn(
                    buttonBase,
                    buttonVariants[variant],
                    buttonSizes[size],
                    fullWidth && 'w-full',
                    className
                )}
                disabled={isDisabled}
                whileTap={shouldReduceMotion || isDisabled ? {} : { scale: 0.98 }}
                transition={{ duration: 0.1 }}
                {...props}
            >
                {loading && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {!loading && leftIcon && (
                    <span className="shrink-0" aria-hidden="true">
                        {leftIcon}
                    </span>
                )}
                <span className={cn(loading && 'opacity-70')}>{children}</span>
                {!loading && rightIcon && (
                    <span className="shrink-0" aria-hidden="true">
                        {rightIcon}
                    </span>
                )}
            </motion.button>
        );
    }
);

UnifiedButton.displayName = 'UnifiedButton';

/**
 * IconButton - A button optimized for icon-only content
 */
export interface IconButtonProps
    extends Omit<UnifiedButtonProps, 'leftIcon' | 'rightIcon' | 'children'> {
    icon: React.ReactNode;
    'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ icon, size = 'icon', variant = 'ghost', ...props }, ref) => {
        return (
            <UnifiedButton ref={ref} variant={variant} size={size} {...props}>
                {icon}
            </UnifiedButton>
        );
    }
);

IconButton.displayName = 'IconButton';

/**
 * ButtonGroup - Group multiple buttons together
 */
export interface ButtonGroupProps {
    children: React.ReactNode;
    orientation?: 'horizontal' | 'vertical';
    className?: string;
}

export function ButtonGroup({
    children,
    orientation = 'horizontal',
    className,
}: ButtonGroupProps) {
    return (
        <div
            className={cn(
                'inline-flex',
                orientation === 'horizontal'
                    ? 'flex-row [&>*:not(:first-child)]:-ml-px [&>*:first-child]:rounded-r-none [&>*:last-child]:rounded-l-none [&>*:not(:first-child):not(:last-child)]:rounded-none'
                    : 'flex-col [&>*:not(:first-child)]:-mt-px [&>*:first-child]:rounded-b-none [&>*:last-child]:rounded-t-none [&>*:not(:first-child):not(:last-child)]:rounded-none',
                className
            )}
            role="group"
        >
            {children}
        </div>
    );
}

export default UnifiedButton;
