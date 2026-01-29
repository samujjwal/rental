import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { Button } from "~/components/ui/button";
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

// ============================================================================
// Error Types
// ============================================================================

export interface AppError {
    id: string;
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
    timestamp: Date;
    context?: {
        component?: string;
        action?: string;
        userId?: string;
        sessionId?: string;
        url?: string;
        userAgent?: string;
        [key: string]: any;
    };
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
    retryable: boolean;
}

export interface ErrorBoundaryState {
    hasError: boolean;
    error: AppError | null;
    errorInfo: ErrorInfo | null;
    retryCount: number;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: React.ComponentType<{ error: AppError; retry: () => void }>;
    onError?: (error: AppError, errorInfo: ErrorInfo) => void;
    maxRetries?: number;
    showErrorDetails?: boolean;
    isolate?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const appError: AppError = {
            id: this.generateErrorId(),
            name: error.name,
            message: error.message,
            stack: error.stack,
            timestamp: new Date(),
            context: {
                component: errorInfo.componentStack,
                action: 'render',
                url: window.location.href,
                userAgent: navigator.userAgent,
            },
            severity: this.getErrorSeverity(error),
            recoverable: this.isRecoverable(error),
            retryable: this.isRetryable(error),
        };

        this.setState({
            error: appError,
            errorInfo,
        });

