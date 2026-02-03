import { Skeleton, StatCardSkeleton } from '../ui/skeleton';

/**
 * Dashboard skeleton for owner and renter dashboards
 * Shows loading state for stats and content sections
 */
export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton variant="text" className="h-8 w-64" />
                <Skeleton variant="text" className="h-4 w-96" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <StatCardSkeleton key={i} />
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-lg border border-border bg-card p-6">
                        <Skeleton variant="text" className="h-6 w-48 mb-4" />
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-4 p-4 border border-border rounded-lg">
                                    <Skeleton variant="rounded" className="h-20 w-20 flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton variant="text" className="h-5 w-3/4" />
                                        <Skeleton variant="text" className="h-4 w-1/2" />
                                        <Skeleton variant="text" className="h-4 w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column - Sidebar */}
                <div className="space-y-6">
                    <div className="rounded-lg border border-border bg-card p-6">
                        <Skeleton variant="text" className="h-6 w-32 mb-4" />
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} variant="text" className="h-4" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
