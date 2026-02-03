import { Skeleton } from '../ui/skeleton';

/**
 * Booking detail page skeleton
 * Shows loading state for booking information and actions
 */
export function BookingDetailSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton variant="text" className="h-8 w-64" />
                <div className="flex items-center gap-2">
                    <Skeleton variant="rounded" className="h-6 w-24" />
                    <Skeleton variant="text" className="h-4 w-48" />
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Booking Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Listing Info */}
                    <div className="rounded-lg border border-border bg-card p-6">
                        <div className="flex gap-4">
                            <Skeleton variant="rounded" className="h-32 w-32 flex-shrink-0" />
                            <div className="flex-1 space-y-3">
                                <Skeleton variant="text" className="h-6 w-3/4" />
                                <Skeleton variant="text" className="h-4 w-1/2" />
                                <Skeleton variant="text" className="h-4 w-2/3" />
                            </div>
                        </div>
                    </div>

                    {/* Booking Timeline */}
                    <div className="rounded-lg border border-border bg-card p-6">
                        <Skeleton variant="text" className="h-6 w-32 mb-4" />
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton variant="circular" className="h-8 w-8 flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton variant="text" className="h-4 w-48" />
                                        <Skeleton variant="text" className="h-3 w-32" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dates and Details */}
                    <div className="rounded-lg border border-border bg-card p-6">
                        <Skeleton variant="text" className="h-6 w-32 mb-4" />
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton variant="text" className="h-4 w-24" />
                                    <Skeleton variant="text" className="h-5 w-32" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column - Summary */}
                <div className="space-y-6">
                    {/* Price Breakdown */}
                    <div className="rounded-lg border border-border bg-card p-6">
                        <Skeleton variant="text" className="h-6 w-32 mb-4" />
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex justify-between">
                                    <Skeleton variant="text" className="h-4 w-24" />
                                    <Skeleton variant="text" className="h-4 w-16" />
                                </div>
                            ))}
                            <div className="pt-3 border-t border-border flex justify-between">
                                <Skeleton variant="text" className="h-5 w-20" />
                                <Skeleton variant="text" className="h-5 w-20" />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <Skeleton variant="rounded" className="h-10 w-full" />
                        <Skeleton variant="rounded" className="h-10 w-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
