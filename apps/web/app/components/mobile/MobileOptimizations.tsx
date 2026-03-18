import React, { useState, useEffect, useRef } from 'react';
import { cn } from '~/lib/utils';
import { Link, useLocation } from 'react-router';
import { Badge } from '~/components/ui';
import { ChevronLeft, ChevronRight, Home, Search, Heart, MessageSquare, Calendar, User } from 'lucide-react';

interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
}

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  swipeable?: boolean;
  onSwipe?: (direction: 'left' | 'right') => void;
}

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  isRefreshing?: boolean;
  className?: string;
}

export function MobileOptimizedLayout({ children, className }: MobileOptimizedLayoutProps) {
  const { isMobile, isTablet } = useBreakpoint();

  return (
    <div className={cn(
      'min-h-screen bg-background',
      {
        // Mobile optimizations
        'touch-pan-y': isMobile,
        'overflow-x-hidden': isMobile,
        'text-sm': isMobile,
        'pb-20': isMobile, // Extra padding for mobile navigation
      },
      className
    )}>
      {/* Mobile viewport meta tag handler */}
      {isMobile && (
        <style>{`
          @viewport {
            width: device-width;
            initial-scale: 1;
            maximum-scale: 1;
            user-scalable: no;
          }
        `}</style>
      )}
      
      {children}
    </div>
  );
}

export function ResponsiveGrid({ 
  children, 
  className, 
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = { mobile: 'gap-4', tablet: 'gap-6', desktop: 'gap-8' }
}: ResponsiveGridProps) {
  const { isMobile, isTablet } = useBreakpoint();

  const gridCols = isMobile ? cols.mobile : isTablet ? cols.tablet : cols.desktop;
  const gridGap = isMobile ? gap.mobile : isTablet ? gap.tablet : gap.desktop;

  return (
    <div 
      className={cn(
        'grid',
        gridGap,
        {
          'grid-cols-1': gridCols === 1,
          'grid-cols-2': gridCols === 2,
          'grid-cols-3': gridCols === 3,
          'grid-cols-4': gridCols === 4,
        },
        className
      )}
    >
      {children}
    </div>
  );
}

export function MobileCard({ 
  children, 
  className, 
  compact = false, 
  swipeable = false, 
  onSwipe 
}: MobileCardProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && onSwipe) {
      onSwipe('left');
    }
    if (isRightSwipe && onSwipe) {
      onSwipe('right');
    }
  };

  return (
    <div
      className={cn(
        'bg-card border rounded-lg shadow-sm transition-all duration-200',
        {
          'p-3': compact,
          'p-4': !compact,
          'active:scale-95': true, // Touch feedback
          'touch-pan-y': swipeable,
        },
        className
      )}
      onTouchStart={swipeable ? onTouchStart : undefined}
      onTouchMove={swipeable ? onTouchMove : undefined}
      onTouchEnd={swipeable ? onTouchEnd : undefined}
    >
      {children}
    </div>
  );
}

export function PullToRefresh({ 
  onRefresh, 
  children, 
  isRefreshing = false, 
  className 
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [startY, setStartY] = useState(0);

  const pullThreshold = 80;

  const onTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsPulling(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance > 0) {
      setPullDistance(Math.min(distance * 0.5, pullThreshold * 1.5));
    }
  };

  const onTouchEnd = async () => {
    if (pullDistance >= pullThreshold && !isRefreshing) {
      await onRefresh();
    }
    
    setPullDistance(0);
    setIsPulling(false);
  };

  return (
    <div
      className={cn('relative min-h-full', className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center bg-background border-b transition-transform duration-200"
        style={{
          transform: `translateY(${Math.max(0, pullDistance - pullThreshold)}px)`,
          height: `${Math.max(0, pullDistance)}px`,
        }}
      >
        {pullDistance > 20 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isRefreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Pull to refresh</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div 
        className="transition-transform duration-200"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'translateY(0)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Hook for responsive breakpoints
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    width: 0,
  });

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      setBreakpoint({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        width,
      });
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
}

// Mobile-first navigation component
export function MobileNavigation({ children }: { children: React.ReactNode }) {
  const { isMobile } = useBreakpoint();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="flex items-center justify-around py-2">
        {children}
      </div>
    </div>
  );
}

// Mobile-optimized button component
export function MobileButton({ 
  children, 
  className, 
  size = 'default',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'default' | 'lg';
}) {
  const { isMobile } = useBreakpoint();

  const sizeClasses = {
    sm: isMobile ? 'px-3 py-2 text-xs' : 'px-3 py-2 text-sm',
    default: isMobile ? 'px-4 py-3 text-sm' : 'px-4 py-2 text-sm',
    lg: isMobile ? 'px-6 py-4 text-base' : 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'active:scale-95', // Touch feedback
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Mobile-optimized input component
export function MobileInput({ 
  className, 
  ...props 
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const { isMobile } = useBreakpoint();

  return (
    <input
      className={cn(
        'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        {
          'py-3 text-base': isMobile, // Larger touch targets on mobile
        },
        className
      )}
      {...props}
    />
  );
}

// Mobile-optimized modal component
export function MobileModal({ 
  children, 
  isOpen, 
  onClose, 
  className 
}: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}) {
  const { isMobile } = useBreakpoint();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div
        className={cn(
          'relative bg-background border rounded-t-2xl shadow-lg w-full max-h-[80vh] overflow-y-auto',
          'animate-in slide-in-from-bottom duration-300',
          {
            'm-4 rounded-lg': !isMobile,
          },
          className
        )}
      >
        {/* Handle for mobile swipe */}
        {isMobile && (
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 bg-muted rounded-full" />
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
}

// Enhanced mobile navigation for dashboard
interface MobileNavigationItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: number;
  active?: boolean;
}

interface MobileNavigationProps {
  className?: string;
  items: MobileNavigationItem[];
}

export function MobileDashboardNavigation({ className, items }: MobileNavigationProps) {
  const location = useLocation();
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current) {
        const isOverflow = containerRef.current.scrollWidth > containerRef.current.clientWidth;
        setIsOverflowing(isOverflow);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = 200;
      const newScrollPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      
      containerRef.current.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth'
      });
      setScrollPosition(newScrollPosition);
    }
  };

  if (!isMobile) return null;

  return (
    <div className={cn('relative', className)}>
      {/* Scroll indicators */}
      {isOverflowing && (
        <>
          <button
            onClick={() => scroll('left')}
            disabled={scrollPosition === 0}
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-background border border-border rounded-full shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              scrollPosition === 0 && 'hidden'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={containerRef.current ? scrollPosition >= containerRef.current.scrollWidth - containerRef.current.clientWidth : false}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-background border border-border rounded-full shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Navigation container */}
      <div
        ref={containerRef}
        className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-2 py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.active || location.pathname === item.href;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-w-[60px] px-2 py-2 rounded-lg transition-colors snap-start',
                'hover:bg-accent',
                isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5', isActive && 'text-primary-foreground')} />
                {item.badge && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                'text-xs mt-1 truncate max-w-[60px]',
                isActive && 'text-primary-foreground'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