        // Report error
        this.reportError(appError, errorInfo);
        this.props.onError?.(appError, errorInfo);
    }

    componentWillUnmount() {
        // Clear any pending retry timeouts
        this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
        this.retryTimeouts.clear();
    }

    private generateErrorId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getErrorSeverity(error: Error): AppError['severity'] {
        if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
            return 'medium';
        }
        if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
            return 'high';
        }
        if (error.name === 'ReferenceError') {
            return 'critical';
        }
        return 'medium';
    }

    private isRecoverable(error: Error): boolean {
        const recoverableErrors = [
            'ChunkLoadError',
            'NetworkError',
            'TimeoutError',
        ];
        return recoverableErrors.includes(error.name) ||
            error.message.includes('Loading chunk') ||
            error.message.includes('Network error');
    }

    private isRetryable(error: Error): boolean {
        const retryableErrors = [
            'ChunkLoadError',
            'NetworkError',
            'TimeoutError',
        ];
        return retryableErrors.includes(error.name) ||
            error.message.includes('Loading chunk') ||
            error.message.includes('Failed to fetch');
    }

    private reportError(error: AppError, errorInfo: ErrorInfo) {
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error Boundary caught an error:', error, errorInfo);
        }

        // Send to error reporting service (if configured)
        if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && window.errorReporting) {
            window.errorReporting.captureException(error, {
                extra: errorInfo,
                tags: {
                    severity: error.severity,
                    recoverable: error.recoverable,
                    retryable: error.retryable,
                },
            });
        }

        // Store in local storage for debugging
        try {
            const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
            errors.push({
                ...error,
                timestamp: error.timestamp.toISOString(),
            });

            // Keep only last 50 errors
            if (errors.length > 50) {
                errors.splice(0, errors.length - 50);
            }

            localStorage.setItem('app_errors', JSON.stringify(errors));
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    private handleRetry = () => {
        const { error, retryCount } = this.state;
        const maxRetries = this.props.maxRetries || 3;

        if (retryCount >= maxRetries) {
            console.warn('Max retries reached');
            return;
        }

        if (error?.retryable) {
            // For chunk loading errors, try to reload the page
            if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
                window.location.reload();
                return;
            }

            // For other retryable errors, attempt to re-render
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
                retryCount: retryCount + 1,
            });
        }
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError && this.state.error) {
            const { error } = this.state;
            const { fallback: Fallback } = this.props;

            if (Fallback) {
                return <Fallback error={error} retry={this.handleRetry} />;
            }

            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>

                        <h1 className="text-xl font-semibold text-gray-900 mb-2">
                            Something went wrong
                        </h1>

                        <p className="text-gray-600 mb-6">
                            {error.recoverable
                                ? 'We encountered an error that can be recovered from. Please try again.'
                                : 'We encountered an unexpected error. Please refresh the page or contact support if the problem persists.'
                            }
                        </p>

                        {process.env.NODE_ENV === 'development' && this.props.showErrorDetails && (
                            <details className="mb-6">
                                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                                    Error Details
                                </summary>
                                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-40">
                                    <div className="mb-2">
                                        <strong>Error:</strong> {error.name}
                                    </div>
                                    <div className="mb-2">
                                        <strong>Message:</strong> {error.message}
                                    </div>
                                    {error.code && (
                                        <div className="mb-2">
                                            <strong>Code:</strong> {error.code}
                                        </div>
                                    )}
                                    <div className="mb-2">
                                        <strong>Severity:</strong> {error.severity}
                                    </div>
                                    <div className="mb-2">
                                        <strong>Recoverable:</strong> {error.recoverable ? 'Yes' : 'No'}
                                    </div>
                                    <div className="mb-2">
                                        <strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}
                                    </div>
                                    {error.stack && (
                                        <div className="mt-2 pt-2 border-t">
                                            <strong>Stack Trace:</strong>
                                            <pre className="whitespace-pre-wrap">{error.stack}</pre>
                                        </div>
                                    )}
                                </div>
                            </details>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            {error.retryable && (
                                <Button
                                    onClick={this.handleRetry}
                                    disabled={this.state.retryCount >= (this.props.maxRetries || 3)}
                                    className="flex items-center justify-center"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    {this.state.retryCount > 0 ? `Retry (${this.state.retryCount}/${this.props.maxRetries || 3})` : 'Retry'}
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                onClick={this.handleGoHome}
                                className="flex items-center justify-center"
                            >
                                <Home className="w-4 h-4 mr-2" />
                                Go Home
                            </Button>

                            {process.env.NODE_ENV === 'development' && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        console.log('Error details:', error);
                                        console.log('Error info:', this.state.errorInfo);
                                    }}
                                    className="flex items-center justify-center"
                                >
                                    <Bug className="w-4 h-4 mr-2" />
                                    Debug
                                </Button>
                            )}
                        </div>

                        {error.context?.component && (
                            <p className="text-xs text-gray-500 mt-4 text-center">
                                Error occurred in: {error.context.component}
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// ============================================================================
// Async Error Boundary
// ============================================================================

interface AsyncErrorBoundaryProps {
    children: ReactNode;
    fallback?: React.ComponentType<{ error: AppError; retry: () => void }>;
    onError?: (error: AppError) => void;
}

export function AsyncErrorBoundary({ children, fallback, onError }: AsyncErrorBoundaryProps) {
    return (
        <ErrorBoundary fallback={fallback} onError={onError}>
            <React.Suspense
                fallback={
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                }
            >
                {children}
            </React.Suspense>
        </ErrorBoundary>
    );
}

// ============================================================================
// Error Hook
// ============================================================================

interface UseErrorReturn {
    error: AppError | null;
    setError: (error: AppError | Error | string) => void;
    clearError: () => void;
    reportError: (error: AppError | Error | string, context?: any) => void;
}

export function useError(): UseErrorReturn {
    const [error, setErrorState] = useState<AppError | null>(null);

    const setError = (error: AppError | Error | string) => {
        let appError: AppError;

        if (typeof error === 'string') {
            appError = {
                id: Date.now().toString(),
                name: 'CustomError',
                message: error,
                timestamp: new Date(),
                severity: 'medium',
                recoverable: true,
                retryable: false,
            };
        } else if (error instanceof Error) {
            appError = {
                id: Date.now().toString(),
                name: error.name,
                message: error.message,
                stack: error.stack,
                timestamp: new Date(),
                severity: 'medium',
                recoverable: true,
                retryable: false,
            };
        } else {
            appError = error;
        }

        setErrorState(appError);
    };

    const clearError = () => {
        setErrorState(null);
    };

    const reportError = (error: AppError | Error | string, context?: any) => {
        let appError: AppError;

        if (typeof error === 'string') {
            appError = {
                id: Date.now().toString(),
                name: 'CustomError',
                message: error,
                timestamp: new Date(),
                context,
                severity: 'medium',
                recoverable: true,
                retryable: false,
            };
        } else if (error instanceof Error) {
            appError = {
                id: Date.now().toString(),
                name: error.name,
                message: error.message,
                stack: error.stack,
                timestamp: new Date(),
                context,
                severity: 'medium',
                recoverable: true,
                retryable: false,
            };
        } else {
            appError = { ...error, context: { ...error.context, ...context } };
        }

        // Report to error tracking service
        if (process.env.NODE_ENV === 'production' && window.errorReporting) {
            window.errorReporting.captureException(appError, {
                extra: appError.context,
            });
        }

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Reported error:', appError);
        }
    };

    return {
        error,
        setError,
        clearError,
        reportError,
    };
}

// ============================================================================
// Error Reporting Service
// ============================================================================

interface ErrorReportingConfig {
    dsn?: string;
    environment?: string;
    release?: string;
    userId?: string;
    beforeSend?: (event: any) => any;
    ignoreErrors?: (error: Error) => boolean;
}

class ErrorReportingService {
    private config: ErrorReportingConfig = {};
    private initialized = false;

    init(config: ErrorReportingConfig) {
        this.config = { ...this.config, ...config };
        this.initialized = true;

        // Set up global error handlers
        if (typeof window !== 'undefined') {
            window.addEventListener('error', this.handleGlobalError.bind(this));
            window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        }
    }

    private handleGlobalError = (event: ErrorEvent) => {
        const error: AppError = {
            id: Date.now().toString(),
            name: 'GlobalError',
            message: event.message,
            stack: event.error?.stack,
            timestamp: new Date(),
            context: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                url: window.location.href,
            },
            severity: 'high',
            recoverable: false,
            retryable: false,
        };

        this.captureException(error);
    };

    private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const error: AppError = {
            id: Date.now().toString(),
            name: 'UnhandledRejection',
            message: event.reason?.message || String(event.reason),
            stack: event.reason?.stack,
            timestamp: new Date(),
            context: {
                url: window.location.href,
            },
            severity: 'critical',
            recoverable: false,
            retryable: false,
        };

        this.captureException(error);
    };

    captureException(error: AppError | Error, context?: any) {
        if (!this.initialized) {
            console.warn('ErrorReporting not initialized');
            return;
        }

        // In a real implementation, this would send to Sentry, Bugsnag, etc.
        if (process.env.NODE_ENV === 'production') {
            // Send to error reporting service
            console.log('Error captured:', error, context);
        } else {
            console.error('Error captured:', error, context);
        }
    }

    captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
        if (!this.initialized) return;

        const error: AppError = {
            id: Date.now().toString(),
            name: 'Message',
            message,
            timestamp: new Date(),
            context: { level },
            severity: level === 'error' ? 'high' : 'low',
            recoverable: true,
            retryable: false,
        };

        this.captureException(error);
    }

    setUser(user: { id: string; email?: string; name?: string }) {
        this.config.userId = user.id;
    }

    clearUser() {
        delete this.config.userId;
    }
}

