import React from "react";
import { cn } from "~/lib/utils";

interface ToastProps {
  /**
   * Toast type/variant
   */
  type: "success" | "error" | "warning" | "info";
  /**
   * Toast message
   */
  message: string;
  /**
   * Action button
   */
  action?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Dismiss callback
   */
  onDismiss?: () => void;
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Toast notification component
 * Based on wireframe section 7.5
 */
export function Toast({
  type,
  message,
  action,
  onDismiss,
  className,
}: ToastProps) {
  const variants = {
    success: {
      bg: "bg-green-50 border-green-200",
      icon: "✅",
      iconColor: "text-green-600",
      text: "text-green-800",
    },
    error: {
      bg: "bg-red-50 border-red-200",
      icon: "❌",
      iconColor: "text-red-600",
      text: "text-red-800",
    },
    warning: {
      bg: "bg-yellow-50 border-yellow-200",
      icon: "⚠️",
      iconColor: "text-yellow-600",
      text: "text-yellow-800",
    },
    info: {
      bg: "bg-blue-50 border-blue-200",
      icon: "ℹ️",
      iconColor: "text-blue-600",
      text: "text-blue-800",
    },
  };

  const variant = variants[type];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg",
        variant.bg,
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <span className={cn("text-lg", variant.iconColor)}>{variant.icon}</span>
      <p className={cn("flex-1 text-sm font-medium", variant.text)}>{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "text-sm font-semibold underline hover:no-underline",
            variant.text
          )}
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn("text-lg opacity-50 hover:opacity-100", variant.text)}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Toast container for positioning
 */
export function ToastContainer({
  children,
  position = "bottom-right",
  className,
}: {
  children: React.ReactNode;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
  className?: string;
}) {
  const positions = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  };

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col gap-2",
        positions[position],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Inline alert component (non-dismissible)
 */
export function Alert({
  type,
  message,
  title,
  className,
  children,
}: {
  type: "success" | "error" | "warning" | "info";
  message: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const variants = {
    success: {
      bg: "bg-green-50 border-green-200",
      icon: "✅",
      title: "text-green-800",
      text: "text-green-700",
    },
    error: {
      bg: "bg-red-50 border-red-200",
      icon: "❌",
      title: "text-red-800",
      text: "text-red-700",
    },
    warning: {
      bg: "bg-yellow-50 border-yellow-200",
      icon: "⚠️",
      title: "text-yellow-800",
      text: "text-yellow-700",
    },
    info: {
      bg: "bg-blue-50 border-blue-200",
      icon: "ℹ️",
      title: "text-blue-800",
      text: "text-blue-700",
    },
  };

  const variant = variants[type];

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        variant.bg,
        className
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <span className="text-lg">{variant.icon}</span>
        <div className="flex-1">
          {title && (
            <h4 className={cn("font-semibold", variant.title)}>{title}</h4>
          )}
          <p className={cn("text-sm", variant.text)}>{message}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Form error alert
 */
export function FormError({
  errors,
  className,
}: {
  errors: Record<string, string | string[] | undefined>;
  className?: string;
}) {
  const errorList = Object.entries(errors)
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      field: key,
      message: Array.isArray(value) ? value.join(", ") : value,
    }));

  if (errorList.length === 0) return null;

  return (
    <Alert
      type="error"
      title="Please fix the following errors:"
      message=""
      className={className}
    >
      <ul className="mt-2 list-inside list-disc text-sm text-red-700">
        {errorList.map(({ field, message }) => (
          <li key={field}>{message}</li>
        ))}
      </ul>
    </Alert>
  );
}
