import { useEffect, useRef } from 'react';
import { trapFocus } from '~/lib/accessibility';

export interface FocusTrapProps {
    children: React.ReactNode;
    active?: boolean;
    restoreFocus?: boolean;
    className?: string;
}

/**
 * Focus Trap Component
 * Traps focus within a container for modals and dialogs
 * WCAG 2.1 Success Criterion 2.4.3 (Level A)
 */
export function FocusTrap({
    children,
    active = true,
    restoreFocus = true,
    className = '',
}: FocusTrapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!active || !containerRef.current) return;

        // Save current focus
        if (restoreFocus) {
            previousFocusRef.current = document.activeElement as HTMLElement;
        }

        // Set up focus trap
        const cleanup = trapFocus(containerRef.current);

        // Cleanup
        return () => {
            cleanup();

            // Restore focus
            if (restoreFocus && previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [active, restoreFocus]);

    return (
        <div ref={containerRef} className={className}>
            {children}
        </div>
    );
}
