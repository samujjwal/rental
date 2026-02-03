import { toast as sonnerToast } from "sonner";

/**
 * Enhanced toast notification utilities
 * Provides consistent toast notifications with better UX
 */

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
    });
  },

  error: (
    message: string,
    description?: string,
    action?: { label: string; onClick: () => void }
  ) => {
    sonnerToast.error(message, {
      description,
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
    });
  },

  info: (
    message: string,
    description?: string,
    action?: { label: string; onClick: () => void }
  ) => {
    sonnerToast.info(message, {
      description,
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
    });
  },

  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
    });
  },

  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
    });
  },

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },
};
