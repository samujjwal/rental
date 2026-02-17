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
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    error: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
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
                    <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
                        {/* Title */}
                        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
                            {showIcon && confirmColor === 'error' && (
                                <AlertTriangle size={24} className="text-red-500" />
                            )}
                            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4">
                            <p className="text-gray-600">{message}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
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
