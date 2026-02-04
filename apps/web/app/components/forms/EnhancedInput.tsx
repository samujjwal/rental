import React, { forwardRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, type LucideIcon } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface EnhancedInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    success?: boolean;
    hint?: string;
    icon?: LucideIcon;
    rightIcon?: LucideIcon;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    containerClassName?: string;
}

const sizeClasses = {
    sm: {
        input: 'h-8 text-sm px-3',
        iconLeft: 'left-2.5 w-4 h-4',
        iconRight: 'right-2.5 w-4 h-4',
        paddingLeft: 'pl-8',
        paddingRight: 'pr-8',
        label: 'text-xs',
        message: 'text-xs',
    },
    md: {
        input: 'h-10 text-sm px-3',
        iconLeft: 'left-3 w-5 h-5',
        iconRight: 'right-3 w-5 h-5',
        paddingLeft: 'pl-10',
        paddingRight: 'pr-10',
        label: 'text-sm',
        message: 'text-sm',
    },
    lg: {
        input: 'h-12 text-base px-4',
        iconLeft: 'left-3.5 w-5 h-5',
        iconRight: 'right-3.5 w-5 h-5',
        paddingLeft: 'pl-11',
        paddingRight: 'pr-11',
        label: 'text-base',
        message: 'text-sm',
    },
};

/**
 * EnhancedInput - A comprehensive input component with validation feedback
 * 
 * Features:
 * - Real-time validation feedback (error/success states)
 * - Animated error messages
 * - Left/right icon support
 * - Success checkmark indicator
 * - Hint text support
 * - Multiple sizes
 * - Full accessibility support
 */
export const EnhancedInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
    (
        {
            label,
            error,
            success,
            hint,
            icon: Icon,
            rightIcon: RightIcon,
            size = 'md',
            fullWidth = true,
            className,
            containerClassName,
            id,
            disabled,
            ...props
        },
        ref
    ) => {
        const generatedId = useId();
        const inputId = id || generatedId;
        const errorId = `${inputId}-error`;
        const hintId = `${inputId}-hint`;
        const sizeStyle = sizeClasses[size];

        const hasError = Boolean(error);
        const hasSuccess = success && !hasError;
        const showRightIcon = hasSuccess || RightIcon;

        return (
            <div className={cn('space-y-1.5', fullWidth && 'w-full', containerClassName)}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className={cn(
                            'block font-medium text-foreground',
                            sizeStyle.label,
                            disabled && 'opacity-50'
                        )}
                    >
                        {label}
                    </label>
                )}

                <div className="relative">
                    {Icon && (
                        <Icon
                            className={cn(
                                'absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
                                sizeStyle.iconLeft,
                                hasError && 'text-destructive',
                                hasSuccess && 'text-success'
                            )}
                            aria-hidden="true"
                        />
                    )}

                    <input
                        ref={ref}
                        id={inputId}
                        disabled={disabled}
                        aria-invalid={hasError}
                        aria-describedby={
                            hasError ? errorId : hint ? hintId : undefined
                        }
                        className={cn(
                            'w-full rounded-md border bg-background text-foreground',
                            'transition-all duration-200 ease-out',
                            'placeholder:text-muted-foreground',
                            'focus:outline-none focus:ring-2 focus:ring-offset-0',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            sizeStyle.input,
                            Icon && sizeStyle.paddingLeft,
                            showRightIcon && sizeStyle.paddingRight,
                            hasError
                                ? 'border-destructive focus:ring-destructive/30 focus:border-destructive'
                                : hasSuccess
                                    ? 'border-success focus:ring-success/30 focus:border-success'
                                    : 'border-input focus:ring-ring/30 focus:border-ring',
                            className
                        )}
                        {...props}
                    />

                    {showRightIcon && (
                        <div
                            className={cn(
                                'absolute top-1/2 -translate-y-1/2 pointer-events-none',
                                sizeStyle.iconRight
                            )}
                            aria-hidden="true"
                        >
                            {hasSuccess ? (
                                <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                >
                                    <CheckCircle2 className="w-full h-full text-success" />
                                </motion.div>
                            ) : RightIcon ? (
                                <RightIcon className="w-full h-full text-muted-foreground" />
                            ) : null}
                        </div>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {hasError && (
                        <motion.p
                            id={errorId}
                            initial={{ opacity: 0, y: -8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -8, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                'flex items-center gap-1.5 text-destructive',
                                sizeStyle.message
                            )}
                            role="alert"
                        >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>{error}</span>
                        </motion.p>
                    )}
                    {!hasError && hint && (
                        <motion.p
                            id={hintId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn('text-muted-foreground', sizeStyle.message)}
                        >
                            {hint}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        );
    }
);

EnhancedInput.displayName = 'EnhancedInput';

/**
 * EnhancedTextarea - A textarea variant with the same features
 */
export interface EnhancedTextareaProps
    extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
    label?: string;
    error?: string;
    success?: boolean;
    hint?: string;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    containerClassName?: string;
}

export const EnhancedTextarea = forwardRef<
    HTMLTextAreaElement,
    EnhancedTextareaProps
>(
    (
        {
            label,
            error,
            success,
            hint,
            size = 'md',
            fullWidth = true,
            className,
            containerClassName,
            id,
            disabled,
            ...props
        },
        ref
    ) => {
        const generatedId = useId();
        const textareaId = id || generatedId;
        const errorId = `${textareaId}-error`;
        const hintId = `${textareaId}-hint`;
        const sizeStyle = sizeClasses[size];

        const hasError = Boolean(error);
        const hasSuccess = success && !hasError;

        return (
            <div className={cn('space-y-1.5', fullWidth && 'w-full', containerClassName)}>
                {label && (
                    <label
                        htmlFor={textareaId}
                        className={cn(
                            'block font-medium text-foreground',
                            sizeStyle.label,
                            disabled && 'opacity-50'
                        )}
                    >
                        {label}
                    </label>
                )}

                <div className="relative">
                    <textarea
                        ref={ref}
                        id={textareaId}
                        disabled={disabled}
                        aria-invalid={hasError}
                        aria-describedby={
                            hasError ? errorId : hint ? hintId : undefined
                        }
                        className={cn(
                            'w-full rounded-md border bg-background text-foreground',
                            'transition-all duration-200 ease-out',
                            'placeholder:text-muted-foreground',
                            'focus:outline-none focus:ring-2 focus:ring-offset-0',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            'min-h-[80px] py-2 px-3 text-sm resize-y',
                            hasError
                                ? 'border-destructive focus:ring-destructive/30 focus:border-destructive'
                                : hasSuccess
                                    ? 'border-success focus:ring-success/30 focus:border-success'
                                    : 'border-input focus:ring-ring/30 focus:border-ring',
                            className
                        )}
                        {...props}
                    />

                    {hasSuccess && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="absolute top-2 right-2"
                            aria-hidden="true"
                        >
                            <CheckCircle2 className="w-5 h-5 text-success" />
                        </motion.div>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {hasError && (
                        <motion.p
                            id={errorId}
                            initial={{ opacity: 0, y: -8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -8, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                'flex items-center gap-1.5 text-destructive',
                                sizeStyle.message
                            )}
                            role="alert"
                        >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>{error}</span>
                        </motion.p>
                    )}
                    {!hasError && hint && (
                        <motion.p
                            id={hintId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn('text-muted-foreground', sizeStyle.message)}
                        >
                            {hint}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        );
    }
);

EnhancedTextarea.displayName = 'EnhancedTextarea';

export default EnhancedInput;
