import { Skeleton } from '../ui/skeleton';

/**
 * Messages page skeleton
 * Shows loading state for conversation list and message thread
 */
export function MessagesSkeleton() {
    return (
        <div className="flex h-[calc(100vh-4rem)] border border-border rounded-lg overflow-hidden">
            {/* Conversations List */}
            <div className="w-80 border-r border-border bg-card">
                <div className="p-4 border-b border-border">
                    <Skeleton variant="rounded" className="h-10 w-full" />
                </div>
                <div className="divide-y divide-border">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="p-4 flex gap-3">
                            <Skeleton variant="circular" className="h-12 w-12 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton variant="text" className="h-4 w-3/4" />
                                <Skeleton variant="text" className="h-3 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 flex flex-col bg-background">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center gap-3">
                    <Skeleton variant="circular" className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton variant="text" className="h-5 w-32" />
                        <Skeleton variant="text" className="h-3 w-24" />
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-md ${i % 2 === 0 ? '' : 'ml-auto'}`}>
                                <Skeleton variant="rounded" className="h-16 w-64" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border">
                    <Skeleton variant="rounded" className="h-12 w-full" />
                </div>
            </div>
        </div>
    );
}
