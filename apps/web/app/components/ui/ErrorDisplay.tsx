import React from 'react';
import { AlertCircle, AlertTriangle, Info, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '~/lib/utils';
import { UnifiedButton } from './unified-button';
import type { AppError, ErrorSeverity } from '~/hooks/useErrorHandler';

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * P2.4: Consistent error UI component
 * Displays errors with appropriate severity styling and actions
 */
export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className,
  compact = false,
}: ErrorDisplayProps) {
  const config = getSeverityConfig(error.severity);

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        config.containerClass,
        compact && 'p-3',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0', config.iconClass)}>
          {config.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
                {config.title}
              </h3>
              <p className={cn('mt-1 text-sm', config.textClass)}>
                {error.message}
              </p>
              
              {!compact && error.context?.component && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Component: {error.context.component}
                  {error.context.action && ` • Action: ${error.context.action}`}
                </p>
              )}
            </div>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss error"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {(onRetry && error.retryable) && (
            <div className="mt-3 flex gap-2">
              <UnifiedButton
                variant="outline"
                size="sm"
                onClick={onRetry}
                className={config.buttonClass}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </UnifiedButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ErrorListProps {
  errors: AppError[];
  onRetry?: (errorId: string) => void;
  onDismiss?: (errorId: string) => void;
  maxVisible?: number;
  className?: string;
}

/**
 * P2.4: Display multiple errors in a list
 */
export function ErrorList({
  errors,
  onRetry,
  onDismiss,
  maxVisible = 3,
  className,
}: ErrorListProps) {
  const visibleErrors = errors.slice(0, maxVisible);
  const hiddenCount = errors.length - maxVisible;

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)} role="region" aria-label="Error messages">
      {visibleErrors.map((error) => (
        <ErrorDisplay
          key={error.id}
          error={error}
          onRetry={onRetry ? () => onRetry(error.id) : undefined}
          onDismiss={onDismiss ? () => onDismiss(error.id) : undefined}
          compact
        />
      ))}
      
      {hiddenCount > 0 && (
        <div className="text-sm text-muted-foreground text-center py-2">
          +{hiddenCount} more error{hiddenCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

interface ErrorBannerProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  position?: 'top' | 'bottom';
}

/**
 * P2.4: Full-width error banner for critical errors
 */
export function ErrorBanner({
  error,
  onRetry,
  onDismiss,
  position = 'top',
}: ErrorBannerProps) {
  const config = getSeverityConfig(error.severity);

  return (
    <div
      className={cn(
        'w-full border-l-4 p-4',
        config.containerClass,
        config.borderClass,
        position === 'top' && 'border-t',
        position === 'bottom' && 'border-b'
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={config.iconClass}>
            {config.icon}
          </div>
          <div>
            <p className="font-semibold">{config.title}</p>
            <p className={cn('text-sm', config.textClass)}>{error.message}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onRetry && error.retryable && (
            <UnifiedButton
              variant="outline"
              size="sm"
              onClick={onRetry}
              className={config.buttonClass}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </UnifiedButton>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface InlineErrorProps {
  message: string;
  severity?: ErrorSeverity;
  className?: string;
}

/**
 * P2.4: Inline error for form fields
 */
export function InlineError({
  message,
  severity = 'error',
  className,
}: InlineErrorProps) {
  const config = getSeverityConfig(severity);

  return (
    <div
      className={cn('flex items-center gap-2 text-sm', config.textClass, className)}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Get configuration for error severity
 */
function getSeverityConfig(severity: ErrorSeverity) {
  const configs = {
    critical: {
      title: 'Critical Error',
      icon: <XCircle className="w-5 h-5" />,
      containerClass: 'bg-destructive/10 border-destructive/20',
      borderClass: 'border-l-destructive',
      iconClass: 'text-destructive',
      textClass: 'text-destructive-foreground',
      buttonClass: 'border-destructive text-destructive hover:bg-destructive/10',
    },
    error: {
      title: 'Error',
      icon: <AlertCircle className="w-5 h-5" />,
      containerClass: 'bg-destructive/10 border-destructive/20',
      borderClass: 'border-l-destructive',
      iconClass: 'text-destructive',
      textClass: 'text-destructive-foreground',
      buttonClass: 'border-destructive text-destructive hover:bg-destructive/10',
    },
    warning: {
      title: 'Warning',
      icon: <AlertTriangle className="w-5 h-5" />,
      containerClass: 'bg-warning/10 border-warning/20',
      borderClass: 'border-l-warning',
      iconClass: 'text-warning',
      textClass: 'text-warning-foreground',
      buttonClass: 'border-warning text-warning hover:bg-warning/10',
    },
    info: {
      title: 'Information',
      icon: <Info className="w-5 h-5" />,
      containerClass: 'bg-info/10 border-info/20',
      borderClass: 'border-l-info',
      iconClass: 'text-info',
      textClass: 'text-info-foreground',
      buttonClass: 'border-info text-info hover:bg-info/10',
    },
  };

  return configs[severity];
}
