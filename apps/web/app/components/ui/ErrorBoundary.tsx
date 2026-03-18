import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showRetry?: boolean;
  showHome?: boolean;
  showReport?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

const createErrorId = (): string =>
  `err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: createErrorId()
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: createErrorId()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: createErrorId()
      });
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReportBug = () => {
    const { error, errorInfo, errorId } = this.state;
    const subject = encodeURIComponent(`Bug Report - ${errorId}`);
    const body = encodeURIComponent(
      `Error ID: ${errorId}\n\n` +
      `Error: ${error?.message}\n\n` +
      `Stack Trace:\n${error?.stack}\n\n` +
      `Component Stack:\n${errorInfo?.componentStack}\n\n` +
      `User Agent: ${navigator.userAgent}\n\n` +
      `URL: ${window.location.href}`
    );
    window.open(`mailto:support@gharbatai.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          onRetry={this.props.showRetry ? this.handleRetry : undefined}
          onGoHome={this.props.showHome ? this.handleGoHome : undefined}
          onReportBug={this.props.showReport ? this.handleReportBug : undefined}
          retryCount={this.retryCount}
          maxRetries={this.maxRetries}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorId: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  onReportBug?: () => void;
  retryCount: number;
  maxRetries: number;
}

function ErrorFallback({
  error,
  errorId,
  onRetry,
  onGoHome,
  onReportBug,
  retryCount,
  maxRetries
}: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {t('error.somethingWentWrong', 'Something went wrong')}
          </h1>
          <p className="text-muted-foreground">
            {t('error.unexpectedError', 'An unexpected error occurred. We apologize for the inconvenience.')}
          </p>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {t('error.errorDetails', 'Error Details')}
              </span>
              <span className="text-xs text-muted-foreground">{errorId}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono break-all">
              {error.message}
            </div>
            {error.stack && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  {t('error.stackTrace', 'Stack Trace')}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {onRetry && retryCount < maxRetries && (
            <button
              onClick={onRetry}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <RefreshCw className="w-4 h-4" />
              {t('error.retry', 'Try Again')}
              {retryCount > 0 && ` (${retryCount}/${maxRetries})`}
            </button>
          )}

          {onGoHome && (
            <button
              onClick={onGoHome}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors',
                'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              <Home className="w-4 h-4" />
              {t('error.goHome', 'Go Home')}
            </button>
          )}

          {onReportBug && (
            <button
              onClick={onReportBug}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors',
                'border border-input bg-background hover:bg-muted text-foreground'
              )}
            >
              <Bug className="w-4 h-4" />
              {t('error.reportBug', 'Report Bug')}
            </button>
          )}
        </div>

        {/* Retry Exhausted Message */}
        {retryCount >= maxRetries && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {t('error.retryExhausted', 'Maximum retry attempts reached. Please try again later or contact support.')}
            </p>
          </div>
        )}

        {/* Error ID */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {t('error.errorId', 'Error ID')}: {errorId}
          </p>
        </div>
      </div>
    </div>
  );
}

// Hook for functional components to handle errors
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, context?: string) => {
    console.error('Error handled by useErrorHandler:', error, context);
    
    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { tags: { context } });
    }
  }, []);

  return { handleError };
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
