import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '~/lib/utils';
import { prefersReducedMotion } from '~/lib/accessibility';

export interface ProgressStep {
    id: string;
    label: string;
    description?: string;
}

export interface BookingProgressProps {
    steps: ProgressStep[];
    currentStep: number;
    className?: string;
    orientation?: 'horizontal' | 'vertical';
    size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
    sm: {
        step: 'w-8 h-8 text-sm',
        icon: 'w-4 h-4',
        label: 'text-xs',
        description: 'text-xs',
        bar: 'h-0.5',
        barVertical: 'w-0.5',
    },
    md: {
        step: 'w-10 h-10 text-sm',
        icon: 'w-5 h-5',
        label: 'text-sm',
        description: 'text-xs',
        bar: 'h-1',
        barVertical: 'w-1',
    },
    lg: {
        step: 'w-12 h-12 text-base',
        icon: 'w-6 h-6',
        label: 'text-base',
        description: 'text-sm',
        bar: 'h-1',
        barVertical: 'w-1',
    },
};

/**
 * BookingProgress - Multi-step progress indicator
 * 
 * Features:
 * - Horizontal and vertical orientations
 * - Animated progress bar
 * - Completed step checkmarks
 * - Current step highlight with pulse
 * - Multiple sizes
 * - Accessible with ARIA
 */
export function BookingProgress({
    steps,
    currentStep,
    className,
    orientation = 'horizontal',
    size = 'md',
}: BookingProgressProps) {
    const shouldReduceMotion = prefersReducedMotion();
    const sizeStyle = sizeClasses[size];
    const isHorizontal = orientation === 'horizontal';
    const progressPercent = (currentStep / (steps.length - 1)) * 100;

    return (
        <div
            className={cn(
                'relative',
                isHorizontal ? 'w-full' : 'h-full',
                className
            )}
            role="progressbar"
            aria-valuenow={currentStep + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-label={`Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep]?.label}`}
        >
            {/* Progress Bar Background */}
            <div
                className={cn(
                    'absolute bg-muted',
                    isHorizontal
                        ? `top-1/2 left-0 right-0 -translate-y-1/2 ${sizeStyle.bar}`
                        : `left-1/2 top-0 bottom-0 -translate-x-1/2 ${sizeStyle.barVertical}`,
                    isHorizontal ? 'mx-5' : 'my-5'
                )}
                style={
                    isHorizontal
                        ? { top: size === 'sm' ? '16px' : size === 'md' ? '20px' : '24px' }
                        : { left: size === 'sm' ? '16px' : size === 'md' ? '20px' : '24px' }
                }
            >
                {/* Animated Progress Fill */}
                <motion.div
                    className={cn(
                        'bg-primary',
                        isHorizontal ? 'h-full' : 'w-full'
                    )}
                    initial={isHorizontal ? { width: 0 } : { height: 0 }}
                    animate={
                        isHorizontal
                            ? { width: `${progressPercent}%` }
                            : { height: `${progressPercent}%` }
                    }
                    transition={
                        shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.5, ease: 'easeInOut' }
                    }
                />
            </div>

            {/* Steps */}
            <div
                className={cn(
                    'relative flex',
                    isHorizontal ? 'justify-between' : 'flex-col justify-between h-full'
                )}
            >
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const isPending = index > currentStep;

                    return (
                        <div
                            key={step.id}
                            className={cn(
                                'flex',
                                isHorizontal ? 'flex-col items-center' : 'flex-row items-center gap-3'
                            )}
                        >
                            {/* Step Circle */}
                            <motion.div
                                className={cn(
                                    'relative flex items-center justify-center rounded-full border-2 transition-colors z-10',
                                    sizeStyle.step,
                                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                                    isCurrent && 'border-primary text-primary bg-background',
                                    isPending && 'border-muted text-muted-foreground bg-background'
                                )}
                                animate={
                                    isCurrent && !shouldReduceMotion
                                        ? { scale: [1, 1.1, 1] }
                                        : {}
                                }
                                transition={{
                                    duration: 0.5,
                                    repeat: isCurrent ? Infinity : 0,
                                    repeatDelay: 2,
                                }}
                            >
                                {isCompleted ? (
                                    <motion.div
                                        initial={shouldReduceMotion ? {} : { scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                        <Check className={sizeStyle.icon} strokeWidth={3} />
                                    </motion.div>
                                ) : (
                                    <span className="font-semibold">{index + 1}</span>
                                )}

                                {/* Current step ring */}
                                {isCurrent && !shouldReduceMotion && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full border-2 border-primary"
                                        animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: 'easeOut',
                                        }}
                                    />
                                )}
                            </motion.div>

                            {/* Step Label */}
                            <div
                                className={cn(
                                    isHorizontal ? 'mt-2 text-center' : 'flex-1'
                                )}
                            >
                                <p
                                    className={cn(
                                        'font-medium',
                                        sizeStyle.label,
                                        isCompleted && 'text-primary',
                                        isCurrent && 'text-foreground',
                                        isPending && 'text-muted-foreground'
                                    )}
                                >
                                    {step.label}
                                </p>
                                {step.description && (
                                    <p
                                        className={cn(
                                            'text-muted-foreground mt-0.5',
                                            sizeStyle.description
                                        )}
                                    >
                                        {step.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * SimpleProgress - A simpler linear progress bar
 */
export interface SimpleProgressProps {
    value: number;
    max?: number;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    variant?: 'default' | 'success' | 'warning' | 'error';
}

export function SimpleProgress({
    value,
    max = 100,
    className,
    size = 'md',
    showLabel = false,
    variant = 'default',
}: SimpleProgressProps) {
    const shouldReduceMotion = prefersReducedMotion();
    const percent = Math.min(100, Math.max(0, (value / max) * 100));

    const heights = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };

    const variants = {
        default: 'bg-primary',
        success: 'bg-success',
        warning: 'bg-warning',
        error: 'bg-destructive',
    };

    return (
        <div className={cn('w-full', className)}>
            <div
                className={cn('w-full bg-muted rounded-full overflow-hidden', heights[size])}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}
            >
                <motion.div
                    className={cn('h-full rounded-full', variants[variant])}
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={
                        shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.5, ease: 'easeOut' }
                    }
                />
            </div>
            {showLabel && (
                <p className="text-sm text-muted-foreground mt-1 text-right">
                    {Math.round(percent)}%
                </p>
            )}
        </div>
    );
}

/**
 * CircularProgress - Circular progress indicator
 */
export interface CircularProgressProps {
    value: number;
    max?: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
    showLabel?: boolean;
    variant?: 'default' | 'success' | 'warning' | 'error';
}

export function CircularProgress({
    value,
    max = 100,
    size = 64,
    strokeWidth = 4,
    className,
    showLabel = true,
    variant = 'default',
}: CircularProgressProps) {
    const shouldReduceMotion = prefersReducedMotion();
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;

    const variants = {
        default: 'text-primary',
        success: 'text-success',
        warning: 'text-warning',
        error: 'text-destructive',
    };

    return (
        <div
            className={cn('relative inline-flex items-center justify-center', className)}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
        >
            <svg width={size} height={size} className="-rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-muted"
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className={variants[variant]}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={
                        shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.5, ease: 'easeOut' }
                    }
                />
            </svg>
            {showLabel && (
                <span className="absolute text-sm font-medium text-foreground">
                    {Math.round(percent)}%
                </span>
            )}
        </div>
    );
}

export default BookingProgress;
