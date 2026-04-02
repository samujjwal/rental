import React, { Suspense } from 'react';
import { Await } from 'react-router';
import { CardSkeleton, Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';

/**
 * Coordinated Dashboard Loading System
 * 
 * This component provides a coordinated loading experience for dashboard widgets,
 * preventing layout shift by rendering skeleton states that match the final layout.
 */

interface DashboardSkeletonGridProps {
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DashboardSkeletonGrid({ 
  columns = 4, 
  gap = 'md',
  className 
}: DashboardSkeletonGridProps) {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8'
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {Array.from({ length: columns }).map((_, i) => (
        <CardSkeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

interface DashboardSectionSkeletonProps {
  title?: boolean;
  description?: boolean;
  widgets?: number;
  widgetHeight?: string;
  className?: string;
}

export function DashboardSectionSkeleton({
  title = true,
  description = false,
  widgets = 3,
  widgetHeight = 'h-40',
  className
}: DashboardSectionSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" variant="text" />
          {description && <Skeleton className="h-4 w-72" variant="text" />}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: widgets }).map((_, i) => (
          <CardSkeleton key={i} className={widgetHeight} />
        ))}
      </div>
    </div>
  );
}

interface CoordinatedDashboardLoaderProps {
  children: React.ReactNode;
  sections?: {
    id: string;
    title: string;
    widgets: number;
    columns?: 1 | 2 | 3 | 4;
  }[];
  fallback?: React.ReactNode;
  className?: string;
}

export function CoordinatedDashboardLoader({
  children,
  sections = [],
  fallback,
  className
}: CoordinatedDashboardLoaderProps) {
  const defaultFallback = (
    <div className={cn('space-y-8', className)}>
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" variant="text" />
          <Skeleton className="h-4 w-48" variant="text" />
        </div>
        <Skeleton className="h-10 w-32" variant="rounded" />
      </div>

      {/* Stats Overview Skeleton */}
      <DashboardSkeletonGrid columns={4} />

      {/* Section Skeletons */}
      {sections.length > 0 ? (
        sections.map((section) => (
          <DashboardSectionSkeleton
            key={section.id}
            title
            widgets={section.widgets}
          />
        ))
      ) : (
        <>
          <DashboardSectionSkeleton title widgets={3} />
          <DashboardSectionSkeleton title widgets={2} />
        </>
      )}
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

interface WidgetContainerProps {
  children: React.ReactNode;
  isLoading?: boolean;
  skeleton?: React.ReactNode;
  className?: string;
}

export function WidgetContainer({
  children,
  isLoading,
  skeleton,
  className
}: WidgetContainerProps) {
  if (isLoading) {
    return skeleton || <CardSkeleton className="h-40" />;
  }

  return (
    <div className={cn('transition-all duration-300', className)}>
      {children}
    </div>
  );
}

interface AsyncWidgetProps<T> {
  data: Promise<T> | T;
  children: (data: T) => React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: (error: Error) => React.ReactNode;
  className?: string;
}

export function AsyncWidget<T>({
  data,
  children,
  fallback,
  errorFallback,
  className
}: AsyncWidgetProps<T>) {
  const defaultFallback = <CardSkeleton className="h-40" />;

  const defaultErrorFallback = (error: Error) => (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-red-600 text-sm">Failed to load widget</p>
      <p className="text-red-500 text-xs mt-1">{error.message}</p>
    </div>
  );

  return (
    <div className={className}>
      <Await
        resolve={data}
        errorElement={errorFallback?.(new Error('Failed to load')) || defaultErrorFallback(new Error('Failed to load'))}
      >
        {(resolvedData) => children(resolvedData)}
      </Await>
    </div>
  );
}

// Dashboard Layout Grid - Prevents layout shift by using CSS Grid
interface DashboardLayoutGridProps {
  children: React.ReactNode;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DashboardLayoutGrid({
  children,
  columns = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 'md',
  className
}: DashboardLayoutGridProps) {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8'
  };

  const getColumnClass = (breakpoint: string, value: number) => {
    const breakpointPrefix = breakpoint === 'sm' ? '' : `${breakpoint}:`;
    return `${breakpointPrefix}grid-cols-${value}`;
  };

  const gridClasses = [
    'grid',
    getColumnClass('sm', columns.sm || 1),
    columns.md && getColumnClass('md', columns.md),
    columns.lg && getColumnClass('lg', columns.lg),
    columns.xl && getColumnClass('xl', columns.xl),
    gapClasses[gap]
  ].filter(Boolean).join(' ');

  return (
    <div className={cn(gridClasses, className)}>
      {children}
    </div>
  );
}

// Staggered Animation for Widget Loading
interface StaggeredWidgetContainerProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function StaggeredWidgetContainer({
  children,
  delay = 0,
  className
}: StaggeredWidgetContainerProps) {
  return (
    <div 
      className={cn(
        'animate-fade-in-up',
        className
      )}
      style={{ 
        animationDelay: `${delay}ms`,
        animationFillMode: 'both'
      }}
    >
      {children}
    </div>
  );
}

// Dashboard Error Boundary for Widgets
interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm font-medium">Widget failed to load</p>
          <p className="text-red-500 text-xs mt-1">
            {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default {
  DashboardSkeletonGrid,
  DashboardSectionSkeleton,
  CoordinatedDashboardLoader,
  WidgetContainer,
  AsyncWidget,
  DashboardLayoutGrid,
  StaggeredWidgetContainer,
  WidgetErrorBoundary
};
