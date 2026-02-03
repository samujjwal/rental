import { lazy, Suspense, ComponentType } from 'react';
import { Skeleton } from '~/components/ui/skeleton';

/**
 * Lazy load component with custom fallback
 */
export function lazyLoad<T extends ComponentType<any>>(
    importFunc: () => Promise<{ default: T }>,
    fallback?: React.ReactNode
) {
    const LazyComponent = lazy(importFunc);

    return function LazyLoadedComponent(props: React.ComponentProps<T>) {
        return (
            <Suspense fallback={fallback || <Skeleton variant="rectangular" className="h-96 w-full" />}>
                <LazyComponent {...props} />
            </Suspense>
        );
    };
}

/**
 * Lazy load with retry logic
 */
export function lazyLoadWithRetry<T extends ComponentType<any>>(
    importFunc: () => Promise<{ default: T }>,
    retries = 3,
    fallback?: React.ReactNode
) {
    const loadWithRetry = async () => {
        for (let i = 0; i < retries; i++) {
            try {
                return await importFunc();
            } catch (error) {
                if (i === retries - 1) throw error;
                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }
        throw new Error('Failed to load component after retries');
    };

    const LazyComponent = lazy(loadWithRetry);

    return function LazyLoadedComponent(props: React.ComponentProps<T>) {
        return (
            <Suspense fallback={fallback || <Skeleton variant="rectangular" className="h-96 w-full" />}>
                <LazyComponent {...props} />
            </Suspense>
        );
    };
}

/**
 * Preload component for faster navigation
 */
export function preloadComponent<T extends ComponentType<any>>(
    importFunc: () => Promise<{ default: T }>
) {
    let componentPromise: Promise<{ default: T }> | null = null;

    return {
        preload: () => {
            if (!componentPromise) {
                componentPromise = importFunc();
            }
            return componentPromise;
        },
        Component: lazy(() => {
            if (!componentPromise) {
                componentPromise = importFunc();
            }
            return componentPromise;
        }),
    };
}

/**
 * Route-based code splitting helper
 */
export interface RouteConfig {
    path: string;
    component: () => Promise<{ default: ComponentType<any> }>;
    preload?: boolean;
}

export function createRoutes(routes: RouteConfig[]) {
    return routes.map((route) => ({
        path: route.path,
        Component: lazyLoadWithRetry(route.component),
        preload: route.preload ? () => route.component() : undefined,
    }));
}
