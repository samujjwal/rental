import { useEffect, useRef } from 'react';

export interface LiveRegionProps {
    message: string;
    priority?: 'polite' | 'assertive';
    clearAfter?: number;
}

/**
 * Live Region Component
 * Announces dynamic content changes to screen readers
 * WCAG 2.1 Success Criterion 4.1.3 (Level AA)
 */
export function LiveRegion({
    message,
    priority = 'polite',
    clearAfter = 1000,
}: LiveRegionProps) {
    const regionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!message || !regionRef.current) return;

        const timer = setTimeout(() => {
            if (regionRef.current) {
                regionRef.current.textContent = '';
            }
        }, clearAfter);

        return () => clearTimeout(timer);
    }, [message, clearAfter]);

    return (
        <div
            ref={regionRef}
            role="status"
            aria-live={priority}
            aria-atomic="true"
            className="sr-only"
        >
            {message}
        </div>
    );
}

/**
 * Hook for announcing messages
 */
export function useAnnounce() {
    const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;

        document.body.appendChild(announcement);

        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    };

    return { announce };
}
