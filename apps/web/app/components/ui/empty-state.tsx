
import React from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { UnifiedButton } from "./unified-button";

interface EmptyStateProps {
  /**
   * Icon to display (emoji or component)
   */
  icon?: React.ReactNode;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Primary action button
   */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * EmptyState component for when there's no data to display
 * Based on wireframe section 7.6
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
}: EmptyStateProps) {
  const sizes = {
    sm: {
      wrapper: "py-8 px-4",
      icon: "text-3xl mb-2",
      title: "text-base font-medium",
      description: "text-sm",
    },
    md: {
      wrapper: "py-12 px-6",
      icon: "text-5xl mb-4",
      title: "text-lg font-semibold",
      description: "text-base",
    },
    lg: {
      wrapper: "py-16 px-8",
      icon: "text-6xl mb-6",
      title: "text-xl font-bold",
      description: "text-lg",
    },
  };

  const sizeStyles = sizes[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizeStyles.wrapper,
        className
      )}
    >
      {icon && (
        <div className={cn("text-muted-foreground", sizeStyles.icon)}>
          {icon}
        </div>
      )}
      <h3 className={cn("text-foreground", sizeStyles.title)}>{title}</h3>
      {description && (
        <p
          className={cn(
            "mt-2 max-w-md text-muted-foreground",
            sizeStyles.description
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <>
              {action.href ? (
                <Link to={action.href}>
                  <UnifiedButton variant="primary">
                    {action.label}
                  </UnifiedButton>
                </Link>
              ) : (
                <UnifiedButton variant="primary" onClick={action.onClick}>
                  {action.label}
                </UnifiedButton>
              )}
            </>
          )}
          {secondaryAction && (
            <>
              {secondaryAction.href ? (
                <Link to={secondaryAction.href}>
                  <UnifiedButton variant="outline">
                    {secondaryAction.label}
                  </UnifiedButton>
                </Link>
              ) : (
                <UnifiedButton variant="outline" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </UnifiedButton>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Preset empty states for common scenarios
 */
export const EmptyStatePresets = {
  /**
   * No search results
   */
  NoSearchResults: ({
    searchTerm,
    onClearFilters,
  }: {
    searchTerm?: string;
    onClearFilters?: () => void;
  }) => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="🔍"
      title={searchTerm ? t("common.noSearchResultsFor", { searchTerm }) : t("common.noResults")}
      description={t("common.tryAdjustingFilters")}
      action={
        onClearFilters
          ? { label: t("search.clearFilters"), onClick: onClearFilters }
          : undefined
      }
      secondaryAction={{ label: t("common.browseAll"), href: "/search" }}
    />
    );
  },

  /**
   * No bookings
   */
  NoBookings: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="📅"
      title={t("common.noBookingsYet")}
      description={t("common.startExploring")}
      action={{ label: t("common.browseListings"), href: "/search" }}
    />
    );
  },

  /**
   * No listings (for owners)
   */
  NoListings: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="📦"
      title={t("common.noListingsCreated")}
      description={t("common.shareAndEarn")}
      action={{ label: t("common.createFirstListing"), href: "/listings/new" }}
    />
    );
  },

  /**
   * No favorites
   */
  NoFavorites: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="❤️"
      title={t("common.noFavoritesYet")}
      description={t("common.saveFavorites")}
      action={{ label: t("common.exploreListings"), href: "/search" }}
    />
    );
  },

  /**
   * No messages
   */
  NoMessages: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="💬"
      title={t("common.noMessagesYet")}
      description={t("common.startConversation")}
      action={{ label: t("common.browseListings"), href: "/search" }}
    />
    );
  },

  /**
   * No reviews
   */
  NoReviews: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="⭐"
      title={t("common.noReviewsYet")}
      description={t("common.completeBookingForReview")}
    />
    );
  },

  /**
   * No notifications
   */
  NoNotifications: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="🔔"
      title={t("common.noNotifications")}
      description={t("common.allCaughtUp")}
      size="sm"
    />
    );
  },

  /**
   * No disputes
   */
  NoDisputes: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="✅"
      title={t("common.noDisputes")}
      description={t("common.allIssuesResolved")}
    />
    );
  },

  /**
   * No team members
   */
  NoTeamMembers: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="👥"
      title={t("common.noTeamMembersYet")}
      description={t("common.inviteTeamMembers")}
      action={{ label: t("common.inviteMember"), href: "#invite" }}
    />
    );
  },

  /**
   * No transactions
   */
  NoTransactions: () => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="💰"
      title={t("common.noTransactionsYet")}
      description={t("common.transactionHistoryHere")}
    />
    );
  },

  /**
   * Generic empty state
   */
  Generic: ({ title, description }: { title?: string; description?: string }) => {
    const { t } = useTranslation();
    return (
    <EmptyState
      icon="📭"
      title={title || t("common.nothingHereYet")}
      description={description || t("common.checkBackLater")}
    />
    );
  },
};
