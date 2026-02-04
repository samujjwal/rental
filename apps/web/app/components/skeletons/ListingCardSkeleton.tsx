import { Skeleton } from '../ui/skeleton';
import { cn } from '~/lib/utils';

export interface ListingCardSkeletonProps {
    variant?: 'default' | 'compact' | 'horizontal';
    className?: string;
}

/**
 * Listing card skeleton for search results and listing grids
 * Content-aware skeleton that matches the actual ListingCard layout
 */
export function ListingCardSkeleton({ variant = 'default', className }: ListingCardSkeletonProps) {
    if (variant === 'horizontal') {
        return <ListingCardSkeletonHorizontal className={className} />;
    }

    if (variant === 'compact') {
        return <ListingCardSkeletonCompact className={className} />;
    }

    return (
        <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
            {/* Image skeleton with shimmer */}
            <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                <Skeleton variant="rounded" className="absolute inset-0" animation="wave" />
                {/* Badge placeholders */}
                <div className="absolute top-2 left-2 flex gap-1">
                    <Skeleton variant="rounded" className="h-5 w-16" />
                </div>
                <div className="absolute top-2 right-2">
                    <Skeleton variant="circular" className="h-8 w-8" />
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Title */}
                <Skeleton variant="text" className="h-6 w-4/5" />

                {/* Location */}
                <div className="flex items-center gap-2">
                    <Skeleton variant="circular" className="h-4 w-4" />
                    <Skeleton variant="text" className="h-4 w-32" />
                </div>

                {/* Condition & Rating row */}
                <div className="flex items-center justify-between">
                    <Skeleton variant="text" className="h-4 w-16" />
                    <div className="flex items-center gap-1">
                        <Skeleton variant="circular" className="h-4 w-4" />
                        <Skeleton variant="text" className="h-4 w-12" />
                    </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1 pt-1">
                    <Skeleton variant="text" className="h-8 w-20" />
                    <Skeleton variant="text" className="h-4 w-8" />
                </div>
            </div>
        </div>
    );
}

/**
 * Horizontal listing card skeleton for list views
 */
function ListingCardSkeletonHorizontal({ className }: { className?: string }) {
    return (
        <div className={cn('flex overflow-hidden rounded-lg border border-border bg-card', className)}>
            {/* Image */}
            <div className="w-48 h-36 bg-muted relative shrink-0">
                <Skeleton variant="rounded" className="absolute inset-0" animation="wave" />
                <div className="absolute top-2 left-2">
                    <Skeleton variant="rounded" className="h-5 w-14" />
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <Skeleton variant="text" className="h-6 w-3/4" />
                        <Skeleton variant="rounded" className="h-5 w-16" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton variant="circular" className="h-4 w-4" />
                        <Skeleton variant="text" className="h-4 w-28" />
                    </div>
                    <Skeleton variant="text" className="h-4 w-full" />
                    <Skeleton variant="text" className="h-4 w-2/3" />
                </div>

                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-4">
                        <Skeleton variant="text" className="h-4 w-16" />
                        <Skeleton variant="text" className="h-4 w-20" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <Skeleton variant="text" className="h-6 w-16" />
                        <Skeleton variant="text" className="h-4 w-8" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Compact listing card skeleton for map views
 */
function ListingCardSkeletonCompact({ className }: { className?: string }) {
    return (
        <div className={cn('flex gap-3 rounded-lg border border-border bg-card p-3', className)}>
            {/* Thumbnail */}
            <Skeleton variant="rounded" className="w-20 h-20 shrink-0" animation="wave" />

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
                <Skeleton variant="text" className="h-4 w-4/5" />
                <div className="flex items-center gap-1">
                    <Skeleton variant="circular" className="h-3 w-3" />
                    <Skeleton variant="text" className="h-3 w-16" />
                </div>
                <Skeleton variant="text" className="h-3 w-20" />
                <Skeleton variant="text" className="h-5 w-24" />
            </div>
        </div>
    );
}

export interface ListingGridSkeletonProps {
    count?: number;
    variant?: 'default' | 'compact' | 'horizontal';
    columns?: 1 | 2 | 3 | 4;
    className?: string;
}

/**
 * Grid of listing card skeletons
 */
export function ListingGridSkeleton({
    count = 8,
    variant = 'default',
    columns = 3,
    className
}: ListingGridSkeletonProps) {
    const columnClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };

    if (variant === 'horizontal') {
        return (
            <div className={cn('space-y-4', className)}>
                {Array.from({ length: count }).map((_, i) => (
                    <ListingCardSkeleton key={i} variant="horizontal" />
                ))}
            </div>
        );
    }

    return (
        <div className={cn('grid gap-6', columnClasses[columns], className)}>
            {Array.from({ length: count }).map((_, i) => (
                <ListingCardSkeleton key={i} variant={variant} />
            ))}
        </div>
    );
}
