
import React from "react";
import { Link, isRouteErrorResponse, useRouteError, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { UnifiedButton } from "./unified-button";

interface ErrorStateProps {
  /**
   * Error title
   */
  title?: string;
  /**
   * Error message/description
   */
  message?: string;
  /**
   * Error code (e.g., 404, 500)
   */
  code?: string | number;
  /**
   * Icon to display
   */
  icon?: React.ReactNode;
  /**
   * Retry callback
   */
  onRetry?: () => void;
  /**
   * Show home button
   */
  showHomeButton?: boolean;
  /**
   * Additional class names
   */
  className?: string;
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show stack trace in development
   */
  error?: Error;
  /**
   * Custom action buttons
   */
  children?: React.ReactNode;
}

/**
 * ErrorState component for displaying errors
 * Based on wireframe section 9.1
 */
export function ErrorState({
  title,
  message,
  code,
  icon,
  onRetry,
  showHomeButton = true,
  className,
  size = "md",
  error,
  children,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const sizes = {
    sm: {
      wrapper: "py-8 px-4",
      code: "text-4xl font-bold",
      icon: "text-3xl mb-2",
      title: "text-base font-medium",
      message: "text-sm",
    },
    md: {
      wrapper: "py-12 px-6",
      code: "text-6xl font-bold",
      icon: "text-5xl mb-4",
      title: "text-lg font-semibold",
      message: "text-base",
    },
    lg: {
      wrapper: "py-16 px-8",
      code: "text-8xl font-bold",
      icon: "text-6xl mb-6",
      title: "text-xl font-bold",
      message: "text-lg",
    },
  };

  const sizeStyles = sizes[size];
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizeStyles.wrapper,
        className
      )}
    >
      {code && (
        <div className={cn("text-muted-foreground/30", sizeStyles.code)}>
          {code}
        </div>
      )}
      {icon && !code && (
        <div className={cn("text-muted-foreground", sizeStyles.icon)}>
          {icon}
        </div>
      )}
      <h3 className={cn("mt-4 text-foreground", sizeStyles.title)}>
        {title || t("errors.somethingWentWrong")}
      </h3>
      {message && (
        <p
          className={cn(
            "mt-2 max-w-md text-muted-foreground",
            sizeStyles.message
          )}
        >
          {message}
        </p>
      )}

      {(onRetry || showHomeButton || children) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <UnifiedButton variant="primary" onClick={onRetry}>
              {t("errors.tryAgain")}
            </UnifiedButton>
          )}
          {showHomeButton && (
            <Link to="/">
              <UnifiedButton variant="outline">
                {t("errors.goToHome")}
              </UnifiedButton>
            </Link>
          )}
          {children}
        </div>
      )}

      {/* Development-only error details */}
      {isDev && error && (
        <details className="mt-8 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Error Details (dev only)
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-xs">
            <code>{error.stack || error.message}</code>
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Preset error states for common scenarios
 */
export const ErrorStatePresets = {
  /**
   * 404 Not Found
   */
  NotFound: ({ message }: { message?: string } = {}) => {
    const { t } = useTranslation();
    return (
    <ErrorState
      code={404}
      title={t("errors.pageNotFound")}
      message={message || t("errors.pageNotFoundDesc")}
    />
    );
  },

  /**
   * 500 Server Error
   */
  ServerError: ({ onRetry }: { onRetry?: () => void } = {}) => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="⚠️"
      title={t("errors.somethingWentWrong")}
      message={t("errors.workingOnIt")}
      onRetry={onRetry}
    />
    );
  },

  /**
   * 401 Unauthorized
   */
  Unauthorized: () => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="🔒"
      title={t("errors.accessDenied")}
      message={t("errors.noPermission")}
      showHomeButton
    />
    );
  },

  /**
   * 403 Forbidden
   */
  Forbidden: () => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="🚫"
      title={t("errors.accessForbidden")}
      message={t("errors.noPermissionAction")}
      showHomeButton
    />
    );
  },

  /**
   * Session Expired
   */
  SessionExpired: () => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="🔒"
      title={t("errors.sessionExpired")}
      message={t("errors.sessionExpiredMessage")}
      showHomeButton={false}
    >
      <Link to="/auth/login">
        <UnifiedButton variant="primary" className="mt-6">
          {t("nav.login")}
        </UnifiedButton>
      </Link>
    </ErrorState>
    );
  },

  /**
   * Network Error
   */
  NetworkError: ({ onRetry }: { onRetry?: () => void } = {}) => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="📡"
      title={t("errors.connectionError")}
      message={t("errors.checkConnection")}
      onRetry={onRetry}
    />
    );
  },

  /**
   * Listing Not Available
   */
  ListingNotAvailable: () => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="ℹ️"
      title={t("errors.listingNotAvailable")}
      message={t("errors.listingRemovedOrPaused")}
      showHomeButton={false}
    >
      <Link to="/search">
        <UnifiedButton variant="primary" className="mt-6">
          {t("errors.browseSimilar")}
        </UnifiedButton>
      </Link>
    </ErrorState>
    );
  },

  /**
   * Payment Failed
   */
  PaymentFailed: ({ onRetry }: { onRetry?: () => void } = {}) => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="❌"
      title={t("errors.paymentFailed")}
      message={t("errors.cardDeclined")}
      onRetry={onRetry}
    />
    );
  },

  /**
   * Dates Unavailable
   */
  DatesUnavailable: () => {
    const { t } = useTranslation();
    return (
    <ErrorState
      icon="⚠️"
      title={t("errors.datesUnavailable")}
      message={t("errors.datesJustBooked")}
      showHomeButton={false}
    />
    );
  },
};

// Extend ErrorState to accept children
interface ErrorStateWithChildrenProps extends ErrorStateProps {
  children?: React.ReactNode;
}

function ErrorStateWithChildren({
  children,
  ...props
}: ErrorStateWithChildrenProps) {
  return (
    <div>
      <ErrorState {...props} />
      {children}
    </div>
  );
}

// Re-export with children support
export { ErrorStateWithChildren };

/**
 * Route Error Boundary component
 * Use as export function ErrorBoundary() in route files
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const { t } = useTranslation();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          code={error.status}
          title={
            error.status === 404
              ? t("errors.pageNotFound")
              : error.status === 401
                ? t("errors.unauthorized")
                : error.status === 403
                  ? t("errors.accessForbidden")
                  : t("errors.somethingWentWrong")
          }
          message={
            error.statusText ||
            (error.status === 404
              ? t("errors.pageNotFoundDesc")
              : t("errors.anErrorOccurred"))
          }
        />
      </div>
    );
  }

  // Handle non-route errors
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const errorInstance = error instanceof Error ? error : undefined;

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <ErrorState
        icon="⚠️"
        title={t("errors.somethingWentWrong")}
        message={errorMessage}
        onRetry={() => revalidator.revalidate()}
        error={errorInstance}
      />
    </div>
  );
}
