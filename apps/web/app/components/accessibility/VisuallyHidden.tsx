import React from 'react';

/**
 * Visually Hidden Component
 * Hides content visually but keeps it accessible to screen readers
 * WCAG 2.1 Best Practice
 */

export interface VisuallyHiddenProps {
    children: React.ReactNode;
    as?: React.ElementType;
    focusable?: boolean;
}

export function VisuallyHidden({
    children,
    as: Component = 'span',
    focusable = false,
}: VisuallyHiddenProps) {
    return (
        <Component
            className={focusable ? 'sr-only-focusable' : 'sr-only'}
            style={
                !focusable
                    ? {
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        padding: '0',
                        margin: '-1px',
                        overflow: 'hidden',
                        clip: 'rect(0, 0, 0, 0)',
                        whiteSpace: 'nowrap',
                        borderWidth: '0',
                    }
                    : undefined
            }
        >
            {children}
        </Component>
    );
}
