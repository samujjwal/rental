import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    CircularProgress,
} from '@mui/material';
import { AlertTriangle } from 'lucide-react';
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
    return (
        <>
            <BackdropAnimation isOpen={open} onClick={onClose} />
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        m: 0,
                    },
                }}
            >
                <ModalAnimation isOpen={open} variant="scale">
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {showIcon && confirmColor === 'error' && (
                            <AlertTriangle size={24} color="error" />
                        )}
                        {title}
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1">{message}</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onClose} disabled={isLoading}>
                            {cancelText}
                        </Button>
                        <Button
                            onClick={onConfirm}
                            color={confirmColor}
                            variant="contained"
                            disabled={isLoading}
                            startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                        >
                            {confirmText}
                        </Button>
                    </DialogActions>
                </ModalAnimation>
            </Dialog>
        </>
    );
}
