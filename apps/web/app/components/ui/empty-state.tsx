/* eslint-disable react-refresh/only-export-components */

import React from "react";
import { Link } from "react-router";
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
  }) => (
    <EmptyState
      icon="🔍"
      title={searchTerm ? `No results found for "${searchTerm}"` : "No results found"}
      description="Try adjusting your search or filters to find what you're looking for."
      action={
        onClearFilters
          ? { label: "Clear Filters", onClick: onClearFilters }
          : undefined
      }
      secondaryAction={{ label: "Browse All", href: "/search" }}
    />
  ),

  /**
   * No bookings
   */
  NoBookings: () => (
    <EmptyState
      icon="📅"
      title="You have no bookings yet"
      description="Start exploring items to rent!"
      action={{ label: "Browse Listings", href: "/search" }}
    />
  ),

  /**
   * No listings (for owners)
   */
  NoListings: () => (
    <EmptyState
      icon="📦"
      title="You haven't created any listings"
      description="Share your items and start earning!"
      action={{ label: "Create Your First Listing", href: "/listings/new" }}
    />
  ),

  /**
   * No favorites
   */
  NoFavorites: () => (
    <EmptyState
      icon="❤️"
      title="No favorites yet"
      description="Save items you love to easily find them later."
      action={{ label: "Explore Listings", href: "/search" }}
    />
  ),

  /**
   * No messages
   */
  NoMessages: () => (
    <EmptyState
      icon="💬"
      title="No messages yet"
      description="Start a conversation with a host or renter."
      action={{ label: "Browse Listings", href: "/search" }}
    />
  ),

  /**
   * No reviews
   */
  NoReviews: () => (
    <EmptyState
      icon="⭐"
      title="No reviews yet"
      description="Complete a booking to leave your first review."
    />
  ),

  /**
   * No notifications
   */
  NoNotifications: () => (
    <EmptyState
      icon="🔔"
      title="No notifications"
      description="You're all caught up!"
      size="sm"
    />
  ),

  /**
   * No disputes
   */
  NoDisputes: () => (
    <EmptyState
      icon="✅"
      title="No disputes"
      description="All issues have been resolved."
    />
  ),

  /**
   * No team members
   */
  NoTeamMembers: () => (
    <EmptyState
      icon="👥"
      title="No team members yet"
      description="Invite team members to help manage your organization."
      action={{ label: "Invite Member", href: "#invite" }}
    />
  ),

  /**
   * No transactions
   */
  NoTransactions: () => (
    <EmptyState
      icon="💰"
      title="No transactions yet"
      description="Your transaction history will appear here."
    />
  ),

  /**
   * Generic empty state
   */
  Generic: ({ title, description }: { title?: string; description?: string }) => (
    <EmptyState
      icon="📭"
      title={title || "Nothing here yet"}
      description={description || "Check back later for updates."}
    />
  ),
};
