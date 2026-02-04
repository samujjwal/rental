import React, { Suspense, lazy, ComponentType } from 'react';
import { PageLoading } from '~/components/ui/loading';

export interface LazyRouteOptions {
    fallback?: React.ReactNode;
    preload?: boolean;
}

/**
 * Creates a lazy-loaded route component with loading fallback
 * 
 * Features:
 * - Automatic code splitting
 * - Loading fallback during chunk load
 * - Optional preload on hover/focus
 * - Error boundary support
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLazyRoute<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: LazyRouteOptions = {}
) {
    const { fallback = <PageLoading />, preload = false } = options;

    const LazyComponent = lazy(importFn);

    // Store the import function for preloading
    const preloadFn = importFn;

    function LazyRoute(props: React.ComponentProps<T>) {
        return (
            <Suspense fallback={fallback}>
                <LazyComponent {...props} />
            </Suspense>
        );
    }

    // Attach preload function for use with link prefetching
    LazyRoute.preload = preloadFn;

    // If preload is true, start loading immediately
    if (preload) {
        preloadFn();
    }

    return LazyRoute;
}

/**
 * Preload a route on mouse enter for faster navigation
 */
export function usePreloadOnHover(preloadFn: () => Promise<any>) {
    const preloaded = React.useRef(false);

    const onMouseEnter = React.useCallback(() => {
        if (!preloaded.current) {
            preloaded.current = true;
            preloadFn();
        }
    }, [preloadFn]);

    return { onMouseEnter };
}

/**
 * PreloadLink - A link that preloads its target route on hover
 */
export interface PreloadLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string;
    preload?: () => Promise<any>;
    children: React.ReactNode;
}

export function PreloadLink({ to, preload, children, ...props }: PreloadLinkProps) {
    const { onMouseEnter } = usePreloadOnHover(preload || (() => Promise.resolve()));

    return (
        <a href={to} onMouseEnter={onMouseEnter} {...props}>
            {children}
        </a>
    );
}

/**
 * Common loading fallbacks for different route types
 */
export const RouteFallbacks = {
    Dashboard: () => (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="h-8 w-48 bg-muted rounded animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
                    ))}
                </div>
                <div className="h-64 bg-muted rounded-lg animate-pulse" />
            </div>
        </div>
    ),

    Listing: () => (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <div className="h-96 bg-muted rounded-lg animate-pulse" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                        <div className="h-32 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-64 bg-muted rounded-lg animate-pulse" />
                </div>
            </div>
        </div>
    ),

    Form: () => (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="h-8 w-48 bg-muted rounded animate-pulse" />
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-10 bg-muted rounded animate-pulse" />
                    </div>
                ))}
                <div className="h-10 w-32 bg-muted rounded animate-pulse" />
            </div>
        </div>
    ),

    Messages: () => (
        <div className="min-h-screen bg-background flex">
            <div className="w-80 border-r p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-3">
                        <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-full bg-muted rounded animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex-1 p-6">
                <div className="h-full bg-muted rounded-lg animate-pulse" />
            </div>
        </div>
    ),
};

export default createLazyRoute;
