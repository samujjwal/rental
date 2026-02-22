/**
 * Shared route-level skeleton components for HydrateFallback.
 * These provide instant visual feedback while client-side JS loads.
 */

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

/** Home page skeleton — hero + feature cards */
export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <Shimmer className="h-10 w-96 mx-auto" />
          <Shimmer className="h-5 w-64 mx-auto" />
          <Shimmer className="h-12 w-48 mx-auto rounded-lg" />
        </div>
        {/* Featured cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <Shimmer className="h-40 w-full rounded-lg" />
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-4 w-1/2" />
              <Shimmer className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Search page skeleton — filters + grid results */
export function SearchSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Search bar */}
      <Shimmer className="h-12 w-full rounded-lg" />
      {/* Filter chips */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      {/* Results grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <Shimmer className="h-48 w-full rounded-lg" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-4 w-1/2" />
            <div className="flex justify-between items-center">
              <Shimmer className="h-5 w-20" />
              <Shimmer className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Listing detail skeleton — gallery + info panel */
export function ListingDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Shimmer className="h-80 rounded-lg" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-[9.5rem] rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Shimmer className="h-8 w-3/4" />
          <Shimmer className="h-5 w-1/3" />
          <Shimmer className="h-20 w-full" />
          <Shimmer className="h-32 w-full" />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <Shimmer className="h-8 w-24" />
            <Shimmer className="h-10 w-full rounded-lg" />
            <Shimmer className="h-10 w-full rounded-lg" />
            <Shimmer className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bookings list skeleton */
export function BookingsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex justify-between items-center">
        <Shimmer className="h-8 w-40" />
        <Shimmer className="h-10 w-32 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 flex gap-4">
          <Shimmer className="h-20 w-20 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-5 w-1/2" />
            <Shimmer className="h-4 w-1/3" />
            <Shimmer className="h-4 w-1/4" />
          </div>
          <Shimmer className="h-8 w-24 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard skeleton — stats + recent items */
export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <Shimmer className="h-8 w-60" />
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-8 w-16" />
          </div>
        ))}
      </div>
      {/* Content cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Shimmer className="h-5 w-32" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Messages skeleton — sidebar + chat */
export function MessagesSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-80 border-r p-4 space-y-3 hidden md:block">
        <Shimmer className="h-10 w-full rounded-lg" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Shimmer className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="border-b p-4">
          <Shimmer className="h-6 w-40" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
              <Shimmer className={`h-10 rounded-lg ${i % 2 === 0 ? "w-48" : "w-36"}`} />
            </div>
          ))}
        </div>
        <div className="border-t p-4">
          <Shimmer className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Checkout skeleton — form + summary */
export function CheckoutSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Shimmer className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <Shimmer className="h-6 w-32" />
            <Shimmer className="h-10 w-full rounded-lg" />
            <Shimmer className="h-10 w-full rounded-lg" />
            <Shimmer className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <Shimmer className="h-6 w-24" />
            <div className="flex justify-between">
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-16" />
            </div>
            <div className="flex justify-between">
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-16" />
            </div>
            <hr />
            <div className="flex justify-between">
              <Shimmer className="h-5 w-16" />
              <Shimmer className="h-5 w-20" />
            </div>
            <Shimmer className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Favorites skeleton — grid of cards */
export function FavoritesSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <Shimmer className="h-8 w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <Shimmer className="h-40 w-full rounded-lg" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-4 w-1/2" />
            <Shimmer className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Earnings skeleton — stats + table */
export function EarningsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Shimmer className="h-8 w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <Shimmer className="h-6 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic fallback skeleton for simple pages */
export function GenericSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <Shimmer className="h-8 w-64" />
      <Shimmer className="h-32 w-full rounded-lg" />
      <Shimmer className="h-64 w-full rounded-lg" />
    </div>
  );
}
