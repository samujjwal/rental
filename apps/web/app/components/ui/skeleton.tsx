import React from "react";
import { cn } from "~/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The variant of skeleton to render
   */
  variant?: "text" | "circular" | "rectangular" | "rounded";
  /**
   * Animation type
   */
  animation?: "pulse" | "wave" | "none";
  /**
   * Width of the skeleton (accepts any CSS value)
   */
  width?: string | number;
  /**
   * Height of the skeleton (accepts any CSS value)
   */
  height?: string | number;
}

/**
 * Skeleton component for loading states
 * Based on wireframe section 7.7
 */
export function Skeleton({
  className,
  variant = "rectangular",
  animation = "pulse",
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const variants = {
    text: "rounded-sm h-4",
    circular: "rounded-full",
    rectangular: "rounded-none",
    rounded: "rounded-md",
  };

  const animations = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  const customStyle = {
    ...style,
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      className={cn(
        "bg-muted",
        variants[variant],
        animations[animation],
        className
      )}
      style={customStyle}
      {...props}
    />
  );
}

/**
 * Card skeleton for listing cards
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <Skeleton variant="rounded" className="h-48 w-full" />
      <Skeleton variant="text" className="h-4 w-3/4" />
      <Skeleton variant="text" className="h-4 w-1/2" />
      <div className="flex justify-between">
        <Skeleton variant="text" className="h-4 w-1/4" />
        <Skeleton variant="text" className="h-4 w-1/4" />
      </div>
    </div>
  );
}

/**
 * Grid of card skeletons for listing pages
 */
export function CardGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({
  columns = 5,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-border", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton variant="text" className="h-4" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Table skeleton with header and rows
 */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg border", className)}>
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-4 text-left">
                <Skeleton variant="text" className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Page skeleton with header and content
 */
export function PageSkeleton({
  showHeader = true,
  showSidebar = false,
  className,
}: {
  showHeader?: boolean;
  showSidebar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-h-screen", className)}>
      {showHeader && (
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <Skeleton variant="text" className="h-8 w-48" />
            <div className="flex gap-4">
              <Skeleton variant="circular" className="h-10 w-10" />
              <Skeleton variant="circular" className="h-10 w-10" />
            </div>
          </div>
        </div>
      )}
      <div className="flex">
        {showSidebar && (
          <div className="w-64 space-y-4 border-r border-border p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="text" className="h-8" />
            ))}
          </div>
        )}
        <div className="flex-1 space-y-6 p-6">
          <Skeleton variant="text" className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" className="h-24" />
            ))}
          </div>
          <CardGridSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}

/**
 * Profile/User info skeleton
 */
export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Skeleton variant="circular" className="h-16 w-16" />
      <div className="space-y-2">
        <Skeleton variant="text" className="h-5 w-32" />
        <Skeleton variant="text" className="h-4 w-24" />
      </div>
    </div>
  );
}

/**
 * Stats card skeleton for dashboards
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-border bg-card p-4",
        className
      )}
    >
      <Skeleton variant="text" className="h-4 w-20" />
      <Skeleton variant="text" className="h-8 w-16" />
      <Skeleton variant="text" className="h-3 w-24" />
    </div>
  );
}

/**
 * Form skeleton
 */
export function FormSkeleton({
  fields = 4,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton variant="text" className="h-4 w-24" />
          <Skeleton variant="rounded" className="h-10 w-full" />
        </div>
      ))}
      <Skeleton variant="rounded" className="h-10 w-32" />
    </div>
  );
}

/**
 * Booking card skeleton
 */
export function BookingCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-lg border border-border bg-card p-4",
        className
      )}
    >
      <Skeleton variant="rounded" className="h-24 w-24 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="h-5 w-48" />
        <Skeleton variant="text" className="h-4 w-32" />
        <div className="flex gap-4">
          <Skeleton variant="text" className="h-4 w-24" />
          <Skeleton variant="rounded" className="h-6 w-20" />
        </div>
      </div>
    </div>
  );
}
