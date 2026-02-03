import { Skeleton } from '../ui/skeleton';

/**
 * Listing card skeleton for search results and listing grids
 * Provides better perceived performance during loading
 */
export function ListingCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Skeleton variant="rounded" className="h-48 w-full" />
            <div className="p-4 space-y-3">
                <Skeleton variant="text" className="h-6 w-3/4" />
                <Skeleton variant="text" className="h-4 w-1/2" />
                <div className="flex items-center justify-between pt-2">
                    <Skeleton variant="text" className="h-5 w-20" />
                    <Skeleton variant="text" className="h-4 w-16" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton variant="circular" className="h-4 w-4" />
                    <Skeleton variant="text" className="h-4 w-24" />
                </div>
            </div>
        </div>
    );
}

/**
 * Grid of listing card skeletons
 */
export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <ListingCardSkeleton key={i} />
            ))}
        </div>
    );
}
