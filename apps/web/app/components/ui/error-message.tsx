import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

/**
 * Enhanced error message component
 * Provides user-friendly error messages with retry options
 * Based on UX Improvement Guide recommendations
 */

interface ErrorMessageProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function ErrorMessage({
    title = "Something went wrong",
    message,
    onRetry,
    action,
    className = "",
}: ErrorMessageProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">{message}</p>
            <div className="flex gap-3">
                {onRetry && (
                    <Button onClick={onRetry} variant="outlined">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                )}
                {action && (
                    <Button onClick={action.onClick}>
                        {action.label}
                    </Button>
                )}
            </div>
        </div>
    );
}

/**
 * Inline error message for forms and small sections
 */
interface InlineErrorProps {
    message: string;
    className?: string;
}

export function InlineError({ message, className = "" }: InlineErrorProps) {
    return (
        <div className={`flex items-center gap-2 text-sm text-red-600 dark:text-red-400 ${className}`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{message}</span>
        </div>
    );
}