export const errorReporting = new ErrorReportingService();

// ============================================================================
// Development Error Overlay
// ============================================================================

export function DevErrorOverlay() {
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    const [errors, setErrors] = useState<AppError[]>([]);

    useEffect(() => {
        // Load errors from localStorage
        try {
            const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
            setErrors(storedErrors.slice(-10)); // Show last 10 errors
        } catch (e) {
            // Ignore
        }

        // Listen for storage changes
        const handleStorageChange = () => {
            try {
                const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
                setErrors(storedErrors.slice(-10));
            } catch (e) {
                // Ignore
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    if (errors.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 bg-red-900 text-white p-4 rounded-lg shadow-lg max-w-md max-h-96 overflow-auto">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Development Errors</h3>
                <button
                    onClick={() => localStorage.removeItem('app_errors')}
                    className="text-xs bg-red-800 px-2 py-1 rounded"
                >
                    Clear
                </button>
            </div>
            <div className="space-y-2">
                {errors.map((error) => (
                    <div key={error.id} className="text-xs border-l-2 border-red-400 pl-2">
                        <div className="font-medium">{error.name}</div>
                        <div className="text-gray-300">{error.message}</div>
                        <div className="text-gray-400">
                            {error.timestamp.toLocaleTimeString()} - {error.severity}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Extend window interface for error reporting
declare global {
    interface Window {
        errorReporting: ErrorReportingService;
    }
}
