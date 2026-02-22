import { AlertTriangle, Loader2, X } from 'lucide-react';
import { ModalAnimation, BackdropAnimation } from '~/components/animations';

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'error' | 'warning' | 'success';
    isLoading?: boolean;
    showIcon?: boolean;
}

const confirmColorClasses: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
    error: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90 focus:ring-warning',
    success: 'bg-success text-success-foreground hover:bg-success/90 focus:ring-success',
};

/**
 * ConfirmDialog Component
 * Reusable confirmation dialog with animations
 */
export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmColor = 'primary',
    isLoading = false,
    showIcon = true,
}: ConfirmDialogProps) {
    if (!open) return null;

    return (
        <>
            <BackdropAnimation isOpen={open} onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <ModalAnimation isOpen={open} variant="scale">
                    <div className="w-full max-w-md rounded-xl bg-background shadow-xl border">
                        {/* Title */}
                        <div className="flex items-center gap-2 border-b px-6 py-4">
                            {showIcon && confirmColor === 'error' && (
                                <AlertTriangle size={24} className="text-red-500" />
                            )}
                            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4">
                            <p className="text-muted-foreground">{message}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 border-t px-6 py-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="rounded-lg border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                            >
                                {cancelText}
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={isLoading}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${confirmColorClasses[confirmColor]}`}
                            >
                                {isLoading && <Loader2 size={16} className="animate-spin" />}
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </ModalAnimation>
            </div>
        </>
    );
}
