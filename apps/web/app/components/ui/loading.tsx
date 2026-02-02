import React from "react";
import { cn } from "~/lib/utils";

interface SpinnerProps {
  /**
   * Size of the spinner
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Color variant
   */
  variant?: "default" | "primary" | "white";
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Loading spinner component
 * Based on wireframe section 7.7
 */
export function Spinner({ size = "md", variant = "default", className }: SpinnerProps) {
  const sizes = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  };

  const variants = {
    default: "text-muted-foreground",
    primary: "text-primary",
    white: "text-white",
  };

  return (
    <svg
      className={cn(
        "animate-spin",
        sizes[size],
        variants[variant],
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface LoadingProps {
  /**
   * Loading message
   */
  message?: string;
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Full screen loading
   */
  fullScreen?: boolean;
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Loading component with message
 */
export function Loading({
  message = "Loading...",
  size = "md",
  fullScreen = false,
  className,
}: LoadingProps) {
  const sizes = {
    sm: {
      spinner: "sm" as const,
      text: "text-sm",
      padding: "py-4",
    },
    md: {
      spinner: "md" as const,
      text: "text-base",
      padding: "py-8",
    },
    lg: {
      spinner: "lg" as const,
      text: "text-lg",
      padding: "py-12",
    },
  };

  const sizeStyles = sizes[size];

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        sizeStyles.padding,
        className
      )}
    >
      <Spinner size={sizeStyles.spinner} variant="primary" />
      {message && (
        <p className={cn("text-muted-foreground", sizeStyles.text)}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * Inline loading for buttons and small areas
 */
export function InlineLoading({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Spinner size={size} />
    </span>
  );
}

/**
 * Page-level loading state
 */
export function PageLoading({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loading size="lg" message={message} />
    </div>
  );
}

/**
 * Overlay loading for forms/modals
 */
export function LoadingOverlay({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <Loading message={message} />
    </div>
  );
}

/**
 * Button loading state (for use inside buttons)
 */
export function ButtonLoading({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <span className="flex items-center gap-2">
        <Spinner size="sm" variant="white" />
        <span>Loading...</span>
      </span>
    );
  }
  return <>{children}</>;
}
