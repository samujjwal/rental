import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui';

interface ProgressiveDisclosureProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'minimal';
  id?: string;
}

/**
 * P1.3 FIX: Enhanced with proper focus management and ARIA live regions
 * Ensures keyboard navigation and screen reader accessibility
 */
export function ProgressiveDisclosure({
  title,
  description,
  children,
  defaultExpanded = false,
  className,
  variant = 'default',
  id
}: ProgressiveDisclosureProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerId = id ? `${id}-header` : undefined;
  const contentId = id ? `${id}-content` : undefined;

  // P1.3: Focus management - focus first focusable element when expanding
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      const firstFocusable = contentRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      // Only focus if user expanded via keyboard
      if (firstFocusable && document.activeElement?.getAttribute('role') === 'button') {
        // Small delay to ensure content is rendered
        setTimeout(() => {
          firstFocusable.focus();
        }, 100);
      }
    }
  }, [isExpanded]);

  const variantStyles = {
    default: {
      header: 'pb-4 border-b',
      content: 'pt-4',
      button: 'text-sm font-medium'
    },
    compact: {
      header: 'pb-2',
      content: 'pt-2',
      button: 'text-xs font-medium'
    },
    minimal: {
      header: 'pb-1',
      content: 'pt-1',
      button: 'text-xs'
    }
  };

  const styles = variantStyles[variant];

  return (
    <Card className={cn('transition-all duration-200', className)}>
      <CardHeader className={cn('cursor-pointer hover:bg-accent/50 transition-colors', styles.header)}>
        <div 
          className="flex items-center justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
            // P1.3: Escape key to collapse
            if (e.key === 'Escape' && isExpanded) {
              e.preventDefault();
              setIsExpanded(false);
            }
          }}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          id={headerId}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
        >
          <div className="flex items-center gap-2">
            <CardTitle className={cn(styles.button, variant === 'minimal' && 'text-base')}>
              {title}
            </CardTitle>
            {description && variant === 'default' && (
              <Info className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {description && variant !== 'default' && (
              <span className="text-xs text-muted-foreground mr-2">{description}</span>
            )}
            <div className={cn(
              'p-1 rounded transition-transform duration-200',
              isExpanded ? 'rotate-180' : ''
            )}>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        {description && variant === 'default' && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
      </CardHeader>
      
      {isExpanded && (
        <div
          ref={contentRef}
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          aria-live="polite"
        >
          <CardContent className={styles.content}>
            {children}
          </CardContent>
        </div>
      )}
    </Card>
  );
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  initiallyCollapsed?: boolean;
  badge?: string | number;
  className?: string;
}

export function CollapsibleSection({
  title,
  children,
  initiallyCollapsed = false,
  badge,
  className
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <button
        className="w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors flex items-center justify-between text-left"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown 
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            !isCollapsed && 'rotate-180'
          )} 
        />
      </button>
      
      {!isCollapsed && (
        <div className="p-4 bg-background">
          {children}
        </div>
      )}
    </div>
  );
}

export default ProgressiveDisclosure;
